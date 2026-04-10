import math
import json
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.flashcard import Flashcard
from models.module import Module
from models.document import Document
from services.fsrs_service import schedule_review
from services import ai_service

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
    )


# ---------- Endpoints ----------

@router.get("/api/flashcards", response_model=list[FlashcardResponse])
def list_flashcards(
    module_id: Optional[str] = None,
    due: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Flashcard)
    if module_id:
        query = query.filter(Flashcard.module_id == module_id)
    if due:
        now = datetime.utcnow()
        query = query.filter(Flashcard.due <= now)
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
        due=datetime.utcnow(),
        state="NEW",
    )
    db.add(card)
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
    db.commit()
    db.refresh(card)
    return _card_to_response(card)


@router.delete("/api/flashcards/{card_id}", status_code=204)
def delete_flashcard(card_id: str, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
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

    docs = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.processing_status == "done")
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents found in this module")

    num_cards = body.num_cards if body and body.num_cards is not None else settings.CARDS_PER_DOCUMENT
    if num_cards <= 0:
        raise HTTPException(status_code=400, detail="num_cards must be greater than 0")

    # Use chunked generation for massive flashcard output
    from services.rag_service import retrieve_all_document_chunks
    chunks = retrieve_all_document_chunks(db, module_id, chunk_size=4000)

    if not chunks:
        # Fallback: concatenate all text and generate a single batch
        all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
        max_chars = min(settings.MAX_CONTEXT_TOKENS * 3, settings.MAX_PROMPT_CHARS)
        if len(all_text) > max_chars:
            all_text = all_text[:max_chars]
        generated_cards_data = await ai_service.generate_flashcards(all_text, num_cards, module.name)
    else:
        chunk_count = min(len(chunks), max(1, num_cards))
        selected_chunks = chunks[:chunk_count]
        cards_per_chunk = max(1, math.ceil(num_cards / chunk_count))
        generated_cards_data = await ai_service.generate_flashcards_chunked(
            selected_chunks,
            module.name,
            cards_per_chunk=cards_per_chunk,
            max_total_cards=num_cards,
        )

    # Load concepts for tagging
    from models.concept import Concept
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    concept_map = {c.name.lower(): c.id for c in concepts}

    created_cards = []
    for card_data in generated_cards_data:
        card_type = "CLOZE"  # All cards are now fill-in-the-gap

        tags = card_data.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        front_val = card_data.get("front") or ""
        back_val = card_data.get("back") or ""

        if not front_val or not back_val:
            continue

        # Try to match a concept
        concept_name = card_data.get("concept_name", "")
        concept_id = None
        if concept_name:
            concept_id = concept_map.get(concept_name.lower())
            if not concept_id:
                # Fuzzy match: find closest concept name
                for cname, cid in concept_map.items():
                    if concept_name.lower() in cname or cname in concept_name.lower():
                        concept_id = cid
                        break

        source_doc_id = card_data.get("source_document_id") or (docs[0].id if docs else None)

        card = Flashcard(
            module_id=module_id,
            front=front_val,
            back=back_val,
            card_type=card_type,
            cloze_text=front_val,
            concept_id=concept_id,
            source_document_id=source_doc_id,
            source_excerpt=card_data.get("source_excerpt"),
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
        )
        db.add(card)
        created_cards.append(card)

    db.commit()
    for c in created_cards:
        db.refresh(c)

    return GenerateCardsResponse(
        generated=len(created_cards),
        cards=[_card_to_response(c) for c in created_cards],
    )
