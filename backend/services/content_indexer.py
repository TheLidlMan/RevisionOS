import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from config import settings
from models.concept import Concept
from models.document import Document
from services import ai_service
from services import vector_service

logger = logging.getLogger(__name__)


def _concept_path(name: str, parent_path: Optional[str] = None) -> str:
    return f"{parent_path}/{name}" if parent_path else name


def _register_concept_path(
    path_to_id: dict[str, str],
    name_to_paths: dict[str, list[str]],
    path: str,
    concept_id: str,
) -> None:
    path_to_id[path] = concept_id
    concept_name = path.rsplit("/", 1)[-1]
    candidates = name_to_paths.setdefault(concept_name, [])
    if path not in candidates:
        candidates.append(path)


async def summarize_document(document_id: str, db: Session) -> Optional[str]:
    """Generate an AI summary for a document and store it."""
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.raw_text:
        return None

    if not settings.GROQ_API_KEY:
        return None

    text = doc.raw_text
    max_chars = 60000
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are a study material summarizer. Create a concise but comprehensive "
                    "summary of the following study material. Include the key topics covered, "
                    "main concepts, and important details. The summary should help a student "
                    "quickly understand what this document covers."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Summarize this study material in 200-300 words. "
                    "Focus on: main topics, key concepts, important definitions, "
                    "and what a student should learn from it.\n\n"
                    f"Document: {doc.filename}\n\n"
                    f"Content:\n{text}"
                ),
            },
        ]
        summary = await ai_service._call_groq(messages, max_tokens=1024)
        doc.summary = summary.strip()

        emb = vector_service.embed_text(f"{doc.filename}: {doc.summary}")
        if emb:
            vector_service.store_embedding(db, "documents", doc.id, emb)

        db.commit()
        return doc.summary
    except Exception as exc:
        db.rollback()
        logger.error("Failed to summarize document %s: %s", document_id, exc)
        return None


async def index_document(document_id: str, db: Session, skip_summary: bool = False) -> list[dict]:
    """
    Auto-index a document: generate summary, extract topics and subtopics,
    create Concept entries with hierarchy.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.raw_text:
        return []

    if not settings.GROQ_API_KEY:
        return []

    if not skip_summary:
        await summarize_document(document_id, db)

    text = doc.raw_text
    max_chars = 120000
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        topics = await extract_topics_hierarchical(text, doc.module_id)

        created_concepts: list[dict] = []
        created_ids: set[str] = set()
        concept_entities: dict[str, Concept] = {}
        path_to_id: dict[str, str] = {}
        name_to_paths: dict[str, list[str]] = {}

        def remember_concept(concept: Concept, is_new: bool) -> None:
            concept_entities[concept.id] = concept
            if concept.id in created_ids:
                return
            created_ids.add(concept.id)
            created_concepts.append({
                "id": concept.id,
                "name": concept.name,
                "is_new": is_new,
            })

        def upsert_topic(topic: dict, parent_id: Optional[str], parent_path: Optional[str]) -> None:
            query = db.query(Concept).filter(
                Concept.module_id == doc.module_id,
                Concept.name == topic["name"],
            )
            if parent_id is None:
                query = query.filter(Concept.parent_concept_id.is_(None))
            else:
                query = query.filter(Concept.parent_concept_id == parent_id)

            existing = query.first()
            if existing:
                if topic.get("definition") and not existing.definition:
                    existing.definition = topic["definition"]
                if topic.get("explanation") and not existing.explanation:
                    existing.explanation = topic["explanation"]
                if topic.get("importance_score") is not None:
                    existing.importance_score = max(
                        existing.importance_score,
                        topic["importance_score"],
                    )
                if topic.get("study_weight") is not None:
                    existing.study_weight = max(existing.study_weight or 1.0, topic["study_weight"])
                existing.parent_concept_id = parent_id
                existing.order_index = topic.get("order_index", 0)
                concept = existing
                is_new = False
            else:
                concept = Concept(
                    id=str(uuid.uuid4()),
                    module_id=doc.module_id,
                    name=topic["name"],
                    definition=topic.get("definition", ""),
                    explanation=topic.get("explanation", ""),
                    importance_score=topic.get("importance_score", 0.5),
                    study_weight=topic.get("study_weight", 1.0),
                    parent_concept_id=parent_id,
                    order_index=topic.get("order_index", 0),
                    user_id=doc.user_id,
                )
                db.add(concept)
                is_new = True

            db.flush()
            remember_concept(concept, is_new)
            _register_concept_path(
                path_to_id,
                name_to_paths,
                _concept_path(topic["name"], parent_path),
                concept.id,
            )

        for topic in topics:
            if topic.get("parent"):
                continue
            upsert_topic(topic, parent_id=None, parent_path=None)

        pending_topics = [topic for topic in topics if topic.get("parent")]
        max_iterations = max(1, len(pending_topics))
        for _ in range(max_iterations):
            if not pending_topics:
                break

            next_pending = []
            resolved_count = 0
            for topic in pending_topics:
                parent_name = topic.get("parent")
                parent_paths = name_to_paths.get(parent_name or "", [])
                if len(parent_paths) != 1:
                    next_pending.append(topic)
                    continue

                parent_path = parent_paths[0]
                parent_id = path_to_id.get(parent_path)
                if not parent_id:
                    next_pending.append(topic)
                    continue

                upsert_topic(topic, parent_id=parent_id, parent_path=parent_path)
                resolved_count += 1

            pending_topics = next_pending
            if resolved_count == 0:
                break

        if pending_topics:
            logger.warning(
                "Unresolved topic hierarchy for document %s: %s",
                document_id,
                [topic.get("name") for topic in pending_topics],
            )

        for concept in concept_entities.values():
            text_for_embedding = f"{concept.name}: {concept.definition or ''} {concept.explanation or ''}"
            emb = vector_service.embed_text(text_for_embedding)
            if emb:
                vector_service.store_embedding(db, "concepts", concept.id, emb)

        db.commit()
        return created_concepts
    except Exception as exc:
        db.rollback()
        logger.error("Failed to index document %s: %s", document_id, exc)
        return []


async def extract_topics_hierarchical(text: str, module_id: str = "") -> list[dict]:
    """Use AI to extract a hierarchical topic taxonomy from text."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a curriculum analyst. Extract ALL topics and subtopics from the study material "
                "and organize them into a logical hierarchy. For each topic, identify whether it is a "
                "main topic or a subtopic under a parent. Order them from foundational to advanced."
            ),
        },
        {
            "role": "user",
            "content": (
                "Extract ALL distinct topics and subtopics from this content and organize them hierarchically.\n\n"
                "For each topic provide:\n"
                "- name: Short specific name\n"
                "- definition: 1-2 sentence definition\n"
                "- explanation: Brief context\n"
                "- importance_score: 0.0-1.0 (exam likelihood)\n"
                "- study_weight: 1.0-5.0 based on difficulty and amount of material\n"
                "- parent: The name of the parent topic (null for top-level topics)\n"
                "- order_index: Integer ordering within its level (0-based)\n\n"
                "Rules:\n"
                "- Be specific (not 'Introduction' but 'Introduction to Monetary Policy')\n"
                "- Include 15-50 topics depending on content length\n"
                "- Main topics should have subtopics where appropriate\n"
                "- Order from prerequisite/foundational to advanced\n\n"
                "Return ONLY valid JSON array:\n"
                '[{"name": "...", "definition": "...", "explanation": "...", '
                '"importance_score": 0.0-1.0, "study_weight": 1.0-5.0, "parent": null or "Parent Name", "order_index": 0}]\n\n'
                f"Content:\n{text}"
            ),
        },
    ]

    response_text = await ai_service._call_groq(messages, max_tokens=8192)
    try:
        topics = ai_service._parse_json_response(response_text)
        if isinstance(topics, dict) and "topics" in topics:
            topics = topics["topics"]
        if not isinstance(topics, list):
            topics = [topics]

        cleaned = []
        for i, topic in enumerate(topics):
            try:
                if not isinstance(topic, dict):
                    logger.warning("Skipping non-dict topic item at index %s: %r", i, topic)
                    continue

                name = str(topic.get("name", "")).strip()
                if not name:
                    logger.warning("Skipping topic item with missing name at index %s", i)
                    continue

                try:
                    importance_score = float(topic.get("importance_score", 0.5))
                except (TypeError, ValueError):
                    importance_score = 0.5
                importance_score = min(max(importance_score, 0.0), 1.0)

                try:
                    study_weight = float(topic.get("study_weight", 1 + importance_score * 2))
                except (TypeError, ValueError):
                    study_weight = 1 + importance_score * 2
                study_weight = min(max(study_weight, 1.0), 5.0)

                try:
                    order_index = int(topic.get("order_index", i))
                except (TypeError, ValueError):
                    order_index = i

                parent_value = topic.get("parent")
                parent_name = str(parent_value).strip()[:200] if parent_value else None

                cleaned.append({
                    "name": name[:200],
                    "definition": str(topic.get("definition", ""))[:500],
                    "explanation": str(topic.get("explanation", ""))[:500],
                    "importance_score": importance_score,
                    "study_weight": study_weight,
                    "parent": parent_name or None,
                    "order_index": order_index,
                })
            except Exception as item_exc:
                logger.warning("Skipping malformed topic item at index %s: %s", i, item_exc)
                continue
        return cleaned
    except Exception as exc:
        logger.error("Failed to parse topic extraction response: %s", exc)
        return []


async def extract_topics_from_text(text: str, module_id: str = "") -> list[dict]:
    """Use AI to extract topics from text (legacy flat list)."""
    topics = await extract_topics_hierarchical(text, module_id)
    for topic in topics:
        topic.pop("parent", None)
    return topics


async def generate_content_map(module_id: str, db: Session) -> dict:
    """
    Generate a content map showing all topics/subtopics for a module,
    organized by hierarchy.
    """
    concepts = (
        db.query(Concept)
        .filter(Concept.module_id == module_id)
        .order_by(Concept.order_index.asc(), Concept.importance_score.desc())
        .all()
    )

    if not concepts:
        return {"module_id": module_id, "topics": [], "total_topics": 0}

    from models.flashcard import Flashcard
    from models.quiz_question import QuizQuestion

    topics = []
    for concept in concepts:
        flashcard_count = (
            db.query(Flashcard).filter(Flashcard.concept_id == concept.id).count()
        )
        question_count = (
            db.query(QuizQuestion).filter(QuizQuestion.concept_id == concept.id).count()
        )

        topics.append({
            "id": concept.id,
            "name": concept.name,
            "definition": concept.definition or "",
            "importance_score": concept.importance_score,
            "study_weight": concept.study_weight,
            "parent_id": concept.parent_concept_id,
            "order_index": concept.order_index,
            "flashcard_count": flashcard_count,
            "question_count": question_count,
            "has_content": flashcard_count > 0 or question_count > 0,
        })

    return {
        "module_id": module_id,
        "topics": topics,
        "total_topics": len(topics),
        "covered_topics": sum(1 for topic in topics if topic["has_content"]),
        "uncovered_topics": sum(1 for topic in topics if not topic["has_content"]),
    }
