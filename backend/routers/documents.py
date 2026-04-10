import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.document import Document
from models.module import Module
from services.file_processor import extract_text

router = APIRouter(prefix="/api/documents", tags=["documents"])


# ---------- Pydantic schemas ----------

class DocumentResponse(BaseModel):
    id: str
    module_id: str
    filename: str
    file_type: str
    file_path: str
    processed: bool
    processing_status: str
    word_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentTextResponse(BaseModel):
    id: str
    filename: str
    raw_text: str


# ---------- Helpers ----------

SUPPORTED_EXTENSIONS = {
    ".pdf": "PDF",
    ".txt": "TXT",
    ".md": "MD",
    ".pptx": "PPTX",
    ".docx": "DOCX",
    ".mp3": "MP3",
    ".mp4": "MP4",
    ".png": "IMAGE",
    ".jpg": "IMAGE",
    ".jpeg": "IMAGE",
}


def _get_file_type(filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return SUPPORTED_EXTENSIONS.get(ext, "TXT")


# ---------- Endpoints ----------

@router.post("/upload", response_model=DocumentResponse, status_code=201)
def upload_document(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    # Verify module exists
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Save file to uploads dir — sanitize filename to prevent path traversal
    upload_dir = os.path.realpath(os.path.join(settings.UPLOAD_DIR, module_id))
    os.makedirs(upload_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    file_type = _get_file_type(file.filename or "unknown.txt")
    safe_basename = os.path.basename(file.filename or "unknown.txt")
    ext = os.path.splitext(safe_basename)[1]
    saved_filename = f"{file_id}{ext}"
    file_path = os.path.join(upload_dir, saved_filename)

    # Verify resolved path is inside uploads dir
    base_upload = os.path.realpath(settings.UPLOAD_DIR)
    if not os.path.realpath(file_path).startswith(base_upload):
        raise HTTPException(status_code=400, detail="Invalid file path")

    with open(file_path, "wb") as f:
        content = file.file.read()
        f.write(content)

    # Create document record
    doc = Document(
        id=file_id,
        module_id=module_id,
        filename=file.filename or "unknown",
        file_type=file_type,
        file_path=file_path,
        processing_status="pending",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Attempt text extraction for supported types
    if file_type in ("PDF", "TXT", "MD"):
        try:
            raw_text = extract_text(file_path, file_type)
            doc.raw_text = raw_text
            doc.word_count = len(raw_text.split())
            doc.processed = True
            doc.processing_status = "done"
        except Exception as e:
            doc.processing_status = "failed"
            doc.raw_text = f"Extraction error: {str(e)}"
        db.commit()
        db.refresh(doc)

    return DocumentResponse(
        id=doc.id,
        module_id=doc.module_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_path=doc.file_path,
        processed=doc.processed,
        processing_status=doc.processing_status,
        word_count=doc.word_count,
        created_at=doc.created_at,
    )


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentResponse(
        id=doc.id,
        module_id=doc.module_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_path=doc.file_path,
        processed=doc.processed,
        processing_status=doc.processing_status,
        word_count=doc.word_count,
        created_at=doc.created_at,
    )


@router.get("/{document_id}/text", response_model=DocumentTextResponse)
def get_document_text(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentTextResponse(
        id=doc.id,
        filename=doc.filename,
        raw_text=doc.raw_text or "",
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Delete physical file
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return None
