import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.module import Module
from services.pipeline_service import rebuild_module_outputs
from services.auth_service import get_current_user
from services.ownership import require_owned_module
from models.user import User

router = APIRouter(tags=["curriculum"])


class CurriculumRequest(BaseModel):
    exam_date: str


class SessionPlan(BaseModel):
    day: str
    activity: str
    duration_minutes: int = 30
    concepts: list[str] = Field(default_factory=list)


class WeekPlan(BaseModel):
    week: int
    focus_areas: list[str] = Field(default_factory=list)
    sessions: list[SessionPlan] = Field(default_factory=list)


class CurriculumResponse(BaseModel):
    module_name: str
    total_concepts: int = 0
    weeks: list[WeekPlan]
    total_weeks: int = 0
    hours_per_week: int = 0
    exam_date: Optional[str] = None
    generated_at: Optional[str] = None


@router.post("/api/modules/{module_id}/curriculum", response_model=CurriculumResponse)
def set_curriculum_date(
    module_id: str,
    body: CurriculumRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    module = require_owned_module(db, module_id, user)

    try:
        module.exam_date = datetime.fromisoformat(body.exam_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid exam_date format") from exc

    study_plan = rebuild_module_outputs(db, module)
    db.commit()
    if not study_plan:
        raise HTTPException(status_code=400, detail="Study plan could not be generated")
    return CurriculumResponse(**study_plan)


@router.get("/api/modules/{module_id}/curriculum", response_model=CurriculumResponse)
def get_curriculum(
    module_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    module = require_owned_module(db, module_id, user)
    if not module.study_plan_json:
        raise HTTPException(status_code=404, detail="Study plan not found")

    try:
        payload = json.loads(module.study_plan_json)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail="Stored study plan is invalid") from exc
    return CurriculumResponse(**payload)
