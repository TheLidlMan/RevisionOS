import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.document import Document
from models.module import Module
from services.file_processor import extract_text, extract_image_text, transcribe_audio
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

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
    summary: Optional[str] = None
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
async def upload_document(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    # Verify module exists
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Save file to uploads dir — sanitize filename to prevent path traversal
    base_upload = os.path.realpath(settings.UPLOAD_DIR)

    # Use only the UUID module_id (already validated from DB lookup above)
    upload_dir = os.path.join(base_upload, module.id)
    os.makedirs(upload_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    file_type = _get_file_type(file.filename or "unknown.txt")

    # Only allow known safe extensions
    ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".pptx", ".docx", ".mp3", ".mp4", ".png", ".jpg", ".jpeg"}
    safe_basename = os.path.basename(file.filename or "unknown.txt")
    ext = os.path.splitext(safe_basename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        ext = ".bin"

    saved_filename = f"{file_id}{ext}"
    file_path = os.path.join(upload_dir, saved_filename)

    # Verify resolved path is inside uploads dir
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
        user_id=user.id if user else None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Attempt text extraction for supported types
    if file_type in ("PDF", "TXT", "MD", "PPTX", "DOCX"):
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
    elif file_type in ("MP3", "MP4"):
        try:
            raw_text = transcribe_audio(file_path)
            doc.raw_text = raw_text
            doc.word_count = len(raw_text.split())
            doc.processed = True
            doc.processing_status = "done"
        except Exception as e:
            doc.processing_status = "failed"
            doc.raw_text = f"Transcription error: {str(e)}"
        db.commit()
        db.refresh(doc)
    elif file_type == "IMAGE":
        try:
            raw_text = extract_image_text(file_path)
            doc.raw_text = raw_text
            doc.word_count = len(raw_text.split())
            doc.processed = True
            doc.processing_status = "done"
        except Exception as e:
            doc.processing_status = "failed"
            doc.raw_text = f"OCR error: {str(e)}"
        db.commit()
        db.refresh(doc)

    # Auto-index: extract topics and generate summary
    if doc.processing_status == "done":
        try:
            from services.content_indexer import index_document
            await index_document(doc.id, db)
        except Exception:
            pass  # Non-critical, indexing can be re-triggered

        # Pre-generate quiz questions in background
        if background_tasks and settings.GROQ_API_KEY:
            from routers.quizzes import _generate_quiz_for_module
            background_tasks.add_task(
                _generate_quiz_for_module,
                module_id,
                user.id if user else None,
            )

    return DocumentResponse(
        id=doc.id,
        module_id=doc.module_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_path=doc.file_path,
        processed=doc.processed,
        processing_status=doc.processing_status,
        word_count=doc.word_count,
        summary=doc.summary,
        created_at=doc.created_at,
    )


@router.post("/{document_id}/index")
async def index_document_endpoint(
    document_id: str,
    db: Session = Depends(get_db),
):
    """Trigger topic extraction for a document."""
    from services.content_indexer import index_document
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if not doc.raw_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text")

    concepts = await index_document(document_id, db)
    return {"indexed": len(concepts), "concepts": concepts}


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    query = db.query(Document).filter(Document.id == document_id)
    if user:
        query = query.filter(Document.user_id == user.id)
    doc = query.first()
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
        summary=doc.summary,
        created_at=doc.created_at,
    )


@router.get("/{document_id}/text", response_model=DocumentTextResponse)
def get_document_text(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    query = db.query(Document).filter(Document.id == document_id)
    if user:
        query = query.filter(Document.user_id == user.id)
    doc = query.first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentTextResponse(
        id=doc.id,
        filename=doc.filename,
        raw_text=doc.raw_text or "",
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    query = db.query(Document).filter(Document.id == document_id)
    if user:
        query = query.filter(Document.user_id == user.id)
    doc = query.first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Delete physical file
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    db.delete(doc)
    db.commit()
    return None


# ---------- Folder import schemas ----------

class FolderImportRequest(BaseModel):
    path: str


class FolderImportResult(BaseModel):
    imported: int = 0
    failed: int = 0
    files: list[dict] = []


# ---------- Folder import endpoint ----------

FOLDER_IMPORT_EXTENSIONS = {
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


@router.post("/import-folder/{module_id}", response_model=FolderImportResult)
def import_folder(
    module_id: str,
    body: FolderImportRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Import supported files from a local folder recursively."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Validate and resolve the folder path
    folder_path = os.path.realpath(body.path)

    # Block access to sensitive system directories
    BLOCKED_PREFIXES = ("/etc", "/proc", "/sys", "/dev", "/boot", "/root", "/var/run")
    for prefix in BLOCKED_PREFIXES:
        if folder_path.startswith(prefix):
            raise HTTPException(status_code=403, detail="Access to system directories is not allowed")

    if not os.path.exists(folder_path):
        raise HTTPException(status_code=400, detail="Path does not exist")
    if not os.path.isdir(folder_path):
        raise HTTPException(status_code=400, detail="Path is not a directory")

    base_upload = os.path.realpath(settings.UPLOAD_DIR)
    upload_dir = os.path.join(base_upload, module.id)
    os.makedirs(upload_dir, exist_ok=True)

    imported = 0
    failed = 0
    files_result: list[dict] = []

    for root, _dirs, filenames in os.walk(folder_path):
        for fname in filenames:
            src_path = os.path.realpath(os.path.join(root, fname))
            # Ensure resolved source is still within the folder_path (no symlink escape)
            if not src_path.startswith(folder_path):
                continue

            ext = os.path.splitext(fname)[1].lower()
            file_type = FOLDER_IMPORT_EXTENSIONS.get(ext)
            if not file_type:
                continue

            file_id = str(uuid.uuid4())
            dest_filename = f"{file_id}{ext}"
            dest_path = os.path.join(upload_dir, dest_filename)

            try:
                import shutil
                shutil.copy2(src_path, dest_path)  # noqa: S202  src_path validated above

                doc = Document(
                    id=file_id,
                    module_id=module_id,
                    filename=fname,
                    file_type=file_type,
                    file_path=dest_path,
                    processing_status="pending",
                    user_id=user.id if user else None,
                )
                db.add(doc)
                db.flush()

                # Extract text
                if file_type in ("PDF", "TXT", "MD", "PPTX", "DOCX"):
                    raw_text = extract_text(dest_path, file_type)
                    doc.raw_text = raw_text
                    doc.word_count = len(raw_text.split())
                    doc.processed = True
                    doc.processing_status = "done"
                elif file_type in ("MP3", "MP4"):
                    raw_text = transcribe_audio(dest_path)
                    doc.raw_text = raw_text
                    doc.word_count = len(raw_text.split())
                    doc.processed = True
                    doc.processing_status = "done"
                elif file_type == "IMAGE":
                    raw_text = extract_image_text(dest_path)
                    doc.raw_text = raw_text
                    doc.word_count = len(raw_text.split())
                    doc.processed = True
                    doc.processing_status = "done"

                imported += 1
                files_result.append({"filename": fname, "status": "ok", "id": file_id})
            except Exception as e:
                failed += 1
                files_result.append({"filename": fname, "status": "failed", "error": str(e)})

    db.commit()

    return FolderImportResult(imported=imported, failed=failed, files=files_result)
