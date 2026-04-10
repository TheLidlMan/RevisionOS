from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.quiz_session import StudySession
from models.flashcard import Flashcard
from models.review_log import ReviewLog
from services.auth_service import get_current_user

router = APIRouter(prefix="/api/social", tags=["social"])


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    display_name: str
    streak: int = 0
    mastery_pct: float = 0.0
    total_reviews: int = 0
    total_sessions: int = 0


class LeaderboardResponse(BaseModel):
    entries: list[LeaderboardEntry]
    your_rank: int | None = None


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    timeframe: str = "all",
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Global leaderboard ranked by total reviews."""
    users = db.query(User).filter(User.is_active == True).all()

    entries = []
    for u in users:
        review_query = db.query(ReviewLog).filter(ReviewLog.user_id == u.id)
        session_query = db.query(StudySession).filter(StudySession.user_id == u.id)

        if timeframe == "week":
            cutoff = datetime.utcnow() - timedelta(days=7)
            review_query = review_query.filter(ReviewLog.answered_at >= cutoff)
            session_query = session_query.filter(StudySession.started_at >= cutoff)
        elif timeframe == "month":
            cutoff = datetime.utcnow() - timedelta(days=30)
            review_query = review_query.filter(ReviewLog.answered_at >= cutoff)
            session_query = session_query.filter(StudySession.started_at >= cutoff)

        total_reviews = review_query.count()
        total_sessions = session_query.count()

        if total_reviews == 0 and total_sessions == 0:
            continue

        # Calculate streak
        streak = 0
        today = datetime.utcnow().date()
        for i in range(365):
            check_date = today - timedelta(days=i)
            day_start = datetime.combine(check_date, datetime.min.time())
            day_end = datetime.combine(check_date, datetime.max.time())
            has_session = (
                db.query(StudySession)
                .filter(StudySession.user_id == u.id)
                .filter(StudySession.started_at >= day_start, StudySession.started_at <= day_end)
                .first()
            )
            if has_session:
                streak += 1
            else:
                if i == 0:
                    continue
                break

        # Calculate mastery percentage
        cards = db.query(Flashcard).filter(Flashcard.user_id == u.id).all()
        mastery_pct = 0.0
        if cards:
            mastered = sum(1 for c in cards if c.state == "REVIEW" and c.lapses == 0 and c.reps >= 2)
            mastery_pct = round((mastered / len(cards)) * 100, 1)

        entries.append(LeaderboardEntry(
            rank=0,
            user_id=u.id,
            display_name=u.display_name,
            streak=streak,
            mastery_pct=mastery_pct,
            total_reviews=total_reviews,
            total_sessions=total_sessions,
        ))

    entries.sort(key=lambda e: e.total_reviews, reverse=True)
    for i, entry in enumerate(entries):
        entry.rank = i + 1

    your_rank = None
    if user:
        for entry in entries:
            if entry.user_id == user.id:
                your_rank = entry.rank
                break

    return LeaderboardResponse(entries=entries[:50], your_rank=your_rank)


class SharedModuleCreate(BaseModel):
    module_id: str
    is_public: bool = True


@router.post("/share-module")
def share_module(
    body: SharedModuleCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    from models.module import Module

    module = db.query(Module).filter(Module.id == body.module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return {"status": "shared", "module_id": module.id, "is_public": body.is_public}


@router.get("/shared-modules")
def list_shared_modules(db: Session = Depends(get_db)):
    """List publicly shared modules (stub — returns all modules with user info)."""
    from models.module import Module

    modules = db.query(Module).filter(Module.user_id.isnot(None)).limit(20).all()
    results = []
    for m in modules:
        owner = db.query(User).filter(User.id == m.user_id).first()
        results.append({
            "id": m.id,
            "name": m.name,
            "description": m.description,
            "color": m.color,
            "owner_name": owner.display_name if owner else "Unknown",
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })
    return results
