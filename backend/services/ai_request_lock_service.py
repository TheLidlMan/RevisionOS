import asyncio
import logging
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from typing import AsyncIterator

from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from database import SessionLocal
from models.ai_request_lock import AiRequestLock

logger = logging.getLogger(__name__)

GLOBAL_GROQ_LOCK_NAME = "groq_global"
LOCK_LEASE_SECONDS = 180
LOCK_HEARTBEAT_INTERVAL_SECONDS = 30
LOCK_POLL_INTERVAL_SECONDS = 0.5


def _utcnow() -> datetime:
    return datetime.utcnow()


def _ensure_lock_row(lock_name: str) -> None:
    db = SessionLocal()
    try:
        existing = db.query(AiRequestLock).filter(AiRequestLock.name == lock_name).first()
        if existing:
            return

        db.add(AiRequestLock(name=lock_name))
        db.commit()
    except IntegrityError:
        db.rollback()
    finally:
        db.close()


def _try_acquire_lock(lock_name: str, owner_id: str) -> bool:
    db = SessionLocal()
    now = _utcnow()
    expires_at = now + timedelta(seconds=LOCK_LEASE_SECONDS)
    try:
        updated = (
            db.query(AiRequestLock)
            .filter(
                AiRequestLock.name == lock_name,
                or_(
                    AiRequestLock.owner_id.is_(None),
                    AiRequestLock.expires_at.is_(None),
                    AiRequestLock.expires_at < now,
                ),
            )
            .update(
                {
                    AiRequestLock.owner_id: owner_id,
                    AiRequestLock.acquired_at: now,
                    AiRequestLock.heartbeat_at: now,
                    AiRequestLock.expires_at: expires_at,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        return updated == 1
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _renew_lock(lock_name: str, owner_id: str) -> bool:
    db = SessionLocal()
    now = _utcnow()
    expires_at = now + timedelta(seconds=LOCK_LEASE_SECONDS)
    try:
        updated = (
            db.query(AiRequestLock)
            .filter(AiRequestLock.name == lock_name, AiRequestLock.owner_id == owner_id)
            .update(
                {
                    AiRequestLock.heartbeat_at: now,
                    AiRequestLock.expires_at: expires_at,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        return updated == 1
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def _release_lock(lock_name: str, owner_id: str) -> None:
    db = SessionLocal()
    try:
        (
            db.query(AiRequestLock)
            .filter(AiRequestLock.name == lock_name, AiRequestLock.owner_id == owner_id)
            .update(
                {
                    AiRequestLock.owner_id: None,
                    AiRequestLock.acquired_at: None,
                    AiRequestLock.heartbeat_at: None,
                    AiRequestLock.expires_at: None,
                },
                synchronize_session=False,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


async def _heartbeat(lock_name: str, owner_id: str) -> None:
    try:
        while True:
            await asyncio.sleep(LOCK_HEARTBEAT_INTERVAL_SECONDS)
            renewed = await asyncio.to_thread(_renew_lock, lock_name, owner_id)
            if not renewed:
                logger.warning("Lost ownership of AI request lock %s for owner %s", lock_name, owner_id)
                return
    except asyncio.CancelledError:
        return


@asynccontextmanager
async def serialized_ai_request(lock_name: str = GLOBAL_GROQ_LOCK_NAME) -> AsyncIterator[None]:
    owner_id = str(uuid.uuid4())

    await asyncio.to_thread(_ensure_lock_row, lock_name)
    while not await asyncio.to_thread(_try_acquire_lock, lock_name, owner_id):
        await asyncio.sleep(LOCK_POLL_INTERVAL_SECONDS)

    heartbeat_task = asyncio.create_task(_heartbeat(lock_name, owner_id))
    try:
        yield
    finally:
        heartbeat_task.cancel()
        try:
            await heartbeat_task
        except asyncio.CancelledError:
            pass
        await asyncio.to_thread(_release_lock, lock_name, owner_id)