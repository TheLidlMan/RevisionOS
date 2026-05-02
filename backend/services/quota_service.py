from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, time, timedelta, timezone

from fastapi import HTTPException
from config import settings
from database import SessionLocal
from models.ai_usage_event import AiUsageEvent


_current_user_id: ContextVar[str | None] = ContextVar("current_ai_user_id", default=None)


class AiQuotaExceededError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(status_code=429, detail=detail)


@contextmanager
def ai_quota_scope(user_id: str | None):
    token = _current_user_id.set(user_id)
    try:
        yield
    finally:
        _current_user_id.reset(token)


def get_current_ai_user_id() -> str | None:
    return _current_user_id.get()


_NEW_CARD_KINDS = frozenset({"flashcards", "synthesis_cards", "concept_flashcards"})


def check_ai_usage_limit(user_id: str | None) -> None:
    if not user_id:
        return

    daily_limit = settings.DAILY_NEW_CARDS_LIMIT
    if daily_limit <= 0:
        return

    now = datetime.now(timezone.utc)
    window_start = datetime.combine(now.date(), time.min, tzinfo=timezone.utc).replace(tzinfo=None)
    window_end = (datetime.combine(now.date(), time.min, tzinfo=timezone.utc) + timedelta(days=1)).replace(tzinfo=None)

    db = SessionLocal()
    try:
        usage_count = (
            db.query(AiUsageEvent)
            .filter(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.kind.in_(_NEW_CARD_KINDS),
                AiUsageEvent.created_at >= window_start,
                AiUsageEvent.created_at < window_end,
            )
            .count()
        )
    finally:
        db.close()

    if usage_count >= daily_limit:
        raise AiQuotaExceededError(
            f"Daily new-card generation limit reached ({daily_limit} requests per day)."
        )


def record_ai_usage(user_id: str | None, kind: str) -> None:
    if not user_id:
        return

    db = SessionLocal()
    try:
        db.add(AiUsageEvent(user_id=user_id, kind=kind, created_at=datetime.now(timezone.utc).replace(tzinfo=None)))
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def check_and_record_ai_usage(user_id: str | None, kind: str) -> None:
    check_ai_usage_limit(user_id)
    record_ai_usage(user_id, kind)
