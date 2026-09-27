"""Zephyra Lite — Files API endpoints."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.files.schemas import DocumentResponse
from app.files.service import (
    MAX_FILE_SIZE,
    FileProcessingError,
    delete_file,
    list_files,
    process_upload,
)
from app.services import conversation as conv_service

router = APIRouter(prefix="/files", tags=["files"])


def _require_conversation(db: Session, conversation_id: uuid.UUID) -> str:
    conv_id = str(conversation_id)
    if conv_service.get_conversation(db, conv_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv_id


@router.get("", response_model=list[DocumentResponse])
def get_files(
    conversation_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> list[DocumentResponse]:
    """List the ready documents attached to one conversation."""
    conv_id = _require_conversation(db, conversation_id)
    docs = list_files(db, conv_id)
    return [DocumentResponse.model_validate(doc) for doc in docs if doc.status == "READY"]


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File()],
    conversation_id: Annotated[uuid.UUID, Form()],
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Upload a file into a conversation and index it for File Assistant questions."""
    conv_id = _require_conversation(db, conversation_id)

    # Read at most one byte past the limit so oversized uploads are never
    # loaded into memory in full.
    content = await file.read(MAX_FILE_SIZE + 1)
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
        )
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is empty.")

    try:
        doc = process_upload(
            db=db,
            content=content,
            original_filename=file.filename or "unknown_file",
            mime_type=file.content_type or "application/octet-stream",
            conversation_id=conv_id,
        )
    except FileProcessingError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Failed to process file: {e}",
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return DocumentResponse.model_validate(doc)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_file(
    document_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    """Delete a document and, when no other document shares it, its vectors."""
    if not delete_file(db, str(document_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
