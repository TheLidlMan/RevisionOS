import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.concept import Concept
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.topic_progress import TopicProgress
from models.user import User
from services import ai_service
from services.auth_service import get_current_user
from services.graph_service import get_module_graph, sync_module_graph
from services.quota_service import ai_quota_scope

router = APIRouter(tags=["tutor"])


class TutorExplainRequest(BaseModel):
    concept: str
    context: str = ""
    mode: str = "eli5"
    card_id: Optional[str] = None
    user_answer: Optional[str] = None


class TutorExplainResponse(BaseModel):
    explanation: str
    key_takeaways: list[str] = []
    memory_hook: str = ""


class TopicGenerateRequest(BaseModel):
    topic: str
    module_id: str
    num_cards: int = Field(default=30, ge=1, le=settings.MAX_CARDS_PER_REQUEST)


class TopicGenerateResponse(BaseModel):
    generated: int
    topic: str


class StudyCoachTopic(BaseModel):
    concept_id: str
    name: str
    mastery: float = 0.0
    progress_pct: float = 0.0
    status: str = "not_started"
    score_pct: float | None = None
    importance: float = 0.5
    item_count: int = 0
    parent_id: str | None = None


class StudyCoachSummary(BaseModel):
    total_topics: int = 0
    completed_topics: int = 0
    active_topics: int = 0
    average_progress_pct: float = 0.0


class StudyCoachStateResponse(BaseModel):
    module_id: str
    module_name: str
    graph_backend: str = "sql"
    document_count: int = 0
    focus_topic_id: str | None = None
    summary: StudyCoachSummary
    topics: list[StudyCoachTopic]


class StudyCoachPlanRequest(BaseModel):
    concept_id: str | None = None
    topic: str | None = None


class StudyCoachChecklistItem(BaseModel):
    concept_id: str | None = None
    title: str
    reason: str


class StudyCoachQuestion(BaseModel):
    question: str
    answer_outline: str


class StudyCoachPlanResponse(BaseModel):
    module_id: str
    module_name: str
    graph_backend: str = "sql"
    focus_topic: StudyCoachTopic
    overview: str
    encouragement: str = ""
    checklist: list[StudyCoachChecklistItem]
    questions: list[StudyCoachQuestion]


class StudyCoachProgressUpdateRequest(BaseModel):
    progress_pct: float = Field(ge=0, le=100)
    status: str | None = None
    score_pct: float | None = Field(default=None, ge=0, le=100)
    confidence_pct: float | None = Field(default=None, ge=0, le=100)
    notes: str | None = None


class StudyCoachEvaluationRequest(BaseModel):
    concept_id: str
    question: str
    answer_outline: str
    user_answer: str


class StudyCoachEvaluationResponse(BaseModel):
    score: float
    feedback: str
    what_was_correct: str = ""
    what_was_missing: str = ""
    improved_answer: str = ""
    updated_topic: StudyCoachTopic


def _require_user(user: Optional[User]) -> User:
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user


def _require_owned_module(db: Session, module_id: str, user: User) -> Module:
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


def _derive_status(progress_pct: float, explicit_status: str | None = None) -> str:
    if explicit_status:
        return explicit_status
    if progress_pct >= 85:
        return "mastered"
    if progress_pct >= 60:
        return "solid"
    if progress_pct > 0:
        return "in_progress"
    return "not_started"


def _topic_from_node(node: dict) -> StudyCoachTopic:
    return StudyCoachTopic(
        concept_id=node["id"],
        name=node["name"],
        mastery=float(node.get("mastery", 0.0) or 0.0),
        progress_pct=float(node.get("progress_pct", 0.0) or 0.0),
        status=node.get("progress_status", "not_started"),
        score_pct=float(node["score_pct"]) if node.get("score_pct") is not None else None,
        importance=float(node.get("importance", 0.5) or 0.5),
        item_count=int(node.get("item_count", 0) or 0),
        parent_id=node.get("parent_id"),
    )


def _load_study_coach_state(db: Session, module_id: str, user_id: str) -> StudyCoachStateResponse:
    graph = get_module_graph(db, module_id, user_id)
    topics = [_topic_from_node(node) for node in graph.get("nodes", [])]
    topics.sort(key=lambda topic: (topic.progress_pct >= 85, topic.progress_pct, -topic.importance, topic.name.lower()))
    focus_topic_id = next((topic.concept_id for topic in topics if topic.progress_pct < 85), topics[0].concept_id if topics else None)
    completed_topics = sum(1 for topic in topics if topic.progress_pct >= 85)
    active_topics = sum(1 for topic in topics if 0 < topic.progress_pct < 85)
    average_progress = round(sum(topic.progress_pct for topic in topics) / len(topics), 1) if topics else 0.0
    return StudyCoachStateResponse(
        module_id=module_id,
        module_name=graph.get("module_name", ""),
        graph_backend=graph.get("graph_backend", "sql"),
        document_count=int(graph.get("document_count", 0) or 0),
        focus_topic_id=focus_topic_id,
        summary=StudyCoachSummary(
            total_topics=len(topics),
            completed_topics=completed_topics,
            active_topics=active_topics,
            average_progress_pct=average_progress,
        ),
        topics=topics,
    )


def _find_focus_topic(state: StudyCoachStateResponse, request: StudyCoachPlanRequest) -> StudyCoachTopic:
    if request.concept_id:
        for topic in state.topics:
            if topic.concept_id == request.concept_id:
                return topic
    if request.topic:
        topic_query = request.topic.strip().lower()
        for topic in state.topics:
            if topic.name.lower() == topic_query:
                return topic
        for topic in state.topics:
            if topic_query in topic.name.lower():
                return topic
    if not state.topics:
        raise HTTPException(status_code=400, detail="No indexed topics found for this module")
    return next((topic for topic in state.topics if topic.progress_pct < 85), state.topics[0])


def _related_topics(state: StudyCoachStateResponse, db: Session, module_id: str, focus_topic: StudyCoachTopic, user_id: str) -> list[dict]:
    graph = get_module_graph(db, module_id, user_id)
    node_map = {node["id"]: node for node in graph.get("nodes", [])}
    neighbours: list[dict] = []
    seen: set[str] = set()
    for edge in graph.get("edges", []):
        if focus_topic.concept_id not in {edge.get("source"), edge.get("target")}:
            continue
        other_id = edge.get("target") if edge.get("source") == focus_topic.concept_id else edge.get("source")
        if not other_id or other_id in seen or other_id not in node_map:
            continue
        seen.add(other_id)
        reason_map = {
            "parent_child": "Direct prerequisite or child concept in the topic hierarchy.",
            "shared_document": "Frequently appears in the same uploaded material.",
            "related": "Semantically linked in the knowledge graph.",
        }
        neighbours.append(
            {
                "id": other_id,
                "name": node_map[other_id]["name"],
                "reason": reason_map.get(edge.get("type"), "Related in the graph."),
            }
        )
    return neighbours[:6]


def _build_graph_context(db: Session, module_id: str, focus_topic: StudyCoachTopic, related_topics: list[dict]) -> str:
    concept = db.query(Concept).filter(Concept.id == focus_topic.concept_id, Concept.module_id == module_id).first()
    if not concept:
        return focus_topic.name

    candidate_names = [focus_topic.name, *[item["name"] for item in related_topics if item.get("name")]]
    documents = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.processing_status == "done")
        .order_by(Document.updated_at.desc())
        .all()
    )
    relevant_summaries = []
    for document in documents:
        haystack = f"{document.filename}\n{document.summary or ''}\n{document.raw_text[:2000] if document.raw_text else ''}".lower()
        if any(name.lower() in haystack for name in candidate_names):
            relevant_summaries.append(
                f"Document: {document.filename}\nSummary: {(document.summary or document.raw_text or '')[:1200]}"
            )
        if len(relevant_summaries) >= 3:
            break

    return "\n\n".join(
        part
        for part in [
            f"Topic: {concept.name}",
            f"Definition: {concept.definition or ''}",
            f"Explanation: {concept.explanation or ''}",
            f"Related topics: {', '.join(item['name'] for item in related_topics) if related_topics else 'None'}",
            *relevant_summaries,
        ]
        if part.strip()
    )


def _upsert_topic_progress(
    db: Session,
    *,
    user_id: str,
    module_id: str,
    concept_id: str,
    progress_pct: float,
    status: str | None,
    score_pct: float | None,
    confidence_pct: float | None,
    notes: str | None,
    score_count_increment: int = 0,
    correct_increment: int = 0,
) -> TopicProgress:
    row = (
        db.query(TopicProgress)
        .filter(TopicProgress.user_id == user_id, TopicProgress.concept_id == concept_id)
        .first()
    )
    if not row:
        row = TopicProgress(
            user_id=user_id,
            module_id=module_id,
            concept_id=concept_id,
        )
        db.add(row)

    row.progress_pct = round(max(0.0, min(100.0, float(progress_pct))), 1)
    row.status = _derive_status(row.progress_pct, status)
    row.last_score_pct = round(float(score_pct), 1) if score_pct is not None else row.last_score_pct
    row.confidence_pct = round(float(confidence_pct), 1) if confidence_pct is not None else row.confidence_pct
    row.notes = notes.strip()[:2000] if notes else row.notes
    row.question_count = int(row.question_count or 0) + max(0, score_count_increment)
    row.correct_count = int(row.correct_count or 0) + max(0, correct_increment)
    row.last_activity_at = datetime.utcnow()
    db.flush()
    return row


@router.post("/api/tutor/explain", response_model=TutorExplainResponse)
async def tutor_explain(
    body: TutorExplainRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    card_front = None
    card_back = None
    if body.card_id:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        card = (
            db.query(Flashcard)
            .join(Module, Module.id == Flashcard.module_id)
            .filter(Flashcard.id == body.card_id, Module.user_id == user.id)
            .first()
        )
        if card:
            card_front = card.front
            card_back = card.back

    user_id = user.id if user else None
    db.close()
    with ai_quota_scope(user_id):
        result = await ai_service.tutor_explain(
            concept=body.concept,
            context=body.context,
            mode=body.mode,
            card_front=card_front,
            card_back=card_back,
            user_answer=body.user_answer,
        )

    return TutorExplainResponse(
        explanation=result.get("explanation", ""),
        key_takeaways=result.get("key_takeaways", []),
        memory_hook=result.get("memory_hook", ""),
    )


@router.post("/api/tutor/topic-generate", response_model=TopicGenerateResponse)
async def topic_generate(
    body: TopicGenerateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not settings.GROQ_API_KEY:
        raise HTTPException(status_code=400, detail="Groq API key not configured")

    user = _require_user(user)
    module = _require_owned_module(db, body.module_id, user)

    db.close()
    with ai_quota_scope(user.id):
        cards_data = await ai_service.generate_cards_from_topic(body.topic, body.num_cards)

    created_count = 0
    for card_data in cards_data:
        card_type = card_data.get("type", "CLOZE").upper()
        if card_type not in ("BASIC", "CLOZE"):
            card_type = "CLOZE"

        tags = card_data.get("tags", [])
        if not isinstance(tags, list):
            tags = []

        front_val = card_data.get("front") or ""
        back_val = card_data.get("back") or ""
        if card_type == "CLOZE" and not back_val:
            back_val = card_data.get("cloze_text") or ""

        card = Flashcard(
            module_id=body.module_id,
            front=front_val,
            back=back_val,
            card_type=card_type,
            cloze_text=card_data.get("cloze_text"),
            tags=json.dumps(tags),
            due=datetime.utcnow(),
            state="NEW",
            generation_source="AI_TOPIC",
            user_id=user.id,
        )
        db.add(card)
        created_count += 1

    db.commit()
    sync_module_graph(db, module.id, user.id)

    return TopicGenerateResponse(generated=created_count, topic=body.topic)


@router.get("/api/modules/{module_id}/study-coach", response_model=StudyCoachStateResponse)
def get_study_coach_state(
    module_id: str,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    user = _require_user(user)
    _require_owned_module(db, module_id, user)
    return _load_study_coach_state(db, module_id, user.id)


@router.post("/api/modules/{module_id}/study-coach/plan", response_model=StudyCoachPlanResponse)
async def build_study_coach_plan(
    module_id: str,
    body: StudyCoachPlanRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    user = _require_user(user)
    module = _require_owned_module(db, module_id, user)
    state = _load_study_coach_state(db, module_id, user.id)
    focus_topic = _find_focus_topic(state, body)
    related_topics = _related_topics(state, db, module_id, focus_topic, user.id)
    graph_context = _build_graph_context(db, module_id, focus_topic, related_topics)

    with ai_quota_scope(user.id):
        plan = await ai_service.generate_study_coach_plan(
            topic=focus_topic.name,
            module_name=module.name,
            graph_context=graph_context,
            related_topics=related_topics,
            progress_pct=focus_topic.progress_pct,
        )

    checklist = [
        StudyCoachChecklistItem(
            concept_id=item.get("concept_id"),
            title=item.get("title") or item.get("name") or focus_topic.name,
            reason=item.get("reason") or "Linked topic to review next.",
        )
        for item in plan.get("checklist", [])
        if isinstance(item, dict)
    ]
    questions = [
        StudyCoachQuestion(
            question=item.get("question") or f"Explain {focus_topic.name}.",
            answer_outline=item.get("answer_outline") or graph_context[:300],
        )
        for item in plan.get("questions", [])
        if isinstance(item, dict)
    ]

    if not checklist:
        checklist = [
            StudyCoachChecklistItem(
                concept_id=focus_topic.concept_id,
                title=focus_topic.name,
                reason="Start by defining the topic clearly before moving on.",
            )
        ]
    if not questions:
        questions = [
            StudyCoachQuestion(
                question=f"Why does {focus_topic.name} matter in {module.name}?",
                answer_outline=graph_context[:500] or focus_topic.name,
            )
        ]

    return StudyCoachPlanResponse(
        module_id=module_id,
        module_name=module.name,
        graph_backend=state.graph_backend,
        focus_topic=focus_topic,
        overview=plan.get("overview") or f"Focus on {focus_topic.name} and its closest linked ideas.",
        encouragement=plan.get("encouragement", ""),
        checklist=checklist,
        questions=questions,
    )


@router.post("/api/modules/{module_id}/study-coach/topics/{concept_id}/progress", response_model=StudyCoachTopic)
def update_study_coach_progress(
    module_id: str,
    concept_id: str,
    body: StudyCoachProgressUpdateRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    user = _require_user(user)
    _require_owned_module(db, module_id, user)
    concept = db.query(Concept).filter(Concept.id == concept_id, Concept.module_id == module_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Topic not found")

    _upsert_topic_progress(
        db,
        user_id=user.id,
        module_id=module_id,
        concept_id=concept_id,
        progress_pct=body.progress_pct,
        status=body.status,
        score_pct=body.score_pct,
        confidence_pct=body.confidence_pct,
        notes=body.notes,
    )
    db.commit()
    sync_module_graph(db, module_id, user.id)
    state = _load_study_coach_state(db, module_id, user.id)
    topic = next((topic for topic in state.topics if topic.concept_id == concept_id), None)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found after update")
    return topic


@router.post("/api/modules/{module_id}/study-coach/evaluate", response_model=StudyCoachEvaluationResponse)
async def evaluate_study_coach_answer(
    module_id: str,
    body: StudyCoachEvaluationRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    user = _require_user(user)
    _require_owned_module(db, module_id, user)
    concept = db.query(Concept).filter(Concept.id == body.concept_id, Concept.module_id == module_id).first()
    if not concept:
        raise HTTPException(status_code=404, detail="Topic not found")

    with ai_quota_scope(user.id):
        grading = await ai_service.evaluate_study_coach_answer(
            topic=concept.name,
            question=body.question,
            answer_outline=body.answer_outline,
            user_answer=body.user_answer,
        )

    score = max(0.0, min(100.0, float(grading.get("score", 0.0) or 0.0)))
    existing = (
        db.query(TopicProgress)
        .filter(TopicProgress.user_id == user.id, TopicProgress.concept_id == body.concept_id)
        .first()
    )
    existing_progress = float(existing.progress_pct) if existing else 0.0
    blended_progress = max(existing_progress, round(existing_progress * 0.55 + score * 0.45, 1))
    _upsert_topic_progress(
        db,
        user_id=user.id,
        module_id=module_id,
        concept_id=body.concept_id,
        progress_pct=blended_progress,
        status=_derive_status(blended_progress),
        score_pct=score,
        confidence_pct=existing.confidence_pct if existing else None,
        notes=existing.notes if existing else None,
        score_count_increment=1,
        correct_increment=1 if score >= 70 else 0,
    )
    db.commit()
    sync_module_graph(db, module_id, user.id)
    state = _load_study_coach_state(db, module_id, user.id)
    topic = next((topic for topic in state.topics if topic.concept_id == body.concept_id), None)
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found after evaluation")

    return StudyCoachEvaluationResponse(
        score=score,
        feedback=grading.get("feedback", ""),
        what_was_correct=grading.get("what_was_correct", ""),
        what_was_missing=grading.get("what_was_missing", ""),
        improved_answer=grading.get("improved_answer", ""),
        updated_topic=topic,
    )
