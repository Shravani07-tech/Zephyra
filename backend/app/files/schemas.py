"""Zephyra Lite — File schemas."""

from datetime import datetime
from pydantic import BaseModel

class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    status: str
    error_message: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DocumentChunkMetadata(BaseModel):
    document_id: str
    filename: str
    page: int | None = None
    sheet: str | None = None
