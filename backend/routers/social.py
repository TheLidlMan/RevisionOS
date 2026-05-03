from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, case, func
from sqlalchemy.orm import Session

from cache import cache_get, cache_set
from database import get_db
from models.module import Module
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
    if timeframe == "week":
        return datetime.utcnow() - timedelta(days=7)
    if timeframe == "month":
        return datetime.utcnow() - timedelta(days=30)
    return None


@router.get("/leaderboard", response_model=LeaderboardResponse)
def get_leaderboard(
    timeframe: str = "all",
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Global leaderboard ranked by total reviews."""
    user_id = user.id if user else "anonymous"
    cache_key = f"cache:social:leaderboard:{timeframe}:{user_id}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

    users = db.query(User.id, User.display_name).filter(User.is_active.is_(True)).all()

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
        db.query(StudySession.user_id, func.date(StudySession.started_at))
        .filter(StudySession.user_id.isnot(None), StudySession.started_at.isnot(None))
        .distinct()
        .all()
    ):
        if started_at is None:
            continue
        if isinstance(started_at, datetime):
            streak_dates[session_user_id].add(started_at.date())
        elif isinstance(started_at, date):
            streak_dates[session_user_id].add(started_at)
        else:
            streak_dates[session_user_id].add(datetime.fromisoformat(str(started_at)).date())

    mastery_rows = (
        db.query(
            Flashcard.user_id,
            func.count(Flashcard.id).label("total"),
            func.sum(
                case(
                    (
                        and_(
                            Flashcard.state == "REVIEW",
                            Flashcard.lapses == 0,
                            Flashcard.reps >= 2,
                        ),
                        1,
                    ),
                    else_=0,
                )
            ).label("mastered"),
        )
        .filter(Flashcard.user_id.isnot(None))
        .group_by(Flashcard.user_id)
        .all()
    )
    mastery_by_user = {
        row.user_id: (int(row.total or 0), int(row.mastered or 0))
        for row in mastery_rows
    }

    entries = []
    for u in users:
        total_reviews = review_counts.get(u.id, 0)
        total_sessions = session_counts.get(u.id, 0)

        if total_reviews == 0 and total_sessions == 0:
            continue

        streak = 0
        today = datetime.utcnow().date()
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
        card_total, mastered_total = mastery_by_user.get(u.id, (0, 0))
        if card_total:
            mastery_pct = round((mastered_total / card_total) * 100, 1)

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

    response = LeaderboardResponse(entries=entries[:50], your_rank=your_rank)
    cache_set(cache_key, response.model_dump(mode="json"), ttl=120)
    return response


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
    modules = (
        db.query(
            Module.id,
            Module.name,
            Module.description,
            Module.color,
            Module.created_at,
            User.display_name.label("owner_name"),
        )
        .outerjoin(User, User.id == Module.user_id)
        .filter(Module.user_id.isnot(None))
        .limit(20)
        .all()
    )
    return [
        {
            "id": module.id,
            "name": module.name,
            "description": module.description,
            "color": module.color,
            "owner_name": module.owner_name or "Unknown",
            "created_at": module.created_at.isoformat() if module.created_at else None,
        }
        for module in modules
    ]
