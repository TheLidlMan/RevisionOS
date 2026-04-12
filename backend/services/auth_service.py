import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.user import User
from models.auth_session import AuthSession

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days
SESSION_COOKIE_NAME = "reviseos_session"

logger = logging.getLogger(__name__)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _get_secret_key() -> str:
    secret_key = settings.JWT_SECRET.strip()
    if len(secret_key) < 32:
        raise RuntimeError("JWT_SECRET must be set and at least 32 characters long")
    return secret_key


def validate_auth_settings() -> None:
    _get_secret_key()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


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
    """Revoke a session by its raw token. Returns True if found."""
    session = _query_session(db, raw_token, require_unexpired=False)
    if session:
        session.revoked = True
        db.commit()
        return True
    return False


def get_user_from_session_token(db: Session, raw_token: str) -> Optional[User]:
    """Look up a valid (non-revoked, non-expired) session and return its user."""
    session = _query_session(db, raw_token, require_unexpired=True)
    if not session:
        return None
    return db.query(User).filter(User.id == session.user_id, User.is_active.is_(True)).first()


# --------------- Allowed redirect origins ---------------

ALLOWED_REDIRECT_PREFIXES = [
    settings.PUBLIC_APP_URL,
    settings.PUBLIC_LOGIN_URL,
    settings.PUBLIC_MARKETING_URL,
]


def validate_return_to(url: Optional[str]) -> Optional[str]:
    """Return *url* only if it starts with one of the approved prefixes."""
    if not url:
        return None
    for prefix in ALLOWED_REDIRECT_PREFIXES:
        if url.startswith(prefix):
            return url
    return None


# --------------- FastAPI dependencies ---------------

def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
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
        user = get_user_from_session_token(db, session_token)
        if user:
            return user

    # 2. Fallback to Bearer JWT
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
