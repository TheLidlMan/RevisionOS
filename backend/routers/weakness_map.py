from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.orm import load_only, selectinload

from cache import cache_get, cache_set
from database import get_db
from models.concept import Concept
from models.flashcard import Flashcard
from models.quiz_question import QuizQuestion
from models.review_log import ReviewLog
from models.module import Module
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(prefix="/api/weakness-map", tags=["weakness-map"])


# ---------- Pydantic schemas ----------

class ConceptConfidence(BaseModel):
    id: str
    name: str
    definition: Optional[str] = None
    importance_score: float = 0.5
    accuracy_rate: float = 0.0
    review_count: int = 0
    last_reviewed: Optional[datetime] = None
    trend: str = "stable"  # improving, declining, stable
    confidence_score: float = 0.0


class WeaknessMapResponse(BaseModel):
    concepts: list[ConceptConfidence]
    total_concepts: int = 0
    weak_count: int = 0
    mastered_count: int = 0


class OptimalSessionItem(BaseModel):
    concept_id: str
    concept_name: str
    confidence_score: float
    question_ids: list[str] = []
    flashcard_ids: list[str] = []


class OptimalSessionResponse(BaseModel):
    items: list[OptimalSessionItem]
    total_items: int = 0


# ---------- Helpers ----------

def _compute_concept_confidence(concept: Concept, logs_by_item_id: dict[str, list]) -> ConceptConfidence:
    """Compute confidence metrics for a single concept."""
    # Gather linked item IDs
    flashcard_ids = [f.id for f in concept.flashcards]
    question_ids = [q.id for q in concept.quiz_questions]
    all_item_ids = flashcard_ids + question_ids

    if not all_item_ids:
        return ConceptConfidence(
            id=concept.id,
            name=concept.name,
            definition=concept.definition,
            importance_score=concept.importance_score,
        )

    # Get review logs for these items
    logs = []
    for item_id in all_item_ids:
        logs.extend(logs_by_item_id.get(item_id, []))
    logs.sort(key=lambda log: log.answered_at, reverse=True)

    review_count = len(logs)
    correct_count = sum(1 for lg in logs if lg.was_correct)
    accuracy_rate = (correct_count / review_count * 100) if review_count > 0 else 0.0

    last_reviewed = logs[0].answered_at if logs else None

    # Trend: compare last 5 vs previous 5
    trend = "stable"
    if len(logs) >= 10:
        recent_5 = logs[:5]
        prev_5 = logs[5:10]
        recent_acc = sum(1 for lg in recent_5 if lg.was_correct) / 5
        prev_acc = sum(1 for lg in prev_5 if lg.was_correct) / 5
        if recent_acc - prev_acc > 0.1:
            trend = "improving"
        elif prev_acc - recent_acc > 0.1:
            trend = "declining"

    # Confidence score: accuracy * recency_factor * stability_factor (0-100)
    recency_factor = 1.0
    if last_reviewed:
        days_since = (datetime.utcnow() - last_reviewed).days
        recency_factor = max(0.1, 1.0 - (days_since / 60.0))

    # Stability factor: more reviews = more stable
    stability_factor = min(1.0, review_count / 10.0)

    confidence_score = round(
        (accuracy_rate / 100.0) * recency_factor * stability_factor * 100, 1
    )

    # Also factor in question-level stats
    for q in concept.quiz_questions:
        if q.times_answered > 0:
            q_acc = q.times_correct / q.times_answered
            accuracy_rate = (accuracy_rate + q_acc * 100) / 2

    return ConceptConfidence(
        id=concept.id,
        name=concept.name,
        definition=concept.definition,
        importance_score=concept.importance_score,
        accuracy_rate=round(accuracy_rate, 1),
        review_count=review_count,
        last_reviewed=last_reviewed,
        trend=trend,
        confidence_score=confidence_score,
    )


# ---------- Endpoints ----------

@router.get("", response_model=WeaknessMapResponse)
def get_weakness_map(
    module_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Compute confidence scores per concept for the weakness map."""
    query = db.query(Concept)
    if user:
        query = query.filter(Concept.user_id == user.id)
    if module_id:
        module = db.query(Module).filter(Module.id == module_id).first()
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        query = query.filter(Concept.module_id == module_id)

    user_id = user.id if user else "anonymous"
    cache_key = f"cache:weakness-map:{user_id}:{module_id or 'all'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    concepts = (
        query.options(
            load_only(Concept.id, Concept.name, Concept.definition, Concept.importance_score),
            selectinload(Concept.flashcards).load_only(Flashcard.id),
            selectinload(Concept.quiz_questions).load_only(
                QuizQuestion.id,
                QuizQuestion.times_answered,
                QuizQuestion.times_correct,
            ),
        )
        .order_by(Concept.importance_score.desc())
        .all()
    )

    item_ids = [
        item_id
        for concept in concepts
        for item_id in (
            [flashcard.id for flashcard in concept.flashcards]
            + [question.id for question in concept.quiz_questions]
        )
    ]
    logs_by_item_id: dict[str, list] = {}
    if item_ids:
        logs = (
            db.query(ReviewLog.item_id, ReviewLog.answered_at, ReviewLog.was_correct)
            .filter(ReviewLog.item_id.in_(item_ids))
            .order_by(ReviewLog.item_id.asc(), ReviewLog.answered_at.desc())
            .all()
        )
        for log in logs:
            logs_by_item_id.setdefault(log.item_id, []).append(log)

    results = [_compute_concept_confidence(c, logs_by_item_id) for c in concepts]

    weak_count = sum(1 for r in results if r.confidence_score < 40)
    mastered_count = sum(1 for r in results if r.confidence_score >= 80)

    response = WeaknessMapResponse(
        concepts=results,
        total_concepts=len(results),
        weak_count=weak_count,
        mastered_count=mastered_count,
    )
    cache_set(cache_key, response.model_dump(mode="json"), ttl=60)
    return response


@router.get("/optimal-session", response_model=OptimalSessionResponse)
def get_optimal_session(
    module_id: Optional[str] = Query(None),
    max_items: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Generate optimal study session from weakest concepts."""
    query = db.query(Concept)
    if user:
        query = query.filter(Concept.user_id == user.id)
    if module_id:
        module = db.query(Module).filter(Module.id == module_id).first()
        if not module:
            raise HTTPException(status_code=404, detail="Module not found")
        query = query.filter(Concept.module_id == module_id)

    concepts = (
        query.options(
            load_only(Concept.id, Concept.name, Concept.definition, Concept.importance_score),
            selectinload(Concept.flashcards).load_only(Flashcard.id),
            selectinload(Concept.quiz_questions).load_only(
                QuizQuestion.id,
                QuizQuestion.times_answered,
                QuizQuestion.times_correct,
            ),
        )
        .all()
    )
    if not concepts:
        return OptimalSessionResponse(items=[], total_items=0)

    item_ids = [
        item_id
        for concept in concepts
        for item_id in (
            [flashcard.id for flashcard in concept.flashcards]
            + [question.id for question in concept.quiz_questions]
        )
    ]
    logs_by_item_id: dict[str, list] = {}
    if item_ids:
        logs = (
            db.query(ReviewLog.item_id, ReviewLog.answered_at, ReviewLog.was_correct)
            .filter(ReviewLog.item_id.in_(item_ids))
            .order_by(ReviewLog.item_id.asc(), ReviewLog.answered_at.desc())
            .all()
        )
        for log in logs:
            logs_by_item_id.setdefault(log.item_id, []).append(log)

    scored = [(_compute_concept_confidence(c, logs_by_item_id), c) for c in concepts]
    scored.sort(key=lambda x: x[0].confidence_score)

    # Take bottom 20% or at least 1
    cutoff = max(1, len(scored) // 5)
    weak_concepts = scored[:cutoff]

    items: list[OptimalSessionItem] = []
    total_items = 0

    for conf, concept in weak_concepts:
        q_ids = [q.id for q in concept.quiz_questions]
        f_ids = [f.id for f in concept.flashcards]
        items.append(OptimalSessionItem(
            concept_id=concept.id,
            concept_name=concept.name,
            confidence_score=conf.confidence_score,
            question_ids=q_ids,
            flashcard_ids=f_ids,
        ))
        total_items += len(q_ids) + len(f_ids)

        if total_items >= max_items:
            break

    return OptimalSessionResponse(items=items, total_items=total_items)
