"""
Advanced feature endpoints for Revise OS.

Covers: forgetting-curve visualisation, session estimation, concept gap detection,
cross-module synthesis cards, elaboration prompts, free recall, YouTube ingest,
web clipping, timed exams, confidence calibration, spaced writing practice,
retention forecasting, exam revision timelines, session replay,
mastery heatmaps, and image-occlusion cards.
"""

import json
import logging
import re
import uuid
from datetime import datetime, timedelta
from time import perf_counter
from typing import Optional as OptionalType

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from config import settings
from database import get_db, get_pool_snapshot, is_pool_under_pressure
from models.concept import Concept
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.quiz_question import QuizQuestion
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from models.user import User
from services import ai_service
from services.auth_service import get_current_user
from services.quota_service import ai_quota_scope

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["features"])


def _json_response_format() -> OptionalType[dict[str, str]]:
    return ai_service.JSON_RESPONSE_FORMAT if settings.LLM_JSON_MODE_ENABLED else None


def _stream_ai_route(
    messages: list[dict[str, str]],
    *,
    kind: str,
    user_id: OptionalType[str] = None,
    expected_payload_key: OptionalType[str],
    max_completion_tokens: int,
    final_mapper,
) -> StreamingResponse:
    async def event_stream():
        started = perf_counter()
        pool_before = get_pool_snapshot()
        try:
            with ai_quota_scope(user_id):
                async for event in ai_service.stream_groq_completion(
                    messages,
                    kind=kind,
                    max_completion_tokens=max_completion_tokens,
                    response_format=_json_response_format(),
                    expected_payload_key=expected_payload_key,
                ):
                    if event.get("event") == "final":
                        envelope = event.get("envelope", {})
                        event["result"] = final_mapper(envelope)
                    yield ai_service.encode_sse_event(event)
        except Exception:
            return
        finally:
            if settings.REQUEST_TIMING_LOG_ENABLED:
                duration_ms = (perf_counter() - started) * 1000
                pool_after = get_pool_snapshot()
                level = logging.WARNING if (
                    duration_ms >= settings.REQUEST_TIMING_WARN_MS
                    or is_pool_under_pressure(pool_before, settings.POOL_PRESSURE_WARN_RATIO)
                    or is_pool_under_pressure(pool_after, settings.POOL_PRESSURE_WARN_RATIO)
                ) else logging.INFO
                logger.log(
                    level,
                    "ai_stream_timing kind=%s duration_ms=%.1f pool_before=%s pool_after=%s",
                    kind,
                    duration_ms,
                    pool_before,
                    pool_after,
                )

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ╔══════════════════════════════════════════════════════════════════╗
# ║                      PYDANTIC SCHEMAS                          ║
# ╚══════════════════════════════════════════════════════════════════╝

# ── Forgetting Curve ──────────────────────────────────────────────

class ForgettingCurvePoint(BaseModel):
    day: int
    retention_pct: float


class ForgettingCurveResponse(BaseModel):
    card_id: str
    stability: float
    data_points: list[ForgettingCurvePoint]


# ── Session Estimator ─────────────────────────────────────────────

class SessionEstimateResponse(BaseModel):
    due_cards: int
    avg_seconds_per_card: float
    estimated_minutes: float
    new_cards: int
    review_cards: int


# ── Concept Gap Detection ────────────────────────────────────────

class ConceptGap(BaseModel):
    name: str
    context_snippet: str
    mentioned_in_documents: int
    has_definition: bool


class ConceptGapResponse(BaseModel):
    gaps: list[ConceptGap]


# ── Cross-Module Synthesis Cards ──────────────────────────────────

class SynthesisCardsRequest(BaseModel):
    module_ids: list[str]
    num_cards: int = Field(default=5, ge=1, le=30)


class SynthesisCardOut(BaseModel):
    id: str
    module_id: str
    front: str
    back: str
    card_type: str
    tags: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class SynthesisCardsResponse(BaseModel):
    generated: int
    cards: list[SynthesisCardOut]


# ── Elaboration Prompts ──────────────────────────────────────────

class FollowUpQuestion(BaseModel):
    question: str
    hint: str


class ElaborationResponse(BaseModel):
    card_id: str
    follow_up_questions: list[FollowUpQuestion]


# ── Free Recall ──────────────────────────────────────────────────

class FreeRecallRequest(BaseModel):
    topic: str
    user_text: str


class MissedConcept(BaseModel):
    name: str
    definition: str


class FreeRecallResponse(BaseModel):
    score_pct: float
    total_concepts: int
    recalled_concepts: int
    missed_concepts: list[MissedConcept]
    feedback: str


# ── YouTube Ingest ───────────────────────────────────────────────

class YouTubeIngestRequest(BaseModel):
    module_id: str
    youtube_url: str


class DocumentOut(BaseModel):
    id: str
    module_id: str
    filename: str
    file_type: str
    file_path: str
    raw_text: str = ""
    processed: bool = False
    processing_status: str = "pending"
    word_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Web Clipper ──────────────────────────────────────────────────

class ClipUrlRequest(BaseModel):
    module_id: str
    url: str


# ── Timed Exam ───────────────────────────────────────────────────

class ExamStartRequest(BaseModel):
    module_id: str
    time_limit_minutes: int = Field(ge=1, le=300)
    num_questions: int = Field(ge=1, le=100)


class ExamQuestionOut(BaseModel):
    id: str
    question_text: str
    question_type: str
    options: OptionalType[list[str]] = None
    difficulty: str

    model_config = {"from_attributes": True}


class ExamStartResponse(BaseModel):
    session_id: str
    module_id: str
    time_limit_minutes: int
    total_questions: int
    questions: list[ExamQuestionOut]
    started_at: datetime


class ExamAnswer(BaseModel):
    question_id: str
    user_answer: str


class ExamSubmitRequest(BaseModel):
    answers: list[ExamAnswer]


class ExamResultItem(BaseModel):
    question_id: str
    question_text: str
    correct_answer: str
    user_answer: str
    is_correct: bool
    explanation: str = ""


class ExamSubmitResponse(BaseModel):
    session_id: str
    total: int
    correct: int
    incorrect: int
    score_pct: float
    time_taken_seconds: int = 0
    review: list[ExamResultItem]


# ── Confidence Rating ────────────────────────────────────────────

class ConfidenceRequest(BaseModel):
    confidence: int = Field(ge=1, le=5)


class ConfidenceResponse(BaseModel):
    card_id: str
    confidence: int
    recorded: bool


class CalibrationPoint(BaseModel):
    confidence_level: int
    predicted_pct: float
    actual_pct: float
    count: int


class CalibrationResponse(BaseModel):
    calibration: list[CalibrationPoint]
    overall_accuracy: float = 0.0
    overconfidence_score: float = 0.0


# ── Spaced Writing Practice ──────────────────────────────────────

class WritingPromptResponse(BaseModel):
    question: str
    mark_scheme: str
    time_limit_minutes: int
    max_marks: int


class WritingGradeRequest(BaseModel):
    question: str
    mark_scheme: str
    user_response: str


class ParagraphFeedback(BaseModel):
    paragraph_idx: int
    feedback: str
    marks: float


class WritingGradeResponse(BaseModel):
    score: float
    max_marks: int
    overall_feedback: str
    paragraph_feedback: list[ParagraphFeedback]


# ── Retention Forecast ───────────────────────────────────────────

class ModuleForecastPoint(BaseModel):
    days: int
    retention_pct: float


class ModuleForecast(BaseModel):
    module_id: str
    module_name: str
    forecasts: list[ModuleForecastPoint]


class RetentionForecastResponse(BaseModel):
    modules: list[ModuleForecast]


# ── Exam Revision Timeline ──────────────────────────────────────

class ExamTimelineRequest(BaseModel):
    exam_date: str  # ISO date


class DailyPlan(BaseModel):
    date: str
    cards_to_review: int
    new_cards: int
    estimated_minutes: float
    focus_concepts: list[str]


class ExamTimelineResponse(BaseModel):
    exam_date: str
    days_until: int
    daily_plan: list[DailyPlan]


# ── Session Replay ───────────────────────────────────────────────

class ReplayItem(BaseModel):
    item_id: str
    item_type: str
    question_text: str
    correct_answer: str
    user_answer: OptionalType[str] = None
    was_correct: bool
    rating: str
    time_taken: float


class ReplaySession(BaseModel):
    id: str
    module_id: OptionalType[str] = None
    module_name: OptionalType[str] = None
    session_type: str
    started_at: datetime
    ended_at: OptionalType[datetime] = None
    total_items: int
    correct: int
    incorrect: int
    skipped: int
    score_pct: float


class SessionReplayResponse(BaseModel):
    session: ReplaySession
    items: list[ReplayItem]


# ── Mastery Heatmap ──────────────────────────────────────────────

class HeatmapDay(BaseModel):
    date: str
    mastery_gain: float
    sessions_count: int
    items_reviewed: int


class MasteryHeatmapResponse(BaseModel):
    days: list[HeatmapDay]


# ── Image Occlusion ──────────────────────────────────────────────

class OcclusionZone(BaseModel):
    x: float
    y: float
    width: float
    height: float
    label: str


class ImageOcclusionRequest(BaseModel):
    module_id: str
    image_url: str
    occlusions: list[OcclusionZone]


class ImageOcclusionCard(BaseModel):
    id: str
    module_id: str
    front: str
    back: str
    card_type: str
    tags: list[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageOcclusionResponse(BaseModel):
    generated: int
    cards: list[ImageOcclusionCard]


# ╔══════════════════════════════════════════════════════════════════╗
# ║                         HELPERS                                ║
# ╚══════════════════════════════════════════════════════════════════╝

def _concept_gap_messages(existing_concepts: list[str], all_text: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are an expert educational analyst. Identify concepts that are "
                "mentioned in the source text but never fully defined or explained."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Existing concepts already tracked: {json.dumps(existing_concepts)}\n\n"
                "Analyze the text and find concept gaps: terms, theories, or ideas that are referenced "
                "but lack a clear definition in the material.\n\n"
                "Return a JSON object with a `gaps` array.\n"
                "Each gap must include `name`, `context_snippet`, `mentioned_in_documents`, and `has_definition`.\n\n"
                f"Text:\n{all_text}"
            ),
        },
    ]


def _synthesis_card_messages(num_cards: int, concept_summary: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You create cross-disciplinary study flashcards that connect concepts from different modules."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create {num_cards} synthesis flashcards connecting concepts across these modules:\n\n"
                f"{concept_summary}\n\n"
                "Return a JSON object with a `cards` array. Each card must include `front`, `back`, and `tags`, "
                "and every card should require understanding from at least two modules."
            ),
        },
    ]


def _elaboration_messages(card: Flashcard) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You generate follow-up elaboration questions that force the learner to apply a concept in new contexts."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Flashcard front: {card.front}\n"
                f"Flashcard back: {card.back}\n\n"
                "Generate 2-3 follow-up questions that test deeper understanding or application of this concept.\n"
                "Return a JSON object with a `questions` array.\n"
                "Each question item must include `question` and `hint`."
            ),
        },
    ]


def _free_recall_messages(topic: str, concept_list: str, source_material: str, user_text: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You evaluate a student's free-recall attempt against source material and return fair, actionable scoring."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Topic: {topic}\n\n"
                f"Key concepts in the module:\n{concept_list}\n\n"
                f"Source material (excerpt):\n{source_material[:8000]}\n\n"
                f"Student's recall attempt:\n{user_text}\n\n"
                "Return a JSON object with `score_pct`, `total_concepts`, `recalled_concepts`, `missed_concepts`, and `feedback`.\n"
                "`missed_concepts` must be an array of objects containing `name` and `definition`."
            ),
        },
    ]


def _writing_prompt_messages(module_name: str, material: str, doc_excerpt: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are an academic examiner generating one strong essay question and a clear mark scheme."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Module: {module_name}\n\n"
                f"Key concepts:\n{material}\n\n"
                f"Source text excerpt:\n{doc_excerpt}\n\n"
                "Return a JSON object with `question`, `mark_scheme`, `time_limit_minutes`, and `max_marks`."
            ),
        },
    ]


def _writing_grade_messages(question: str, mark_scheme: str, user_response: str) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "You are an academic examiner grading an essay with paragraph-level feedback and an overall score."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\n"
                f"Mark Scheme:\n{mark_scheme}\n\n"
                f"Student Response:\n{user_response}\n\n"
                "Return a JSON object with `score`, `max_marks`, `overall_feedback`, and `paragraph_feedback`.\n"
                "Each `paragraph_feedback` item must include `paragraph_idx`, `feedback`, and `marks`."
            ),
        },
    ]


def _fsrs_retention(stability: float, days: float) -> float:
    """FSRS power-decay formula: R(t) = (1 + t/(9*S))^(-1)."""
    if stability <= 0:
        return 0.0
    return (1.0 + days / (9.0 * stability)) ** -1


def _strip_html(html: str) -> str:
    """Crude HTML → plain-text conversion."""
    text = re.sub(r"<\s*script[\s>].*?<\s*/\s*script\s*>", "", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<\s*style[\s>].*?<\s*/\s*style\s*>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


_YOUTUBE_RE = re.compile(
    r"^(https?://)?(www\.)?(youtube\.com/(watch\?v=|shorts/|embed/)|youtu\.be/)"
)


def _is_youtube_url(url: str) -> bool:
    return bool(_YOUTUBE_RE.match(url))


def _validate_external_url(url: str) -> str:
    """Validate that a URL is an acceptable external HTTP(S) URL (SSRF mitigation)."""
    import ipaddress
    import socket
    from urllib.parse import urlparse

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Only http and https URLs are allowed")
    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL must include a hostname")

    hostname = parsed.hostname.lower()
    # Block obviously internal hostnames
    blocked_hosts = {
        "localhost", "localhost.localdomain",
        "127.0.0.1", "0.0.0.0", "[::1]",
        "metadata.google.internal", "metadata.internal",
    }
    if hostname in blocked_hosts:
        raise HTTPException(status_code=400, detail="Requests to internal addresses are not allowed")

    # Resolve hostname and validate all resulting IPs are public
    try:
        addr_infos = socket.getaddrinfo(hostname, parsed.port or (443 if parsed.scheme == "https" else 80))
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Could not resolve hostname")

    for _family, _type, _proto, _canonname, sockaddr in addr_infos:
        ip = ipaddress.ip_address(sockaddr[0])
        if not ip.is_global:
            raise HTTPException(status_code=400, detail="Requests to internal addresses are not allowed")

    return url


def _scope_module_query(db: Session, module_id: str, user: OptionalType[User]):
    query = db.query(Module).filter(Module.id == module_id)
    if user:
        return query.filter(Module.user_id == user.id)
    return query.filter(Module.user_id.is_(None))


def _scope_session_query(db: Session, session_id: str, user: OptionalType[User]):
    query = db.query(StudySession).filter(StudySession.id == session_id)
    if user:
        return query.filter(StudySession.user_id == user.id)
    return query.filter(StudySession.user_id.is_(None))


def _parse_tags_json(tags_str: OptionalType[str]) -> list[str]:
    if not tags_str:
        return []
    try:
        parsed = json.loads(tags_str)
        return parsed if isinstance(parsed, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


# Predicted-confidence → predicted-accuracy mapping (rough calibration reference)
_CONFIDENCE_PREDICTED_PCT = {1: 20.0, 2: 40.0, 3: 60.0, 4: 80.0, 5: 95.0}


# ╔══════════════════════════════════════════════════════════════════╗
# ║                         ENDPOINTS                              ║
# ╚══════════════════════════════════════════════════════════════════╝


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  1. Forgetting Curve Visualiser
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get(
    "/flashcards/{card_id}/forgetting-curve",
    response_model=ForgettingCurveResponse,
)
def forgetting_curve(
    card_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    intervals = [0, 1, 2, 3, 5, 7, 14, 21, 30, 60, 90]
    stability = card.stability or 0.0

    data_points = [
        ForgettingCurvePoint(
            day=d,
            retention_pct=round(_fsrs_retention(stability, d) * 100, 2),
        )
        for d in intervals
    ]

    return ForgettingCurveResponse(
        card_id=card.id,
        stability=stability,
        data_points=data_points,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  2. Smart Session Estimator
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/session-estimate", response_model=SessionEstimateResponse)
def session_estimate(
    module_id: OptionalType[str] = None,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    now = datetime.utcnow()

    card_query = db.query(Flashcard)
    if module_id:
        card_query = card_query.filter(Flashcard.module_id == module_id)
    if user:
        card_query = card_query.filter(Flashcard.user_id == user.id)

    due_cards = card_query.filter(Flashcard.due <= now).all()
    new_cards = sum(1 for c in due_cards if c.state == "NEW")
    review_cards = len(due_cards) - new_cards

    # Average time per card from review logs
    avg_query = db.query(func.avg(ReviewLog.time_taken_seconds))
    if user:
        avg_query = avg_query.filter(ReviewLog.user_id == user.id)
    avg_seconds = avg_query.scalar() or 15.0

    estimated_minutes = round((len(due_cards) * avg_seconds) / 60.0, 1)

    return SessionEstimateResponse(
        due_cards=len(due_cards),
        avg_seconds_per_card=round(avg_seconds, 1),
        estimated_minutes=estimated_minutes,
        new_cards=new_cards,
        review_cards=review_cards,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  3. Concept Gap Detection
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/modules/{module_id}/detect-gaps",
    response_model=ConceptGapResponse,
)
async def detect_gaps(
    module_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = _scope_module_query(db, module_id, user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.processing_status == "done")
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents in this module")

    all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    max_chars = settings.MAX_PROMPT_CHARS
    if len(all_text) > max_chars:
        all_text = all_text[:max_chars]

    existing_concepts = [
        c.name
        for c in db.query(Concept).filter(Concept.module_id == module_id).all()
    ]

    messages = _concept_gap_messages(existing_concepts, all_text)
    db.close()
    try:
        envelope = await ai_service._call_groq(
            messages,
            kind="concept_gaps",
            max_completion_tokens=2048,
            response_format=_json_response_format(),
            expected_payload_key="gaps",
        )
        gaps_raw = envelope.get("data", {}).get("gaps", [])
        gaps = [
            ConceptGap(
                name=g.get("name", ""),
                context_snippet=g.get("context_snippet", ""),
                mentioned_in_documents=g.get("mentioned_in_documents", 1),
                has_definition=g.get("has_definition", False),
            )
            for g in gaps_raw
            if isinstance(g, dict) and g.get("name")
        ]
    except (json.JSONDecodeError, ValueError, AttributeError) as exc:
        logger.error("Failed to parse gap-detection response: %s", exc)
        gaps = []

    return ConceptGapResponse(gaps=gaps)


@router.post("/modules/{module_id}/detect-gaps/stream")
async def detect_gaps_stream(
    module_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = _scope_module_query(db, module_id, user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.processing_status == "done")
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents in this module")

    all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    if len(all_text) > settings.MAX_PROMPT_CHARS:
        all_text = all_text[: settings.MAX_PROMPT_CHARS]
    existing_concepts = [c.name for c in db.query(Concept).filter(Concept.module_id == module_id).all()]
    module_user_id = module.user_id
    db.close()

    return _stream_ai_route(
        _concept_gap_messages(existing_concepts, all_text),
        kind="concept_gaps",
        user_id=module_user_id,
        expected_payload_key="gaps",
        max_completion_tokens=2048,
        final_mapper=lambda envelope: {"gaps": envelope.get("data", {}).get("gaps", [])},
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  4. Cross-Module Synthesis Cards
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/synthesis-cards", response_model=SynthesisCardsResponse, status_code=201)
async def synthesis_cards(
    body: SynthesisCardsRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    if len(body.module_ids) < 2:
        raise HTTPException(status_code=400, detail="At least two module IDs are required")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    modules = db.query(Module).filter(Module.id.in_(body.module_ids)).all()
    if len(modules) != len(body.module_ids):
        raise HTTPException(status_code=404, detail="One or more modules not found")

    concepts_by_module_id: dict[str, list[Concept]] = {}
    for concept in db.query(Concept).filter(Concept.module_id.in_(body.module_ids)).all():
        concepts_by_module_id.setdefault(concept.module_id, []).append(concept)

    module_concepts: dict[str, list[str]] = {}
    for mod in modules:
        concepts = concepts_by_module_id.get(mod.id, [])
        module_concepts[mod.name] = [
            f"{c.name}: {c.definition or ''}" for c in concepts
        ]

    if not any(module_concepts.values()):
        raise HTTPException(status_code=400, detail="No concepts found across the selected modules")

    concept_summary = "\n\n".join(
        f"Module '{name}':\n" + "\n".join(f"  - {c}" for c in concepts)
        for name, concepts in module_concepts.items()
        if concepts
    )
    primary_module_id = body.module_ids[0]
    request_user_id = user.id if user else None

    db.close()

    messages = _synthesis_card_messages(body.num_cards, concept_summary)
    try:
        with ai_quota_scope(request_user_id):
            envelope = await ai_service._call_groq(
                messages,
                kind="synthesis_cards",
                max_completion_tokens=4096,
                response_format=_json_response_format(),
                expected_payload_key="cards",
            )
        cards_data = envelope.get("data", {}).get("cards", [])
        if not isinstance(cards_data, list):
            cards_data = [cards_data]
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=502, detail="Failed to parse AI response")

    created: list[Flashcard] = []
    for cd in cards_data:
        tags = cd.get("tags", ["synthesis"])
        if not isinstance(tags, list):
            tags = ["synthesis"]
        if "synthesis" not in tags:
            tags.insert(0, "synthesis")

        card = Flashcard(
            id=str(uuid.uuid4()),
            module_id=primary_module_id,
            user_id=request_user_id,
            front=cd.get("front", ""),
            back=cd.get("back", ""),
            card_type="BASIC",
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
        )
        db.add(card)
        created.append(card)

    db.commit()
    for c in created:
        db.refresh(c)

    return SynthesisCardsResponse(
        generated=len(created),
        cards=[
            SynthesisCardOut(
                id=c.id,
                module_id=c.module_id,
                front=c.front,
                back=c.back,
                card_type=c.card_type,
                tags=_parse_tags_json(c.tags),
                created_at=c.created_at,
            )
            for c in created
        ],
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  5. Elaboration Prompts
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/flashcards/{card_id}/elaborate",
    response_model=ElaborationResponse,
)
async def elaborate(
    card_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    messages = _elaboration_messages(card)
    resolved_user_id = card.user_id or (user.id if user else None)
    resolved_card_id = card.id
    db.close()
    try:
        with ai_quota_scope(resolved_user_id):
            envelope = await ai_service._call_groq(
                messages,
                kind="elaboration_questions",
                max_completion_tokens=1024,
                response_format=_json_response_format(),
                expected_payload_key="questions",
            )
        parsed = envelope.get("data", {}).get("questions", [])
        if not isinstance(parsed, list):
            parsed = [parsed]
        follow_ups = [
            FollowUpQuestion(
                question=q.get("question", ""),
                hint=q.get("hint", ""),
            )
            for q in parsed
            if isinstance(q, dict) and q.get("question")
        ]
    except (json.JSONDecodeError, ValueError):
        follow_ups = []

    return ElaborationResponse(card_id=resolved_card_id, follow_up_questions=follow_ups)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  6. Free Recall Mode
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/modules/{module_id}/free-recall",
    response_model=FreeRecallResponse,
)
async def free_recall(
    module_id: str,
    body: FreeRecallRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = db.query(Document).filter(
        Document.module_id == module_id, Document.processing_status == "done"
    ).all()
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()

    source_material = "\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    concept_list = "\n".join(
        f"- {c.name}: {c.definition or 'No definition'}" for c in concepts
    )

    max_chars = settings.MAX_PROMPT_CHARS
    if len(source_material) > max_chars:
        source_material = source_material[:max_chars]

    messages = _free_recall_messages(body.topic, concept_list, source_material, body.user_text)
    module_user_id = module.user_id
    db.close()
    try:
        with ai_quota_scope(module_user_id):
            envelope = await ai_service._call_groq(
                messages,
                kind="free_recall",
                max_completion_tokens=2048,
                response_format=_json_response_format(),
                expected_payload_key="score_pct",
            )
        parsed = envelope.get("data", {})
        if not isinstance(parsed, dict):
            raise ValueError("Expected dict response")
        missed = [
            MissedConcept(name=m.get("name", ""), definition=m.get("definition", ""))
            for m in parsed.get("missed_concepts", [])
            if isinstance(m, dict)
        ]
        return FreeRecallResponse(
            score_pct=float(parsed.get("score_pct", 0)),
            total_concepts=int(parsed.get("total_concepts", 0)),
            recalled_concepts=int(parsed.get("recalled_concepts", 0)),
            missed_concepts=missed,
            feedback=parsed.get("feedback", ""),
        )
    except (json.JSONDecodeError, ValueError, AttributeError) as exc:
        logger.error("Failed to parse free-recall response: %s", exc)
        return FreeRecallResponse(
            score_pct=0,
            total_concepts=0,
            recalled_concepts=0,
            missed_concepts=[],
            feedback="Unable to evaluate recall at this time.",
        )


@router.post("/modules/{module_id}/free-recall/stream")
async def free_recall_stream(
    module_id: str,
    body: FreeRecallRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = db.query(Document).filter(
        Document.module_id == module_id, Document.processing_status == "done"
    ).all()
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    source_material = "\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    concept_list = "\n".join(f"- {c.name}: {c.definition or 'No definition'}" for c in concepts)
    if len(source_material) > settings.MAX_PROMPT_CHARS:
        source_material = source_material[: settings.MAX_PROMPT_CHARS]
    module_user_id = module.user_id
    db.close()

    return _stream_ai_route(
        _free_recall_messages(body.topic, concept_list, source_material, body.user_text),
        kind="free_recall",
        user_id=module_user_id,
        expected_payload_key="score_pct",
        max_completion_tokens=2048,
        final_mapper=lambda envelope: envelope.get("data", {}),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  7. YouTube URL Ingest
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/documents/youtube", response_model=DocumentOut, status_code=201)
def youtube_ingest(
    body: YouTubeIngestRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = _scope_module_query(db, body.module_id, user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not _is_youtube_url(body.youtube_url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")

    doc = Document(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        module_id=body.module_id,
        filename=body.youtube_url,
        file_type="YOUTUBE",
        file_path=body.youtube_url,
        raw_text="",
        processed=False,
        processing_status="pending",
        word_count=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  8. Web Clipper API
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/documents/clip-url", response_model=DocumentOut, status_code=201)
async def clip_url(
    body: ClipUrlRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == body.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    module_id = module.id
    user_id = user.id if user else None
    db.close()

    validated_url = _validate_external_url(body.url)

    try:
        from urllib.parse import urljoin

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as client:
            resp = await client.get(validated_url)
            # If we get a redirect, validate the target too
            if resp.is_redirect and resp.has_redirect_location:
                redirect_url = urljoin(validated_url, str(resp.headers.get("location", "")))
                _validate_external_url(redirect_url)
                resp = await client.get(redirect_url)
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch URL: {exc}")

    text = _strip_html(html)
    word_count = len(text.split())

    doc = Document(
        id=str(uuid.uuid4()),
        user_id=user_id,
        module_id=module_id,
        filename=body.url,
        file_type="URL",
        file_path=body.url,
        raw_text=text,
        processed=True,
        processing_status="done",
        word_count=word_count,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  11. Timed Exam Mode
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/exam/start", response_model=ExamStartResponse, status_code=201)
def exam_start(
    body: ExamStartRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = _scope_module_query(db, body.module_id, user).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    questions = (
        db.query(QuizQuestion)
        .filter(QuizQuestion.module_id == body.module_id)
        .order_by(func.random())
        .limit(body.num_questions)
        .all()
    )
    if not questions:
        raise HTTPException(status_code=400, detail="No questions available for this module")

    session = StudySession(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        module_id=body.module_id,
        session_type="TIMED_EXAM",
        started_at=datetime.utcnow(),
        total_items=len(questions),
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    question_items = []
    for q in questions:
        options = None
        if q.options:
            try:
                options = json.loads(q.options)
            except (json.JSONDecodeError, TypeError):
                options = None

        question_items.append(
            ExamQuestionOut(
                id=q.id,
                question_text=q.question_text,
                question_type=q.question_type,
                options=options,
                difficulty=q.difficulty,
            )
        )

    return ExamStartResponse(
        session_id=session.id,
        module_id=body.module_id,
        time_limit_minutes=body.time_limit_minutes,
        total_questions=len(questions),
        questions=question_items,
        started_at=session.started_at,
    )


@router.post("/exam/{session_id}/submit", response_model=ExamSubmitResponse)
async def exam_submit(
    session_id: str,
    body: ExamSubmitRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    session = _scope_session_query(db, session_id, user).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.session_type != "TIMED_EXAM":
        raise HTTPException(status_code=400, detail="Session is not a timed exam")

    session_module_id = session.module_id
    session_user_id = session.user_id or (user.id if user else None)
    resolved_session_id = session.id

    results: list[ExamResultItem] = []
    correct_count = 0

    for ans in body.answers:
        question = (
            db.query(QuizQuestion)
            .filter(
                QuizQuestion.id == ans.question_id,
                QuizQuestion.module_id == session_module_id,
            )
            .first()
        )
        if not question:
            continue

        question_id = question.id
        question_text = question.question_text
        correct_answer = question.correct_answer
        question_type = question.question_type

        # Determine correctness
        correct_answer_lower = (correct_answer or "").strip().lower()
        user_answer_lower = ans.user_answer.strip().lower()
        was_correct = user_answer_lower == correct_answer_lower

        # For short-answer / exam-style, use AI grading if available
        if (
            question_type in ("SHORT_ANSWER", "EXAM_STYLE")
            and not was_correct
            and settings.GROQ_API_KEY
        ):
            try:
                db.close()
                with ai_quota_scope(session_user_id):
                    grade = await ai_service.grade_answer(
                        question_text, correct_answer, ans.user_answer
                    )
                was_correct = grade.get("score", 0) >= 50
            except Exception:
                pass

        question = db.query(QuizQuestion).filter(QuizQuestion.id == question_id).first()

        if was_correct:
            correct_count += 1

        # Update question stats
        question.times_answered = (question.times_answered or 0) + 1
        if was_correct:
            question.times_correct = (question.times_correct or 0) + 1

        # Create review log
        log = ReviewLog(
            id=str(uuid.uuid4()),
            user_id=user.id if user else None,
            session_id=resolved_session_id,
            item_id=question.id,
            item_type="QUESTION",
            rating="GOOD" if was_correct else "AGAIN",
            was_correct=was_correct,
            user_answer=ans.user_answer,
            answered_at=datetime.utcnow(),
        )
        db.add(log)

        results.append(
            ExamResultItem(
                question_id=question.id,
                question_text=question.question_text,
                correct_answer=question.correct_answer,
                user_answer=ans.user_answer,
                is_correct=was_correct,
                explanation=question.explanation or "",
            )
        )

    total = len(results)
    incorrect_count = total - correct_count
    score_pct = round((correct_count / total) * 100, 1) if total > 0 else 0.0

    session = _scope_session_query(db, session_id, user).first()
    session.ended_at = datetime.utcnow()
    session.correct = correct_count
    session.incorrect = incorrect_count
    session.total_items = total
    session.score_pct = score_pct

    db.commit()

    time_taken_seconds = max(int((session.ended_at - session.started_at).total_seconds()), 0)

    return ExamSubmitResponse(
        session_id=session.id,
        total=total,
        correct=correct_count,
        incorrect=incorrect_count,
        score_pct=score_pct,
        time_taken_seconds=time_taken_seconds,
        review=results,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  12. Confidence Rating
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/flashcards/{card_id}/confidence",
    response_model=ConfidenceResponse,
)
def confidence_rating(
    card_id: str,
    body: ConfidenceRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    # Find the most recent active study session for the user (or any session)
    session_query = db.query(StudySession).filter(StudySession.ended_at.is_(None))
    if user:
        session_query = session_query.filter(StudySession.user_id == user.id)
    session = session_query.order_by(StudySession.started_at.desc()).first()

    # If no open session, create a lightweight one
    if not session:
        session = StudySession(
            id=str(uuid.uuid4()),
            user_id=user.id if user else None,
            module_id=card.module_id,
            session_type="FLASHCARDS",
            started_at=datetime.utcnow(),
            total_items=0,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

    # Store confidence as a review log with rating = "CONFIDENCE:<level>"
    log = ReviewLog(
        id=str(uuid.uuid4()),
        user_id=user.id if user else None,
        session_id=session.id,
        item_id=card_id,
        item_type="FLASHCARD",
        rating=f"CONFIDENCE:{body.confidence}",
        was_correct=False,
        answered_at=datetime.utcnow(),
    )
    db.add(log)
    db.commit()

    return ConfidenceResponse(card_id=card_id, confidence=body.confidence, recorded=True)


@router.get("/analytics/calibration", response_model=CalibrationResponse)
def calibration(
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """
    For each confidence level (1-5), compute what % of answers were actually correct.

    Strategy: pair each CONFIDENCE log with the *next* review log for the same item
    to determine the actual outcome.
    """
    conf_filter = ReviewLog.rating.like("CONFIDENCE:%")
    conf_query = db.query(ReviewLog).filter(conf_filter)
    if user:
        conf_query = conf_query.filter(ReviewLog.user_id == user.id)
    confidence_logs = conf_query.order_by(ReviewLog.answered_at.asc()).all()

    # Build buckets: confidence_level → list of bool (was the next review correct?)
    buckets: dict[int, list[bool]] = {i: [] for i in range(1, 6)}

    for clog in confidence_logs:
        level_str = clog.rating.split(":")[-1]
        try:
            level = int(level_str)
        except ValueError:
            continue
        if level < 1 or level > 5:
            continue

        # Find the next actual review for this item after the confidence was recorded
        outcome_query = db.query(ReviewLog).filter(
            ReviewLog.item_id == clog.item_id,
            ReviewLog.answered_at > clog.answered_at,
            ~ReviewLog.rating.like("CONFIDENCE:%"),
        )
        if user:
            outcome_query = outcome_query.filter(ReviewLog.user_id == user.id)
        outcome = outcome_query.order_by(ReviewLog.answered_at.asc()).first()

        if outcome is not None:
            buckets[level].append(outcome.was_correct)

    calibration_data = []
    for level in range(1, 6):
        entries = buckets[level]
        actual = (sum(entries) / len(entries) * 100) if entries else 0.0
        calibration_data.append(
            CalibrationPoint(
                confidence_level=level,
                predicted_pct=_CONFIDENCE_PREDICTED_PCT[level],
                actual_pct=round(actual, 1),
                count=len(entries),
            )
        )

    total_count = sum(point.count for point in calibration_data)
    overall_accuracy = (
        sum(point.actual_pct * point.count for point in calibration_data) / total_count
        if total_count
        else 0.0
    )
    overconfidence_score = (
        sum((point.predicted_pct - point.actual_pct) * point.count for point in calibration_data) / total_count
        if total_count
        else 0.0
    )

    return CalibrationResponse(
        calibration=calibration_data,
        overall_accuracy=round(overall_accuracy, 1),
        overconfidence_score=round(overconfidence_score, 1),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  14. Spaced Writing Practice
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/modules/{module_id}/writing-prompt",
    response_model=WritingPromptResponse,
)
async def writing_prompt(
    module_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    docs = db.query(Document).filter(
        Document.module_id == module_id, Document.processing_status == "done"
    ).all()

    material = "\n".join(
        f"- {c.name}: {c.definition or ''}" for c in concepts
    )
    doc_excerpt = "\n\n".join(
        (d.raw_text or "")[:2000] for d in docs if d.raw_text
    )[:6000]

    module_name = module.name
    module_user_id = module.user_id
    messages = _writing_prompt_messages(module_name, material, doc_excerpt)
    db.close()
    try:
        with ai_quota_scope(module_user_id):
            envelope = await ai_service._call_groq(
                messages,
                kind="writing_prompt",
                max_completion_tokens=2048,
                response_format=_json_response_format(),
                expected_payload_key="question",
            )
        parsed = envelope.get("data", {})
        if not isinstance(parsed, dict):
            raise ValueError("Expected dict response")
        return WritingPromptResponse(
            question=parsed.get("question", ""),
            mark_scheme=parsed.get("mark_scheme", ""),
            time_limit_minutes=int(parsed.get("time_limit_minutes", 30)),
            max_marks=int(parsed.get("max_marks", 20)),
        )
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse writing-prompt response: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to generate writing prompt")


@router.post("/modules/{module_id}/writing-prompt/stream")
async def writing_prompt_stream(
    module_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    docs = db.query(Document).filter(
        Document.module_id == module_id, Document.processing_status == "done"
    ).all()
    material = "\n".join(f"- {c.name}: {c.definition or ''}" for c in concepts)
    doc_excerpt = "\n\n".join((d.raw_text or "")[:2000] for d in docs if d.raw_text)[:6000]
    module_name = module.name
    module_user_id = module.user_id
    db.close()

    return _stream_ai_route(
        _writing_prompt_messages(module_name, material, doc_excerpt),
        kind="writing_prompt",
        user_id=module_user_id,
        expected_payload_key="question",
        max_completion_tokens=2048,
        final_mapper=lambda envelope: envelope.get("data", {}),
    )


@router.post("/writing/grade", response_model=WritingGradeResponse)
async def writing_grade(
    body: WritingGradeRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    messages = _writing_grade_messages(body.question, body.mark_scheme, body.user_response)
    try:
        with ai_quota_scope(user.id if user else None):
            envelope = await ai_service._call_groq(
                messages,
                kind="writing_grade",
                max_completion_tokens=2048,
                response_format=_json_response_format(),
                expected_payload_key="score",
            )
        parsed = envelope.get("data", {})
        if not isinstance(parsed, dict):
            raise ValueError("Expected dict response")

        para_fb = [
            ParagraphFeedback(
                paragraph_idx=p.get("paragraph_idx", 0),
                feedback=p.get("feedback", ""),
                marks=float(p.get("marks", 0)),
            )
            for p in parsed.get("paragraph_feedback", [])
            if isinstance(p, dict)
        ]

        return WritingGradeResponse(
            score=float(parsed.get("score", 0)),
            max_marks=int(parsed.get("max_marks", 20)),
            overall_feedback=parsed.get("overall_feedback", ""),
            paragraph_feedback=para_fb,
        )
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse writing-grade response: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to grade writing")


@router.post("/writing/grade/stream")
async def writing_grade_stream(
    body: WritingGradeRequest,
    user: OptionalType[User] = Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    return _stream_ai_route(
        _writing_grade_messages(body.question, body.mark_scheme, body.user_response),
        kind="writing_grade",
        user_id=user.id if user else None,
        expected_payload_key="score",
        max_completion_tokens=2048,
        final_mapper=lambda envelope: envelope.get("data", {}),
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  15. Retention Forecast
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/analytics/retention-forecast", response_model=RetentionForecastResponse)
def retention_forecast(
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    forecast_days = [1, 3, 7, 14]

    modules_query = db.query(Module)
    if user:
        modules_query = modules_query.filter(Module.user_id == user.id)
    modules = modules_query.all()

    result_modules: list[ModuleForecast] = []
    for mod in modules:
        cards = db.query(Flashcard).filter(Flashcard.module_id == mod.id).all()
        if not cards:
            forecasts = [ModuleForecastPoint(days=d, retention_pct=0.0) for d in forecast_days]
        else:
            forecasts = []
            for d in forecast_days:
                retentions = [
                    _fsrs_retention(c.stability or 0.0, d) for c in cards
                ]
                avg = sum(retentions) / len(retentions) * 100
                forecasts.append(ModuleForecastPoint(days=d, retention_pct=round(avg, 1)))

        result_modules.append(
            ModuleForecast(module_id=mod.id, module_name=mod.name, forecasts=forecasts)
        )

    return RetentionForecastResponse(modules=result_modules)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  16. Optimal Exam Revision Timeline
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/modules/{module_id}/exam-timeline",
    response_model=ExamTimelineResponse,
)
def exam_timeline(
    module_id: str,
    body: ExamTimelineRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    try:
        exam_date = datetime.fromisoformat(body.exam_date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid exam_date format. Use ISO date (YYYY-MM-DD).")

    today = datetime.utcnow().date()
    days_until = (exam_date - today).days
    if days_until < 0:
        raise HTTPException(status_code=400, detail="Exam date is in the past")

    cards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    concept_names = [c.name for c in concepts]

    # Sort cards by weakness (lowest stability first)
    sorted_cards = sorted(cards, key=lambda c: c.stability or 0.0)

    total_cards = len(sorted_cards)
    plan_days = min(max(days_until, 1), 180)  # cap at 180 days to prevent excessive output

    daily_plan: list[DailyPlan] = []
    for day_offset in range(plan_days):
        plan_date = today + timedelta(days=day_offset)
        # Distribute review cards with more focus early on weak cards
        progress_ratio = (day_offset + 1) / plan_days

        # More new cards early, more review cards near the exam
        new_card_count = max(1, int((1 - progress_ratio) * settings.DAILY_NEW_CARDS_LIMIT))
        review_count = max(1, int(total_cards * min(progress_ratio + 0.2, 1.0) / plan_days) + 1)

        # Estimate time (15 sec per card default)
        est_minutes = round((new_card_count + review_count) * 15 / 60.0, 1)

        # Focus on weakest concepts, rotating through
        focus_start = (day_offset * 3) % max(len(concept_names), 1)
        focus = concept_names[focus_start: focus_start + 3] if concept_names else []
        if len(focus) < 3 and concept_names:
            focus += concept_names[: 3 - len(focus)]

        daily_plan.append(
            DailyPlan(
                date=plan_date.isoformat(),
                cards_to_review=review_count,
                new_cards=new_card_count,
                estimated_minutes=est_minutes,
                focus_concepts=focus,
            )
        )

    return ExamTimelineResponse(
        exam_date=exam_date.isoformat(),
        days_until=days_until,
        daily_plan=daily_plan,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  17. Session Replay
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/sessions/{session_id}/replay", response_model=SessionReplayResponse)
def session_replay(
    session_id: str,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    session = _scope_session_query(db, session_id, user).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    logs = (
        db.query(ReviewLog)
        .filter(ReviewLog.session_id == session_id)
        .order_by(ReviewLog.answered_at.asc())
        .all()
    )

    items: list[ReplayItem] = []
    for log in logs:
        # Skip confidence-only logs in replay
        if log.rating and log.rating.startswith("CONFIDENCE:"):
            continue

        question_text = ""
        correct_answer = ""

        if log.item_type == "FLASHCARD":
            card = db.query(Flashcard).filter(Flashcard.id == log.item_id).first()
            if card:
                question_text = card.front
                correct_answer = card.back
        elif log.item_type == "QUESTION":
            question = db.query(QuizQuestion).filter(QuizQuestion.id == log.item_id).first()
            if question:
                question_text = question.question_text
                correct_answer = question.correct_answer

        items.append(
            ReplayItem(
                item_id=log.item_id,
                item_type=log.item_type,
                question_text=question_text,
                correct_answer=correct_answer,
                user_answer=log.user_answer,
                was_correct=log.was_correct,
                rating=log.rating,
                time_taken=log.time_taken_seconds or 0.0,
            )
        )

    module_name = None
    if session.module_id:
        module_query = db.query(Module).filter(Module.id == session.module_id)
        if user:
            module_query = module_query.filter(Module.user_id == user.id)
        else:
            module_query = module_query.filter(Module.user_id.is_(None))
        module = module_query.first()
        if module:
            module_name = module.name

    return SessionReplayResponse(
        session=ReplaySession(
            id=session.id,
            module_id=session.module_id,
            module_name=module_name,
            session_type=session.session_type,
            started_at=session.started_at,
            ended_at=session.ended_at,
            total_items=session.total_items,
            correct=session.correct,
            incorrect=session.incorrect,
            skipped=session.skipped,
            score_pct=session.score_pct,
        ),
        items=items,
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  18. Concept Mastery Heatmap Calendar
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/analytics/mastery-heatmap", response_model=MasteryHeatmapResponse)
def mastery_heatmap(
    days: int = Query(default=90, ge=1, le=365),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    end_date = datetime.utcnow().date()
    start_date = end_date - timedelta(days=days - 1)

    log_query = db.query(ReviewLog).filter(
        ReviewLog.answered_at >= datetime.combine(start_date, datetime.min.time()),
        ~ReviewLog.rating.like("CONFIDENCE:%"),
    )
    if user:
        log_query = log_query.filter(ReviewLog.user_id == user.id)
    logs = log_query.all()

    session_query = db.query(StudySession).filter(
        StudySession.started_at >= datetime.combine(start_date, datetime.min.time()),
    )
    if user:
        session_query = session_query.filter(StudySession.user_id == user.id)
    sessions = session_query.all()

    # Index sessions by date
    sessions_by_date: dict[str, int] = {}
    for s in sessions:
        d = s.started_at.date().isoformat()
        sessions_by_date[d] = sessions_by_date.get(d, 0) + 1

    # Index logs by date
    logs_by_date: dict[str, list[ReviewLog]] = {}
    for log in logs:
        d = log.answered_at.date().isoformat()
        logs_by_date.setdefault(d, []).append(log)

    heatmap_days: list[HeatmapDay] = []
    current = start_date
    while current <= end_date:
        d_str = current.isoformat()
        day_logs = logs_by_date.get(d_str, [])

        items_reviewed = len(day_logs)
        correct = sum(1 for l in day_logs if l.was_correct)
        mastery_gain = round((correct / items_reviewed) * 100, 1) if items_reviewed > 0 else 0.0

        heatmap_days.append(
            HeatmapDay(
                date=d_str,
                mastery_gain=mastery_gain,
                sessions_count=sessions_by_date.get(d_str, 0),
                items_reviewed=items_reviewed,
            )
        )
        current += timedelta(days=1)

    return MasteryHeatmapResponse(days=heatmap_days)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  13. Image Occlusion Cards
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post(
    "/flashcards/image-occlusion",
    response_model=ImageOcclusionResponse,
    status_code=201,
)
def image_occlusion(
    body: ImageOcclusionRequest,
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module = db.query(Module).filter(Module.id == body.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not body.occlusions:
        raise HTTPException(status_code=400, detail="At least one occlusion zone is required")

    created: list[Flashcard] = []
    for idx, occ in enumerate(body.occlusions):
        occlusion_data = json.dumps({
            "image_url": body.image_url,
            "occlusions": [
                {"x": o.x, "y": o.y, "width": o.width, "height": o.height, "label": o.label}
                for o in body.occlusions
            ],
            "hidden_index": idx,
        })

        card = Flashcard(
            id=str(uuid.uuid4()),
            user_id=user.id if user else None,
            module_id=body.module_id,
            front=f"[Image Occlusion] What is hidden at region ({occ.x}, {occ.y})? "
                  f"Image: {body.image_url}",
            back=occ.label,
            card_type="BASIC",
            source_excerpt=occlusion_data,
            tags=json.dumps(["image-occlusion"]),
            due=datetime.utcnow(),
            state="NEW",
        )
        db.add(card)
        created.append(card)

    db.commit()
    for c in created:
        db.refresh(c)

    return ImageOcclusionResponse(
        generated=len(created),
        cards=[
            ImageOcclusionCard(
                id=c.id,
                module_id=c.module_id,
                front=c.front,
                back=c.back,
                card_type=c.card_type,
                tags=_parse_tags_json(c.tags),
                created_at=c.created_at,
            )
            for c in created
        ],
    )
