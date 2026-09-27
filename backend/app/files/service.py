"""Zephyra Lite — File service."""

import hashlib
import os
import shutil
from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Document
from app.files.parser import parse_document
from app.files.chunker import chunk_document
from app.files.store import get_vector_store

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB limit for MVP


class FileProcessingError(ValueError):
    """The file was accepted but could not be parsed or indexed."""

def _calculate_hash(content: bytes) -> str:
    """Calculate SHA-256 hash of content."""
    return hashlib.sha256(content).hexdigest()

def list_files(db: Session, conversation_id: str | None = None) -> Sequence[Document]:
    """List documents optionally filtered by conversation_id."""
    stmt = select(Document)
    if conversation_id is not None:
        stmt = stmt.where(Document.conversation_id == conversation_id)
    stmt = stmt.order_by(Document.created_at.desc())
    return db.execute(stmt).scalars().all()

def get_file(db: Session, document_id: str) -> Document | None:
    """Get a document by ID."""
    return db.execute(select(Document).where(Document.id == document_id)).scalar_one_or_none()

def find_files_by_name(db: Session, filename: str, conversation_id: str | None = None) -> Sequence[Document]:
    """Find files matching a filename."""
    stmt = select(Document).where(Document.original_filename.ilike(f"%{filename}%"))
    if conversation_id is not None:
        stmt = stmt.where(Document.conversation_id == conversation_id)
    return db.execute(stmt).scalars().all()

def delete_file(db: Session, document_id: str, is_test: bool = False) -> bool:
    """Delete a document and its vector index."""
    doc = get_file(db, document_id)
    if not doc:
        return False
        
    file_hash = doc.file_hash
    
    # Remove from DB
    db.delete(doc)
    db.commit()
    
    # Check if any other document uses this hash
    others = db.execute(select(Document).where(Document.file_hash == file_hash)).scalars().all()
    if not others:
        # Remove from vector store
        store = get_vector_store(is_test=is_test)
        store.delete_document(file_hash)
        
        # Remove from disk if it exists
        if doc.storage_path and os.path.exists(doc.storage_path):
            try:
                os.remove(doc.storage_path)
            except Exception:
                pass
    return True

def process_upload(
    db: Session,
    content: bytes,
    original_filename: str,
    mime_type: str,
    conversation_id: str | None = None,
    is_test: bool = False
) -> Document:
    """Process an uploaded file."""
    if len(content) > MAX_FILE_SIZE:
        raise ValueError(f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.")
        
    # Reject executable paths trivially
    bad_exts = {".exe", ".bat", ".ps1", ".py", ".js", ".zip", ".sh"}
    if any(original_filename.lower().endswith(ext) for ext in bad_exts):
        raise ValueError("Unsupported executable file rejected.")
        
    # Prevent path traversal
    safe_filename = os.path.basename(original_filename)
    
    file_hash = _calculate_hash(content)
    
    # Identical content is processed once. A later upload of the same bytes gets
    # its own document row that shares the stored file and the hash-keyed vectors.
    existing = db.execute(
        select(Document)
        .where(Document.file_hash == file_hash)
        .where(Document.status == "READY")
        .limit(1)
    ).scalars().first()

    if existing:
        doc = Document(
            conversation_id=conversation_id,
            filename=safe_filename,
            original_filename=original_filename,
            file_hash=file_hash,
            mime_type=mime_type,
            file_size=len(content),
            storage_path=existing.storage_path,
            status="READY",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        return doc

    settings = get_settings()
    settings.file_storage_path.mkdir(parents=True, exist_ok=True)

    # The stored file is named by its hash, so identical uploads share it.
    storage_path = str(settings.file_storage_path / file_hash)

    doc = Document(
        conversation_id=conversation_id,
        filename=safe_filename,
        original_filename=original_filename,
        file_hash=file_hash,
        mime_type=mime_type,
        file_size=len(content),
        storage_path=storage_path,
        status="PROCESSING",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    if not os.path.exists(storage_path):
        with open(storage_path, "wb") as f:
            f.write(content)

    try:
        sections = parse_document(content, mime_type, safe_filename)
        chunked_sections = chunk_document(sections)
        store = get_vector_store(is_test=is_test)
        # Chunks are keyed by `file_hash`, so all identical files share them.
        store.add_chunks(
            document_id=file_hash,
            chunks=[cs.text for cs in chunked_sections],
            metadata_list=[cs.metadata for cs in chunked_sections],
        )
    except Exception as e:
        # Leave nothing behind: no FAILED row, no orphaned file on disk.
        db.delete(doc)
        db.commit()
        others = db.execute(select(Document).where(Document.file_hash == file_hash)).first()
        if others is None and os.path.exists(storage_path):
            try:
                os.remove(storage_path)
            except OSError:
                pass
        raise FileProcessingError(str(e)) from e

    doc.status = "READY"
    db.commit()
    db.refresh(doc)
    return doc
