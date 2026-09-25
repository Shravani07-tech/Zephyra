"""Zephyra Lite — Files API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.files.service import process_upload, list_files, delete_file, MAX_FILE_SIZE
from app.files.schemas import DocumentResponse

router = APIRouter(prefix="/files", tags=["files"])

@router.get("", response_model=list[DocumentResponse])
def get_files(
    conversation_id: str | None = None,
    db: Session = Depends(get_db),
) -> list[DocumentResponse]:
    """List documents, optionally filtered by conversation_id."""
    docs = list_files(db, conversation_id)
    return [DocumentResponse.model_validate(doc) for doc in docs]

@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File()],
    conversation_id: Annotated[str | None, Form()] = None,
    db: Session = Depends(get_db),
) -> DocumentResponse:
    """Upload and process a file."""
    content = await file.read()
    
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB."
        )
        
    mime_type = file.content_type or "application/octet-stream"
    original_filename = file.filename or "unknown_file"
    
    try:
        doc = process_upload(
            db=db,
            content=content,
            original_filename=original_filename,
            mime_type=mime_type,
            conversation_id=conversation_id
        )
        if doc.status == "FAILED":
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Failed to process file: {doc.error_message}"
            )
        return DocumentResponse.model_validate(doc)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error processing file: {str(e)}"
        )

@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_file(
    document_id: str,
    db: Session = Depends(get_db),
) -> None:
    """Delete a document and its processed vectors."""
    success = delete_file(db, document_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
