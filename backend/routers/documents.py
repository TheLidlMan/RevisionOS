import asyncio
import hashlib
import logging
import os
import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Response, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.document import Document
from models.module import Module
from models.module_job import ModuleJob
from services.content_indexer import backfill_document_summaries
from services.file_processor import extract_image_text, extract_text, transcribe_audio
from services.ownership import require_owned_document, require_owned_module
from services.pipeline_service import ACTIVE_JOB_STATUSES, PIPELINE_TOTAL_STEPS, create_module_job, process_document_pipeline, sync_module_pipeline_state
from services import ai_service
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger(__name__)
SSE_KEEPALIVE_INTERVAL_SECONDS = 15
SSE_KEEPALIVE_COMMENT = ": keep-alive\n\n"

# ---------- Pydantic schemas ----------

class DocumentResponse(BaseModel):
    id: str
    module_id: str
    filename: str
    file_type: str
    file_path: str
    processed: bool
    processing_status: str
    processing_stage: str
    processing_error: Optional[str] = None
    processing_completed: int = 0
    processing_total: int = 0
    word_count: int
    file_size_bytes: int = 0
    file_sha256: Optional[str] = None
    summary: Optional[str] = None
    summary_data: dict[str, Any] | list[Any] | None = None
    last_pipeline_updated_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
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


def _document_to_response(doc: Document) -> DocumentResponse:
    summary, summary_data = ai_service.normalize_summary_content(doc.summary)
    return DocumentResponse(
        id=doc.id,
        module_id=doc.module_id,
        filename=doc.filename,
        file_type=doc.file_type,
        file_path=doc.file_path,
        processed=doc.processed,
        processing_status=doc.processing_status,
        processing_stage=doc.processing_stage or "uploaded",
        processing_error=doc.processing_error,
        processing_completed=doc.processing_completed or 0,
        processing_total=doc.processing_total or 0,
        word_count=doc.word_count,
        file_size_bytes=doc.file_size_bytes or 0,
        file_sha256=doc.file_sha256,
        summary=summary or None,
        summary_data=summary_data,
        last_pipeline_updated_at=doc.last_pipeline_updated_at,
        cancelled_at=doc.cancelled_at,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )


def _get_active_job(db: Session, document_id: str) -> Optional[ModuleJob]:
    return (
        db.query(ModuleJob)
        .filter(ModuleJob.document_id == document_id, ModuleJob.status.in_(ACTIVE_JOB_STATUSES))
        .order_by(ModuleJob.created_at.desc())
        .first()
    )


def _save_uploaded_file(module_id: str, file: UploadFile) -> tuple[str, str, str, int, str]:
    base_upload = os.path.realpath(settings.UPLOAD_DIR)
    upload_dir = os.path.join(base_upload, module_id)
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
    tmp_path = f"{file_path}.part"
    if not os.path.realpath(file_path).startswith(base_upload):
        raise HTTPException(status_code=400, detail="Invalid file path")

    digest = hashlib.sha256()
    total_bytes = 0

    try:
        with open(tmp_path, "wb") as f:
            while True:
                chunk = file.file.read(1024 * 1024)
                if not chunk:
                    break
                total_bytes += len(chunk)
                digest.update(chunk)
                f.write(chunk)

        if total_bytes <= 0:
            raise HTTPException(status_code=400, detail="Empty uploads are not allowed")

        os.replace(tmp_path, file_path)
        if os.path.getsize(file_path) != total_bytes:
            raise HTTPException(status_code=400, detail="Uploaded file did not write completely")
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        if os.path.exists(file_path):
            os.remove(file_path)
        raise

    return file_id, file_type, file_path, total_bytes, digest.hexdigest()


def _run_document_pipeline_background(
    document_id: str,
    module_id: str,
    job_id: str,
) -> None:
    asyncio.run(process_document_pipeline(document_id, module_id, job_id))


# ---------- Endpoints ----------

@router.post("/upload", response_model=DocumentResponse, status_code=201)
async def upload_document(
    background_tasks: BackgroundTasks,
    module_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = require_owned_module(db, module_id, user)

    resolved_module_id = module.id
    resolved_user_id = module.user_id

    file_id, file_type, file_path, file_size_bytes, file_sha256 = _save_uploaded_file(resolved_module_id, file)

    # Create document record
    doc = Document(
        id=file_id,
        module_id=resolved_module_id,
        filename=file.filename or "unknown",
        file_type=file_type,
        file_path=file_path,
        file_size_bytes=file_size_bytes,
        file_sha256=file_sha256,
        processing_status="pending",
        processing_stage="queued",
        processing_completed=0,
        processing_total=PIPELINE_TOTAL_STEPS,
        last_pipeline_updated_at=datetime.utcnow(),
        user_id=resolved_user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    job = create_module_job(db, module_id=resolved_module_id, document_id=doc.id)
    document_id = doc.id
    job_id = job.id
    module.pipeline_status = "queued"
    module.pipeline_stage = "queued"
    module.pipeline_completed = 0
    module.pipeline_total = 5
    module.pipeline_error = None
    module.pipeline_updated_at = datetime.utcnow()
    db.commit()
    sync_module_pipeline_state(db, module.id)
    db.commit()
    db.refresh(doc)

    background_tasks.add_task(_run_document_pipeline_background, document_id, resolved_module_id, job_id)

    return _document_to_response(doc)


@router.post("/upload-stream")
async def upload_document_stream(
    module_id: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = require_owned_module(db, module_id, user)

    resolved_module_id = module.id
    resolved_user_id = module.user_id

    file_id, file_type, file_path, file_size_bytes, file_sha256 = _save_uploaded_file(resolved_module_id, file)

    doc = Document(
        id=file_id,
        module_id=resolved_module_id,
        filename=file.filename or "unknown",
        file_type=file_type,
        file_path=file_path,
        file_size_bytes=file_size_bytes,
        file_sha256=file_sha256,
        processing_status="pending",
        processing_stage="queued",
        processing_completed=0,
        processing_total=PIPELINE_TOTAL_STEPS,
        last_pipeline_updated_at=datetime.utcnow(),
        user_id=resolved_user_id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    job = create_module_job(db, module_id=resolved_module_id, document_id=doc.id)
    document_id = doc.id
    job_id = job.id
    document_snapshot = {
        "id": doc.id,
        "module_id": doc.module_id,
        "filename": doc.filename,
        "processing_status": doc.processing_status,
    }
    module.pipeline_status = "queued"
    module.pipeline_stage = "queued"
    module.pipeline_completed = 0
    module.pipeline_total = 5
    module.pipeline_error = None
    module.pipeline_updated_at = datetime.utcnow()
    db.commit()
    sync_module_pipeline_state(db, module.id)
    db.commit()
    db.refresh(doc)

    async def event_stream():
        queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
        loop = asyncio.get_running_loop()
        yield ai_service.encode_sse_event(
            {
                "event": "status",
                "stage": "uploaded",
                "document": document_snapshot,
            }
        )

        async def emit(event: dict):
            if event.get("event") == "final":
                db.expire_all()
                final_doc = db.query(Document).filter(Document.id == document_id).first()
                if not final_doc:
                    event["result"] = None
                else:
                    result = _document_to_response(final_doc).model_dump(mode="json")
                    event["result"] = result
            await queue.put(ai_service.encode_sse_event(event))

        def emit_threadsafe(event: dict) -> None:
            asyncio.run_coroutine_threadsafe(emit(event), loop)

        async def send_keepalives():
            try:
                while True:
                    await asyncio.sleep(SSE_KEEPALIVE_INTERVAL_SECONDS)
                    await queue.put(SSE_KEEPALIVE_COMMENT)
            except asyncio.CancelledError:
                logger.info("Document upload keepalive cancelled for %s", document_id)
                raise

        def run_pipeline_in_thread() -> None:
            try:
                asyncio.run(process_document_pipeline(document_id, resolved_module_id, job_id, event_handler=emit_threadsafe))
            except Exception as exc:
                logger.exception("Streaming document pipeline failed for %s: %s", document_id, exc)
                loop.call_soon_threadsafe(
                    queue.put_nowait,
                    ai_service.encode_sse_event({"event": "error", "stage": "failed", "message": str(exc)}),
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        keepalive_task = asyncio.create_task(send_keepalives())
        try:
            pipeline_task = asyncio.create_task(asyncio.to_thread(run_pipeline_in_thread))
            while True:
                item = await queue.get()
                if item is None:
                    break
                yield item
            await pipeline_task
        except asyncio.CancelledError:
            logger.info("Document upload stream cancelled for %s", document_id)
            raise
        except Exception as exc:
            logger.exception("Document upload stream failed for %s: %s", document_id, exc)
            yield ai_service.encode_sse_event({"event": "error", "stage": "failed", "message": str(exc)})
        finally:
            keepalive_task.cancel()
            try:
                await keepalive_task
            except asyncio.CancelledError:
                pass

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{document_id}/index")
async def index_document_endpoint(
    document_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Trigger topic extraction for a document."""
    from services.content_indexer import index_document
    doc = require_owned_document(db, document_id, user)
    if not doc.raw_text:
        raise HTTPException(status_code=400, detail="Document has no extracted text")

    concepts = await index_document(document_id, db)
    return {"indexed": len(concepts), "concepts": concepts}


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    doc = require_owned_document(db, document_id, user)
    if doc.delete_requested_at:
        raise HTTPException(status_code=404, detail="Document not found")
    backfill_document_summaries([doc], db)
    return _document_to_response(doc)


@router.get("/{document_id}/text", response_model=DocumentTextResponse)
def get_document_text(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    doc = require_owned_document(db, document_id, user)
    return DocumentTextResponse(
        id=doc.id,
        filename=doc.filename,
        raw_text=doc.raw_text or "",
    )


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    doc = require_owned_document(db, document_id, user)

    active_job = _get_active_job(db, doc.id)
    module = db.query(Module).filter(Module.id == doc.module_id).first()
    now = datetime.utcnow()

    if active_job and active_job.status == "queued":
        active_job.status = "cancelled"
        active_job.stage = "deleted"
        active_job.error = "Document deleted before processing started"
        active_job.cancel_requested_at = now
        active_job.cancelled_at = now
        active_job.finished_at = now
        if doc.file_path and os.path.exists(doc.file_path):
            os.remove(doc.file_path)
        db.delete(doc)
        if module:
            sync_module_pipeline_state(db, module.id)
        db.commit()
        return None

    if active_job and active_job.status in {"running", "cancelling"}:
        doc.cancel_requested_at = now
        doc.delete_requested_at = now
        doc.processing_status = "cancelling"
        doc.processing_stage = "cancelling"
        doc.processing_error = "Deletion requested while processing"
        doc.last_pipeline_updated_at = now
        active_job.cancel_requested_at = now
        active_job.status = "cancelling"
        active_job.stage = "cancelling"
        active_job.updated_at = now
        if module:
            sync_module_pipeline_state(db, module.id)
        db.commit()
        return None

    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)
    if module:
        module.updated_at = now
        module.pipeline_updated_at = now
    db.delete(doc)
    db.commit()
    return None


@router.post("/{document_id}/cancel", response_model=DocumentResponse)
def cancel_document_processing(
    document_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    doc = require_owned_document(db, document_id, user)

    active_job = _get_active_job(db, doc.id)
    if not active_job:
        return _document_to_response(doc)

    now = datetime.utcnow()
    doc.cancel_requested_at = now
    doc.processing_status = "cancelling"
    doc.processing_stage = "cancelling"
    doc.processing_error = "Cancellation requested"
    doc.last_pipeline_updated_at = now
    active_job.cancel_requested_at = now
    active_job.status = "cancelling"
    active_job.stage = "cancelling"
    active_job.updated_at = now

    module = db.query(Module).filter(Module.id == doc.module_id).first()
    if module:
        sync_module_pipeline_state(db, module.id)

    db.commit()
    db.refresh(doc)
    return _document_to_response(doc)


# ---------- Folder import schemas ----------

class FolderImportRequest(BaseModel):
    path: Optional[str] = None
    folder_path: Optional[str] = Field(default=None, alias="folder_path")

    @model_validator(mode="after")
    def validate_path(self):
        resolved_path = self.path or self.folder_path
        if not resolved_path:
            raise ValueError("path is required")
        self.path = resolved_path
        return self


class FolderImportResult(BaseModel):
    imported: int = 0
    failed: int = 0
    files: list[dict] = Field(default_factory=list)


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
    module = require_owned_module(db, module_id, user)

    resolved_module_id = module.id
    resolved_user_id = module.user_id

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
    upload_dir = os.path.join(base_upload, resolved_module_id)
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

                # Extract text
                raw_text = ""
                word_count = 0
                processed = False
                processing_status = "pending"
                if file_type in ("PDF", "TXT", "MD", "PPTX", "DOCX"):
                    raw_text = extract_text(dest_path, file_type)
                    word_count = len(raw_text.split())
                    processed = True
                    processing_status = "done"
                elif file_type in ("MP3", "MP4"):
                    raw_text = transcribe_audio(dest_path)
                    word_count = len(raw_text.split())
                    processed = True
                    processing_status = "done"
                elif file_type == "IMAGE":
                    raw_text = extract_image_text(dest_path)
                    word_count = len(raw_text.split())
                    processed = True
                    processing_status = "done"

                doc = Document(
                    id=file_id,
                    module_id=resolved_module_id,
                    filename=fname,
                    file_type=file_type,
                    file_path=dest_path,
                    raw_text=raw_text,
                    word_count=word_count,
                    processed=processed,
                    processing_status=processing_status,
                    user_id=resolved_user_id,
                )
                db.add(doc)
                db.commit()

                imported += 1
                files_result.append({"filename": fname, "status": "ok", "id": file_id})
            except Exception as e:
                db.rollback()
                failed += 1
                files_result.append({"filename": fname, "status": "failed", "error": str(e)})

    return FolderImportResult(imported=imported, failed=failed, files=files_result)
