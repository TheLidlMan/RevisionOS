import os
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from cache import cache_get, cache_set, cache_invalidate_prefix
from database import get_db
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.module_job import ModuleJob
from models.quiz_question import QuizQuestion
from models.user import User
from services import ai_service
from services.auth_service import get_current_user
from services.content_indexer import backfill_document_summaries
from services.pipeline_service import ACTIVE_JOB_STATUSES, rebuild_module_outputs, sync_module_pipeline_state
from typing import Optional as OptionalType

router = APIRouter(prefix="/api/modules", tags=["modules"])


class ModuleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#00b4d8"
    exam_date: Optional[datetime] = None


class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    exam_date: Optional[datetime] = None


class ModuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime
    exam_date: Optional[datetime] = None
    total_cards: int = 0
    due_cards: int = 0
    mastery_pct: float = 0.0
    total_documents: int = 0
    auto_cards: int = 0
    manual_cards: int = 0
    pipeline_status: str = "idle"
    pipeline_stage: str = "idle"
    pipeline_completed: int = 0
    pipeline_total: int = 0
    pipeline_error: Optional[str] = None
    pipeline_updated_at: Optional[datetime] = None
    has_study_plan: bool = False

    model_config = {"from_attributes": True}


class ModuleDetailResponse(ModuleResponse):
    documents: list[dict] = []


class ModuleStatsResponse(BaseModel):
    id: str
    name: str
    total_cards: int = 0
    due_cards: int = 0
    new_cards: int = 0
    learning_cards: int = 0
    review_cards: int = 0
    mastery_pct: float = 0.0
    total_documents: int = 0
    total_concepts: int = 0
    total_questions: int = 0
    auto_cards: int = 0
    manual_cards: int = 0


class PaginatedModulesResponse(BaseModel):
    items: list[ModuleResponse]
    total: int
    has_more: bool


class ModuleReorderRequest(BaseModel):
    ordered_ids: list[str]


def _apply_module_scope(query, user: OptionalType[User]):
    if user:
        return query.filter(Module.user_id == user.id)
    return query.filter(Module.user_id.is_(None))


def _compute_module_stats(db: Session, module: Module) -> dict:
    """Compute module statistics using SQL aggregates instead of loading all cards."""
    now = datetime.utcnow()

    # Single query: counts by state and due
    from sqlalchemy import case, and_

    stats_row = db.query(
        func.count(Flashcard.id).label("total_cards"),
        func.sum(case((and_(Flashcard.due.isnot(None), Flashcard.due <= now), 1), else_=0)).label("due_cards"),
        func.sum(case((Flashcard.state == "NEW", 1), else_=0)).label("new_cards"),
        func.sum(case((Flashcard.state.in_(["LEARNING", "RELEARNING"]), 1), else_=0)).label("learning_cards"),
        func.sum(case((Flashcard.state == "REVIEW", 1), else_=0)).label("review_cards"),
        func.sum(case((and_(Flashcard.state == "REVIEW", Flashcard.lapses == 0, Flashcard.reps >= 2), 1), else_=0)).label("mastered"),
        func.sum(case((Flashcard.generation_source == "AUTO", 1), else_=0)).label("auto_cards"),
        func.sum(case((Flashcard.generation_source != "AUTO", 1), else_=0)).label("manual_cards"),
    ).filter(Flashcard.module_id == module.id).one()

    total_cards = stats_row.total_cards or 0
    due_cards = int(stats_row.due_cards or 0)
    new_cards = int(stats_row.new_cards or 0)
    learning_cards = int(stats_row.learning_cards or 0)
    review_cards = int(stats_row.review_cards or 0)
    mastered = int(stats_row.mastered or 0)
    auto_cards = int(stats_row.auto_cards or 0)
    manual_cards = int(stats_row.manual_cards or 0)
    mastery_pct = (mastered / total_cards * 100) if total_cards > 0 else 0.0

    total_documents = db.query(func.count(Document.id)).filter(
        Document.module_id == module.id,
        Document.delete_requested_at.is_(None),
    ).scalar() or 0

    return {
        "total_cards": total_cards,
        "due_cards": due_cards,
        "new_cards": new_cards,
        "learning_cards": learning_cards,
        "review_cards": review_cards,
        "mastery_pct": round(mastery_pct, 1),
        "total_documents": total_documents,
        "auto_cards": auto_cards,
        "manual_cards": manual_cards,
    }


def _module_to_response(module: Module, stats: dict) -> ModuleResponse:
    return ModuleResponse(
        id=module.id,
        name=module.name,
        description=module.description,
        color=module.color,
        sort_order=module.sort_order,
        created_at=module.created_at,
        updated_at=module.updated_at,
        exam_date=module.exam_date,
        total_cards=stats["total_cards"],
        due_cards=stats["due_cards"],
        mastery_pct=stats["mastery_pct"],
        total_documents=stats["total_documents"],
        auto_cards=stats["auto_cards"],
        manual_cards=stats["manual_cards"],
        pipeline_status=module.pipeline_status,
        pipeline_stage=module.pipeline_stage,
        pipeline_completed=module.pipeline_completed,
        pipeline_total=module.pipeline_total,
        pipeline_error=module.pipeline_error,
        pipeline_updated_at=module.pipeline_updated_at,
        has_study_plan=bool(module.study_plan_json),
    )


def _serialize_document_summary(document: Document) -> dict[str, Any]:
    summary, summary_data = ai_service.normalize_summary_content(document.summary)
    return {
        "summary": summary or None,
        "summary_data": summary_data,
    }


@router.get("", response_model=PaginatedModulesResponse)
def list_modules(
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    user_id = user.id if user else "anonymous"
    cache_key = f"cache:module:{user_id}:list:{skip}:{limit}"

    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    base_query = _apply_module_scope(db.query(Module), user).order_by(Module.sort_order.asc(), Module.created_at.desc())
    total = base_query.count()
    modules = base_query.offset(skip).limit(limit).all()
    items = [_module_to_response(m, _compute_module_stats(db, m)) for m in modules]
    response = PaginatedModulesResponse(items=items, total=total, has_more=(skip + len(items)) < total)
    cache_set(cache_key, response.model_dump(mode="json"))
    return response


@router.post("", response_model=ModuleResponse, status_code=201)
def create_module(body: ModuleCreate, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    max_sort_order = _apply_module_scope(db.query(func.max(Module.sort_order)), user).scalar()
    module = Module(
        name=body.name,
        description=body.description,
        color=body.color,
        exam_date=body.exam_date,
        user_id=user.id if user else None,
        sort_order=(int(max_sort_order) + 1) if max_sort_order is not None else 0,
    )
    db.add(module)
    db.commit()
    db.refresh(module)
    user_id = user.id if user else "anonymous"
    cache_invalidate_prefix(f"cache:module:{user_id}:")
    return _module_to_response(module, _compute_module_stats(db, module))


@router.get("/{module_id}", response_model=ModuleDetailResponse)
def get_module(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    module = _apply_module_scope(db.query(Module).filter(Module.id == module_id), user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    stats = _compute_module_stats(db, module)
    docs = db.query(Document).filter(
        Document.module_id == module_id,
        Document.delete_requested_at.is_(None),
    ).order_by(Document.created_at.desc()).all()
    backfill_document_summaries(docs, db)
    base = _module_to_response(module, stats).model_dump()
    base["documents"] = [
        {
            **_serialize_document_summary(d),
            "id": d.id,
            "module_id": d.module_id,
            "filename": d.filename,
            "file_type": d.file_type,
            "file_path": d.file_path,
            "processed": d.processed,
            "processing_status": d.processing_status,
            "processing_stage": d.processing_stage,
            "processing_error": d.processing_error,
            "processing_completed": d.processing_completed,
            "processing_total": d.processing_total,
            "word_count": d.word_count,
            "file_size_bytes": d.file_size_bytes,
            "file_sha256": d.file_sha256,
            "last_pipeline_updated_at": d.last_pipeline_updated_at.isoformat() if d.last_pipeline_updated_at else None,
            "cancelled_at": d.cancelled_at.isoformat() if d.cancelled_at else None,
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in docs
    ]
    return ModuleDetailResponse(**base)


@router.patch("/{module_id}", response_model=ModuleResponse)
def update_module(module_id: str, body: ModuleUpdate, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    module = _apply_module_scope(db.query(Module).filter(Module.id == module_id), user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if body.name is not None:
        module.name = body.name
    if body.description is not None:
        module.description = body.description
    if body.color is not None:
        module.color = body.color
    if body.exam_date is not None:
        module.exam_date = body.exam_date

    module.updated_at = datetime.utcnow()
    rebuild_module_outputs(db, module)
    db.commit()
    db.refresh(module)
    user_id = user.id if user else "anonymous"
    cache_invalidate_prefix(f"cache:module:{user_id}:")
    return _module_to_response(module, _compute_module_stats(db, module))


@router.delete("/{module_id}", status_code=204)
def delete_module(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    module = _apply_module_scope(db.query(Module).filter(Module.id == module_id), user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    for document in list(module.documents):
        if document.file_path and os.path.exists(document.file_path):
            os.remove(document.file_path)

    db.delete(module)
    db.commit()
    user_id = user.id if user else "anonymous"
    cache_invalidate_prefix(f"cache:module:{user_id}:")
    return None


@router.post("/reorder", response_model=list[ModuleResponse])
def reorder_modules(
    body: ModuleReorderRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    if not body.ordered_ids:
        return []

    modules = _apply_module_scope(
        db.query(Module).filter(Module.id.in_(body.ordered_ids)),
        user,
    ).all()
    module_by_id = {module.id: module for module in modules}
    missing_ids = [module_id for module_id in body.ordered_ids if module_id not in module_by_id]
    if missing_ids:
        raise HTTPException(status_code=404, detail="One or more modules were not found")

    for index, module_id in enumerate(body.ordered_ids):
        module_by_id[module_id].sort_order = index

    db.commit()

    user_id = user.id if user else "anonymous"
    cache_invalidate_prefix(f"cache:module:{user_id}:")

    reordered = _apply_module_scope(db.query(Module), user).order_by(Module.sort_order.asc(), Module.created_at.desc()).all()
    return [_module_to_response(module, _compute_module_stats(db, module)) for module in reordered]


@router.post("/{module_id}/cancel-processing")
def cancel_module_processing(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    module = _apply_module_scope(db.query(Module).filter(Module.id == module_id), user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    jobs = db.query(ModuleJob).filter(
        ModuleJob.module_id == module_id,
        ModuleJob.status.in_(ACTIVE_JOB_STATUSES),
    ).all()
    if not jobs:
        return {"cancelled": 0}

    now = datetime.utcnow()
    document_ids = [job.document_id for job in jobs if job.document_id]
    if document_ids:
        docs = db.query(Document).filter(Document.id.in_(document_ids)).all()
        for doc in docs:
            doc.cancel_requested_at = now
            doc.processing_status = "cancelling"
            doc.processing_stage = "cancelling"
            doc.processing_error = "Cancellation requested"
            doc.last_pipeline_updated_at = now

    for job in jobs:
        job.cancel_requested_at = now
        job.status = "cancelling"
        job.stage = "cancelling"
        job.updated_at = now

    sync_module_pipeline_state(db, module.id)
    db.commit()
    return {"cancelled": len(jobs)}


@router.get("/{module_id}/stats", response_model=ModuleStatsResponse)
def get_module_stats(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    module = _apply_module_scope(db.query(Module).filter(Module.id == module_id), user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    from models.concept import Concept

    stats = _compute_module_stats(db, module)
    total_concepts = db.query(Concept).filter(Concept.module_id == module_id).count()
    total_questions = db.query(QuizQuestion).filter(QuizQuestion.module_id == module_id).count()

    return ModuleStatsResponse(
        id=module.id,
        name=module.name,
        total_cards=stats["total_cards"],
        due_cards=stats["due_cards"],
        new_cards=stats["new_cards"],
        learning_cards=stats["learning_cards"],
        review_cards=stats["review_cards"],
        mastery_pct=stats["mastery_pct"],
        total_documents=stats["total_documents"],
        total_concepts=total_concepts,
        total_questions=total_questions,
        auto_cards=stats["auto_cards"],
        manual_cards=stats["manual_cards"],
    )
