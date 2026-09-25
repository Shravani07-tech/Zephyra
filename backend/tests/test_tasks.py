import pytest
from datetime import datetime, UTC
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Task, Conversation
from app.db import Base
from app.services import tasks

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_create_and_get_task(db_session):
    task = tasks.create_task(db_session, None, "Study DBMS", priority="HIGH")
    assert task.title == "Study DBMS"
    assert task.priority == "HIGH"
    assert task.status == "PENDING"
    
    fetched = tasks.get_task(db_session, task.id)
    assert fetched.title == "Study DBMS"

def test_list_tasks(db_session):
    tasks.create_task(db_session, None, "Task 1")
    tasks.create_task(db_session, None, "Task 2", priority="URGENT")
    
    all_tasks = tasks.list_tasks(db_session)
    assert len(all_tasks) == 2

def test_update_task(db_session):
    task = tasks.create_task(db_session, None, "Study DBMS")
    updated = tasks.update_task(db_session, task.id, priority="HIGH")
    assert updated.priority == "HIGH"

def test_complete_task(db_session):
    task = tasks.create_task(db_session, None, "Study DBMS")
    completed = tasks.complete_task(db_session, task.id)
    assert completed.status == "COMPLETED"

def test_delete_task(db_session):
    task = tasks.create_task(db_session, None, "Study DBMS")
    assert tasks.delete_task(db_session, task.id) is True
    assert tasks.get_task(db_session, task.id) is None
