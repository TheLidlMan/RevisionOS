import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.concept import Concept
from models.module import Module
from services import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["curriculum"])


# ---------- Pydantic schemas ----------

class CurriculumRequest(BaseModel):
    hours_per_week: int = 5
    exam_date: Optional[str] = None


class TopicPlan(BaseModel):
    concept_name: str
    estimated_minutes: int = 30
    resources: list[str] = []


class SessionPlan(BaseModel):
    day: str
    activity: str
    duration: int = 30


class WeekPlan(BaseModel):
    week: int
    topics: list[TopicPlan] = []
    sessions: list[SessionPlan] = []


class CurriculumResponse(BaseModel):
    weeks: list[WeekPlan]
    total_weeks: int = 0
    hours_per_week: int = 5


# ---------- Endpoints ----------

@router.post("/api/modules/{module_id}/curriculum", response_model=CurriculumResponse)
async def generate_curriculum(
    module_id: str,
    body: CurriculumRequest,
    db: Session = Depends(get_db),
):
    """AI-generate a study plan based on module concepts."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    if not concepts:
        raise HTTPException(status_code=400, detail="No concepts found in this module")

    concept_list = [
        {"name": c.name, "importance": c.importance_score, "definition": c.definition or ""}
        for c in concepts
    ]

    exam_info = ""
    if body.exam_date:
        exam_info = f"The exam is on {body.exam_date}. Plan accordingly."

    prompt = (
        f"Create a study plan for the subject '{module.name}'.\n"
        f"Available study time: {body.hours_per_week} hours per week.\n"
        f"{exam_info}\n\n"
        f"Concepts to cover (sorted by importance):\n"
        f"{json.dumps(concept_list, indent=2)}\n\n"
        "Create a weekly study plan. For each week provide:\n"
        "- Topics to study with estimated minutes and learning resources/activities\n"
        "- Daily study sessions with activity type and duration\n\n"
        "Prioritize high-importance concepts. Include review sessions.\n\n"
        "Return ONLY valid JSON:\n"
        '{"weeks": [{"week": 1, "topics": [{"concept_name": "...", '
        '"estimated_minutes": 30, "resources": ["..."]}], '
        '"sessions": [{"day": "Monday", "activity": "...", "duration": 30}]}]}'
    )

    messages = [
        {"role": "system", "content": "You are an expert study planner creating optimized study schedules."},
        {"role": "user", "content": prompt},
    ]

    try:
        response_text = await ai_service._call_groq(messages, max_tokens=4096)
        parsed = ai_service._parse_json_response(response_text)

        if isinstance(parsed, dict) and "weeks" in parsed:
            weeks_data = parsed["weeks"]
        elif isinstance(parsed, list):
            weeks_data = parsed
        else:
            weeks_data = [parsed]

        weeks: list[WeekPlan] = []
        for w in weeks_data:
            topics = [
                TopicPlan(
                    concept_name=t.get("concept_name", "Unknown"),
                    estimated_minutes=t.get("estimated_minutes", 30),
                    resources=t.get("resources", []),
                )
                for t in w.get("topics", [])
            ]
            sessions = [
                SessionPlan(
                    day=s.get("day", ""),
                    activity=s.get("activity", ""),
                    duration=s.get("duration", 30),
                )
                for s in w.get("sessions", [])
            ]
            weeks.append(WeekPlan(
                week=w.get("week", len(weeks) + 1),
                topics=topics,
                sessions=sessions,
            ))

        return CurriculumResponse(
            weeks=weeks,
            total_weeks=len(weeks),
            hours_per_week=body.hours_per_week,
        )

    except Exception as e:
        logger.error(f"Curriculum generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate curriculum: {str(e)}")
