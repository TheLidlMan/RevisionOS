from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from cache import cache_get, cache_set
from database import get_db
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from models.flashcard import Flashcard
from models.module import Module
from models.user_stats import UserStats
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(tags=["sessions"])


def _get_owned_session(db: Session, session_id: str, user: OptionalType[User]) -> StudySession:
    query = db.query(StudySession).filter(StudySession.id == session_id)
    if user:
        query = query.filter(StudySession.user_id == user.id)
    session = query.first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _sync_session_duration(session: StudySession, now: Optional[datetime] = None) -> None:
    now = now or datetime.utcnow()
    if session.timer_state == "running" and session.resumed_at:
        session.active_duration_sec += max(0, int((now - session.resumed_at).total_seconds()))
        session.resumed_at = now


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
    active_duration_sec: int = 0
    timer_state: str = "running"


class FlashcardSessionStartRequest(BaseModel):
    module_id: str
    total_items: int = 0


class SessionTimerResponse(BaseModel):
    id: str
    module_id: Optional[str] = None
    session_type: str
    status: str
    timer_state: str
    active_duration_sec: int
    paused_at: Optional[datetime] = None
    resumed_at: Optional[datetime] = None
    started_at: datetime
    ended_at: Optional[datetime] = None


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
    query = db.query(StudySession).options(joinedload(StudySession.module))
    if user:
        query = query.filter(StudySession.user_id == user.id)
    if module_id:
        query = query.filter(StudySession.module_id == module_id)
    sessions = query.order_by(StudySession.started_at.desc()).limit(limit).all()

    results = []
    for s in sessions:
        results.append(SessionListItem(
            id=s.id,
            module_id=s.module_id,
            module_name=s.module.name if s.module else None,
            session_type=s.session_type,
            started_at=s.started_at,
            ended_at=s.ended_at,
            total_items=s.total_items,
            correct=s.correct,
            incorrect=s.incorrect,
            skipped=s.skipped,
            score_pct=s.score_pct,
            active_duration_sec=s.active_duration_sec,
            timer_state=s.timer_state,
        ))
    return results


@router.post("/api/sessions/flashcards", response_model=SessionTimerResponse)
def start_flashcard_session(
    body: FlashcardSessionStartRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    module = db.query(Module).filter(Module.id == body.module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    session = StudySession(
        user_id=user.id,
        module_id=body.module_id,
        session_type="FLASHCARDS",
        started_at=datetime.utcnow(),
        resumed_at=datetime.utcnow(),
        timer_state="running",
        total_items=body.total_items,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return SessionTimerResponse(**session.__dict__)


@router.post("/api/sessions/{session_id}/pause", response_model=SessionTimerResponse)
def pause_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = _get_owned_session(db, session_id, user)
    if session.timer_state != "paused":
        now = datetime.utcnow()
        _sync_session_duration(session, now)
        session.timer_state = "paused"
        session.paused_at = now
    db.commit()
    db.refresh(session)
    return SessionTimerResponse(**session.__dict__)


@router.post("/api/sessions/{session_id}/resume", response_model=SessionTimerResponse)
def resume_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = _get_owned_session(db, session_id, user)
    if session.timer_state != "running":
        now = datetime.utcnow()
        session.timer_state = "running"
        session.paused_at = None
        session.resumed_at = now
    db.commit()
    db.refresh(session)
    return SessionTimerResponse(**session.__dict__)


@router.post("/api/sessions/{session_id}/complete", response_model=SessionTimerResponse)
def complete_timer_session(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = _get_owned_session(db, session_id, user)
    now = datetime.utcnow()
    if session.timer_state == "running":
        _sync_session_duration(session, now)
    session.timer_state = "completed"
    session.status = "completed"
    session.ended_at = now
    session.paused_at = None
    session.resumed_at = None
    stats = db.query(UserStats).filter(UserStats.user_id == user.id).first()
    if stats:
        existing_completed = max(0, sum(
            completed.active_duration_sec or 0
            for completed in db.query(StudySession)
            .filter(StudySession.user_id == user.id, StudySession.status == "completed")
            .all()
        ))
        stats.total_study_time_sec = max(existing_completed, stats.total_study_time_sec)
    db.commit()
    db.refresh(session)
    return SessionTimerResponse(**session.__dict__)


@router.get("/api/sessions/{session_id}", response_model=SessionTimerResponse)
def get_session_timer(
    session_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    session = _get_owned_session(db, session_id, user)
    return SessionTimerResponse(**session.__dict__)


@router.get("/api/analytics/overview", response_model=OverviewResponse)
def analytics_overview(db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    cache_key = f"cache:analytics:{user.id if user else 'anonymous'}:overview"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached

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

    # Calculate streak from a single distinct-date query instead of 365 point lookups
    streak = 0
    today = now.date()
    streak_window_start = datetime.combine(today - timedelta(days=364), datetime.min.time())
    streak_dates = {
        str(value)
        for value, in (
            session_query_base
            .filter(StudySession.started_at >= streak_window_start)
            .with_entities(func.date(StudySession.started_at))
            .distinct()
            .all()
        )
        if value is not None
    }
    for i in range(365):
        if (today - timedelta(days=i)).isoformat() in streak_dates:
            streak += 1
        else:
            if i == 0:
                continue  # Today might not have a session yet
            break

    # Overall mastery via SQL instead of loading every card into Python
    if total_cards:
        mastered = (
            card_query
            .filter(Flashcard.state == "REVIEW", Flashcard.lapses == 0, Flashcard.reps >= 2)
            .count()
        )
        overall_mastery = round((mastered / total_cards) * 100, 1)
    else:
        overall_mastery = 0.0

    response = OverviewResponse(
        total_modules=total_modules,
        total_cards=total_cards,
        due_today=due_today,
        streak=streak,
        overall_mastery=overall_mastery,
    )
    cache_set(cache_key, response.model_dump(mode="json"), ttl=60)
    return response


@router.get("/api/analytics/streaks", response_model=StreakResponse)
def get_streaks(db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Current streak, longest streak, and daily activity for last 30 days."""
    today = datetime.utcnow().date()
    window_start = datetime.combine(today - timedelta(days=29), datetime.min.time())
    longest_window_start = datetime.combine(today - timedelta(days=364), datetime.min.time())

    sessions_by_date_query = (
        db.query(
            func.date(StudySession.started_at).label("day"),
            func.count(StudySession.id).label("sessions"),
        )
        .filter(StudySession.started_at >= window_start)
    )
    longest_dates_query = (
        db.query(func.date(StudySession.started_at))
        .filter(StudySession.started_at >= longest_window_start)
        .distinct()
    )
    reviewed_by_date_query = (
        db.query(
            func.date(StudySession.started_at).label("day"),
            func.count(ReviewLog.id).label("items_reviewed"),
        )
        .join(ReviewLog, ReviewLog.session_id == StudySession.id)
        .filter(StudySession.started_at >= window_start)
    )
    if user:
        sessions_by_date_query = sessions_by_date_query.filter(StudySession.user_id == user.id)
        longest_dates_query = longest_dates_query.filter(StudySession.user_id == user.id)
        reviewed_by_date_query = reviewed_by_date_query.filter(StudySession.user_id == user.id)

    sessions_by_date = {
        str(day): int(count or 0)
        for day, count in sessions_by_date_query.group_by(func.date(StudySession.started_at)).all()
        if day is not None
    }
    reviewed_by_date = {
        str(day): int(count or 0)
        for day, count in reviewed_by_date_query.group_by(func.date(StudySession.started_at)).all()
        if day is not None
    }
    active_date_set = {
        str(day)
        for day, in longest_dates_query.all()
        if day is not None
    }

    # Build daily activity for last 30 days
    daily_activity: list[DailyActivity] = []
    active_days: list[bool] = []

    for i in range(30):
        check_date = today - timedelta(days=i)
        date_key = check_date.isoformat()
        session_count = sessions_by_date.get(date_key, 0)
        items_reviewed = reviewed_by_date.get(date_key, 0)

        daily_activity.append(DailyActivity(
            date=date_key,
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
        if (today - timedelta(days=i)).isoformat() in active_date_set:
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
