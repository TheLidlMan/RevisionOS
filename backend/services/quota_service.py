from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime, timezone

from fastapi import HTTPException
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


def check_ai_usage_limit(user_id: str | None) -> None:
    return


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