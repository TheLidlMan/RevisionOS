import json
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from models.concept import Concept
from models.document import Document
from services import ai_service
from services import vector_service
from config import settings

logger = logging.getLogger(__name__)


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
        db.commit()

        # Embed the summary for semantic search
        emb = vector_service.embed_text(f"{doc.filename}: {doc.summary}")
        if emb:
            vector_service.store_embedding(db, "documents", doc.id, emb)

        return doc.summary
    except Exception as e:
        logger.error(f"Failed to summarize document {document_id}: {e}")
        return None


async def index_document(document_id: str, db: Session) -> list[dict]:
    """
    Auto-index a document: generate summary, extract topics and subtopics,
    create Concept entries with hierarchy.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.raw_text:
        return []

    if not settings.GROQ_API_KEY:
        return []

    # Generate summary first
    await summarize_document(document_id, db)

    text = doc.raw_text
    max_chars = 120000
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        topics = await extract_topics_hierarchical(text, doc.module_id)

        created_concepts = []
        parent_map = {}  # name -> concept id

        # First pass: create/update top-level topics
        for topic in topics:
            if topic.get("parent"):
                continue  # Handle children in second pass

            existing = (
                db.query(Concept)
                .filter(
                    Concept.module_id == doc.module_id,
                    Concept.name == topic["name"],
                )
                .first()
            )

            if existing:
                if topic.get("definition") and not existing.definition:
                    existing.definition = topic["definition"]
                if topic.get("explanation") and not existing.explanation:
                    existing.explanation = topic["explanation"]
                if topic.get("importance_score"):
                    existing.importance_score = max(
                        existing.importance_score, topic["importance_score"]
                    )
                existing.order_index = topic.get("order_index", 0)
                db.commit()
                parent_map[topic["name"]] = existing.id
                created_concepts.append({
                    "id": existing.id,
                    "name": existing.name,
                    "is_new": False,
                })
            else:
                concept = Concept(
                    id=str(uuid.uuid4()),
                    module_id=doc.module_id,
                    name=topic["name"],
                    definition=topic.get("definition", ""),
                    explanation=topic.get("explanation", ""),
                    importance_score=topic.get("importance_score", 0.5),
                    order_index=topic.get("order_index", 0),
                    user_id=doc.user_id,
                )
                db.add(concept)
                db.flush()
                parent_map[topic["name"]] = concept.id
                created_concepts.append({
                    "id": concept.id,
                    "name": concept.name,
                    "is_new": True,
                })

        # Second pass: create/update child topics
        for topic in topics:
            parent_name = topic.get("parent")
            if not parent_name:
                continue

            parent_id = parent_map.get(parent_name)

            existing = (
                db.query(Concept)
                .filter(
                    Concept.module_id == doc.module_id,
                    Concept.name == topic["name"],
                )
                .first()
            )

            if existing:
                if topic.get("definition") and not existing.definition:
                    existing.definition = topic["definition"]
                if topic.get("explanation") and not existing.explanation:
                    existing.explanation = topic["explanation"]
                if topic.get("importance_score"):
                    existing.importance_score = max(
                        existing.importance_score, topic["importance_score"]
                    )
                existing.parent_concept_id = parent_id
                existing.order_index = topic.get("order_index", 0)
                parent_map[topic["name"]] = existing.id
                created_concepts.append({
                    "id": existing.id,
                    "name": existing.name,
                    "is_new": False,
                })
            else:
                concept = Concept(
                    id=str(uuid.uuid4()),
                    module_id=doc.module_id,
                    name=topic["name"],
                    definition=topic.get("definition", ""),
                    explanation=topic.get("explanation", ""),
                    importance_score=topic.get("importance_score", 0.5),
                    parent_concept_id=parent_id,
                    order_index=topic.get("order_index", 0),
                    user_id=doc.user_id,
                )
                db.add(concept)
                db.flush()
                parent_map[topic["name"]] = concept.id
                created_concepts.append({
                    "id": concept.id,
                    "name": concept.name,
                    "is_new": True,
                })

        db.commit()

        # Embed all concepts
        for concept_info in created_concepts:
            c = db.query(Concept).filter(Concept.id == concept_info["id"]).first()
            if c:
                txt = f"{c.name}: {c.definition or ''} {c.explanation or ''}"
                emb = vector_service.embed_text(txt)
                if emb:
                    vector_service.store_embedding(db, "concepts", c.id, emb, commit=False)

        if created_concepts:
            db.commit()

        return created_concepts

    except Exception as e:
        logger.error(f"Failed to index document {document_id}: {e}")
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
                "- parent: The name of the parent topic (null for top-level topics)\n"
                "- order_index: Integer ordering within its level (0-based)\n\n"
                "Rules:\n"
                "- Be specific (not 'Introduction' but 'Introduction to Monetary Policy')\n"
                "- Include 15-50 topics depending on content length\n"
                "- Main topics should have subtopics where appropriate\n"
                "- Order from prerequisite/foundational to advanced\n\n"
                "Return ONLY valid JSON array:\n"
                '[{"name": "...", "definition": "...", "explanation": "...", '
                '"importance_score": 0.0-1.0, "parent": null or "Parent Name", "order_index": 0}]\n\n'
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
        for i, t in enumerate(topics):
            if isinstance(t, dict) and t.get("name"):
                cleaned.append({
                    "name": str(t["name"])[:200],
                    "definition": str(t.get("definition", ""))[:500],
                    "explanation": str(t.get("explanation", ""))[:500],
                    "importance_score": min(
                        max(float(t.get("importance_score", 0.5)), 0.0), 1.0
                    ),
                    "parent": t.get("parent") if t.get("parent") else None,
                    "order_index": int(t.get("order_index", i)),
                })
        return cleaned
    except Exception as e:
        logger.error(f"Failed to parse topic extraction response: {e}")
        return []


# Legacy function for backward compatibility
async def extract_topics_from_text(text: str, module_id: str = "") -> list[dict]:
    """Use AI to extract topics from text (legacy flat list)."""
    topics = await extract_topics_hierarchical(text, module_id)
    # Flatten: remove parent field
    for t in topics:
        t.pop("parent", None)
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
    for c in concepts:
        flashcard_count = (
            db.query(Flashcard).filter(Flashcard.concept_id == c.id).count()
        )
        question_count = (
            db.query(QuizQuestion).filter(QuizQuestion.concept_id == c.id).count()
        )

        topics.append({
            "id": c.id,
            "name": c.name,
            "definition": c.definition or "",
            "importance_score": c.importance_score,
            "parent_id": c.parent_concept_id,
            "order_index": c.order_index,
            "flashcard_count": flashcard_count,
            "question_count": question_count,
            "has_content": flashcard_count > 0 or question_count > 0,
        })

    return {
        "module_id": module_id,
        "topics": topics,
        "total_topics": len(topics),
        "covered_topics": sum(1 for t in topics if t["has_content"]),
        "uncovered_topics": sum(1 for t in topics if not t["has_content"]),
    }
