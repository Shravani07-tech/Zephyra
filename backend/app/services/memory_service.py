import logging
import asyncio
from typing import Any
from sqlalchemy.orm import Session
from sqlalchemy import select
from pydantic import BaseModel, Field
import json

from app.models import Memory
from app.files.store import get_vector_store
from app.services.llm import get_llm_provider
from app.services.memory_rules import is_sensitive, normalize_category
from app.config import get_settings

logger = logging.getLogger(__name__)

class ExtractionResult(BaseModel):
    should_remember: bool = Field(description="Whether this information is worth remembering long-term.")
    category: str = Field(description="Category of memory: PREFERENCE, PROJECT, GOAL, ROUTINE, CONSTRAINT, PERSONAL_FACT, IMPORTANT_CONTEXT, or NONE")
    content: str = Field(description="The factual content to remember, clearly stated.")
    confidence: float = Field(description="Confidence from 0.0 to 1.0")


class MemoryService:
    def __init__(self, db: Session):
        self.db = db
        self.store = get_vector_store()
        self.settings = get_settings()

    def create_memory(
        self,
        content: str,
        category: str,
        conversation_id: str | None = None,
        user_id: str | None = None,
    ) -> Memory:
        """Create a new active memory."""
        # Check for semantic duplicates first
        existing = self.search_memories(content, user_id=user_id, n_results=1, threshold=0.85)
        
        # We need a conflict/update strategy. For simplicity, if very similar, we deactivate the old one
        # and create the new one, representing an "update".
        if existing:
            old_mem = self.get_memory(existing[0]["metadata"]["memory_id"])
            if old_mem:
                self.delete_memory(old_mem.id)

        mem = Memory(
            content=content,
            category=category,
            conversation_id=conversation_id,
            user_id=user_id,
            active=True,
        )
        self.db.add(mem)
        self.db.commit()
        self.db.refresh(mem)

        # Add to Chroma
        self.store.add_memory(
            memory_id=mem.id,
            content=mem.content,
            metadata={
                "category": mem.category,
                "user_id": user_id or "default",
                "conversation_id": conversation_id or "default",
                "active": mem.active
            }
        )
        return mem

    def get_memory(self, memory_id: str) -> Memory | None:
        return self.db.scalar(select(Memory).where(Memory.id == memory_id))

    def delete_memory(self, memory_id: str) -> bool:
        """Deactivate memory and remove from index."""
        mem = self.get_memory(memory_id)
        if not mem:
            return False
            
        mem.active = False
        self.db.commit()
        
        try:
            self.store.delete_memory(memory_id)
        except Exception as e:
            logger.warning(f"Failed to delete memory {memory_id} from Chroma: {e}")
            
        return True

    def search_memories(self, query: str, user_id: str | None = None, n_results: int = 3, threshold: float = 1.0) -> list[dict]:
        """Search active memories."""
        results = self.store.search_memories(query, n_results=n_results, user_id=user_id or "default")
        
        valid_results = []
        for r in results:
            if r.get("distance", 0.0) <= threshold: # lower distance is better in Chroma usually (L2) or cosine
                # Verify in SQLite to ensure it's still active
                mem_id = r["metadata"]["memory_id"]
                mem = self.get_memory(mem_id)
                if mem and mem.active:
                    r["created_at"] = mem.created_at.timestamp()
                    valid_results.append(r)
        
        valid_results.sort(key=lambda x: x.get("created_at", 0), reverse=True)
        return valid_results

    async def extract_memory_candidates(self, text: str, conversation_id: str | None = None, user_id: str | None = None) -> None:
        """Run implicit memory extraction in the background."""
        # Special-category data is never stored implicitly, whatever the model says.
        if is_sensitive(text):
            logger.info("Skipping implicit memory extraction: sensitive content")
            return
        llm = get_llm_provider(self.settings.llm_provider)
        
        system_prompt = """You are a Memory Extraction Assistant.
Analyze the user's message and determine if it contains durable, long-term information worth remembering.

DO NOT STORE:
- General knowledge questions (e.g. "What is binary search?", "Explain recursion")
- Transient state or emotions (e.g. "I'm tired", "My build is failing right now")
- Ordinary code/debugging context
- Sensitive personal data: health or medical details, religion, political views,
  sexual orientation or sex life, criminal history, finances, or credentials

DO STORE:
- User preferences (e.g. "I prefer Python")
- Projects, goals, routines (e.g. "My project is ZEphyra")
- Personal facts

CRITICAL RULES FOR EXTRACTION:
- Extract ONLY the precise fact.
- Do NOT write conversational replies, acknowledgments, or conversational framing inside the JSON fields.
- Write the extracted fact from a third-person perspective (e.g. "User's favorite color is crimson red").

Return structured JSON matching the requested schema. If nothing should be remembered, set should_remember to false.
"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": text}
        ]

        try:
            # We want structured output. We can ask LLM for JSON.
            # Assuming llm provider supports JSON format if we prompt it.
            messages[0]["content"] += "\n\nRespond ONLY with a valid JSON object in this exact format:\n{\"should_remember\": true|false, \"category\": \"CATEGORY_NAME_OR_NONE\", \"content\": \"the extracted fact or empty string\", \"confidence\": 0.0_to_1.0}"
            
            # Simple async wrapper or just sync call in a thread
            # To be safe, we'll do synchronous for now, as provider generate_response might be sync
            # We are currently in an async task, but standard llm provider is a sync generator
            response_text = ""
            async for chunk in llm.stream_chat(messages):
                response_text += chunk
            
            # Parse JSON
            # try to strip markdown code blocks
            clean_json = response_text.replace("```json", "").replace("```", "").strip()
            data = json.loads(clean_json)
            if not isinstance(data, dict):
                return
            # Small models misspell the flag ("should_reremember"); accept any
            # "should_*" key rather than silently dropping every extraction.
            if "should_remember" not in data:
                flag = next((k for k in data if str(k).startswith("should_")), None)
                data["should_remember"] = bool(data.get(flag)) if flag else False

            result = ExtractionResult(**data)
            
            category = normalize_category(result.category)
            content = result.content.strip()
            if (
                result.should_remember
                and category is not None
                and content
                and result.confidence > 0.7
                and not is_sensitive(content)
            ):
                logger.info("Implicit memory extracted (%s)", category)
                self.create_memory(
                    content=content,
                    category=category,
                    conversation_id=conversation_id,
                    user_id=user_id,
                )
                
        except Exception as e:
            logger.error(f"Memory extraction failed: {e}")

    def rebuild_memory_index(self):
        """Rebuild the Chroma memory index from SQLite."""
        # Since Chroma collection might not have clear 'drop', we can just fetch all active and re-add
        # For a true rebuild, we'd need to clear the collection first.
        try:
            self.store.client.delete_collection("zephyra_memories")
            self.store.memory_collection = self.store.client.get_or_create_collection(
                name="zephyra_memories",
                embedding_function=self.store.embedding_fn,
            )
        except Exception:
            pass
            
        memories = self.db.scalars(select(Memory).where(Memory.active == True)).all()
        for mem in memories:
            self.store.add_memory(
                memory_id=mem.id,
                content=mem.content,
                metadata={
                    "category": mem.category,
                    "user_id": mem.user_id or "default",
                    "conversation_id": mem.conversation_id or "default",
                    "active": mem.active
                }
            )
