"""
Caching layer: Redis when REDIS_URL is set, otherwise an in-process TTL dict.

Key patterns
------------
cache:module:{user_id}:list          – list of module dicts for a user
cache:flashcards:{user_id}:due       – due flashcard list for a user
cache:flashcards:{module_id}:list    – all flashcards for a module

Usage
-----
    from cache import cache_get, cache_set, cache_delete, cache_invalidate_prefix

    data = cache_get(key)
    if data is None:
        data = expensive_query()
        cache_set(key, data, ttl=300)

    # bust all keys for a user's modules
    cache_invalidate_prefix(f"cache:module:{user_id}:")
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_TTL = 300  # 5 minutes

# ---------------------------------------------------------------------------
# Internal in-process store
# ---------------------------------------------------------------------------
_store: dict[str, tuple[Any, float]] = {}
_store_lock = threading.Lock()


def _mem_get(key: str) -> Any | None:
    with _store_lock:
        entry = _store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if time.monotonic() > expires_at:
            del _store[key]
            return None
        return value


def _mem_set(key: str, value: Any, ttl: int) -> None:
    with _store_lock:
        _store[key] = (value, time.monotonic() + ttl)


def _mem_delete(key: str) -> None:
    with _store_lock:
        _store.pop(key, None)


def _mem_invalidate_prefix(prefix: str) -> int:
    with _store_lock:
        keys = [k for k in _store if k.startswith(prefix)]
        for k in keys:
            del _store[k]
        return len(keys)


# ---------------------------------------------------------------------------
# Redis client (optional)
# ---------------------------------------------------------------------------
_redis_client: Any = None
_redis_checked = False


def _get_redis() -> Any | None:
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return None
    try:
        import redis  # type: ignore

        client = redis.from_url(redis_url, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
        logger.info("Cache: connected to Redis at %s", redis_url)
    except Exception as exc:
        logger.warning("Cache: Redis unavailable (%s), falling back to in-memory store", exc)
        _redis_client = None
    return _redis_client


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def cache_get(key: str) -> Any | None:
    r = _get_redis()
    if r is not None:
        try:
            raw = r.get(key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug("Cache Redis GET error: %s", exc)
            return None
    return _mem_get(key)


def cache_set(key: str, value: Any, ttl: int = DEFAULT_TTL) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.setex(key, ttl, json.dumps(value, default=str))
            return
        except Exception as exc:
            logger.debug("Cache Redis SET error: %s", exc)
    _mem_set(key, value, ttl)


def cache_delete(key: str) -> None:
    r = _get_redis()
    if r is not None:
        try:
            r.delete(key)
            return
        except Exception as exc:
            logger.debug("Cache Redis DELETE error: %s", exc)
    _mem_delete(key)


def cache_invalidate_prefix(prefix: str) -> int:
    """Delete all keys starting with *prefix*. Returns count of deleted keys."""
    r = _get_redis()
    if r is not None:
        try:
            keys = r.keys(f"{prefix}*")
            if keys:
                r.delete(*keys)
            return len(keys)
        except Exception as exc:
            logger.debug("Cache Redis SCAN/DEL error: %s", exc)
    return _mem_invalidate_prefix(prefix)
