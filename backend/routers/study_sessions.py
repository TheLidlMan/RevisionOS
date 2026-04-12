from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import and_, case, func

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
    daily_activity: list[DailyActivity] = Field(default_factory=list)


class DailyScore(BaseModel):
    date: str
    avg_score: float = 0.0
    sessions: int = 0


class PerformanceOverTimeResponse(BaseModel):
    daily_scores: list[DailyScore] = Field(default_factory=list)
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
    query = db.query(
        StudySession,
        Module.name.label("module_name"),
    ).outerjoin(Module, Module.id == StudySession.module_id)
    if user:
        query = query.filter(StudySession.user_id == user.id)
    if module_id:
        query = query.filter(StudySession.module_id == module_id)
    sessions = query.order_by(StudySession.started_at.desc()).limit(limit).all()

    results = []
    for s, module_name in sessions:
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
    now = datetime.utcnow()
    module_query = db.query(func.count(Module.id))
    card_summary_query = db.query(
        func.count(Flashcard.id),
        func.sum(case((Flashcard.due <= now, 1), else_=0)),
        func.sum(
            case((
                and_(
                    Flashcard.state == "REVIEW",
                    Flashcard.lapses == 0,
                    Flashcard.reps >= 2,
                ),
                1,
            ), else_=0)
        ),
    )
    session_dates_query = db.query(func.date(StudySession.started_at)).filter(StudySession.started_at.isnot(None))

    if user:
        module_query = module_query.filter(Module.user_id == user.id)
        card_summary_query = card_summary_query.filter(Flashcard.user_id == user.id)
        session_dates_query = session_dates_query.filter(StudySession.user_id == user.id)

    total_modules = module_query.scalar() or 0
    total_cards, due_today, mastered = card_summary_query.one()
    total_cards = total_cards or 0
    due_today = due_today or 0
    mastered = mastered or 0

    today = datetime.utcnow().date()
    session_dates = {
        datetime.fromisoformat(session_date).date()
        for (session_date,) in session_dates_query.distinct().all()
        if session_date
    }
    streak = 0
    for i in range(365):
        check_date = today - timedelta(days=i)
        if check_date in session_dates:
            streak += 1
            continue
        if i == 0:
            continue
        break

    overall_mastery = round((mastered / total_cards) * 100, 1) if total_cards else 0.0

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
    window_start = today - timedelta(days=29)
    session_counts_query = db.query(
        func.date(StudySession.started_at).label("date"),
        func.count(StudySession.id).label("sessions"),
    ).filter(StudySession.started_at.isnot(None))
    review_counts_query = db.query(
        func.date(StudySession.started_at).label("date"),
        func.count(ReviewLog.id).label("items_reviewed"),
    ).join(ReviewLog, ReviewLog.session_id == StudySession.id).filter(StudySession.started_at.isnot(None))
    streak_dates_query = db.query(func.date(StudySession.started_at)).filter(StudySession.started_at.isnot(None))

    if user:
        session_counts_query = session_counts_query.filter(StudySession.user_id == user.id)
        review_counts_query = review_counts_query.filter(StudySession.user_id == user.id)
        streak_dates_query = streak_dates_query.filter(StudySession.user_id == user.id)

    session_counts_query = session_counts_query.filter(
        StudySession.started_at >= datetime.combine(window_start, datetime.min.time())
    ).group_by(func.date(StudySession.started_at))
    review_counts_query = review_counts_query.filter(
        StudySession.started_at >= datetime.combine(window_start, datetime.min.time())
    ).group_by(func.date(StudySession.started_at))

    session_counts = {date: count for date, count in session_counts_query.all() if date}
    review_counts = {date: count for date, count in review_counts_query.all() if date}

    daily_activity = []
    active_days: list[bool] = []
    for i in range(30):
        check_date = today - timedelta(days=i)
        date_key = check_date.isoformat()
        session_count = session_counts.get(date_key, 0)
        daily_activity.append(DailyActivity(
            date=date_key,
            sessions=session_count,
            items_reviewed=review_counts.get(date_key, 0),
        ))
        active_days.append(session_count > 0)

    current_streak = 0
    for i, active in enumerate(active_days):
        if active:
            current_streak += 1
            continue
        if i == 0:
            continue
        break

    streak_dates = sorted(
        {
            datetime.fromisoformat(session_date).date()
            for (session_date,) in streak_dates_query.distinct().all()
            if session_date
        }
    )
    longest_streak = 0
    previous_date = None
    current_run = 0
    for streak_date in streak_dates:
        if previous_date and (streak_date - previous_date).days == 1:
            current_run += 1
        else:
            current_run = 1
        longest_streak = max(longest_streak, current_run)
        previous_date = streak_date

    daily_activity.reverse()

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
    start_date = today - timedelta(days=days - 1)
    query = db.query(
        func.date(StudySession.started_at).label("date"),
        func.avg(StudySession.score_pct).label("avg_score"),
        func.count(StudySession.id).label("sessions"),
    ).filter(
        StudySession.started_at >= datetime.combine(start_date, datetime.min.time()),
        StudySession.ended_at.isnot(None),
    )
    if user:
        query = query.filter(StudySession.user_id == user.id)
    if module_id:
        query = query.filter(StudySession.module_id == module_id)

    score_by_date = {
        date: (round(avg_score or 0.0, 1), sessions)
        for date, avg_score, sessions in query.group_by(func.date(StudySession.started_at)).all()
        if date
    }

    daily_scores: list[DailyScore] = []
    for i in range(days):
        check_date = start_date + timedelta(days=i)
        avg_score, session_count = score_by_date.get(check_date.isoformat(), (0.0, 0))
        daily_scores.append(DailyScore(
            date=check_date.isoformat(),
            avg_score=avg_score,
            sessions=session_count,
        ))

    return PerformanceOverTimeResponse(
        daily_scores=daily_scores,
        days=days,
        module_id=module_id,
    )
