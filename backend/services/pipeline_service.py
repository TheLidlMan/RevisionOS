import json
import logging
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
from services.rag_service import build_rag_context

logger = logging.getLogger(__name__)

PIPELINE_TOTAL_STEPS = 5


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
    module.pipeline_status = status
    module.pipeline_stage = stage
    module.pipeline_completed = completed
    module.pipeline_total = total
    module.pipeline_error = error

    if job:
        job.status = status
        job.stage = stage
        job.completed = completed
        job.total = total
        job.error = error
        job.updated_at = datetime.utcnow()


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


async def _generate_missing_flashcards(module: Module, db: Session) -> int:
    if not settings.GROQ_API_KEY:
        return 0

    concepts = (
        db.query(Concept)
        .filter(Concept.module_id == module.id)
        .order_by(Concept.parent_concept_id.is_(None).desc(), Concept.order_index.asc(), Concept.importance_score.desc())
        .all()
    )
    if not concepts:
        return 0

    existing_cards = db.query(Flashcard).filter(Flashcard.module_id == module.id).all()
    cards_by_concept: dict[str, list[Flashcard]] = defaultdict(list)
    existing_pairs = set()
    for card in existing_cards:
        if card.concept_id:
            cards_by_concept[card.concept_id].append(card)
        existing_pairs.add(((card.front or "").strip().lower(), (card.back or "").strip().lower()))

    docs = (
        db.query(Document)
        .filter(Document.module_id == module.id, Document.processing_status == "done")
        .all()
    )
    default_doc_id = docs[0].id if docs else None
    created = 0

    for concept in concepts:
        current_count = len(cards_by_concept.get(concept.id, []))
        missing = _target_cards_for_concept(concept) - current_count
        if missing <= 0:
            continue

        rag_context = build_rag_context(
            db,
            module.id,
            query=f"{concept.name}\n{concept.definition or ''}\n{concept.explanation or ''}",
            max_chars=18000,
            user_id=module.user_id,
        )
        if not rag_context.strip():
            continue

        generated_cards = await ai_service.generate_flashcards_for_concept(
            concept_name=concept.name,
            concept_definition=concept.definition or concept.explanation or "",
            context=rag_context,
            num_cards=missing,
            subject=module.name,
        )

        for payload in generated_cards:
            if not isinstance(payload, dict):
                continue

            front = (payload.get("front") or "").strip()
            back = (payload.get("back") or "").strip()
            pair = (front.lower(), back.lower())
            if not front or not back or pair in existing_pairs:
                continue
            if "___" not in front and "___" not in back:
                continue

            tags = payload.get("tags", [])
            if not isinstance(tags, list):
                tags = []
            if concept.name not in tags:
                tags = [concept.name, *tags]

            card = Flashcard(
                user_id=module.user_id,
                module_id=module.id,
                concept_id=concept.id,
                front=front,
                back=back,
                card_type="CLOZE",
                cloze_text=front,
                source_document_id=payload.get("source_document_id") or default_doc_id,
                source_excerpt=payload.get("source_excerpt"),
                tags=json.dumps(tags),
                due=datetime.utcnow(),
                state="NEW",
                generation_source="AUTO",
            )
            db.add(card)
            cards_by_concept[concept.id].append(card)
            existing_pairs.add(pair)
            created += 1

        db.flush()

    return created


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
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        module = db.query(Module).filter(Module.id == module_id).first()
        job = db.query(ModuleJob).filter(ModuleJob.id == job_id).first() if job_id else None
        if not doc or not module:
            return

        _set_pipeline_state(module, job, status="running", stage="extracting", completed=0)
        doc.processing_status = "processing"
        db.commit()
        await _emit_pipeline_event(event_handler, {"event": "status", "stage": "extracting", "completed": 0, "total": PIPELINE_TOTAL_STEPS})

        try:
            raw_text, word_count = _extract_document_content(doc)
            doc.raw_text = raw_text
            doc.word_count = word_count
            doc.processed = True
            doc.processing_status = "done"
            db.commit()
            await _emit_pipeline_event(
                event_handler,
                {"event": "partial", "stage": "extracting", "word_count": word_count, "document_id": doc.id},
            )
        except Exception as exc:
            doc.processing_status = "failed"
            doc.raw_text = f"Processing error: {exc}"
            _set_pipeline_state(module, job, status="failed", stage="extracting", completed=0, error=str(exc))
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "error", "stage": "extracting", "message": str(exc)})
            return

        _set_pipeline_state(module, job, status="running", stage="summarizing", completed=1)
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
        await _emit_pipeline_event(
            event_handler,
            {"event": "partial", "stage": "summarizing", "summary": doc.summary or "", "document_id": doc.id},
        )

        _set_pipeline_state(module, job, status="running", stage="indexing_topics", completed=2)
        db.commit()
        await _emit_pipeline_event(event_handler, {"event": "status", "stage": "indexing_topics", "completed": 2, "total": PIPELINE_TOTAL_STEPS})
        await index_document(document_id, db, skip_summary=True)

        _set_pipeline_state(module, job, status="running", stage="refreshing_module", completed=3)
        refresh_module_relationships(module.id, db)
        db.commit()
        await _emit_pipeline_event(event_handler, {"event": "status", "stage": "refreshing_module", "completed": 3, "total": PIPELINE_TOTAL_STEPS})

        _set_pipeline_state(module, job, status="running", stage="generating_flashcards", completed=4)
        db.commit()
        await _emit_pipeline_event(event_handler, {"event": "status", "stage": "generating_flashcards", "completed": 4, "total": PIPELINE_TOTAL_STEPS})
        await _generate_missing_flashcards(module, db)
        refresh_module_relationships(module.id, db)
        db.commit()

        _set_pipeline_state(module, job, status="running", stage="building_study_plan", completed=5)
        _build_study_plan(module, db)
        _set_pipeline_state(module, job, status="completed", stage="ready", completed=PIPELINE_TOTAL_STEPS)
        db.commit()
        await _emit_pipeline_event(event_handler, {"event": "status", "stage": "building_study_plan", "completed": 5, "total": PIPELINE_TOTAL_STEPS})
        await _emit_pipeline_event(
            event_handler,
            {
                "event": "final",
                "stage": "ready",
                "document_id": doc.id,
                "module_id": module.id,
                "summary": doc.summary or "",
                "completed": PIPELINE_TOTAL_STEPS,
                "total": PIPELINE_TOTAL_STEPS,
            },
        )
    except Exception as exc:
        logger.exception("Module pipeline failed for document %s: %s", document_id, exc)
        try:
            module = db.query(Module).filter(Module.id == module_id).first()
            job = db.query(ModuleJob).filter(ModuleJob.id == job_id).first() if job_id else None
            if module:
                _set_pipeline_state(module, job, status="failed", stage="failed", completed=0, error=str(exc))
            if doc := db.query(Document).filter(Document.id == document_id).first():
                doc.processing_status = "failed"
            db.commit()
            await _emit_pipeline_event(event_handler, {"event": "error", "stage": "failed", "message": str(exc)})
        except Exception:
            db.rollback()
    finally:
        db.close()


def rebuild_module_outputs(db: Session, module: Module) -> Optional[dict]:
    refresh_module_relationships(module.id, db)
    return _build_study_plan(module, db)
