from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func

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


def _start_of_day_utc(now: datetime) -> datetime:
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _start_of_month_utc(now: datetime) -> datetime:
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def check_ai_usage_limit(user_id: str | None) -> None:
    if not user_id:
        return

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    daily_window_start = _start_of_day_utc(now)
    monthly_window_start = _start_of_month_utc(now)

    db = SessionLocal()
    try:
        if settings.AI_REQUESTS_DAILY_LIMIT > 0:
            daily_count = db.query(func.count(AiUsageEvent.id)).filter(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.created_at >= daily_window_start,
            ).scalar() or 0
            if daily_count >= settings.AI_REQUESTS_DAILY_LIMIT:
                raise AiQuotaExceededError("Daily AI request limit reached")

        if settings.AI_REQUESTS_MONTHLY_LIMIT > 0:
            monthly_count = db.query(func.count(AiUsageEvent.id)).filter(
                AiUsageEvent.user_id == user_id,
                AiUsageEvent.created_at >= monthly_window_start,
            ).scalar() or 0
            if monthly_count >= settings.AI_REQUESTS_MONTHLY_LIMIT:
                raise AiQuotaExceededError("Monthly AI request limit reached")
    except Exception:
        raise
    finally:
        db.close()


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