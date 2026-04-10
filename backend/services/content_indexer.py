import json
import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from models.concept import Concept
from models.document import Document
from services import ai_service
from config import settings

logger = logging.getLogger(__name__)


async def index_document(document_id: str, db: Session) -> list[dict]:
    """
    Auto-index a document: extract topics and subtopics, create Concept entries.
    Called after document text extraction completes.
    Returns list of created concept dicts.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.raw_text:
        return []

    if not settings.GROQ_API_KEY:
        return []

    text = doc.raw_text
    max_chars = 120000  # ~40k tokens
    if len(text) > max_chars:
        text = text[:max_chars]

    try:
        topics = await extract_topics_from_text(text, doc.module_id)

        created_concepts = []
        for topic in topics:
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
                db.commit()
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
                    user_id=doc.user_id,
                )
                db.add(concept)
                created_concepts.append({
                    "id": concept.id,
                    "name": concept.name,
                    "is_new": True,
                })

        db.commit()
        return created_concepts

    except Exception as e:
        logger.error(f"Failed to index document {document_id}: {e}")
        return []


async def extract_topics_from_text(text: str, module_id: str = "") -> list[dict]:
    """Use AI to extract topics and subtopics from text."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a curriculum analyst. Extract the key topics and subtopics from the following study material. "
                "For each topic, provide: name (short, specific), definition (1-2 sentences), "
                "explanation (brief context), and importance_score (0.0-1.0 based on how likely this is to appear in an exam)."
            ),
        },
        {
            "role": "user",
            "content": (
                "Extract ALL distinct topics and subtopics from this content. "
                "Include both main topics and their subtopics as separate entries. "
                "Be specific — don't just say 'Introduction', say 'Introduction to Monetary Policy'. "
                "Aim for 10-30 topics depending on content length.\n\n"
                "Return ONLY valid JSON array: "
                '[{"name": "...", "definition": "...", "explanation": "...", "importance_score": 0.0-1.0}]\n\n'
                f"Content:\n{text}"
            ),
        },
    ]

    response_text = await ai_service._call_groq(messages, max_tokens=4096)
    try:
        topics = ai_service._parse_json_response(response_text)
        if isinstance(topics, dict) and "topics" in topics:
            topics = topics["topics"]
        if not isinstance(topics, list):
            topics = [topics]

        cleaned = []
        for t in topics:
            if isinstance(t, dict) and t.get("name"):
                cleaned.append({
                    "name": str(t["name"])[:200],
                    "definition": str(t.get("definition", ""))[:500],
                    "explanation": str(t.get("explanation", ""))[:500],
                    "importance_score": min(
                        max(float(t.get("importance_score", 0.5)), 0.0), 1.0
                    ),
                })
        return cleaned
    except Exception as e:
        logger.error(f"Failed to parse topic extraction response: {e}")
        return []


async def generate_content_map(module_id: str, db: Session) -> dict:
    """
    Generate a content map showing all topics/subtopics for a module,
    organized by theme/section.
    """
    concepts = (
        db.query(Concept)
        .filter(Concept.module_id == module_id)
        .order_by(Concept.importance_score.desc())
        .all()
    )

    if not concepts:
        return {"module_id": module_id, "topics": [], "total_topics": 0}

    topics = []
    for c in concepts:
        from models.flashcard import Flashcard
        from models.quiz_question import QuizQuestion

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
