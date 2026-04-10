from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models.quiz_session import StudySession
from models.flashcard import Flashcard
from models.module import Module

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


# ---------- Endpoints ----------

@router.get("/api/sessions", response_model=list[SessionListItem])
def list_sessions(
    module_id: Optional[str] = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    query = db.query(StudySession)
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
def analytics_overview(db: Session = Depends(get_db)):
    total_modules = db.query(Module).count()
    total_cards = db.query(Flashcard).count()

    now = datetime.utcnow()
    due_today = db.query(Flashcard).filter(Flashcard.due <= now).count()

    # Calculate streak: consecutive days with at least one session
    streak = 0
    today = datetime.utcnow().date()
    for i in range(365):
        check_date = today - timedelta(days=i)
        day_start = datetime.combine(check_date, datetime.min.time())
        day_end = datetime.combine(check_date, datetime.max.time())
        has_session = (
            db.query(StudySession)
            .filter(StudySession.started_at >= day_start, StudySession.started_at <= day_end)
            .first()
        )
        if has_session:
            streak += 1
        else:
            if i == 0:
                continue  # Today might not have a session yet
            break

    # Overall mastery
    all_cards = db.query(Flashcard).all()
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
