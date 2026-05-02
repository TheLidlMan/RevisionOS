import json
import logging
import time
import threading
import uuid
from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from cache import cache_get, cache_set, cache_invalidate_prefix
from config import settings
from database import get_db
from models.flashcard import Flashcard
from models.module import Module
from models.document import Document
from services.fsrs_service import schedule_review
from services import ai_service
from services.quota_service import ai_quota_scope
from services.auth_service import get_current_user, require_user
from models.user import User

router = APIRouter(tags=["flashcards"])
logger = logging.getLogger(__name__)

# In-process deduplication state for generate-cards requests {module_id: started_at}
_pending_generation: dict[str, float] = {}
_pending_lock = threading.Lock()
_GENERATION_DEBOUNCE_SECS = 30


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
    generation_source: str = "MANUAL"
    state: str = "NEW"
    last_review: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    rating: str  # AGAIN, HARD, GOOD, EASY


class BatchReviewItem(BaseModel):
    id: str
    rating: str
    duration_ms: Optional[int] = None


class BatchReviewResponse(BaseModel):
    reviewed: int
    results: list[ReviewResponse]


class PaginatedFlashcardsResponse(BaseModel):
    items: list[FlashcardResponse]
    total: int
    has_more: bool


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

def _card_to_response(card: Flashcard, fields: Optional[set] = None) -> FlashcardResponse:
    tags = []
    if card.tags:
        try:
            tags = json.loads(card.tags)
        except (json.JSONDecodeError, TypeError):
            tags = []

    # Build full response object; field selection trims content-heavy fields for list endpoints
    resp = FlashcardResponse(
        id=card.id,
        module_id=card.module_id,
        concept_id=card.concept_id,
        front=card.front if (fields is None or "front" in fields) else "",
        back=card.back if (fields is None or "back" in fields) else "",
        card_type=card.card_type,
        cloze_text=card.cloze_text if (fields is None or "cloze_text" in fields) else None,
        source_document_id=card.source_document_id,
        source_excerpt=card.source_excerpt if (fields is None or "source_excerpt" in fields) else None,
        tags=tags,
        due=card.due,
        stability=card.stability,
        difficulty=card.difficulty,
        elapsed_days=card.elapsed_days,
        scheduled_days=card.scheduled_days,
        reps=card.reps,
        lapses=card.lapses,
        generation_source=card.generation_source,
        state=card.state,
        last_review=card.last_review,
        created_at=card.created_at,
        updated_at=card.updated_at,
    )
    return resp


def _user_owns_card_condition(user_id: str, owned_module_ids):
    """Return SQLAlchemy condition for flashcard ownership, handling legacy NULL user_id rows."""
    return or_(
        Flashcard.user_id == user_id,
        and_(Flashcard.user_id.is_(None), Flashcard.module_id.in_(owned_module_ids)),
    )


def _owned_card_filter(db: Session, card_id: str, user_id: str):
    """Return a query that finds a flashcard by ID owned by user_id, handling legacy NULL user_id rows."""
    owned_module_ids = db.query(Module.id).filter(Module.user_id == user_id)
    return db.query(Flashcard).filter(
        Flashcard.id == card_id,
        _user_owns_card_condition(user_id, owned_module_ids),
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

@router.get("/api/flashcards", response_model=PaginatedFlashcardsResponse)
def list_flashcards(
    module_id: Optional[str] = None,
    due: Optional[bool] = None,
    generation_source: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    sort: Literal["updated_desc", "created_desc", "created_asc", "front_asc"] = "updated_desc",
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    owned_module_ids = db.query(Module.id).filter(Module.user_id == current_user.id)
    query = db.query(Flashcard).filter(
        _user_owns_card_condition(current_user.id, owned_module_ids)
    )
    if module_id:
        query = query.filter(Flashcard.module_id == module_id)
    if generation_source:
        query = query.filter(Flashcard.generation_source == generation_source.upper())
    if state:
        query = query.filter(Flashcard.state == state.upper())
    if due:
        now = datetime.utcnow()
        query = query.filter(Flashcard.due <= now)
    if search:
        term = f"%{search.strip()}%"
        if term != "%%":
            query = query.filter(or_(Flashcard.front.ilike(term), Flashcard.back.ilike(term)))

    total = query.with_entities(func.count(Flashcard.id)).scalar() or 0

    if sort == "created_desc":
        query = query.order_by(Flashcard.created_at.desc(), Flashcard.id.desc())
    elif sort == "created_asc":
        query = query.order_by(Flashcard.created_at.asc(), Flashcard.id.asc())
    elif sort == "front_asc":
        query = query.order_by(Flashcard.front.asc(), Flashcard.created_at.asc(), Flashcard.id.asc())
    else:
        query = query.order_by(Flashcard.updated_at.desc(), Flashcard.id.desc())

    cards = query.offset(skip).limit(limit).all()
    items = [_card_to_response(card) for card in cards]
    return PaginatedFlashcardsResponse(items=items, total=total, has_more=(skip + len(items)) < total)


@router.post("/api/flashcards", response_model=FlashcardResponse, status_code=201)
def create_flashcard(
    body: FlashcardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    module = db.query(Module).filter(Module.id == body.module_id, Module.user_id == current_user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    card = Flashcard(
        user_id=current_user.id,
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
    current_user: User = Depends(require_user),
):
    card = _owned_card_filter(db, card_id, current_user.id).first()
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
def delete_flashcard(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user),
):
    card = _owned_card_filter(db, card_id, current_user.id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    db.delete(card)
    db.commit()
    return None


@router.post("/api/flashcards/{card_id}/review", response_model=ReviewResponse)
def review_flashcard(
    card_id: str,
    body: ReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    card = _owned_card_filter(db, card_id, user.id).first()
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


@router.post("/api/flashcards/review/batch", response_model=BatchReviewResponse)
def review_flashcards_batch(
    items: list[BatchReviewItem],
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """
    Submit multiple flashcard reviews in a single database transaction.
    Accepts a list of {id, rating, duration_ms} objects.
    """
    if not items:
        return BatchReviewResponse(reviewed=0, results=[])

    card_ids = [item.id for item in items]
    cards = {c.id: c for c in db.query(Flashcard).filter(Flashcard.id.in_(card_ids)).all()}

    results: list[ReviewResponse] = []
    errors: list[str] = []

    for item in items:
        card = cards.get(item.id)
        if not card:
            errors.append(f"Card {item.id} not found")
            continue

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
            result = schedule_review(card_data, item.rating)
        except ValueError as exc:
            errors.append(f"Card {item.id}: {exc}")
            continue

        card.due = result["due"]
        card.stability = result["stability"]
        card.difficulty = result["difficulty"]
        card.elapsed_days = result["elapsed_days"]
        card.scheduled_days = result["scheduled_days"]
        card.reps = result["reps"]
        card.lapses = result["lapses"]
        card.state = result["state"]
        card.last_review = result["last_review"]
        results.append(ReviewResponse(
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
        ))

    # Single commit for all cards
    db.commit()

    if errors:
        logger.warning("Batch review had %d error(s): %s", len(errors), "; ".join(errors))

    # Award XP once for the whole batch
    if user and results:
        try:
            from routers.gamification import process_card_review
            for _r in results:
                process_card_review(db, user.id)
        except Exception as exc:
            logger.warning("Failed to award batch gamification XP: %s", exc)

    # Invalidate cache for this user's due flashcards
    if user:
        cache_invalidate_prefix(f"cache:flashcards:{user.id}:")

    return BatchReviewResponse(reviewed=len(results), results=results)


@router.post("/api/modules/{module_id}/generate-cards", response_model=GenerateCardsResponse)
async def generate_cards_for_module(
    module_id: str,
    body: Optional[GenerateCardsRequest] = None,
    db: Session = Depends(get_db),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    # Debounce: reject duplicate generation requests within GENERATION_DEBOUNCE_SECS
    with _pending_lock:
        last = _pending_generation.get(module_id)
        now_ts = time.monotonic()
        if last is not None and (now_ts - last) < _GENERATION_DEBOUNCE_SECS:
            remaining = int(_GENERATION_DEBOUNCE_SECS - (now_ts - last))
            raise HTTPException(
                status_code=429,
                detail=f"Generation already in progress for this module. Try again in {remaining}s.",
            )
        _pending_generation[module_id] = now_ts

    try:
        return await _do_generate_cards(module_id, body, db, module)
    finally:
        with _pending_lock:
            _pending_generation.pop(module_id, None)


async def _do_generate_cards(module_id: str, body: Optional[GenerateCardsRequest], db: Session, module: Module) -> GenerateCardsResponse:
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
