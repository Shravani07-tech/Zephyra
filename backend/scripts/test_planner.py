"""Manual test script to verify planner and task capabilities end-to-end."""

import asyncio
import json
import logging
from sqlalchemy.orm import sessionmaker

from app.db import engine, Base
from app.agent.runner import run_turn
from app.services.llm import get_llm_provider
from app.services.conversation import create_conversation

# Setup logging to be clean for manual test output
logging.basicConfig(level=logging.ERROR)
logger = logging.getLogger(__name__)

async def run_scenario(session, conversation_id, llm_service, user_input, description):
    print(f"\n=======================================")
    print(f"SCENARIO: {description}")
    print(f"User    : {user_input}")
    print(f"=======================================")
    print("Agent   : ", end="", flush=True)
    
    try:
        async for chunk in run_turn(
            db=session,
            conversation_id=conversation_id,
            user_text=user_input,
            llm_service=llm_service,
        ):
            print(chunk, end="", flush=True)
        print("\n")
    except Exception as e:
        print(f"\n[ERROR] {str(e)}\n")


async def main():
    print("Setting up test database...")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    llm_service = get_llm_provider()
    
    with SessionLocal() as db:
        conv = create_conversation(db)
        conv_id = conv.id
        
        print(f"Started Conversation: {conv_id}\n")
        
        scenarios = [
            (
                "Create a task to buy groceries.",
                "1. Creating a task"
            ),
            (
                "List my tasks.",
                "2. Listing tasks"
            ),
            (
                "Mark the groceries task as completed.",
                "3. Marking a task completed"
            ),
            (
                "Change the priority of the groceries task to URGENT.",
                "4. Updating a task"
            ),
            (
                "Delete the groceries task.",
                "5. Deleting a task"
            ),
            (
                "Update task priority.",
                "6. Ambiguous task update (requires clarification)"
            ),
            (
                "What is the capital of France?",
                "7. Regular chat fallback"
            )
        ]
        
        for user_input, description in scenarios:
            await run_scenario(db, conv_id, llm_service, user_input, description)
            # Short pause between turns to emulate pacing
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
