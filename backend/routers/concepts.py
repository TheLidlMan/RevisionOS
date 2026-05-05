import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database import get_db
from models.concept import Concept
from models.flashcard import Flashcard
from models.module import Module
from models.quiz_question import QuizQuestion
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from typing import Optional as OptionalType
from services.auth_service import get_current_user, require_user
from models.user import User

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


# ---------- Pydantic schemas ----------

class ConceptResponse(BaseModel):
    id: str
    module_id: str
    name: str
    definition: Optional[str] = None
    explanation: Optional[str] = None
    importance_score: float = 0.5
    study_weight: float = 1.0
    created_at: datetime

    model_config = {"from_attributes": True}


class FlashcardBrief(BaseModel):
    id: str
    front: str
    back: str
    state: str = "NEW"


class QuestionBrief(BaseModel):
    id: str
    question_text: str
    question_type: str
    difficulty: str
    times_answered: int = 0
    times_correct: int = 0


class ConceptDetailResponse(BaseModel):
    id: str
    module_id: str
    name: str
    definition: Optional[str] = None
    explanation: Optional[str] = None
    importance_score: float = 0.5
    created_at: datetime
    flashcards: list[FlashcardBrief] = []
    questions: list[QuestionBrief] = []
    accuracy_rate: float = 0.0
    total_reviews: int = 0


class DrillSessionResponse(BaseModel):
    session_id: str
    concept_id: str
    concept_name: str
    session_type: str = "WEAKNESS_DRILL"
    question_ids: list[str] = []
    flashcard_ids: list[str] = []
    total_items: int = 0


# ---------- Endpoints ----------


@router.get("/content-map/{module_id}")
async def get_content_map(
    module_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    """Get content map showing all topics/subtopics for a module."""
    from services.content_indexer import generate_content_map
    module = db.query(Module.id).filter(Module.id == module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return await generate_content_map(module_id, db)


@router.get("", response_model=list[ConceptResponse])
def list_concepts(
    module_id: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    query = db.query(Concept)
    if user:
        query = query.filter(Concept.user_id == user.id)
    if module_id:
        query = query.filter(Concept.module_id == module_id)
    concepts = (
        query.with_entities(
            Concept.id,
            Concept.module_id,
            Concept.name,
            Concept.definition,
            Concept.explanation,
            Concept.importance_score,
            Concept.study_weight,
            Concept.created_at,
        )
        .order_by(Concept.importance_score.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [
        ConceptResponse(
            id=c.id,
            module_id=c.module_id,
            name=c.name,
            definition=c.definition,
            explanation=c.explanation,
            importance_score=c.importance_score,
            study_weight=c.study_weight,
            created_at=c.created_at,
        )
        for c in concepts
    ]


@router.get("/{concept_id}", response_model=ConceptDetailResponse)
def get_concept_detail(concept_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Return concept with linked flashcards, questions, and accuracy stats."""
    query = db.query(Concept).filter(Concept.id == concept_id)
    if user:
        query = query.filter(Concept.user_id == user.id)
    concept = query.first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    flashcards = (
        db.query(Flashcard.id, Flashcard.front, Flashcard.back, Flashcard.state)
        .filter(Flashcard.concept_id == concept_id)
        .all()
    )
    questions = (
        db.query(
            QuizQuestion.id,
            QuizQuestion.question_text,
            QuizQuestion.question_type,
            QuizQuestion.difficulty,
            QuizQuestion.times_answered,
            QuizQuestion.times_correct,
        )
        .filter(QuizQuestion.concept_id == concept_id)
        .all()
    )

    fc_briefs = [
        FlashcardBrief(id=f.id, front=f.front, back=f.back, state=f.state)
        for f in flashcards
    ]
    q_briefs = [
        QuestionBrief(
            id=q.id,
            question_text=q.question_text,
            question_type=q.question_type,
            difficulty=q.difficulty,
            times_answered=q.times_answered,
            times_correct=q.times_correct,
        )
        for q in questions
    ]

    # Compute accuracy stats from review logs
    item_ids = [f.id for f in flashcards] + [q.id for q in questions]
    total_reviews = 0
    accuracy_rate = 0.0
    if item_ids:
        stats = db.query(
            func.count(ReviewLog.id).label("total_reviews"),
            func.sum(case((ReviewLog.was_correct.is_(True), 1), else_=0)).label("correct_reviews"),
        ).filter(ReviewLog.item_id.in_(item_ids)).one()
        total_reviews = int(stats.total_reviews or 0)
        if total_reviews > 0:
            accuracy_rate = round((int(stats.correct_reviews or 0) / total_reviews) * 100, 1)

    return ConceptDetailResponse(
        id=concept.id,
        module_id=concept.module_id,
        name=concept.name,
        definition=concept.definition,
        explanation=concept.explanation,
        importance_score=concept.importance_score,
        created_at=concept.created_at,
        flashcards=fc_briefs,
        questions=q_briefs,
        accuracy_rate=accuracy_rate,
        total_reviews=total_reviews,
    )


@router.post("/{concept_id}/drill", response_model=DrillSessionResponse)
def create_drill_session(concept_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Create a WEAKNESS_DRILL session targeting this concept's questions and flashcards."""
    query = db.query(Concept).filter(Concept.id == concept_id)
    if user:
        query = query.filter(Concept.user_id == user.id)
    concept = query.first()
    if not concept:
        raise HTTPException(status_code=404, detail="Concept not found")

    question_ids = [q.id for q in concept.quiz_questions]
    flashcard_ids = [f.id for f in concept.flashcards]

    if not question_ids and not flashcard_ids:
        raise HTTPException(
            status_code=400,
            detail="No questions or flashcards linked to this concept",
        )

    session = StudySession(
        module_id=concept.module_id,
        session_type="WEAKNESS_DRILL",
        started_at=datetime.utcnow(),
        total_items=len(question_ids) + len(flashcard_ids),
        user_id=user.id if user else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return DrillSessionResponse(
        session_id=session.id,
        concept_id=concept.id,
        concept_name=concept.name,
        session_type="WEAKNESS_DRILL",
        question_ids=question_ids,
        flashcard_ids=flashcard_ids,
        total_items=len(question_ids) + len(flashcard_ids),
    )
