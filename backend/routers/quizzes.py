import asyncio
import json
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from config import settings
from database import get_db
from models.quiz_question import QuizQuestion
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from models.module import Module
from models.document import Document
from models.user import User
from services import ai_service
from services.auth_service import get_current_user
from services.quota_service import ai_quota_scope

router = APIRouter(tags=["quizzes"])
logger = logging.getLogger(__name__)
_quiz_generation_locks: dict[str, asyncio.Lock] = {}


# ---------- Pydantic schemas ----------

class QuestionResponse(BaseModel):
    id: str
    module_id: str
    concept_id: Optional[str] = None
    question_text: str
    question_type: str
    options: Optional[list[str]] = None
    correct_answer: str
    explanation: Optional[str] = None
    difficulty: str
    source_document_id: Optional[str] = None
    times_answered: int = 0
    times_correct: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class QuestionForQuiz(BaseModel):
    """Question sent during a quiz (no correct_answer exposed)."""
    id: str
    question_text: str
    question_type: str
    options: Optional[list[str]] = None
    difficulty: str


class GenerateQuizRequest(BaseModel):
    module_id: str
    question_types: list[str] = ["MCQ"]
    difficulty: str = "MEDIUM"
    num_questions: int = 10
    mode: str = "random"  # random, weakness_drill, unseen


class GenerateQuizResponse(BaseModel):
    generated: int
    questions: list[QuestionResponse]


class StartSessionRequest(BaseModel):
    module_id: Optional[str] = None
    session_type: str = "QUIZ"
    question_ids: list[str] = []


class SessionResponse(BaseModel):
    id: str
    module_id: Optional[str] = None
    session_type: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_items: int = 0
    correct: int = 0
    incorrect: int = 0
    skipped: int = 0
    score_pct: float = 0.0
    questions: list[QuestionForQuiz] = []

    model_config = {"from_attributes": True}


class AnswerRequest(BaseModel):
    question_id: str
    user_answer: str


class AnswerResponse(BaseModel):
    is_correct: bool
    explanation: Optional[str] = None
    correct_answer: str
    ai_feedback: Optional[dict] = None


class SessionResultsResponse(BaseModel):
    id: str
    session_type: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    total_items: int
    correct: int
    incorrect: int
    skipped: int
    score_pct: float
    review_logs: list[dict] = []


# ---------- Helpers ----------


def _get_owned_session(db: Session, session_id: str, user: Optional[User]) -> StudySession:
    session_query = db.query(StudySession).filter(StudySession.id == session_id)
    if user:
        session_query = session_query.filter(StudySession.user_id == user.id)
    else:
        session_query = session_query.filter(StudySession.user_id.is_(None))

    session = session_query.first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


def _run_generate_quiz_for_module_background(module_id: str, user_id: Optional[str] = None):
    asyncio.run(_generate_quiz_for_module(module_id, user_id))


def _run_generate_next_quiz_background(module_id: str, completed_session_id: str):
    asyncio.run(_generate_next_quiz_background(module_id, completed_session_id))


def _question_to_response(q: QuizQuestion) -> QuestionResponse:
    options = None
    if q.options:
        try:
            options = json.loads(q.options)
        except (json.JSONDecodeError, TypeError):
            options = None
    return QuestionResponse(
        id=q.id,
        module_id=q.module_id,
        concept_id=q.concept_id,
        question_text=q.question_text,
        question_type=q.question_type,
        options=options,
        correct_answer=q.correct_answer,
        explanation=q.explanation,
        difficulty=q.difficulty,
        source_document_id=q.source_document_id,
        times_answered=q.times_answered,
        times_correct=q.times_correct,
        created_at=q.created_at,
    )


def _question_for_quiz(q: QuizQuestion) -> QuestionForQuiz:
    options = None
    if q.options:
        try:
            options = json.loads(q.options)
        except (json.JSONDecodeError, TypeError):
            options = None
    return QuestionForQuiz(
        id=q.id,
        question_text=q.question_text,
        question_type=q.question_type,
        options=options,
        difficulty=q.difficulty,
    )


def _normalize_question_type(value: Optional[str], default: str = "MCQ") -> str:
    normalized = (value or default).strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "MCQ": "MCQ",
        "MULTIPLE_CHOICE": "MCQ",
        "MULTIPLECHOICE": "MCQ",
        "SHORT_ANSWER": "SHORT_ANSWER",
        "SHORTANSWER": "SHORT_ANSWER",
        "TRUE_FALSE": "TRUE_FALSE",
        "TRUEFALSE": "TRUE_FALSE",
        "FILL_BLANK": "FILL_BLANK",
        "FILL_IN_THE_BLANK": "FILL_BLANK",
        "FILLINBLANK": "FILL_BLANK",
        "EXAM_STYLE": "EXAM_STYLE",
        "EXAM": "EXAM_STYLE",
    }
    return aliases.get(normalized, default)


def _normalize_question_difficulty(value: Optional[str], default: str = "MEDIUM") -> str:
    normalized = (value or default).strip().upper().replace("-", "_").replace(" ", "_")
    aliases = {
        "EASY": "EASY",
        "MEDIUM": "MEDIUM",
        "HARD": "HARD",
        "EXAM": "EXAM",
        "EXAM_STYLE": "EXAM",
    }
    return aliases.get(normalized, default)


def _quiz_generation_lock(module_id: str) -> asyncio.Lock:
    lock = _quiz_generation_locks.get(module_id)
    if lock is None:
        lock = asyncio.Lock()
        _quiz_generation_locks[module_id] = lock
    return lock


def _quiz_generation_messages(
    *,
    text: str,
    num_questions: int,
    question_types: list[str],
    difficulty: str,
    subject: str,
) -> list[dict[str, str]]:
    type_instructions = []
    for qt in question_types:
        if qt == "MCQ":
            type_instructions.append("multiple choice questions with 4 options and exactly 1 correct answer")
        elif qt == "SHORT_ANSWER":
            type_instructions.append("short answer questions with concise model answers")
        elif qt == "TRUE_FALSE":
            type_instructions.append("true/false questions")
        elif qt == "FILL_BLANK":
            type_instructions.append("fill in the blank questions")
        elif qt == "EXAM_STYLE":
            type_instructions.append("exam-style questions worth 8-12 marks")

    return [
        {
            "role": "system",
            "content": f"You are an experienced {subject} examiner writing rigorous questions.",
        },
        {
            "role": "user",
            "content": (
                f"Generate {num_questions} questions from the material below.\n"
                f"Question types to include: {', '.join(type_instructions) if type_instructions else 'a balanced mix'}.\n"
                f"Target difficulty: {difficulty}.\n\n"
                "Return a JSON object with a `questions` array.\n"
                "Each question object must include `question_text`, `type`, `options`, `correct_answer`, `explanation`, and `difficulty`.\n\n"
                f"Material:\n{text}"
            ),
        },
    ]


# ---------- Endpoints ----------

@router.get("/api/questions", response_model=list[QuestionResponse])
def list_questions(
    module_id: Optional[str] = None,
    difficulty: Optional[str] = None,
    type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(QuizQuestion)
    if module_id:
        query = query.filter(QuizQuestion.module_id == module_id)
    if difficulty:
        query = query.filter(QuizQuestion.difficulty == difficulty.upper())
    if type:
        query = query.filter(QuizQuestion.question_type == type.upper())
    questions = query.order_by(QuizQuestion.created_at.desc()).all()
    return [_question_to_response(q) for q in questions]


@router.post("/api/quizzes/generate", response_model=GenerateQuizResponse)
async def generate_quiz(body: GenerateQuizRequest, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == body.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = (
        db.query(Document)
        .filter(
            Document.module_id == body.module_id,
            Document.processing_status == "done",
            Document.delete_requested_at.is_(None),
        )
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents found in this module")

    all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    max_chars = min(settings.MAX_CONTEXT_TOKENS * 3, settings.MAX_PROMPT_CHARS)
    if len(all_text) > max_chars:
        all_text = all_text[:max_chars]

    num_questions = min(
        max(1, body.num_questions),
        settings.QUESTIONS_PER_DOCUMENT,
        settings.MAX_QUESTIONS_PER_REQUEST,
    )

    with ai_quota_scope(module.user_id):
        generated = await ai_service.generate_quiz_questions(
            text=all_text,
            num_questions=num_questions,
            question_types=body.question_types,
            difficulty=body.difficulty,
            subject=module.name,
        )

    created_questions = []
    for qdata in generated:
        q_type = _normalize_question_type(qdata.get("type", qdata.get("question_type")), default="MCQ")

        options = qdata.get("options")
        options_json = json.dumps(options) if options else None

        diff = _normalize_question_difficulty(qdata.get("difficulty", body.difficulty), default="MEDIUM")

        question = QuizQuestion(
            module_id=body.module_id,
            question_text=qdata.get("question_text", qdata.get("question", "")),
            question_type=q_type,
            options=options_json,
            correct_answer=qdata.get("correct_answer", ""),
            explanation=qdata.get("explanation", ""),
            difficulty=diff,
            source_document_id=docs[0].id if docs else None,
        )
        db.add(question)
        created_questions.append(question)

    db.commit()
    for q in created_questions:
        db.refresh(q)

    return GenerateQuizResponse(
        generated=len(created_questions),
        questions=[_question_to_response(q) for q in created_questions],
    )


@router.post("/api/quizzes/generate/stream")
async def generate_quiz_stream(body: GenerateQuizRequest, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == body.module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    docs = (
        db.query(Document)
        .filter(
            Document.module_id == body.module_id,
            Document.processing_status == "done",
            Document.delete_requested_at.is_(None),
        )
        .all()
    )
    if not docs:
        raise HTTPException(status_code=400, detail="No processed documents found in this module")

    all_text = "\n\n---\n\n".join(d.raw_text or "" for d in docs if d.raw_text)
    max_chars = min(settings.MAX_CONTEXT_TOKENS * 3, settings.MAX_PROMPT_CHARS)
    if len(all_text) > max_chars:
        all_text = all_text[:max_chars]

    num_questions = min(
        max(1, body.num_questions),
        settings.QUESTIONS_PER_DOCUMENT,
        settings.MAX_QUESTIONS_PER_REQUEST,
    )
    messages = _quiz_generation_messages(
        text=all_text,
        num_questions=num_questions,
        question_types=body.question_types,
        difficulty=body.difficulty,
        subject=module.name,
    )

    async def event_stream():
        try:
            with ai_quota_scope(module.user_id):
                async for event in ai_service.stream_groq_completion(
                    messages,
                    kind="quiz_questions",
                    max_completion_tokens=4096,
                    response_format=ai_service.JSON_RESPONSE_FORMAT if settings.LLM_JSON_MODE_ENABLED else None,
                    expected_payload_key="questions",
                ):
                    if event.get("event") == "final":
                        parsed = event.get("envelope", {}).get("data", {}).get("questions", [])
                        if not isinstance(parsed, list):
                            parsed = [parsed]
                        created_questions = []
                        for qdata in parsed:
                            q_type = _normalize_question_type(qdata.get("type", qdata.get("question_type")), default="MCQ")
                            options = qdata.get("options")
                            options_json = json.dumps(options) if options else None
                            diff = _normalize_question_difficulty(qdata.get("difficulty", body.difficulty), default="MEDIUM")
                            question = QuizQuestion(
                                module_id=body.module_id,
                                question_text=qdata.get("question_text", qdata.get("question", "")),
                                question_type=q_type,
                                options=options_json,
                                correct_answer=qdata.get("correct_answer", ""),
                                explanation=qdata.get("explanation", ""),
                                difficulty=diff,
                                source_document_id=docs[0].id if docs else None,
                            )
                            db.add(question)
                            created_questions.append(question)
                        db.commit()
                        for question in created_questions:
                            db.refresh(question)
                        result = GenerateQuizResponse(
                            generated=len(created_questions),
                            questions=[_question_to_response(question) for question in created_questions],
                        ).model_dump(mode="json")
                        event["result"] = result
                    yield ai_service.encode_sse_event(event)
        except Exception as exc:
            yield ai_service.encode_sse_event({"event": "error", "kind": "quiz_questions", "message": str(exc)})

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.post("/api/quizzes/sessions", response_model=SessionResponse)
def start_quiz_session(
    body: StartSessionRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    session = StudySession(
        module_id=body.module_id,
        session_type=body.session_type.upper(),
        started_at=datetime.utcnow(),
        total_items=len(body.question_ids),
        user_id=user.id if user else None,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    questions = []
    if body.question_ids:
        questions = (
            db.query(QuizQuestion)
            .filter(QuizQuestion.id.in_(body.question_ids))
            .all()
        )
    elif body.module_id:
        questions = (
            db.query(QuizQuestion)
            .filter(QuizQuestion.module_id == body.module_id)
            .limit(20)
            .all()
        )
        session.total_items = len(questions)
        db.commit()

    return SessionResponse(
        id=session.id,
        module_id=session.module_id,
        session_type=session.session_type,
        started_at=session.started_at,
        ended_at=session.ended_at,
        total_items=session.total_items,
        correct=session.correct,
        incorrect=session.incorrect,
        skipped=session.skipped,
        score_pct=session.score_pct,
        questions=[_question_for_quiz(q) for q in questions],
    )


@router.post("/api/quizzes/sessions/{session_id}/answer", response_model=AnswerResponse)
async def submit_answer(
    session_id: str,
    body: AnswerRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, user)

    question = db.query(QuizQuestion).filter(QuizQuestion.id == body.question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    # Determine correctness
    is_correct = False
    ai_feedback = None

    if question.question_type in ("MCQ", "TRUE_FALSE"):
        is_correct = body.user_answer.strip().lower() == question.correct_answer.strip().lower()
    elif question.question_type in ("SHORT_ANSWER", "EXAM_STYLE", "FILL_BLANK"):
        # Simple exact match check first
        if body.user_answer.strip().lower() == question.correct_answer.strip().lower():
            is_correct = True
        elif settings.GROQ_API_KEY:
            try:
                with ai_quota_scope(session.user_id or (user.id if user else None)):
                    ai_feedback = await ai_service.grade_answer(
                        question.question_text,
                        question.correct_answer,
                        body.user_answer,
                    )
                score = ai_feedback.get("score", 0)
                is_correct = score >= 60
            except Exception:
                # Fall back to simple match
                is_correct = body.user_answer.strip().lower() == question.correct_answer.strip().lower()

    # Update question stats
    question.times_answered += 1
    if is_correct:
        question.times_correct += 1

    # Create review log
    rating = "GOOD" if is_correct else "AGAIN"
    log = ReviewLog(
        session_id=session_id,
        item_id=question.id,
        item_type="QUESTION",
        rating=rating,
        was_correct=is_correct,
        user_answer=body.user_answer,
        answered_at=datetime.utcnow(),
    )
    db.add(log)

    # Update session counters
    if is_correct:
        session.correct += 1
    else:
        session.incorrect += 1

    db.commit()

    return AnswerResponse(
        is_correct=is_correct,
        explanation=question.explanation,
        correct_answer=question.correct_answer,
        ai_feedback=ai_feedback,
    )


@router.post("/api/quizzes/sessions/{session_id}/complete", response_model=SessionResultsResponse)
def complete_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    session = _get_owned_session(db, session_id, user)

    session.ended_at = datetime.utcnow()
    total = session.correct + session.incorrect + session.skipped
    if total > 0:
        session.score_pct = round((session.correct / total) * 100, 1)
    session.total_items = total
    session.status = "completed"
    db.commit()
    db.refresh(session)

    # Trigger background generation of next quiz
    if session.module_id and settings.GROQ_API_KEY:
        background_tasks.add_task(
            _run_generate_next_quiz_background,
            session.module_id,
            session_id,
        )

    logs = db.query(ReviewLog).filter(ReviewLog.session_id == session_id).all()
    log_dicts = [
        {
            "id": l.id,
            "item_id": l.item_id,
            "item_type": l.item_type,
            "rating": l.rating,
            "was_correct": l.was_correct,
            "user_answer": l.user_answer,
            "answered_at": l.answered_at.isoformat() if l.answered_at else None,
        }
        for l in logs
    ]

    return SessionResultsResponse(
        id=session.id,
        session_type=session.session_type,
        started_at=session.started_at,
        ended_at=session.ended_at,
        total_items=session.total_items,
        correct=session.correct,
        incorrect=session.incorrect,
        skipped=session.skipped,
        score_pct=session.score_pct,
        review_logs=log_dicts,
    )


@router.get("/api/quizzes/sessions/{session_id}/results", response_model=SessionResultsResponse)
def get_session_results(session_id: str, db: Session = Depends(get_db), user: Optional[User] = Depends(get_current_user)):
    session = _get_owned_session(db, session_id, user)

    logs = db.query(ReviewLog).filter(ReviewLog.session_id == session_id).all()
    log_dicts = [
        {
            "id": l.id,
            "item_id": l.item_id,
            "item_type": l.item_type,
            "rating": l.rating,
            "was_correct": l.was_correct,
            "user_answer": l.user_answer,
            "answered_at": l.answered_at.isoformat() if l.answered_at else None,
        }
        for l in logs
    ]

    return SessionResultsResponse(
        id=session.id,
        session_type=session.session_type,
        started_at=session.started_at,
        ended_at=session.ended_at,
        total_items=session.total_items,
        correct=session.correct,
        incorrect=session.incorrect,
        skipped=session.skipped,
        score_pct=session.score_pct,
        review_logs=log_dicts,
    )


# ---------- Background quiz pre-generation ----------

async def _generate_quiz_for_module(module_id: str, user_id: str = None):
    """Generate quiz questions for a module in the background."""
    from database import SessionLocal
    async with _quiz_generation_lock(module_id):
        db = SessionLocal()
        try:
            module = db.query(Module).filter(Module.id == module_id).first()
            if not module:
                return

            docs = db.query(Document).filter(
                Document.module_id == module_id,
                Document.processing_status == "done",
            ).all()
            if not docs:
                return

            combined_text = "\n\n".join(d.raw_text for d in docs if d.raw_text)
            if not combined_text.strip():
                return

            question_types = ["MCQ"]
            difficulty = "MEDIUM"
            num_questions = min(settings.QUESTIONS_PER_DOCUMENT, settings.MAX_QUESTIONS_PER_REQUEST)
            questions = await ai_service.generate_quiz_questions(
                combined_text,
                num_questions,
                question_types,
                difficulty,
                subject=module.name,
            )

            normalized_questions: list[QuizQuestion] = []
            for q_data in questions:
                if not isinstance(q_data, dict):
                    logger.debug("Skipping malformed background quiz payload for module %s: %r", module_id, q_data)
                    continue

                question_text = q_data.get("question_text", q_data.get("question", ""))
                correct_answer = q_data.get("correct_answer", "")
                if not question_text or not correct_answer:
                    continue

                options = q_data.get("options")
                options_json = json.dumps(options) if isinstance(options, list) and options else None
                normalized_questions.append(
                    QuizQuestion(
                        id=str(uuid.uuid4()),
                        module_id=module_id,
                        question_text=question_text,
                        question_type=_normalize_question_type(q_data.get("type", q_data.get("question_type")), default="MCQ"),
                        options=options_json,
                        correct_answer=correct_answer,
                        explanation=q_data.get("explanation", ""),
                        difficulty=_normalize_question_difficulty(q_data.get("difficulty", difficulty), default="MEDIUM"),
                        source_document_id=docs[0].id if docs else None,
                        user_id=user_id,
                    )
                )

            if not normalized_questions:
                return

            db.query(QuizQuestion).filter(QuizQuestion.module_id == module_id).delete(synchronize_session=False)
            for question in normalized_questions:
                db.add(question)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.exception("Background quiz generation failed for module %s: %s", module_id, exc)
        finally:
            db.close()


async def _generate_next_quiz_background(module_id: str, completed_session_id: str):
    """After a quiz session completes, pre-generate the next set of questions."""
    await _generate_quiz_for_module(module_id)


class QuizStatusResponse(BaseModel):
    module_id: str
    status: str  # ready, generating, no_questions
    question_count: int = 0


@router.get("/api/modules/{module_id}/quiz-status", response_model=QuizStatusResponse)
def get_quiz_status(module_id: str, db: Session = Depends(get_db)):
    count = db.query(QuizQuestion).filter(QuizQuestion.module_id == module_id).count()
    if count == 0:
        status = "no_questions"
    else:
        status = "ready"
    return QuizStatusResponse(module_id=module_id, status=status, question_count=count)
