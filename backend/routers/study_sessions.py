from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from models.flashcard import Flashcard
from models.module import Module
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(tags=["sessions"])


# ---------- Pydantic schemas ----------

class SessionListItem(BaseModel):
    id: str
    module_id: Optional[str] = None
    module_name: Optional[str] = None
    session_type: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_items: int
    correct: int
    incorrect: int
    skipped: int
    score_pct: float


class OverviewResponse(BaseModel):
    total_modules: int = 0
    total_cards: int = 0
    due_today: int = 0
    streak: int = 0
    overall_mastery: float = 0.0


class DailyActivity(BaseModel):
    date: str
    sessions: int = 0
    items_reviewed: int = 0


class StreakResponse(BaseModel):
    current_streak: int = 0
    longest_streak: int = 0
    daily_activity: list[DailyActivity] = []


class DailyScore(BaseModel):
    date: str
    avg_score: float = 0.0
    sessions: int = 0


class PerformanceOverTimeResponse(BaseModel):
    daily_scores: list[DailyScore] = []
    days: int = 30
    module_id: Optional[str] = None


# ---------- Endpoints ----------

@router.get("/api/sessions", response_model=list[SessionListItem])
def list_sessions(
    module_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    query = db.query(StudySession)
    if user:
        query = query.filter(StudySession.user_id == user.id)
    if module_id:
        query = query.filter(StudySession.module_id == module_id)
    sessions = query.order_by(StudySession.started_at.desc()).limit(limit).all()

    results = []
    for s in sessions:
        module_name = None
        if s.module_id:
            mod = db.query(Module).filter(Module.id == s.module_id).first()
            if mod:
                module_name = mod.name
        results.append(SessionListItem(
            id=s.id,
            module_id=s.module_id,
            module_name=module_name,
            session_type=s.session_type,
            started_at=s.started_at,
            ended_at=s.ended_at,
            total_items=s.total_items,
            correct=s.correct,
            incorrect=s.incorrect,
            skipped=s.skipped,
            score_pct=s.score_pct,
        ))
    return results


@router.get("/api/analytics/overview", response_model=OverviewResponse)
def analytics_overview(db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    mod_query = db.query(Module)
    card_query = db.query(Flashcard)
    session_query_base = db.query(StudySession)
    if user:
        mod_query = mod_query.filter(Module.user_id == user.id)
        card_query = card_query.filter(Flashcard.user_id == user.id)
        session_query_base = session_query_base.filter(StudySession.user_id == user.id)
    total_modules = mod_query.count()
    total_cards = card_query.count()

    now = datetime.utcnow()
    due_query = db.query(Flashcard).filter(Flashcard.due <= now)
    if user:
        due_query = due_query.filter(Flashcard.user_id == user.id)
    due_today = due_query.count()

    # Calculate streak: consecutive days with at least one session
    streak = 0
    today = datetime.utcnow().date()
    for i in range(365):
        check_date = today - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())
        sess_q = (
            session_query_base
            .filter(StudySession.started_at >= day_start, StudySession.started_at <= day_end)
        )
        has_session = sess_q.first()
        if has_session:
            streak += 1
        else:
            if i == 0:
                continue  # Today might not have a session yet
            break

    # Overall mastery
    all_cards = card_query.all()
    if all_cards:
        mastered = sum(1 for c in all_cards if c.state == "REVIEW" and c.lapses == 0 and c.reps >= 2)
        overall_mastery = round((mastered / len(all_cards)) * 100, 1)
    else:
        overall_mastery = 0.0

    return OverviewResponse(
        total_modules=total_modules,
        total_cards=total_cards,
        due_today=due_today,
        streak=streak,
        overall_mastery=overall_mastery,
    )


@router.get("/api/analytics/streaks", response_model=StreakResponse)
def get_streaks(db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Current streak, longest streak, and daily activity for last 30 days."""
    today = datetime.utcnow().date()

    # Build daily activity for last 30 days
    daily_activity: list[DailyActivity] = []
    active_days: list[bool] = []

    for i in range(30):
        check_date = today - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())

        sess_q = db.query(func.count(StudySession.id)).filter(
            StudySession.started_at >= day_start, StudySession.started_at <= day_end
        )
        if user:
            sess_q = sess_q.filter(StudySession.user_id == user.id)
        session_count = sess_q.scalar() or 0

        items_reviewed = 0
        if session_count > 0:
            sid_q = db.query(StudySession).filter(
                StudySession.started_at >= day_start, StudySession.started_at <= day_end
            )
            if user:
                sid_q = sid_q.filter(StudySession.user_id == user.id)
            session_ids = [s.id for s in sid_q.all()]
            if session_ids:
                items_reviewed = (
                    db.query(func.count(ReviewLog.id))
                    .filter(ReviewLog.session_id.in_(session_ids))
                    .scalar()
                ) or 0

        daily_activity.append(DailyActivity(
            date=check_date.isoformat(),
            sessions=session_count,
            items_reviewed=items_reviewed,
        ))
        active_days.append(session_count > 0)

    # Current streak
    current_streak = 0
    for i, active in enumerate(active_days):
        if active:
            current_streak += 1
        else:
            if i == 0:
                continue  # Today may not have activity yet
            break

    # Longest streak (check up to 365 days)
    longest_streak = 0
    temp_streak = 0
    for i in range(365):
        check_date = today - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())
        longest_q = db.query(StudySession).filter(
            StudySession.started_at >= day_start, StudySession.started_at <= day_end
        )
        if user:
            longest_q = longest_q.filter(StudySession.user_id == user.id)
        has_session = longest_q.first()
        if has_session:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 0

    daily_activity.reverse()  # Chronological order

    return StreakResponse(
        current_streak=current_streak,
        longest_streak=longest_streak,
        daily_activity=daily_activity,
    )


@router.get("/api/analytics/performance-over-time", response_model=PerformanceOverTimeResponse)
def get_performance_over_time(
    module_id: Optional[str] = Query(None),
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Daily average scores over time."""
    today = datetime.utcnow().date()
    daily_scores: list[DailyScore] = []

    for i in range(days):
        check_date = today - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())

        query = db.query(StudySession).filter(
            StudySession.started_at >= day_start,
            StudySession.started_at <= day_end,
            StudySession.ended_at.isnot(None),
        )
        if user:
            query = query.filter(StudySession.user_id == user.id)
        if module_id:
            query = query.filter(StudySession.module_id == module_id)

        sessions = query.all()
        if sessions:
            avg_score = sum(s.score_pct for s in sessions) / len(sessions)
            daily_scores.append(DailyScore(
                date=check_date.isoformat(),
                avg_score=round(avg_score, 1),
                sessions=len(sessions),
            ))
        else:
            daily_scores.append(DailyScore(
                date=check_date.isoformat(),
                avg_score=0.0,
                sessions=0,
            ))

    daily_scores.reverse()  # Chronological order

    return PerformanceOverTimeResponse(
        daily_scores=daily_scores,
        days=days,
        module_id=module_id,
    )
