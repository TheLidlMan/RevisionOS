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
from models.user import User
from services import ai_service
from services.auth_service import get_current_user
from services.quota_service import ai_quota_scope

router = APIRouter(tags=["tutor"])


class TutorExplainRequest(BaseModel):
    concept: str
    context: str = ""
    mode: str = "eli5"  # eli5, deep, example, why_wrong
    card_id: Optional[str] = None
    user_answer: Optional[str] = None


class TutorExplainResponse(BaseModel):
    explanation: str
    key_takeaways: list[str] = []
    memory_hook: str = ""


class TopicGenerateRequest(BaseModel):
    topic: str
    module_id: str
    num_cards: int = Field(default=30, ge=1, le=settings.MAX_CARDS_PER_REQUEST)


class TopicGenerateResponse(BaseModel):
    generated: int
    topic: str


@router.post("/api/tutor/explain", response_model=TutorExplainResponse)
async def tutor_explain(
    body: TutorExplainRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    card_front = None
    card_back = None
    if body.card_id:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        card = (
            db.query(Flashcard)
            .join(Module, Module.id == Flashcard.module_id)
            .filter(Flashcard.id == body.card_id, Module.user_id == user.id)
            .first()
        )
        if card:
            card_front = card.front
            card_back = card.back

    user_id = user.id if user else None
    db.close()
    with ai_quota_scope(user_id):
        result = await ai_service.tutor_explain(
            concept=body.concept,
            context=body.context,
            mode=body.mode,
            card_front=card_front,
            card_back=card_back,
            user_answer=body.user_answer,
        )

    return TutorExplainResponse(
        explanation=result.get("explanation", ""),
        key_takeaways=result.get("key_takeaways", []),
        memory_hook=result.get("memory_hook", ""),
    )


@router.post("/api/tutor/topic-generate", response_model=TopicGenerateResponse)
async def topic_generate(
    body: TopicGenerateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Generate flashcards from a topic name alone (no source document needed)."""
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    module = (
        db.query(Module)
        .filter(Module.id == body.module_id, Module.user_id == user.id)
        .first()
    )
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    user_id = user.id
    with ai_quota_scope(user_id):
        cards_data = await ai_service.generate_cards_from_topic(body.topic, body.num_cards)

    created_count = 0
    for card_data in cards_data:
        card_type = card_data.get("type", "CLOZE").upper()
        if card_type not in ("BASIC", "CLOZE"):
            card_type = "CLOZE"

        tags = card_data.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        front_val = card_data.get("front") or ""
        back_val = card_data.get("back") or ""
        if card_type == "CLOZE" and not back_val:
            back_val = card_data.get("cloze_text") or ""

        card = Flashcard(
            module_id=body.module_id,
            front=front_val,
            back=back_val,
            card_type=card_type,
            cloze_text=card_data.get("cloze_text"),
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
            generation_source="AI_TOPIC",
        )
        if hasattr(card, 'user_id') and user_id:
            card.user_id = user_id
        db.add(card)
        created_count += 1

    db.commit()

    return TopicGenerateResponse(
        generated=created_count,
        topic=body.topic,
    )
