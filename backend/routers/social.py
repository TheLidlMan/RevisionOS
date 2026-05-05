from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_, case, func, or_
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


def _leaderboard_stats_subquery(db: Session, timeframe: str):
    cutoff = _get_timeframe_cutoff(timeframe)

    review_counts = (
        db.query(
            ReviewLog.user_id.label("user_id"),
            func.count(ReviewLog.id).label("total_reviews"),
        )
        .filter(ReviewLog.user_id.isnot(None))
    )
    if cutoff is not None:
        review_counts = review_counts.filter(ReviewLog.answered_at >= cutoff)
    review_counts = review_counts.group_by(ReviewLog.user_id).subquery()

    session_counts = (
        db.query(
            StudySession.user_id.label("user_id"),
            func.count(StudySession.id).label("total_sessions"),
        )
        .filter(StudySession.user_id.isnot(None))
    )
    if cutoff is not None:
        session_counts = session_counts.filter(StudySession.started_at >= cutoff)
    session_counts = session_counts.group_by(StudySession.user_id).subquery()

    mastery = (
        db.query(
            Flashcard.user_id.label("user_id"),
            func.count(Flashcard.id).label("card_total"),
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
            ).label("mastered_total"),
        )
        .filter(Flashcard.user_id.isnot(None))
        .group_by(Flashcard.user_id)
        .subquery()
    )

    total_reviews = func.coalesce(review_counts.c.total_reviews, 0)
    total_sessions = func.coalesce(session_counts.c.total_sessions, 0)
    card_total = func.coalesce(mastery.c.card_total, 0)
    mastered_total = func.coalesce(mastery.c.mastered_total, 0)
    rank_order = (
        total_reviews.desc(),
        total_sessions.desc(),
        User.display_name.asc(),
        User.id.asc(),
    )

    return (
        db.query(
            User.id.label("user_id"),
            User.display_name.label("display_name"),
            total_reviews.label("total_reviews"),
            total_sessions.label("total_sessions"),
            card_total.label("card_total"),
            mastered_total.label("mastered_total"),
            func.row_number().over(order_by=rank_order).label("rank"),
        )
        .outerjoin(review_counts, review_counts.c.user_id == User.id)
        .outerjoin(session_counts, session_counts.c.user_id == User.id)
        .outerjoin(mastery, mastery.c.user_id == User.id)
        .filter(User.is_active.is_(True))
        .filter(or_(total_reviews > 0, total_sessions > 0))
        .subquery()
    )


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

    leaderboard_stats = _leaderboard_stats_subquery(db, timeframe)
    top_rows = db.query(leaderboard_stats).order_by(leaderboard_stats.c.rank).limit(50).all()
    user_row = None
    if user and not any(row.user_id == user.id for row in top_rows):
        user_row = db.query(leaderboard_stats).filter(leaderboard_stats.c.user_id == user.id).first()

    streak_user_ids = [row.user_id for row in top_rows]
    if user_row is not None:
        streak_user_ids.append(user_row.user_id)

    streak_dates: dict[str, set] = defaultdict(set)
    if streak_user_ids:
        streak_rows = (
            db.query(StudySession.user_id, func.date(StudySession.started_at))
            .filter(
                StudySession.user_id.in_(streak_user_ids),
                StudySession.user_id.isnot(None),
                StudySession.started_at.isnot(None),
            )
            .distinct()
            .all()
        )
    else:
        streak_rows = []

    for session_user_id, started_at in streak_rows:
        if started_at is None:
            continue
        if isinstance(started_at, datetime):
            streak_dates[session_user_id].add(started_at.date())
        elif isinstance(started_at, date):
            streak_dates[session_user_id].add(started_at)
        else:
            streak_dates[session_user_id].add(datetime.fromisoformat(str(started_at)).date())

    entries = []
    for row in top_rows:
        streak = 0
        today = datetime.utcnow().date()
        user_session_dates = streak_dates.get(row.user_id, set())
        for i in range(365):
            check_date = today - timedelta(days=i)
            if check_date in user_session_dates:
                streak += 1
            else:
                if i == 0:
                    continue
                break

        mastery_pct = 0.0
        card_total = int(row.card_total or 0)
        mastered_total = int(row.mastered_total or 0)
        if card_total:
            mastery_pct = round((mastered_total / card_total) * 100, 1)

        entries.append(LeaderboardEntry(
            rank=int(row.rank),
            user_id=row.user_id,
            display_name=row.display_name,
            streak=streak,
            mastery_pct=mastery_pct,
            total_reviews=int(row.total_reviews or 0),
            total_sessions=int(row.total_sessions or 0),
        ))

    your_rank = next((entry.rank for entry in entries if user and entry.user_id == user.id), None)
    if your_rank is None and user_row is not None:
        your_rank = int(user_row.rank)

    response = LeaderboardResponse(entries=entries, your_rank=your_rank)
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
