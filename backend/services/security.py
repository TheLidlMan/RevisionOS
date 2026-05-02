import math
import threading
from collections import defaultdict, deque
from time import monotonic
from typing import Deque

from fastapi import HTTPException, Request

_RATE_LIMIT_BUCKETS: dict[tuple[str, str], Deque[float]] = defaultdict(deque)
_RATE_LIMIT_LOCK = threading.Lock()


def _get_request_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    if forwarded_for:
        return forwarded_for.split(",", 1)[0].strip() or "anonymous"
    if request.client and request.client.host:
        return request.client.host
    return "anonymous"


def enforce_rate_limit(
    request: Request,
    *,
    scope: str,
    limit: int,
    window_seconds: int,
) -> None:
    now = monotonic()
    identifier = _get_request_identifier(request)
    bucket_key = (scope, identifier)

    with _RATE_LIMIT_LOCK:
        bucket = _RATE_LIMIT_BUCKETS[bucket_key]
        cutoff = now - window_seconds
        while bucket and bucket[0] <= cutoff:
            bucket.popleft()

        if len(bucket) >= limit:
            retry_after = max(1, int(math.ceil(window_seconds - (now - bucket[0]))))
            raise HTTPException(
                status_code=429,
                detail="Too many requests",
                headers={"Retry-After": str(retry_after)},
            )

        bucket.append(now)


def reset_rate_limits() -> None:
    with _RATE_LIMIT_LOCK:
        _RATE_LIMIT_BUCKETS.clear()
