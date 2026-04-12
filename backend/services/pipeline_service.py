import asyncio
import json
import logging
import os
from collections.abc import Awaitable, Callable
from collections import defaultdict
from datetime import datetime, timedelta
from math import ceil
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from database import SessionLocal
from models.concept import Concept
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.module_job import ModuleJob
from services import ai_service
from services.content_indexer import index_document, summarize_document
from services.file_processor import extract_image_text, extract_text, transcribe_audio
from services.quota_service import ai_quota_scope
from services.rag_service import build_rag_context

logger = logging.getLogger(__name__)

PIPELINE_TOTAL_STEPS = 5
ACTIVE_JOB_STATUSES = {"queued", "running", "cancelling"}
TERMINAL_JOB_STATUSES = {"completed", "failed", "cancelled"}
MAX_DOCUMENT_RETRIES = 3
MAX_PROCESSING_ATTEMPTS = 1 + MAX_DOCUMENT_RETRIES
RETRY_DELAYS = (
    timedelta(minutes=5),
    timedelta(minutes=10),
    timedelta(minutes=10),
)
RETRY_POLL_INTERVAL_SECONDS = 60
STALE_PIPELINE_WINDOW = timedelta(minutes=15)
_retry_worker_task: Optional[asyncio.Task] = None
_active_retry_documents: set[str] = set()


async def _emit_pipeline_event(
    event_handler: Optional[Callable[[dict], Awaitable[None] | None]],
    event: dict,
) -> None:
    if not event_handler:
        return
    result = event_handler(event)
    if result is not None:
        await result


def create_module_job(db: Session, module_id: str, document_id: Optional[str] = None) -> ModuleJob:
    job = ModuleJob(
        module_id=module_id,
        document_id=document_id,
        job_type="document_pipeline",
        status="queued",
        stage="queued",
        completed=0,
        total=PIPELINE_TOTAL_STEPS,
    )
    db.add(job)
    db.flush()
    return job


def _now() -> datetime:
    return datetime.utcnow()


def _set_document_state(
    doc: Document,
    *,
    status: str,
    stage: str,
    completed: int,
    total: int = PIPELINE_TOTAL_STEPS,
    error: Optional[str] = None,
) -> None:
    doc.processing_status = status
    doc.processing_stage = stage
    doc.processing_completed = completed
    doc.processing_total = total
    doc.processing_error = error
    doc.last_pipeline_updated_at = _now()


def _begin_processing_attempt(doc: Document) -> None:
    doc.processing_attempts = int(doc.processing_attempts or 0) + 1
    doc.next_retry_at = None
    doc.processing_error = None


def _remaining_retry_slots(doc: Document) -> int:
    attempts = max(1, int(doc.processing_attempts or 1))
    retries_used = max(0, attempts - 1)
    return max(0, MAX_DOCUMENT_RETRIES - retries_used)


def _retry_delay(doc: Document) -> timedelta:
    attempts = max(1, int(doc.processing_attempts or 1))
    delay_index = min(max(attempts - 1, 0), len(RETRY_DELAYS) - 1)
    return RETRY_DELAYS[delay_index]


def sync_module_pipeline_state(db: Session, module_id: str) -> None:
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        return

    jobs = (
        db.query(ModuleJob)
        .filter(ModuleJob.module_id == module_id)
        .order_by(ModuleJob.updated_at.desc(), ModuleJob.created_at.desc())
        .all()
    )
    active_jobs = [job for job in jobs if job.status in ACTIVE_JOB_STATUSES]

    if active_jobs:
        priority = {"cancelling": 3, "running": 2, "queued": 1}
        active_jobs.sort(
            key=lambda job: (priority.get(job.status, 0), job.updated_at or job.created_at),
            reverse=True,
        )
        selected = active_jobs[0]
        module.pipeline_status = selected.status
        module.pipeline_stage = selected.stage
        module.pipeline_completed = selected.completed
        module.pipeline_total = selected.total
        module.pipeline_error = selected.error
        module.pipeline_updated_at = selected.updated_at or selected.created_at
        return

    if jobs:
        selected = jobs[0]
        module.pipeline_status = selected.status
        module.pipeline_stage = selected.stage
        module.pipeline_completed = selected.completed
        module.pipeline_total = selected.total
        module.pipeline_error = selected.error
        module.pipeline_updated_at = selected.updated_at or selected.created_at
        return

    module.pipeline_status = "idle"
    module.pipeline_stage = "idle"
    module.pipeline_completed = 0
    module.pipeline_total = 0
    module.pipeline_error = None
    module.pipeline_updated_at = None


def _set_pipeline_state(
    module: Module,
    job: Optional[ModuleJob],
    *,
    status: str,
    stage: str,
    completed: int,
    total: int = PIPELINE_TOTAL_STEPS,
    error: Optional[str] = None,
) -> None:
    now = _now()
    module.pipeline_status = status
    module.pipeline_stage = stage
    module.pipeline_completed = completed
    module.pipeline_total = total
    module.pipeline_error = error
    module.pipeline_updated_at = now

    if job:
        job.status = status
        job.stage = stage
        job.completed = completed
        job.total = total
        job.error = error
        job.updated_at = now
        if status == "running" and job.started_at is None:
            job.started_at = now
        if status in TERMINAL_JOB_STATUSES:
            job.finished_at = now
        if status == "cancelled" and job.cancelled_at is None:
            job.cancelled_at = now


def _fallback_summary(raw_text: str, limit: int = 500) -> str:
    cleaned = " ".join((raw_text or "").split())
    if not cleaned:
        return ""
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


def _extract_document_content(doc: Document) -> tuple[str, int]:
    if doc.file_type in ("PDF", "TXT", "MD", "PPTX", "DOCX"):
        raw_text = extract_text(doc.file_path, doc.file_type)
    elif doc.file_type in ("MP3", "MP4"):
        raw_text = transcribe_audio(doc.file_path)
    elif doc.file_type == "IMAGE":
        raw_text = extract_image_text(doc.file_path)
    else:
        raw_text = ""

    return raw_text, len(raw_text.split())


def refresh_module_relationships(module_id: str, db: Session) -> None:
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    flashcards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()

    concept_docs: dict[str, set[str]] = defaultdict(set)
    related: dict[str, set[str]] = defaultdict(set)

    for card in flashcards:
        if card.concept_id and card.source_document_id:
            concept_docs[card.concept_id].add(card.source_document_id)

    children_by_parent: dict[str, list[str]] = defaultdict(list)
    for concept in concepts:
        if concept.parent_concept_id:
            children_by_parent[concept.parent_concept_id].append(concept.id)
            related[concept.id].add(concept.parent_concept_id)
            related[concept.parent_concept_id].add(concept.id)

    for concept in concepts:
        sibling_ids = children_by_parent.get(concept.parent_concept_id or "", [])
        for sibling_id in sibling_ids:
            if sibling_id != concept.id:
                related[concept.id].add(sibling_id)

        concept.source_document_ids = json.dumps(sorted(concept_docs.get(concept.id, set())))
        concept.related_concept_ids = json.dumps(sorted(related.get(concept.id, set())))

    db.flush()


def _target_cards_for_concept(concept: Concept) -> int:
    weight = concept.study_weight or 1.0
    return max(1, min(5, ceil(weight * 1.5)))


def _target_cards_for_weight(study_weight: Optional[float]) -> int:
    weight = study_weight or 1.0
    return max(1, min(5, ceil(weight * 1.5)))


def _normalize_flashcard_tags(raw_tags: object, concept_name: Optional[str] = None) -> list[str]:
    tags: list[str] = []
    seen: set[str] = set()

    candidates: list[str] = []
    if concept_name:
        candidates.append(concept_name)
    if isinstance(raw_tags, list):
        candidates.extend(str(tag).strip() for tag in raw_tags)

    for tag in candidates:
        normalized = tag.strip()
        if not normalized:
            continue
        key = normalized.lower()
        if key in seen:
            continue
        seen.add(key)
        tags.append(normalized)

    return tags


def _create_flashcards_from_payloads(
    *,
    db: Session,
    module: Module,
    document: Document,
    payloads: list[dict],
    existing_pairs: set[tuple[str, str]],
    concept_id: Optional[str] = None,
    concept_name: Optional[str] = None,
    default_card_type: str = "BASIC",
    require_cloze: bool = False,
    default_source_excerpt: Optional[str] = None,
) -> list[str]:
    created_cards: list[Flashcard] = []

    for payload in payloads:
        if not isinstance(payload, dict):
            continue

        front = str(payload.get("front") or "").strip()
        card_type = str(payload.get("type") or default_card_type).upper()
        if card_type not in ("BASIC", "CLOZE"):
            card_type = default_card_type

        back = str(payload.get("back") or "").strip()
        cloze_text = payload.get("cloze_text")
        if card_type == "CLOZE" and not back:
            back = str(cloze_text or "").strip()

        pair = (front.lower(), back.lower())
        if not front or not back or pair in existing_pairs:
            continue
        if require_cloze and "___" not in front and "___" not in back:
            continue

        tags = _normalize_flashcard_tags(payload.get("tags"), concept_name)
        card = Flashcard(
            user_id=module.user_id,
            module_id=module.id,
            concept_id=concept_id,
            front=front,
            back=back,
            card_type=card_type,
            cloze_text=(cloze_text or front) if card_type == "CLOZE" else None,
            source_document_id=payload.get("source_document_id") or document.id,
            source_excerpt=payload.get("source_excerpt") or default_source_excerpt,
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
            generation_source="AUTO",
        )
        db.add(card)
        created_cards.append(card)
        existing_pairs.add(pair)

    if not created_cards:
        return []

    db.flush()
    return [card.id for card in created_cards if card.id]


def _build_flashcard_generation_error(
    *,
    concept_error: Optional[str],
    concept_had_usable_cards: bool,
    raw_text_error: Optional[str],
    raw_text_had_usable_cards: bool,
) -> str:
    parts: list[str] = []

    if concept_error:
        parts.append(f"Concept-generation failure: {concept_error}")
    elif not concept_had_usable_cards:
        parts.append("Concept generation returned no usable cards")

    if raw_text_error:
        parts.append(f"Raw-text fallback failure: {raw_text_error}")
    elif not raw_text_had_usable_cards:
        parts.append("Raw-text fallback returned no usable cards")

    return "; ".join(parts)


async def _generate_missing_flashcards(
    module: Module,
    document: Document,
    concept_ids: list[str],
    db: Session,
) -> tuple[list[str], Optional[str]]:
    if not settings.GROQ_API_KEY:
        return [], None

    module_id = module.id
    module_name = module.name
    raw_text = (document.raw_text or "").strip()
    existing_cards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
    cards_by_concept: dict[str, list[Flashcard]] = defaultdict(list)
    existing_pairs = set()
    for card in existing_cards:
        if card.concept_id:
            cards_by_concept[card.concept_id].append(card)
        existing_pairs.add(((card.front or "").strip().lower(), (card.back or "").strip().lower()))

    created_ids: list[str] = []
    concept_had_usable_cards = False
    raw_text_had_usable_cards = False
    concept_error: Optional[str] = None
    raw_text_error: Optional[str] = None
    fallback_target_cards = 0

    try:
        concept_rows = (
            db.query(Concept)
            .filter(
                Concept.module_id == module_id,
                Concept.id.in_(concept_ids or [""]),
            )
            .order_by(Concept.parent_concept_id.is_(None).desc(), Concept.order_index.asc(), Concept.importance_score.desc())
            .all()
        )
        per_concept_errors: list[str] = []

        for concept in concept_rows:
            current_count = len(cards_by_concept.get(concept.id, []))
            missing = _target_cards_for_weight(concept.study_weight) - current_count
            if missing <= 0:
                continue
            fallback_target_cards = min(
                settings.CARDS_PER_DOCUMENT,
                max(1, fallback_target_cards + missing),
            )

            try:
                rag_context = build_rag_context(
                    db,
                    module_id,
                    query=f"{concept.name}\n{concept.definition or ''}\n{concept.explanation or ''}",
                    max_chars=18000,
                    user_id=module.user_id,
                )
                db.close()
                if not rag_context.strip():
                    continue

                generated_cards = await ai_service.generate_flashcards_for_concept(
                    concept_name=concept.name,
                    concept_definition=concept.definition or concept.explanation or "",
                    context=rag_context,
                    num_cards=missing,
                    subject=module_name,
                )
                new_ids = _create_flashcards_from_payloads(
                    db=db,
                    module=module,
                    document=document,
                    payloads=generated_cards,
                    existing_pairs=existing_pairs,
                    concept_id=concept.id,
                    concept_name=concept.name,
                    default_card_type="CLOZE",
                    require_cloze=True,
                )
                if new_ids:
                    concept_had_usable_cards = True
                    created_ids.extend(new_ids)
                    cards_by_concept[concept.id].extend(
                        db.query(Flashcard).filter(Flashcard.id.in_(new_ids)).all()
                    )
                    db.commit()
            except Exception as exc:
                logger.exception(
                    "Concept flashcard generation failed for document %s concept %s: %s",
                    document.id,
                    concept.name,
                    exc,
                )
                per_concept_errors.append(f"{concept.name}: {exc}")

        if per_concept_errors and not concept_had_usable_cards:
            concept_error = "; ".join(per_concept_errors[:3])
    except Exception as exc:
        logger.exception("Concept flashcard generation crashed for document %s: %s", document.id, exc)
        concept_error = str(exc)

    fallback_target_cards = max(1, fallback_target_cards or settings.CARDS_PER_DOCUMENT)

    if concept_had_usable_cards:
        return created_ids, None

    try:
        generated_cards = await ai_service.generate_flashcards(
            raw_text,
            fallback_target_cards,
            module_name,
            source_name=document.filename,
        )
        new_ids = _create_flashcards_from_payloads(
            db=db,
            module=module,
            document=document,
            payloads=generated_cards,
            existing_pairs=existing_pairs,
            default_card_type="BASIC",
            require_cloze=False,
            default_source_excerpt=raw_text[:200] if raw_text else None,
        )
        if new_ids:
            raw_text_had_usable_cards = True
            created_ids.extend(new_ids)
            db.commit()
    except Exception as exc:
        logger.exception("Raw-text flashcard fallback failed for document %s: %s", document.id, exc)
        raw_text_error = str(exc)

    if raw_text_had_usable_cards:
        return created_ids, None

    return created_ids, _build_flashcard_generation_error(
        concept_error=concept_error,
        concept_had_usable_cards=concept_had_usable_cards,
        raw_text_error=raw_text_error,
        raw_text_had_usable_cards=raw_text_had_usable_cards,
    )


def _remove_document_file(doc: Document) -> None:
    if doc.file_path and os.path.exists(doc.file_path):
        os.remove(doc.file_path)


def _rollback_pipeline_run(
    db: Session,
    *,
    module_id: str,
    document_id: str,
    created_concept_ids: list[str],
    created_flashcard_ids: list[str],
    clear_summary: bool,
    clear_raw_text: bool,
) -> None:
    if created_flashcard_ids:
        db.query(Flashcard).filter(Flashcard.id.in_(created_flashcard_ids)).delete(synchronize_session=False)

    if created_concept_ids:
        concepts = db.query(Concept).filter(Concept.id.in_(created_concept_ids)).all()
        for concept in concepts:
            if concept.flashcards or concept.quiz_questions:
                continue
            db.delete(concept)

    doc = db.query(Document).filter(Document.id == document_id).first()
    if doc:
        if clear_summary:
            doc.summary = None
        if clear_raw_text:
            doc.raw_text = ""
            doc.word_count = 0
            doc.processed = False

    refresh_module_relationships(module_id, db)


def _current_entities(
    db: Session,
    document_id: str,
    module_id: str,
    job_id: Optional[str],
) -> tuple[Optional[Document], Optional[Module], Optional[ModuleJob]]:
    db.expire_all()
    doc = db.query(Document).filter(Document.id == document_id).first()
    module = db.query(Module).filter(Module.id == module_id).first()
    job = db.query(ModuleJob).filter(ModuleJob.id == job_id).first() if job_id else None
    return doc, module, job


def _cancellation_requested(doc: Optional[Document], job: Optional[ModuleJob]) -> bool:
    if job and job.cancel_requested_at:
        return True
    if doc and (doc.cancel_requested_at or doc.delete_requested_at):
        return True
    return False


async def _finalize_cancellation(
    db: Session,
    *,
    module_id: str,
    document_id: str,
    job_id: Optional[str],
    event_handler: Optional[Callable[[dict], Awaitable[None] | None]],
    created_concept_ids: list[str],
    created_flashcard_ids: list[str],
    clear_summary: bool,
    clear_raw_text: bool,
) -> None:
    doc, module, job = _current_entities(db, document_id, module_id, job_id)

    _rollback_pipeline_run(
        db,
        module_id=module_id,
        document_id=document_id,
        created_concept_ids=created_concept_ids,
        created_flashcard_ids=created_flashcard_ids,
        clear_summary=clear_summary,
        clear_raw_text=clear_raw_text,
    )

    if doc and doc.delete_requested_at:
        _remove_document_file(doc)
        db.delete(doc)
    elif doc:
        _set_document_state(
            doc,
            status="cancelled",
            stage="cancelled",
            completed=doc.processing_completed,
            total=doc.processing_total or PIPELINE_TOTAL_STEPS,
            error="Processing cancelled",
        )
        doc.cancelled_at = _now()

    if module:
        if module.exam_date:
            _build_study_plan(module, db)

    if job:
        if module:
            _set_pipeline_state(
                module,
                job,
                status="cancelled",
                stage="cancelled",
                completed=job.completed,
                total=job.total or PIPELINE_TOTAL_STEPS,
                error="Processing cancelled",
            )
        else:
            job.status = "cancelled"
            job.stage = "cancelled"
            job.error = "Processing cancelled"
            job.updated_at = _now()
            job.finished_at = job.finished_at or _now()
            job.cancelled_at = job.cancelled_at or _now()

    if module:
        sync_module_pipeline_state(db, module.id)

    db.commit()
    await _emit_pipeline_event(
        event_handler,
        {"event": "cancelled", "stage": "cancelled", "document_id": document_id, "module_id": module_id},
    )


async def _schedule_retry_or_fail(
    db: Session,
    *,
    module: Optional[Module],
    doc: Optional[Document],
    job: Optional[ModuleJob],
    stage: str,
    completed: int,
    message: str,
    event_handler: Optional[Callable[[dict], Awaitable[None] | None]],
) -> None:
    if not doc:
        return

    remaining_slots = _remaining_retry_slots(doc)
    if remaining_slots > 0:
        next_retry_at = _now() + _retry_delay(doc)
        doc.next_retry_at = next_retry_at
        _set_document_state(
            doc,
            status="pending",
            stage="queued",
            completed=completed,
            total=doc.processing_total or PIPELINE_TOTAL_STEPS,
            error=None,
        )

        if module and job:
            _set_pipeline_state(
                module,
                job,
                status="queued",
                stage="queued",
                completed=completed,
                total=job.total or PIPELINE_TOTAL_STEPS,
                error=None,
            )
        elif job:
            now = _now()
            job.status = "queued"
            job.stage = "queued"
            job.error = None
            job.updated_at = now
            job.finished_at = None

        if module:
            sync_module_pipeline_state(db, module.id)

        db.commit()
        logger.warning(
            "Retry scheduled for document %s after stage=%s failure attempt=%s next_retry_at=%s error=%s",
            doc.id,
            stage,
            doc.processing_attempts,
            next_retry_at.isoformat(),
            message,
        )
        await _emit_pipeline_event(
            event_handler,
            {
                "event": "status",
                "stage": "queued",
                "document_id": doc.id,
                "completed": completed,
                "total": doc.processing_total or PIPELINE_TOTAL_STEPS,
                "retry_attempt": doc.processing_attempts,
                "retry_at": next_retry_at.isoformat(),
            },
        )
        return

    _set_document_state(
        doc,
        status="failed",
        stage=stage or "failed",
        completed=completed,
        total=doc.processing_total or PIPELINE_TOTAL_STEPS,
        error=message,
    )
    doc.next_retry_at = None

    if module and job:
        _set_pipeline_state(
            module,
            job,
            status="failed",
            stage=stage or "failed",
            completed=completed,
            total=job.total or PIPELINE_TOTAL_STEPS,
            error=message,
        )
    elif job:
        now = _now()
        job.status = "failed"
        job.stage = stage or "failed"
        job.error = message
        job.updated_at = now
        job.finished_at = now

    if module:
        sync_module_pipeline_state(db, module.id)

    db.commit()
    await _emit_pipeline_event(
        event_handler,
        {"event": "error", "stage": stage or "failed", "message": message, "document_id": doc.id},
    )


def _document_stale_since(doc: Document) -> datetime:
    return doc.last_pipeline_updated_at or doc.updated_at or doc.created_at or _now()


def _document_needs_summary_repair(doc: Document) -> bool:
    return doc.processing_status == "done" and bool((doc.raw_text or "").strip()) and not bool((doc.summary or "").strip())


def _document_due_for_retry(doc: Document, active_job: Optional[ModuleJob], now: datetime) -> bool:
    if doc.delete_requested_at or doc.cancel_requested_at or doc.cancelled_at:
        return False

    if _document_needs_summary_repair(doc):
        if int(doc.processing_attempts or 0) >= MAX_PROCESSING_ATTEMPTS:
            return False
        return doc.next_retry_at is None or doc.next_retry_at <= now

    status = doc.processing_status or "pending"
    attempts = int(doc.processing_attempts or 0)
    stale = _document_stale_since(doc) <= now - STALE_PIPELINE_WINDOW

    if status == "processing":
        return stale
    if status == "pending":
        if doc.next_retry_at is not None:
            return doc.next_retry_at is not None and doc.next_retry_at <= now
        return attempts == 0 and (active_job is None or stale)
    if status == "failed":
        return attempts < MAX_PROCESSING_ATTEMPTS and doc.next_retry_at is not None and doc.next_retry_at <= now

    return False


async def repair_document_summary(document_id: str) -> None:
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc or not _document_needs_summary_repair(doc):
            return

        doc.processing_attempts = int(doc.processing_attempts or 0) + 1
        doc.next_retry_at = None
        doc.last_pipeline_updated_at = _now()
        db.commit()

        module = db.query(Module).filter(Module.id == doc.module_id).first()
        try:
            if settings.GROQ_API_KEY:
                with ai_quota_scope(module.user_id if module else None):
                    summary = await summarize_document(document_id, db)
                    if summary is None and not doc.summary:
                        doc.summary = _fallback_summary(doc.raw_text or "")
                        db.commit()
            elif not doc.summary:
                doc.summary = _fallback_summary(doc.raw_text or "")
                db.commit()

            doc.next_retry_at = None
            doc.last_pipeline_updated_at = _now()
            db.commit()
        except Exception as exc:
            await _schedule_retry_or_fail(
                db,
                module=module,
                doc=doc,
                job=None,
                stage="repairing_summary",
                completed=doc.processing_completed or PIPELINE_TOTAL_STEPS,
                message=str(exc),
                event_handler=None,
            )
    finally:
        db.close()


def _run_document_pipeline_retry(document_id: str, module_id: str, job_id: Optional[str]) -> None:
    asyncio.run(process_document_pipeline(document_id, module_id, job_id))


def _run_document_summary_repair(document_id: str) -> None:
    asyncio.run(repair_document_summary(document_id))


async def _launch_document_retry(document_id: str, module_id: str, job_id: Optional[str]) -> None:
    if document_id in _active_retry_documents:
        return

    _active_retry_documents.add(document_id)
    try:
        await asyncio.to_thread(_run_document_pipeline_retry, document_id, module_id, job_id)
    finally:
        _active_retry_documents.discard(document_id)


async def _launch_summary_repair(document_id: str) -> None:
    if document_id in _active_retry_documents:
        return

    _active_retry_documents.add(document_id)
    try:
        await asyncio.to_thread(_run_document_summary_repair, document_id)
    finally:
        _active_retry_documents.discard(document_id)


async def _retry_due_documents_once() -> None:
    db = SessionLocal()
    try:
        now = _now()
        docs = (
            db.query(Document)
            .filter(Document.delete_requested_at.is_(None))
            .all()
        )
        tasks: list[asyncio.Task] = []

        for doc in docs:
            active_job = (
                db.query(ModuleJob)
                .filter(ModuleJob.document_id == doc.id, ModuleJob.status.in_(ACTIVE_JOB_STATUSES))
                .order_by(ModuleJob.created_at.desc())
                .first()
            )
            if not _document_due_for_retry(doc, active_job, now):
                continue

            if _document_needs_summary_repair(doc):
                tasks.append(asyncio.create_task(_launch_summary_repair(doc.id)))
                continue

            job = active_job or create_module_job(db, module_id=doc.module_id, document_id=doc.id)
            if active_job:
                job.status = "queued"
                job.stage = "queued"
                job.error = None
                job.updated_at = now
                job.finished_at = None

            doc.processing_status = "pending"
            doc.processing_stage = "queued"
            doc.processing_error = None
            doc.next_retry_at = None
            doc.last_pipeline_updated_at = now
            db.commit()

            tasks.append(asyncio.create_task(_launch_document_retry(doc.id, doc.module_id, job.id)))

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
    finally:
        db.close()


async def _document_retry_worker() -> None:
    while True:
        try:
            await _retry_due_documents_once()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.exception("Document retry worker error: %s", exc)
        await asyncio.sleep(RETRY_POLL_INTERVAL_SECONDS)


async def ensure_document_retry_worker_started() -> None:
    global _retry_worker_task
    if _retry_worker_task and not _retry_worker_task.done():
        return
    _retry_worker_task = asyncio.create_task(_document_retry_worker(), name="document-retry-worker")


async def stop_document_retry_worker() -> None:
    global _retry_worker_task
    if not _retry_worker_task:
        return
    _retry_worker_task.cancel()
    try:
        await _retry_worker_task
    except asyncio.CancelledError:
        pass
    _retry_worker_task = None


def _build_study_plan(module: Module, db: Session) -> Optional[dict]:
    if not module.exam_date:
        module.study_plan_json = None
        module.study_plan_generated_at = None
        return None

    concepts = (
        db.query(Concept)
        .filter(Concept.module_id == module.id)
        .order_by(Concept.parent_concept_id.is_(None).desc(), Concept.order_index.asc(), Concept.importance_score.desc())
        .all()
    )
    if not concepts:
        module.study_plan_json = None
        module.study_plan_generated_at = None
        return None

    today = datetime.utcnow().date()
    exam_day = module.exam_date.date()
    total_days = max(1, (exam_day - today).days + 1)

    weighted_concepts = []
    total_weight = 0.0
    for concept in concepts:
        weight = max(1.0, float(concept.study_weight or 1.0))
        total_weight += weight
        weighted_concepts.append((concept, weight))

    allocated_sessions = []
    remaining_days = total_days
    for index, (concept, weight) in enumerate(weighted_concepts):
        if index == len(weighted_concepts) - 1:
            sessions = max(1, remaining_days)
        else:
            sessions = max(1, round((weight / total_weight) * total_days))
            sessions = min(sessions, remaining_days - max(0, len(weighted_concepts) - index - 1))
        remaining_days -= sessions
        allocated_sessions.extend([concept] * sessions)

    allocated_sessions = allocated_sessions[:total_days]
    while len(allocated_sessions) < total_days:
        allocated_sessions.append(weighted_concepts[-1][0])

    week_map: dict[int, dict] = {}
    for offset, concept in enumerate(allocated_sessions):
        session_day = today + timedelta(days=offset)
        week_number = (offset // 7) + 1
        week_entry = week_map.setdefault(
            week_number,
            {"week": week_number, "focus_areas": [], "sessions": []},
        )
        if concept.name not in week_entry["focus_areas"]:
            week_entry["focus_areas"].append(concept.name)

        duration_minutes = max(30, min(90, int(round((concept.study_weight or 1.0) * 25))))
        activity = f"Study {concept.name}"
        if concept.parent_concept_id:
            activity = f"Deepen understanding of {concept.name}"

        week_entry["sessions"].append(
            {
                "day": session_day.strftime("%a %d %b"),
                "activity": activity,
                "duration_minutes": duration_minutes,
                "concepts": [concept.name],
            }
        )

    weeks = list(week_map.values())
    total_minutes = sum(
        session["duration_minutes"]
        for week in weeks
        for session in week["sessions"]
    )
    hours_per_week = max(1, round((total_minutes / max(1, len(weeks))) / 60))

    study_plan = {
        "module_name": module.name,
        "total_concepts": len(concepts),
        "total_weeks": len(weeks),
        "hours_per_week": hours_per_week,
        "exam_date": module.exam_date.date().isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "weeks": weeks,
    }
    module.study_plan_json = json.dumps(study_plan)
    module.study_plan_generated_at = datetime.utcnow()
    return study_plan


async def process_document_pipeline(
    document_id: str,
    module_id: str,
    job_id: Optional[str] = None,
    event_handler: Optional[Callable[[dict], Awaitable[None] | None]] = None,
) -> None:
    db = SessionLocal()
    created_concept_ids: list[str] = []
    extracted_concept_ids: list[str] = []
    created_flashcard_ids: list[str] = []
    clear_summary_on_cancel = False
    clear_raw_text_on_cancel = False

    try:
        doc, module, job = _current_entities(db, document_id, module_id, job_id)
        if not module:
            return

        if not doc:
            if job:
                _set_pipeline_state(module, job, status="cancelled", stage="deleted", completed=job.completed, error="Document removed before processing")
                sync_module_pipeline_state(db, module.id)
                db.commit()
            return

        with ai_quota_scope(module.user_id):
            _begin_processing_attempt(doc)
            _set_pipeline_state(module, job, status="running", stage="extracting", completed=0)
            _set_document_state(doc, status="processing", stage="extracting", completed=0, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "extracting", "completed": 0, "total": PIPELINE_TOTAL_STEPS})

            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            try:
                raw_text, word_count = _extract_document_content(doc)
                if not raw_text.strip() or word_count <= 0:
                    raise ValueError("No readable text could be extracted from the uploaded file")

                doc.raw_text = raw_text
                doc.word_count = word_count
                doc.processed = True
                clear_raw_text_on_cancel = True
                _set_document_state(doc, status="processing", stage="extracting", completed=1, total=PIPELINE_TOTAL_STEPS)
                sync_module_pipeline_state(db, module.id)
                db.commit()
                await _emit_pipeline_event(
                    event_handler,
                    {"event": "partial", "stage": "extracting", "word_count": word_count, "document_id": doc.id},
                )
            except Exception as exc:
                doc.processed = False
                await _schedule_retry_or_fail(
                    db,
                    module=module,
                    doc=doc,
                    job=job,
                    stage="extracting",
                    completed=0,
                    message=str(exc),
                    event_handler=event_handler,
                )
                return

            doc, module, job = _current_entities(db, document_id, module_id, job_id)
            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            _set_pipeline_state(module, job, status="running", stage="summarizing", completed=1)
            _set_document_state(doc, status="processing", stage="summarizing", completed=1, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "summarizing", "completed": 1, "total": PIPELINE_TOTAL_STEPS})
            if settings.GROQ_API_KEY:
                summary = await summarize_document(document_id, db)
                if summary is None and not doc.summary:
                    doc.summary = _fallback_summary(doc.raw_text or "")
                    db.commit()
            elif not doc.summary:
                doc.summary = _fallback_summary(doc.raw_text or "")
                db.commit()
            clear_summary_on_cancel = bool(doc.summary)
            summary_text, summary_data = ai_service.normalize_summary_content(doc.summary)
            _set_document_state(doc, status="processing", stage="summarizing", completed=2, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(
                event_handler,
                {
                    "event": "partial",
                    "stage": "summarizing",
                    "summary": summary_text,
                    "summary_data": summary_data,
                    "document_id": doc.id,
                },
            )

            doc, module, job = _current_entities(db, document_id, module_id, job_id)
            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            _set_pipeline_state(module, job, status="running", stage="indexing_topics", completed=2)
            _set_document_state(doc, status="processing", stage="indexing_topics", completed=2, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "indexing_topics", "completed": 2, "total": PIPELINE_TOTAL_STEPS})
            created_concepts = await index_document(document_id, db, skip_summary=True)
            extracted_concept_ids = [entry["id"] for entry in created_concepts if entry.get("id")]
            created_concept_ids = [entry["id"] for entry in created_concepts if entry.get("is_new")]

            doc, module, job = _current_entities(db, document_id, module_id, job_id)
            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            _set_pipeline_state(module, job, status="running", stage="refreshing_module", completed=3)
            _set_document_state(doc, status="processing", stage="refreshing_module", completed=3, total=PIPELINE_TOTAL_STEPS)
            refresh_module_relationships(module.id, db)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "refreshing_module", "completed": 3, "total": PIPELINE_TOTAL_STEPS})

            doc, module, job = _current_entities(db, document_id, module_id, job_id)
            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            _set_pipeline_state(module, job, status="running", stage="generating_flashcards", completed=4)
            _set_document_state(doc, status="processing", stage="generating_flashcards", completed=4, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "generating_flashcards", "completed": 4, "total": PIPELINE_TOTAL_STEPS})
            created_flashcard_ids, flashcard_generation_error = await _generate_missing_flashcards(module, doc, extracted_concept_ids, db)
            refresh_module_relationships(module.id, db)
            sync_module_pipeline_state(db, module.id)
            db.commit()

            if flashcard_generation_error:
                doc, module, job = _current_entities(db, document_id, module_id, job_id)
                _set_document_state(
                    doc,
                    status="failed",
                    stage="generating_flashcards",
                    completed=4,
                    total=PIPELINE_TOTAL_STEPS,
                    error=flashcard_generation_error,
                )
                _set_pipeline_state(
                    module,
                    job,
                    status="failed",
                    stage="generating_flashcards",
                    completed=4,
                    total=PIPELINE_TOTAL_STEPS,
                    error=flashcard_generation_error,
                )
                sync_module_pipeline_state(db, module.id)
                db.commit()
                await _emit_pipeline_event(
                    event_handler,
                    {
                        "event": "error",
                        "stage": "generating_flashcards",
                        "message": flashcard_generation_error,
                        "document_id": doc.id,
                    },
                )
                return

            doc, module, job = _current_entities(db, document_id, module_id, job_id)
            if _cancellation_requested(doc, job):
                await _finalize_cancellation(
                    db,
                    module_id=module.id,
                    document_id=document_id,
                    job_id=job_id,
                    event_handler=event_handler,
                    created_concept_ids=created_concept_ids,
                    created_flashcard_ids=created_flashcard_ids,
                    clear_summary=clear_summary_on_cancel,
                    clear_raw_text=clear_raw_text_on_cancel,
                )
                return

            _set_pipeline_state(module, job, status="running", stage="building_study_plan", completed=5)
            _set_document_state(doc, status="processing", stage="building_study_plan", completed=5, total=PIPELINE_TOTAL_STEPS)
            _build_study_plan(module, db)
            _set_pipeline_state(module, job, status="completed", stage="ready", completed=PIPELINE_TOTAL_STEPS)
            _set_document_state(doc, status="done", stage="ready", completed=PIPELINE_TOTAL_STEPS, total=PIPELINE_TOTAL_STEPS)
            sync_module_pipeline_state(db, module.id)
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "status", "stage": "building_study_plan", "completed": 5, "total": PIPELINE_TOTAL_STEPS})
            await _emit_pipeline_event(
                event_handler,
                {
                    "event": "final",
                    "stage": "ready",
                    "document_id": doc.id,
                    "module_id": module.id,
                    "summary": summary_text,
                    "summary_data": summary_data,
                    "completed": PIPELINE_TOTAL_STEPS,
                    "total": PIPELINE_TOTAL_STEPS,
                },
            )
    except Exception as exc:
        logger.exception("Module pipeline failed for document %s: %s", document_id, exc)
        try:
            module = db.query(Module).filter(Module.id == module_id).first()
            job = db.query(ModuleJob).filter(ModuleJob.id == job_id).first() if job_id else None
            doc = db.query(Document).filter(Document.id == document_id).first()
            _rollback_pipeline_run(
                db,
                module_id=module_id,
                document_id=document_id,
                created_concept_ids=created_concept_ids,
                created_flashcard_ids=created_flashcard_ids,
                clear_summary=False,
                clear_raw_text=False,
            )
            if doc:
                await _schedule_retry_or_fail(
                    db,
                    module=module,
                    doc=doc,
                    job=job,
                    stage=(doc.processing_stage or "failed"),
                    completed=doc.processing_completed,
                    message=str(exc),
                    event_handler=event_handler,
                )
        except Exception:
            db.rollback()
    finally:
        db.close()


def rebuild_module_outputs(db: Session, module: Module) -> Optional[dict]:
    refresh_module_relationships(module.id, db)
    return _build_study_plan(module, db)
