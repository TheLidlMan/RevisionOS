import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.concept import Concept
from models.document import Document
from models.module import Module
from services import ai_service
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["curriculum"])


# ---------- Pydantic schemas ----------

class CurriculumRequest(BaseModel):
    hours_per_week: int = 5
    exam_date: Optional[str] = None


class SessionPlan(BaseModel):
    day: str
    activity: str
    duration_minutes: int = 30
    concepts: list[str] = []


class WeekPlan(BaseModel):
    week: int
    focus_areas: list[str] = []
    sessions: list[SessionPlan] = []


class CurriculumResponse(BaseModel):
    module_name: str
    total_concepts: int = 0
    weeks: list[WeekPlan]
    total_weeks: int = 0
    hours_per_week: int = 5
    exam_date: Optional[str] = None


# ---------- Endpoints ----------

@router.post("/api/modules/{module_id}/curriculum", response_model=CurriculumResponse)
async def generate_curriculum(
    module_id: str,
    body: CurriculumRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """AI-generate a study plan based on module concepts."""
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    docs = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.processing_status == "done")
        .all()
    )
    if not concepts and not docs:
        raise HTTPException(
            status_code=400,
            detail="No concepts or processed documents found in this module",
        )

    exam_info = ""
    if body.exam_date:
        exam_info = f"The exam is on {body.exam_date}. Plan accordingly."

    source_heading = "Concepts to cover (sorted by importance):"
    if concepts:
        source_payload = json.dumps(
            [
                {"name": c.name, "importance": c.importance_score, "definition": c.definition or ""}
                for c in concepts
            ],
            indent=2,
        )
    else:
        source_heading = "Source material to plan from:"
        all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
        max_chars = min(settings.MAX_CONTEXT_TOKENS * 3, settings.MAX_PROMPT_CHARS)
        source_payload = all_text[:max_chars]

    prompt = (
        f"Create a study plan for the subject '{module.name}'.\n"
        f"Available study time: {body.hours_per_week} hours per week.\n"
        f"{exam_info}\n\n"
        f"{source_heading}\n"
        f"{source_payload}\n\n"
        "Create a weekly study plan. For each week provide:\n"
        "- focus_areas: a short list of the main topics for that week\n"
        "- sessions: day, activity, duration_minutes, concepts\n\n"
        "Balance new learning, retrieval practice, and review sessions. "
        "If concept importance is available, prioritize the highest-importance items first.\n\n"
        "Return ONLY valid JSON:\n"
        '{"weeks": [{"week": 1, "focus_areas": ["..."], '
        '"sessions": [{"day": "Monday", "activity": "...", "duration_minutes": 45, '
        '"concepts": ["..."]}]}]}'
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
            raw_topics = w.get("topics", [])
            focus_areas = w.get("focus_areas", [])
            if not isinstance(focus_areas, list):
                focus_areas = []

            sessions = []
            for s in w.get("sessions", []):
                concepts_for_session = s.get("concepts", [])
                if not isinstance(concepts_for_session, list):
                    concepts_for_session = []
                sessions.append(
                    SessionPlan(
                        day=s.get("day", ""),
                        activity=s.get("activity", ""),
                        duration_minutes=s.get("duration_minutes", s.get("duration", 30)),
                        concepts=concepts_for_session,
                    )
                )

            if not focus_areas and isinstance(raw_topics, list):
                focus_areas = [
                    topic.get("concept_name", "")
                    for topic in raw_topics
                    if isinstance(topic, dict) and topic.get("concept_name")
                ]

            if not sessions and isinstance(raw_topics, list):
                for index, topic in enumerate(raw_topics, start=1):
                    if not isinstance(topic, dict):
                        continue
                    concept_name = topic.get("concept_name", "Review")
                    sessions.append(
                        SessionPlan(
                            day=f"Session {index}",
                            activity=f"Study {concept_name}",
                            duration_minutes=topic.get("estimated_minutes", 30),
                            concepts=[concept_name],
                        )
                    )

            weeks.append(WeekPlan(
                week=w.get("week", len(weeks) + 1),
                focus_areas=focus_areas,
                sessions=sessions,
            ))

        return CurriculumResponse(
            module_name=module.name,
            total_concepts=len(concepts),
            weeks=weeks,
            total_weeks=len(weeks),
            hours_per_week=body.hours_per_week,
            exam_date=body.exam_date,
        )

    except Exception as e:
        logger.error(f"Curriculum generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate curriculum: {str(e)}")
