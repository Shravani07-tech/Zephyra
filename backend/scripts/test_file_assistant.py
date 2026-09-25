"""Zephyra Lite — File Assistant Test Script."""

import sys
import argparse
from pathlib import Path

from app.db import init_db, SessionLocal
from app.files.service import process_upload, list_files, delete_file
from app.agent.state import PlannerState
from app.agent.planner import build_planner
from app.files.store import get_vector_store

def create_dummy_file(path: Path, content: str):
    path.write_text(content, encoding="utf-8")

def test_file_assistant():
    print("--- Starting File Assistant MVP Tests ---")
    
    # 1. Initialize DB and Store
    init_db()
    db = SessionLocal()
    
    # Reset vector store for clean test
    store = get_vector_store(is_test=True)
    store.reset()
    
    test_dir = Path("data/test_files")
    test_dir.mkdir(parents=True, exist_ok=True)
    
    txt_path = test_dir / "test_doc.txt"
    create_dummy_file(txt_path, "The secret base is located in Antarctica under the ice.\nThe password is 'penguin123'.")
    
    conversation_id = "test-conv-1"
    
    # Test Upload
    print("\n1. Testing File Upload...")
    doc = process_upload(
        db=db,
        content=txt_path.read_bytes(),
        original_filename=txt_path.name,
        mime_type="text/plain",
        conversation_id=conversation_id,
        is_test=True
    )
    print(f"Uploaded: {doc.filename}, Status: {doc.status}, Hash: {doc.file_hash}")
    if doc.status == "FAILED":
        print(f"Error: {doc.error_message}")
    
    # Test Listing
    print("\n2. Testing File Listing...")
    files = list_files(db, conversation_id)
    print(f"Files found: {len(files)}")
    for f in files:
        print(f" - {f.filename}")
        
    # Test Planner Agent (FILE intent)
    print("\n3. Testing Planner Routing (FILE intent)...")
    planner = build_planner(db)
    state = PlannerState(
        user_text="What is the password to the secret base?",
        conversation_id=conversation_id,
        is_test=True, # Custom flag to use MockEmbedding in tests
        messages=[],
    )
    
    import asyncio
    
    async def run_planner():
        return await planner.ainvoke(state)
        
    result = asyncio.run(run_planner())
    print(f"Planner finished with Intent: {result.get('intent')}")
    tool_results = result.get("tool_results", [])
    if tool_results:
        print(f"Tool results: {tool_results}")
    else:
        print("No tool results (LLM parsing might have skipped the mock file due to hash match, or identity prompt failed).")
        
    # Test Deletion
    print("\n4. Testing File Deletion...")
    delete_file(db, doc.id, is_test=True)
    files_after = list_files(db, conversation_id)
    print(f"Files after deletion: {len(files_after)}")
    
    print("\n--- Tests Completed ---")

if __name__ == "__main__":
    test_file_assistant()
