from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
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


def _get_timeframe_cutoff(timeframe: str) -> datetime | None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if timeframe == "week":
        return now - timedelta(days=7)
    if timeframe == "month":
        return now - timedelta(days=30)
    return None


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    timeframe: str = "all",
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Global leaderboard ranked by total reviews."""
    users = db.query(User).filter(User.is_active == True).all()

    cutoff = _get_timeframe_cutoff(timeframe)

    review_counts_query = db.query(
        ReviewLog.user_id,
        func.count(ReviewLog.id),
    ).filter(ReviewLog.user_id.isnot(None))
    if cutoff is not None:
        review_counts_query = review_counts_query.filter(ReviewLog.answered_at >= cutoff)
    review_counts = {
        user_id: count
        for user_id, count in review_counts_query.group_by(ReviewLog.user_id).all()
    }

    session_counts_query = db.query(
        StudySession.user_id,
        func.count(StudySession.id),
    ).filter(StudySession.user_id.isnot(None))
    if cutoff is not None:
        session_counts_query = session_counts_query.filter(StudySession.started_at >= cutoff)
    session_counts = {
        user_id: count
        for user_id, count in session_counts_query.group_by(StudySession.user_id).all()
    }

    streak_dates: dict[str, set] = defaultdict(set)
    for session_user_id, started_at in (
        db.query(StudySession.user_id, StudySession.started_at)
        .filter(StudySession.user_id.isnot(None), StudySession.started_at.isnot(None))
        .all()
    ):
        streak_dates[session_user_id].add(started_at.date())

    card_totals: dict[str, int] = defaultdict(int)
    mastered_totals: dict[str, int] = defaultdict(int)
    for card_user_id, state, lapses, reps in (
        db.query(Flashcard.user_id, Flashcard.state, Flashcard.lapses, Flashcard.reps)
        .filter(Flashcard.user_id.isnot(None))
        .all()
    ):
        card_totals[card_user_id] += 1
        if state == "REVIEW" and lapses == 0 and reps >= 2:
            mastered_totals[card_user_id] += 1

    entries = []
    for u in users:
        total_reviews = review_counts.get(u.id, 0)
        total_sessions = session_counts.get(u.id, 0)

        if total_reviews == 0 and total_sessions == 0:
            continue

        streak = 0
        today = datetime.now(timezone.utc).date()
        user_session_dates = streak_dates.get(u.id, set())
        for i in range(365):
            check_date = today - timedelta(days=i)
            if check_date in user_session_dates:
                streak += 1
            else:
                if i == 0:
                    continue
                break

        mastery_pct = 0.0
        if card_totals.get(u.id):
            mastery_pct = round((mastered_totals.get(u.id, 0) / card_totals[u.id]) * 100, 1)

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
