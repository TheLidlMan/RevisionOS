import json
import logging
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
from services.quota_service import ai_quota_scope
from services.auth_service import get_current_user
from services.ownership import require_owned_flashcard, require_owned_module, scope_flashcards
from models.user import User

router = APIRouter(tags=["flashcards"])
logger = logging.getLogger(__name__)


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
    xp_earned: int = 0
    xp_total: int = 0
    level: int = 1
    level_up: bool = False
    new_achievements: list[dict] = []


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


def _allocate_card_targets(docs: list[Document], requested_total: Optional[int]) -> dict[str, int]:
    if not docs:
        return {}

    if requested_total is None:
        return {doc.id: settings.CARDS_PER_DOCUMENT for doc in docs}

    if requested_total <= 0:
        return {doc.id: 0 for doc in docs}

    weights = [max(1, doc.word_count or len((doc.raw_text or "").split()) or 1) for doc in docs]
    if requested_total < len(docs):
        ranked_indexes = sorted(range(len(docs)), key=lambda idx: weights[idx], reverse=True)
        allocations = [0 for _ in docs]
        for idx in ranked_indexes[:requested_total]:
            allocations[idx] = 1
        return {doc.id: allocations[index] for index, doc in enumerate(docs)}

    total_weight = sum(weights) or len(docs)
    allocations = [max(1, round(requested_total * weight / total_weight)) for weight in weights]

    difference = requested_total - sum(allocations)
    ranked_indexes = sorted(range(len(docs)), key=lambda idx: weights[idx], reverse=True)

    while difference > 0:
        for idx in ranked_indexes:
            allocations[idx] += 1
            difference -= 1
            if difference == 0:
                break

    while difference < 0:
        adjusted = False
        for idx in reversed(ranked_indexes):
            if allocations[idx] <= 1:
                continue
            allocations[idx] -= 1
            difference += 1
            adjusted = True
            if difference == 0:
                break
        if not adjusted:
            break

    return {doc.id: allocations[index] for index, doc in enumerate(docs)}


# ---------- Endpoints ----------

@router.get("/api/flashcards", response_model=list[FlashcardResponse])
def list_flashcards(
    module_id: Optional[str] = None,
    due: Optional[bool] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    query = scope_flashcards(db.query(Flashcard), user)
    if module_id:
        require_owned_module(db, module_id, user)
        query = query.filter(Flashcard.module_id == module_id)
    if due:
        now = datetime.utcnow()
        query = query.filter(Flashcard.due <= now)
    cards = query.order_by(Flashcard.due.asc()).all()
    return [_card_to_response(c) for c in cards]


@router.post("/api/flashcards", response_model=FlashcardResponse, status_code=201)
def create_flashcard(
    body: FlashcardCreate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    module = require_owned_module(db, body.module_id, user)

    card = Flashcard(
        user_id=module.user_id,
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
def update_flashcard(
    card_id: str,
    body: FlashcardUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    card = require_owned_flashcard(db, card_id, user)
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
def delete_flashcard(
    card_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    card = require_owned_flashcard(db, card_id, user)
    db.delete(card)
    db.commit()
    return None


@router.post("/api/flashcards/{card_id}/review", response_model=ReviewResponse)
def review_flashcard(
    card_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    card = require_owned_flashcard(db, card_id, user)

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

    # Award XP via gamification
    xp_data = {"xp_earned": 0, "xp_total": 0, "level": 1, "level_up": False, "new_achievements": []}
    if user:
        try:
            from routers.gamification import process_card_review
            xp_result = process_card_review(db, user.id)
            xp_data = {
                "xp_earned": xp_result.xp_earned,
                "xp_total": xp_result.xp_total,
                "level": xp_result.level,
                "level_up": xp_result.level_up,
                "new_achievements": [
                    {"key": a.achievement_key, "name": a.name, "icon": a.icon}
                    for a in xp_result.new_achievements
                ],
            }
        except Exception as exc:
            logger.warning("Failed to award gamification XP for card review %s: %s", card_id, exc)

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
        xp_earned=xp_data["xp_earned"],
        xp_total=xp_data["xp_total"],
        level=xp_data["level"],
        level_up=xp_data["level_up"],
        new_achievements=xp_data["new_achievements"],
    )


@router.post("/api/modules/{module_id}/generate-cards", response_model=GenerateCardsResponse)
async def generate_cards_for_module(
    module_id: str,
    body: Optional[GenerateCardsRequest] = None,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    module = require_owned_module(db, module_id, user)

    module_name = module.name
    module_user_id = module.user_id

    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = (
        db.query(Document)
        .filter(
            Document.module_id == module_id,
            Document.processing_status == "done",
            Document.delete_requested_at.is_(None),
        )
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents found in this module")

    requested_total = body.num_cards if body and body.num_cards else None
    card_targets = _allocate_card_targets(docs, requested_total)
    generated_cards_data: list[dict] = []
    seen_pairs: set[tuple[str, str]] = set()

    with ai_quota_scope(module_user_id):
        for doc in docs:
            raw_text = (doc.raw_text or "").strip()
            target_cards = card_targets.get(doc.id, settings.CARDS_PER_DOCUMENT)
            if not raw_text or target_cards <= 0:
                continue

            doc_cards = await ai_service.generate_flashcards(
                raw_text,
                target_cards,
                module_name,
                source_name=doc.filename,
            )

            for card_data in doc_cards:
                if not isinstance(card_data, dict):
                    continue
                front = str(card_data.get("front") or "").strip()
                back = str(card_data.get("back") or "").strip()
                pair = (front.lower(), back.lower())
                if not front or not back or pair in seen_pairs:
                    continue
                seen_pairs.add(pair)
                generated_cards_data.append(
                    {
                        **card_data,
                        "source_document_id": doc.id,
                        "source_excerpt": raw_text[:200],
                    }
                )

    created_cards = []
    for card_data in generated_cards_data:
        card_type = str(card_data.get("type", "basic")).upper()
        if card_type not in ("BASIC", "CLOZE"):
            card_type = "BASIC"

        tags = card_data.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        front_val = card_data.get("front") or ""
        back_val = card_data.get("back") or ""
        # For CLOZE cards the AI may omit back; fall back to cloze_text
        if card_type == "CLOZE" and not back_val:
            back_val = card_data.get("cloze_text") or ""

        card = Flashcard(
            user_id=module_user_id,
            module_id=module_id,
            front=front_val,
            back=back_val,
            card_type=card_type,
            cloze_text=card_data.get("cloze_text"),
            source_document_id=card_data.get("source_document_id"),
            source_excerpt=card_data.get("source_excerpt"),
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
            generation_source="AUTO",
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
