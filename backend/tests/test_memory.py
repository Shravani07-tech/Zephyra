import pytest
from app.services.memory_service import MemoryService, ExtractionResult
from app.models import Memory
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db import Base

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

@pytest.fixture
def memory_service(db_session):
    return MemoryService(db_session)

def test_memory_crud(memory_service, db_session):
    # Create
    mem = memory_service.create_memory(
        content="User prefers Python",
        category="PREFERENCE",
        user_id="default"
    )
    assert mem.id is not None
    assert mem.content == "User prefers Python"
    
    # Retrieve
    mem2 = memory_service.get_memory(mem.id)
    assert mem2.content == "User prefers Python"
    
    # Search
    results = memory_service.search_memories("Python", user_id="default")
    assert len(results) >= 1
    assert any(r["text"] == "User prefers Python" for r in results)
    
    # Delete
    memory_service.delete_memory(mem.id)
    
    # Inactive memory should not be returned in search
    results2 = memory_service.search_memories("Python", user_id="default")
    assert not any(r["text"] == "User prefers Python" for r in results2)

def test_memory_update_conflict(memory_service, db_session):
    # First preference
    mem1 = memory_service.create_memory(
        content="I prefer Python",
        category="PREFERENCE",
        user_id="default"
    )
    
    # New preference that conflicts/duplicates
    mem2 = memory_service.create_memory(
        content="I prefer TypeScript now",
        category="PREFERENCE",
        user_id="default"
    )
    
    # Wait, the deduplication in create_memory looks for high similarity.
    # We set threshold=0.85, which might or might not catch "I prefer TypeScript now".
    # For a deterministic test, we can check that they are both there if different enough,
    # or replaced if similar. "I prefer Python" and "I prefer Python" will definitely match.
    
    mem3 = memory_service.create_memory(
        content="I prefer Python",
        category="PREFERENCE",
        user_id="default"
    )
    
    # mem1 should be inactive
    db_session.refresh(mem1)
    assert not mem1.active
    
    db_session.refresh(mem3)
    assert mem3.active

def test_rebuild_index(memory_service, db_session):
    mem = memory_service.create_memory(
        content="Testing rebuild index",
        category="PERSONAL_FACT",
        user_id="default"
    )
    
    # Delete from chroma directly
    memory_service.store.delete_memory(mem.id)
    
    # Verify it's gone
    results = memory_service.store.search_memories("Testing rebuild index", user_id="default")
    assert not any(r["metadata"]["memory_id"] == mem.id for r in results)
    
    # Rebuild
    memory_service.rebuild_memory_index()
    
    # Verify it's back
    results2 = memory_service.store.search_memories("Testing rebuild index", user_id="default")
    assert any(r["metadata"]["memory_id"] == mem.id for r in results2)
