from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user,
    ACCESS_TOKEN_EXPIRE_MINUTES,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    display_name: str
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    user = User(
        email=body.email,
        display_name=body.display_name,
        hashed_password=get_password_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat() if user.created_at else "",
        },
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(data={"sub": user.id})
    return TokenResponse(
        access_token=token,
        user={
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat() if user.created_at else "",
        },
    )


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UserResponse(
        id=user.id,
        email=user.email,
        display_name=user.display_name,
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
    if "password" in body and len(body["password"]) >= 6:
        user.hashed_password = get_password_hash(body["password"])
    db.commit()
    db.refresh(user)
    return {"id": user.id, "email": user.email, "display_name": user.display_name}
