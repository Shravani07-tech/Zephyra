"""File node for Zephyra Lite planner."""

import json
from sqlalchemy.orm import Session

from app.agent.state import PlannerState
from app.services.llm import get_llm_provider
from app.files.store import get_vector_store
from app.files.service import list_files

async def handle_file(state: PlannerState, db: Session) -> dict:
    """Process a file question operation."""
    user_text = state["user_text"]
    conversation_id = state["conversation_id"]
    is_test = state.get("is_test", False)
    
    # 1. Identify which files the user has. Only fully indexed files are searchable.
    docs = [doc for doc in list_files(db, conversation_id) if doc.status == "READY"]
    if not docs:
        return {"tool_results": [{"success": False, "error": "There are no uploaded files in this conversation to search. Attach a file first."}]}
        
    doc_map = {doc.filename: doc for doc in docs}
    
    # If the user mentioned a specific file, figure it out using LLM.
    llm = get_llm_provider()
    
    filenames = list(doc_map.keys())
    
    identify_prompt = (
        "The user asked a question about their files.\n"
        f"Available files: {filenames}\n\n"
        "Identify which file(s) the user is referring to based on their query.\n"
        "If they don't specify, and there is only 1 file, return that file.\n"
        "If they don't specify and there are multiple files, return an empty array.\n"
        "Respond ONLY with a JSON array of exact filenames.\n"
        f"User query: {user_text}"
    )
    
    messages = [{"role": "user", "content": identify_prompt}]
    chunks = []
    async for chunk in llm.stream_chat(messages):
        chunks.append(chunk)
    
    response_text = "".join(chunks).strip()
    
    try:
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        selected_filenames = json.loads(response_text.strip())
    except Exception:
        selected_filenames = []
        
    if not selected_filenames:
        if len(filenames) == 1:
            selected_filenames = filenames
        else:
            return {"tool_results": [{"success": False, "error": "Multiple files available. Please specify which file you mean."}]}
            
    # Validate selected filenames
    valid_filenames = [f for f in selected_filenames if f in doc_map]
    if not valid_filenames:
        return {"tool_results": [{"success": False, "error": f"Could not find the requested file(s) among {filenames}"}]}
        
    # 2. Search Vector Store
    store = get_vector_store(is_test=is_test)
    
    # We will search the query across the selected documents.
    # To combine, we can either search each document individually, or search all of them if Chroma allows multiple hashes (it doesn't natively with standard `where` without $in, which we can use).
    file_hashes = [doc_map[fn].file_hash for fn in valid_filenames]
    
    where = None
    if len(file_hashes) == 1:
        where = {"document_id": file_hashes[0]}
    else:
        where = {"document_id": {"$in": file_hashes}}
        
    results = store.collection.query(
        query_texts=[user_text],
        n_results=5,
        where=where,
    )
    
    extracted_info = []
    if results and results.get("documents") and len(results["documents"]) > 0:
        docs_found = results["documents"][0]
        metadatas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs_found)
        
        # We need a reverse map from file_hash to filename to show to LLM
        hash_to_name = {doc.file_hash: doc.filename for doc in doc_map.values()}
        
        for doc_text, meta in zip(docs_found, metadatas):
            doc_id = meta.get("document_id")
            filename = hash_to_name.get(doc_id, "Unknown File")
            
            source_parts = [filename]
            if "page" in meta:
                source_parts.append(f"page {meta['page']}")
            if "sheet" in meta:
                source_parts.append(f"Sheet: {meta['sheet']}")
                
            source_ref = " — ".join(source_parts)
            
            extracted_info.append({
                "source": source_ref,
                "content": doc_text
            })
            
    if not extracted_info:
        return {"tool_results": [{"success": False, "error": "I couldn't find relevant information in the uploaded files."}]}
        
    return {"tool_results": [{"success": True, "operation": "FILE_RETRIEVAL", "retrieved_chunks": extracted_info}]}
