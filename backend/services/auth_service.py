import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Optional
from urllib.parse import urlparse

from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, WebSocket, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from config import settings
from database import get_db, get_pool_snapshot, is_pool_under_pressure
from models.user import User
from models.auth_session import AuthSession

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
SESSION_COOKIE_NAME = "reviseos_session"

logger = logging.getLogger(__name__)
bearer_scheme = HTTPBearer(auto_error=False)


def _get_secret_key() -> str:
    secret_key = settings.JWT_SECRET.strip()
    if len(secret_key) < 32:
        raise RuntimeError("JWT_SECRET must be set and at least 32 characters long")
    character_classes = sum(
        (
            any(char.islower() for char in secret_key),
            any(char.isupper() for char in secret_key),
            any(char.isdigit() for char in secret_key),
            any(not char.isalnum() for char in secret_key),
        )
    )
    if character_classes < 3:
        raise RuntimeError("JWT_SECRET must include upper, lower, numeric, or symbol characters from at least 3 classes")
    return secret_key


def validate_auth_settings() -> None:
    _get_secret_key()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)


# --------------- Session helpers ---------------

def _hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode()).hexdigest()


def _is_missing_auth_sessions_table(exc: Exception) -> bool:
    original_exc = getattr(exc, "orig", exc)
    sqlstate = getattr(original_exc, "sqlstate", None) or getattr(original_exc, "pgcode", None)
    if sqlstate == "42P01":
        return True

    message = str(original_exc).lower()
    return "auth_sessions" in message and (
        "does not exist" in message
        or "undefined table" in message
        or "no such table" in message
    )


def _query_session(
    db: Session,
    raw_token: str,
    *,
    require_unexpired: bool,
) -> Optional[AuthSession]:
    try:
        query = db.query(AuthSession).filter(
            AuthSession.token_hash == _hash_token(raw_token),
            AuthSession.revoked.is_(False),
        )
        if require_unexpired:
            query = query.filter(AuthSession.expires_at > datetime.now(timezone.utc))
        return query.first()
    except (OperationalError, ProgrammingError) as exc:
        if not _is_missing_auth_sessions_table(exc):
            raise
        try:
            db.rollback()
        except SQLAlchemyError:
            logger.warning("Rollback failed after auth session lookup error", exc_info=True)
        logger.warning(
            "Skipping session lookup because auth_sessions is unavailable: %s",
            getattr(exc, "orig", exc),
        )
        return None


def create_session(db: Session, user: User, request: Optional[Request] = None) -> str:
    """Create a new auth session and return the raw session token."""
    raw_token = secrets.token_urlsafe(48)
    session = AuthSession(
        user_id=user.id,
        token_hash=_hash_token(raw_token),
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.SESSION_MAX_AGE_DAYS),
        ip_address=request.client.host if request and request.client else None,
        user_agent=(request.headers.get("user-agent", "")[:512]) if request else None,
    )
    db.add(session)

    # Update last_login_at
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return raw_token


def revoke_session(db: Session, raw_token: str) -> bool:
    """Delete a session row by its raw token. Returns True if found."""
    session = _query_session(db, raw_token, require_unexpired=False)
    if session:
        db.delete(session)
        db.commit()
        return True
    return False


def get_user_from_session_token(db: Session, raw_token: str) -> Optional[User]:
    """Look up a valid (non-revoked, non-expired) session and return its user."""
    try:
        return (
            db.query(User)
            .join(AuthSession, AuthSession.user_id == User.id)
            .filter(
                AuthSession.token_hash == _hash_token(raw_token),
                AuthSession.revoked.is_(False),
                AuthSession.expires_at > datetime.now(timezone.utc),
                User.is_active.is_(True),
            )
            .first()
        )
    except (OperationalError, ProgrammingError) as exc:
        if not _is_missing_auth_sessions_table(exc):
            raise
        try:
            db.rollback()
        except SQLAlchemyError:
            logger.warning("Rollback failed after auth session lookup error", exc_info=True)
        logger.warning(
            "Skipping session lookup because auth_sessions is unavailable: %s",
            getattr(exc, "orig", exc),
        )
        return None


# --------------- Allowed redirect origins ---------------

ALLOWED_REDIRECT_PREFIXES = [
    settings.PUBLIC_APP_URL,
    settings.PUBLIC_LOGIN_URL,
    settings.PUBLIC_MARKETING_URL,
]


def validate_return_to(url: Optional[str]) -> Optional[str]:
    """Return *url* only if it matches one of the approved redirect origins."""
    if not url:
        return None

    candidate = urlparse(url)
    if candidate.scheme not in {"http", "https"} or not candidate.netloc:
        return None
    if candidate.username or candidate.password:
        return None

    candidate_host = candidate.hostname.lower() if candidate.hostname else ""
    candidate_port = candidate.port

    for prefix in ALLOWED_REDIRECT_PREFIXES:
        allowed = urlparse(prefix)
        allowed_host = allowed.hostname.lower() if allowed.hostname else ""
        if (
            allowed.scheme == candidate.scheme
            and allowed_host == candidate_host
            and allowed.port == candidate_port
        ):
            return url
    return None


# --------------- FastAPI dependencies ---------------

def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Resolve the current user.

    Priority:
    1. Session cookie (``reviseos_session``)
    2. Bearer token (backward-compatible fallback)
    """
    # 1. Try session cookie
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        lookup_started = perf_counter()
        user = get_user_from_session_token(db, session_token)
        lookup_duration_ms = (perf_counter() - lookup_started) * 1000
        request_path = request.url.path
        if settings.REQUEST_TIMING_LOG_ENABLED and (
            request_path == "/api/auth/session"
            or lookup_duration_ms >= settings.AUTH_SESSION_WARN_MS
        ):
            pool_snapshot = get_pool_snapshot()
            level = logging.WARNING if (
                lookup_duration_ms >= settings.AUTH_SESSION_WARN_MS
                or is_pool_under_pressure(pool_snapshot, settings.POOL_PRESSURE_WARN_RATIO)
            ) else logging.INFO
            logger.log(
                level,
                "auth_session_lookup path=%s authenticated=%s duration_ms=%.1f pool=%s",
                request_path,
                bool(user),
                lookup_duration_ms,
                pool_snapshot,
            )
        if user:
            return user

    # 2. Fallback to Bearer JWT
    token = credentials.credentials if credentials else None
    if not token:
        return None
    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authenticated user not found or inactive",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def require_user(user: Optional[User] = Depends(get_current_user)) -> User:
    """Require authenticated user. Raises 401 if not authenticated."""
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_from_websocket(
    websocket: WebSocket,
    db: Session,
) -> Optional[User]:
    session_token = websocket.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        user = get_user_from_session_token(db, session_token)
        if user:
            return user

    authorization = websocket.headers.get("authorization", "")
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        payload = jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None
    return db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()
