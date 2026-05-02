import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.user import User
from services.auth_service import (
    get_current_user,
    create_session,
    revoke_session,
    validate_return_to,
    SESSION_COOKIE_NAME,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

# In-memory nonce/state store (use Redis in production for multi-instance)
_oauth_states: dict[str, dict[str, object]] = {}
OAUTH_STATE_TTL = timedelta(minutes=10)


def _prune_oauth_states(now: Optional[datetime] = None) -> None:
    current_time = now or datetime.now(timezone.utc)
    cutoff = current_time - OAUTH_STATE_TTL
    expired_states = []

    for state, payload in _oauth_states.items():
        created_at = payload.get("created_at")
        if isinstance(created_at, str):
            try:
                created_at = datetime.fromisoformat(created_at)
            except ValueError:
                expired_states.append(state)
                continue

        if not isinstance(created_at, datetime):
            expired_states.append(state)
            continue

        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)

        if created_at < cutoff:
            expired_states.append(state)

    for state in expired_states:
        _oauth_states.pop(state, None)


def _set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="lax",
        domain=settings.SESSION_COOKIE_DOMAIN if settings.SESSION_COOKIE_SECURE else None,
        max_age=settings.SESSION_MAX_AGE_DAYS * 86400,
        path="/",
    )


def _clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite="lax",
        domain=settings.SESSION_COOKIE_DOMAIN if settings.SESSION_COOKIE_SECURE else None,
        path="/",
    )


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "auth_provider": user.auth_provider or "google",
        "created_at": user.created_at.isoformat() if user.created_at else "",
    }


# ---------- Pydantic models ----------


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    avatar_url: Optional[str] = None
    auth_provider: str = "google"
    created_at: str

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    authenticated: bool
    user: Optional[dict] = None


# ---------- Session endpoints ----------

@router.get("/session", response_model=SessionResponse)
def get_session(user: Optional[User] = Depends(get_current_user)):
    if not user:
        return SessionResponse(authenticated=False)
    return SessionResponse(authenticated=True, user=_user_dict(user))


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    session_token = request.cookies.get(SESSION_COOKIE_NAME)
    if session_token:
        revoke_session(db, session_token)
    _clear_session_cookie(response)
    return {"ok": True}


# ---------- Profile ----------

@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
        avatar_url=user.avatar_url,
        auth_provider=user.auth_provider or "google",
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.patch("/me")
def update_profile(
    body: dict,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if "display_name" in body:
        user.display_name = body["display_name"]
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "display_name": user.display_name}


# ---------- Google OAuth ----------

@router.get("/google/start")
def google_start(return_to: Optional[str] = None, redirect: bool = False):
    """Initiate Google OAuth2 authorization code flow with PKCE."""
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google login is not configured")

    now = datetime.now(timezone.utc)
    _prune_oauth_states(now)

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(16)
    code_verifier = secrets.token_urlsafe(64)
    code_challenge = (
        hashlib.sha256(code_verifier.encode())
        .digest()
    )
    import base64
    code_challenge_b64 = base64.urlsafe_b64encode(code_challenge).rstrip(b"=").decode()

    validated_return = validate_return_to(return_to) or settings.PUBLIC_APP_URL

    _oauth_states[state] = {
        "nonce": nonce,
        "code_verifier": code_verifier,
        "return_to": validated_return,
        "created_at": now,
    }

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "nonce": nonce,
        "code_challenge": code_challenge_b64,
        "code_challenge_method": "S256",
        "access_type": "online",
        "prompt": "select_account",
    }
    url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    if redirect:
        return Response(status_code=302, headers={"Location": url})
    return {"url": url}


@router.get("/google/callback")
async def google_callback(
    request: Request,
    response: Response,
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Handle Google OAuth2 callback — exchange code, upsert user, set session."""
    login_url = settings.PUBLIC_LOGIN_URL

    if error:
        return Response(
            status_code=302,
            headers={"Location": f"{login_url}?error={error}"},
        )

    if not code or not state:
        return Response(
            status_code=302,
            headers={"Location": f"{login_url}?error=missing_params"},
        )

    _prune_oauth_states()
    state_data = _oauth_states.pop(state, None)
    if not state_data:
        return Response(
            status_code=302,
            headers={"Location": f"{login_url}?error=invalid_state"},
        )

    # Exchange authorization code for tokens
    try:
        async with httpx.AsyncClient() as http:
            token_resp = await http.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": settings.GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                    "code_verifier": state_data["code_verifier"],
                },
            )
            if token_resp.status_code != 200:
                return Response(
                    status_code=302,
                    headers={"Location": f"{login_url}?error=token_exchange_failed"},
                )
            tokens = token_resp.json()

            # Fetch user info
            userinfo_resp = await http.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {tokens['access_token']}"},
            )
            if userinfo_resp.status_code != 200:
                return Response(
                    status_code=302,
                    headers={"Location": f"{login_url}?error=userinfo_failed"},
                )
            userinfo = userinfo_resp.json()
    except Exception:
        return Response(
            status_code=302,
            headers={"Location": f"{login_url}?error=google_request_failed"},
        )

    google_sub = userinfo.get("sub")
    email = userinfo.get("email")
    if not google_sub or not email:
        return Response(
            status_code=302,
            headers={"Location": f"{login_url}?error=missing_google_info"},
        )

    # Upsert user
    user = db.query(User).filter(User.google_subject == google_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link existing account
            user.google_subject = google_sub
            user.auth_provider = "google"
            user.avatar_url = userinfo.get("picture")
            user.email_verified_at = datetime.now(timezone.utc)
        else:
            # New user
            user = User(
                email=email,
                display_name=userinfo.get("name", email.split("@")[0]),
                hashed_password=None,
                auth_provider="google",
                google_subject=google_sub,
                avatar_url=userinfo.get("picture"),
                email_verified_at=datetime.now(timezone.utc),
            )
            db.add(user)
    else:
        user.avatar_url = userinfo.get("picture")
        if userinfo.get("email_verified"):
            user.email_verified_at = user.email_verified_at or datetime.now(timezone.utc)

    db.commit()
    db.refresh(user)

    # Create session
    raw_token = create_session(db, user, request)

    redirect_to = state_data.get("return_to") or settings.PUBLIC_APP_URL
    resp = Response(status_code=302, headers={"Location": redirect_to})
    _set_session_cookie(resp, raw_token)
    return resp
