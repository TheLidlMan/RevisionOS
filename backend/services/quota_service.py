from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone
import calendar

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


def check_ai_usage_limit(user_id: str | None) -> bool:
    """Check whether the user is within their monthly AI request quota.

    Returns True when the request is allowed, False when the monthly limit is exceeded.
    Returns True unconditionally when user_id is absent or the limit is disabled (≤ 0).
    """
    if not user_id:
        return True

    monthly_limit = settings.AI_MONTHLY_REQUEST_LIMIT
    if monthly_limit <= 0:
        return True

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=None)
    last_day = calendar.monthrange(now.year, now.month)[1]
    month_end = datetime(now.year, now.month, last_day, 23, 59, 59, 999999, tzinfo=None)

    db = SessionLocal()
    try:
        usage_count = (
            db.query(AiUsageEvent)
            .filter(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.created_at >= month_start,
                AiUsageEvent.created_at <= month_end,
            )
            .count()
        )
    finally:
        db.close()

    return usage_count < monthly_limit


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


def check_and_record_ai_usage(user_id: str | None, kind: str) -> bool:
    """Check monthly quota and, if within limit, record this usage event.

    Designed to be called *after* successful AI generation so that usage is only
    incremented when a response was actually produced.  Returns True when the
    event was recorded (i.e. the request was within quota), False when the
    monthly limit has already been reached and the event was *not* recorded.
    """
    if not user_id:
        return True

    monthly_limit = settings.AI_MONTHLY_REQUEST_LIMIT
    if monthly_limit <= 0:
        record_ai_usage(user_id, kind)
        return True

    now = datetime.now(timezone.utc)
    month_start = datetime(now.year, now.month, 1, tzinfo=None)
    last_day = calendar.monthrange(now.year, now.month)[1]
    month_end = datetime(now.year, now.month, last_day, 23, 59, 59, 999999, tzinfo=None)

    db = SessionLocal()
    try:
        usage_count = (
            db.query(AiUsageEvent)
            .filter(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.created_at >= month_start,
                AiUsageEvent.created_at <= month_end,
            )
            .with_for_update()
            .count()
        )

        if usage_count >= monthly_limit:
            return False

        db.add(AiUsageEvent(user_id=user_id, kind=kind, created_at=datetime.now(timezone.utc).replace(tzinfo=None)))
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
