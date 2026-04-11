import asyncio
import logging
import os
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.document import Document
from models.module import Module
from services.pipeline_service import create_module_job, process_document_pipeline
from services import ai_service
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger(__name__)

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
    updated_at: datetime

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


def _save_uploaded_file(module: Module, file: UploadFile) -> tuple[str, str, str]:
    base_upload = os.path.realpath(settings.UPLOAD_DIR)
    upload_dir = os.path.join(base_upload, module.id)
    os.makedirs(upload_dir, exist_ok=True)

    file_id = str(uuid.uuid4())
    file_type = _get_file_type(file.filename or "unknown.txt")
    allowed_extensions = {".pdf", ".txt", ".md", ".pptx", ".docx", ".mp3", ".mp4", ".png", ".jpg", ".jpeg"}
    safe_basename = os.path.basename(file.filename or "unknown.txt")
    ext = os.path.splitext(safe_basename)[1].lower()
    if ext not in allowed_extensions:
        ext = ".bin"

    saved_filename = f"{file_id}{ext}"
    file_path = os.path.join(upload_dir, saved_filename)
    if not os.path.realpath(file_path).startswith(base_upload):
        raise HTTPException(status_code=400, detail="Invalid file path")

    with open(file_path, "wb") as f:
        content = file.file.read()
        f.write(content)

    return file_id, file_type, file_path


# ---------- Endpoints ----------

@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    module_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    # Verify module exists
    module_query = db.query(Module).filter(Module.id == module_id)
    if user:
        module_query = module_query.filter(Module.user_id == user.id)
    module = module_query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    file_id, file_type, file_path = _save_uploaded_file(module, file)

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
    job = create_module_job(db, module_id=module.id, document_id=doc.id)
    module.pipeline_status = "queued"
    module.pipeline_stage = "queued"
    module.pipeline_completed = 0
    module.pipeline_total = 5
    module.pipeline_error = None
    module.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(process_document_pipeline, doc.id, module.id, job.id)

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
        updated_at=doc.updated_at,
    )


@router.post("/upload-stream")
async def upload_document_stream(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module_query = db.query(Module).filter(Module.id == module_id)
    if user:
        module_query = module_query.filter(Module.user_id == user.id)
    module = module_query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    file_id, file_type, file_path = _save_uploaded_file(module, file)

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
    job = create_module_job(db, module_id=module.id, document_id=doc.id)
    module.pipeline_status = "queued"
    module.pipeline_stage = "queued"
    module.pipeline_completed = 0
    module.pipeline_total = 5
    module.pipeline_error = None
    module.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)

    async def event_stream():
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
        yield ai_service.encode_sse_event(
            {
                "event": "status",
                "stage": "uploaded",
                "document": {
                    "id": doc.id,
                    "module_id": doc.module_id,
                    "filename": doc.filename,
                    "processing_status": doc.processing_status,
                },
            }
        )

        async def emit(event: dict):
            if event.get("event") == "final":
                db.expire_all()
                final_doc = db.query(Document).filter(Document.id == doc.id).first()
                result = DocumentResponse(
                    id=final_doc.id,
                    module_id=final_doc.module_id,
                    filename=final_doc.filename,
                    file_type=final_doc.file_type,
                    file_path=final_doc.file_path,
                    processed=final_doc.processed,
                    processing_status=final_doc.processing_status,
                    word_count=final_doc.word_count,
                    summary=final_doc.summary,
                    created_at=final_doc.created_at,
                    updated_at=final_doc.updated_at,
                ).model_dump(mode="json")
                event["result"] = result
            await queue.put(ai_service.encode_sse_event(event))

        async def run_pipeline():
            try:
                await process_document_pipeline(doc.id, module.id, job.id, event_handler=emit)
            finally:
                await queue.put(None)

        try:
            pipeline_task = asyncio.create_task(run_pipeline())
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
            await pipeline_task
        except Exception as exc:
            yield ai_service.encode_sse_event({"event": "error", "stage": "failed", "message": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


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
        updated_at=doc.updated_at,
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
    module = db.query(Module).filter(Module.id == doc.module_id).first()
    if module:
        module.updated_at = datetime.utcnow()
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
