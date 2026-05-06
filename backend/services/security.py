import math
import threading
from collections import defaultdict, deque
from functools import lru_cache
from time import monotonic
from typing import Deque
import ipaddress

from fastapi import HTTPException, Request

from config import settings

_RATE_LIMIT_BUCKETS: dict[tuple[str, str], Deque[float]] = defaultdict(deque)
_RATE_LIMIT_LOCK = threading.Lock()
_MAX_RATE_LIMIT_BUCKETS = 10_000
NetworkType = ipaddress.IPv4Network | ipaddress.IPv6Network


@lru_cache(maxsize=1)
def _trusted_proxy_networks() -> list[NetworkType]:
    networks: list[NetworkType] = []
    for raw_value in settings.TRUSTED_PROXY_IPS.split(","):
        candidate = raw_value.strip()
        if not candidate:
            continue
        try:
            if "/" in candidate:
                networks.append(ipaddress.ip_network(candidate, strict=False))
            else:
                address = ipaddress.ip_address(candidate)
                suffix = 32 if isinstance(address, ipaddress.IPv4Address) else 128
                networks.append(ipaddress.ip_network(f"{candidate}/{suffix}", strict=False))
        except ValueError:
            continue
    return networks


def _is_trusted_proxy(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in network for network in _trusted_proxy_networks())


def _get_request_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "").strip()
    client_host = request.client.host if request.client and request.client.host else ""
    if forwarded_for and client_host and _is_trusted_proxy(client_host):
        return forwarded_for.split(",", 1)[0].strip() or "anonymous"
    if client_host:
        return client_host
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
        cutoff = now - window_seconds
        if len(_RATE_LIMIT_BUCKETS) >= _MAX_RATE_LIMIT_BUCKETS and bucket_key not in _RATE_LIMIT_BUCKETS:
            stale_keys = [key for key, values in _RATE_LIMIT_BUCKETS.items() if not values or values[-1] <= cutoff]
            for key in stale_keys:
                _RATE_LIMIT_BUCKETS.pop(key, None)
            if len(_RATE_LIMIT_BUCKETS) >= _MAX_RATE_LIMIT_BUCKETS:
                oldest_key = min(
                    _RATE_LIMIT_BUCKETS,
                    key=lambda key: _RATE_LIMIT_BUCKETS[key][-1] if _RATE_LIMIT_BUCKETS[key] else 0,
                )
                _RATE_LIMIT_BUCKETS.pop(oldest_key, None)
        bucket = _RATE_LIMIT_BUCKETS[bucket_key]
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


def escape_like_query(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
