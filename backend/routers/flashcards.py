import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.flashcard import Flashcard
from models.module import Module
from services.fsrs_service import schedule_review
from services.pipeline_service import _generate_missing_flashcards

router = APIRouter(tags=["flashcards"])


# ---------- Pydantic schemas ----------

class FlashcardCreate(BaseModel):
    module_id: str
    front: str
    back: str
    card_type: str = "BASIC"
    cloze_text: Optional[str] = None
    concept_id: Optional[str] = None
    source_document_id: Optional[str] = None
    source_excerpt: Optional[str] = None
    tags: list[str] = []


class FlashcardUpdate(BaseModel):
    front: Optional[str] = None
    back: Optional[str] = None
    card_type: Optional[str] = None
    cloze_text: Optional[str] = None
    tags: Optional[list[str]] = None


class FlashcardResponse(BaseModel):
    id: str
    module_id: str
    concept_id: Optional[str] = None
    front: str
    back: str
    card_type: str
    cloze_text: Optional[str] = None
    source_document_id: Optional[str] = None
    source_excerpt: Optional[str] = None
    tags: list[str] = []
    generation_source: str = "MANUAL"
    due: Optional[datetime] = None
    stability: float = 0.0
    difficulty: float = 0.0
    elapsed_days: int = 0
    scheduled_days: int = 0
    reps: int = 0
    lapses: int = 0
    state: str = "NEW"
    last_review: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    rating: str  # AGAIN, HARD, GOOD, EASY


class ReviewResponse(BaseModel):
    id: str
    due: datetime
    stability: float
    difficulty: float
    elapsed_days: int
    scheduled_days: int
    reps: int
    lapses: int
    state: str
    last_review: Optional[datetime] = None


class GenerateCardsRequest(BaseModel):
    num_cards: Optional[int] = None


class GenerateCardsResponse(BaseModel):
    generated: int
    cards: list[FlashcardResponse]


# ---------- Helpers ----------

def _card_to_response(card: Flashcard) -> FlashcardResponse:
    tags = []
    if card.tags:
        try:
            tags = json.loads(card.tags)
        except (json.JSONDecodeError, TypeError):
            tags = []
    return FlashcardResponse(
        id=card.id,
        module_id=card.module_id,
        concept_id=card.concept_id,
        front=card.front,
        back=card.back,
        card_type=card.card_type,
        cloze_text=card.cloze_text,
        source_document_id=card.source_document_id,
        source_excerpt=card.source_excerpt,
        tags=tags,
        generation_source=card.generation_source,
        due=card.due,
        stability=card.stability,
        difficulty=card.difficulty,
        elapsed_days=card.elapsed_days,
        scheduled_days=card.scheduled_days,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        last_review=card.last_review,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )


# ---------- Endpoints ----------

@router.get("/api/flashcards", response_model=list[FlashcardResponse])
def list_flashcards(
    module_id: Optional[str] = None,
    due: Optional[bool] = None,
    generation_source: Optional[str] = None,
    state: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Flashcard)
    if module_id:
        query = query.filter(Flashcard.module_id == module_id)
    if due:
        now = datetime.utcnow()
        query = query.filter(Flashcard.due <= now)
    if generation_source:
        query = query.filter(Flashcard.generation_source == generation_source.upper())
    if state:
        query = query.filter(Flashcard.state == state.upper())
    cards = query.order_by(Flashcard.due.asc()).all()
    return [_card_to_response(c) for c in cards]


@router.post("/api/flashcards", response_model=FlashcardResponse, status_code=201)
def create_flashcard(body: FlashcardCreate, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == body.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    card = Flashcard(
        module_id=body.module_id,
        front=body.front,
        back=body.back,
        card_type=body.card_type.upper(),
        cloze_text=body.cloze_text,
        concept_id=body.concept_id,
        source_document_id=body.source_document_id,
        source_excerpt=body.source_excerpt,
        tags=json.dumps(body.tags),
        generation_source="MANUAL",
        due=datetime.utcnow(),
        state="NEW",
    )
    db.add(card)
    module.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(card)
    return _card_to_response(card)


@router.patch("/api/flashcards/{card_id}", response_model=FlashcardResponse)
def update_flashcard(card_id: str, body: FlashcardUpdate, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if body.front is not None:
        card.front = body.front
    if body.back is not None:
        card.back = body.back
    if body.card_type is not None:
        card.card_type = body.card_type.upper()
    if body.cloze_text is not None:
        card.cloze_text = body.cloze_text
    if body.tags is not None:
        card.tags = json.dumps(body.tags)
    module = db.query(Module).filter(Module.id == card.module_id).first()
    if module:
        module.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(card)
    return _card_to_response(card)


@router.delete("/api/flashcards/{card_id}", status_code=204)
def delete_flashcard(card_id: str, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    module = db.query(Module).filter(Module.id == card.module_id).first()
    if module:
        module.updated_at = datetime.utcnow()
    db.delete(card)
    db.commit()
    return None


@router.post("/api/flashcards/{card_id}/review", response_model=ReviewResponse)
def review_flashcard(card_id: str, body: ReviewRequest, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    card_data = {
        "due": card.due,
        "stability": card.stability,
        "difficulty": card.difficulty,
        "elapsed_days": card.elapsed_days,
        "scheduled_days": card.scheduled_days,
        "reps": card.reps,
        "lapses": card.lapses,
        "state": card.state,
        "last_review": card.last_review,
    }

    try:
        result = schedule_review(card_data, body.rating)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    card.due = result["due"]
    card.stability = result["stability"]
    card.difficulty = result["difficulty"]
    card.elapsed_days = result["elapsed_days"]
    card.scheduled_days = result["scheduled_days"]
    card.reps = result["reps"]
    card.lapses = result["lapses"]
    card.state = result["state"]
    card.last_review = result["last_review"]
    module = db.query(Module).filter(Module.id == card.module_id).first()
    if module:
        module.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(card)

    return ReviewResponse(
        id=card.id,
        due=card.due,
        stability=card.stability,
        difficulty=card.difficulty,
        elapsed_days=card.elapsed_days,
        scheduled_days=card.scheduled_days,
        reps=card.reps,
        lapses=card.lapses,
        state=card.state,
        last_review=card.last_review,
    )


@router.post("/api/modules/{module_id}/generate-cards", response_model=GenerateCardsResponse)
async def generate_cards_for_module(
    module_id: str,
    body: Optional[GenerateCardsRequest] = None,
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    before_ids = {card.id for card in db.query(Flashcard).filter(Flashcard.module_id == module_id).all()}
    await _generate_missing_flashcards(module, db)
    db.commit()
    created_cards = [
        card
        for card in db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
        if card.id not in before_ids
    ]

    return GenerateCardsResponse(generated=len(created_cards), cards=[_card_to_response(card) for card in created_cards])
