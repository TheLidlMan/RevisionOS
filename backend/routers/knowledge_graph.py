from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.concept import Concept
from models.flashcard import Flashcard
from models.quiz_question import QuizQuestion
from models.review_log import ReviewLog
from models.module import Module
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(tags=["knowledge-graph"])


# ---------- Pydantic schemas ----------

class GraphNode(BaseModel):
    id: str
    name: str
    importance: float = 0.5
    mastery: float = 0.0
    group: str = "concept"
    parent_id: Optional[str] = None
    order_index: int = 0
    item_count: int = 0


class GraphEdge(BaseModel):
    source: str
    target: str
    type: str = "related"


class KnowledgeGraphResponse(BaseModel):
    module_name: str = ""
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# ---------- Helpers ----------

def _compute_concept_mastery(db: Session, concept: Concept) -> float:
    """Compute mastery for a concept based on linked items' review performance."""
    item_ids = [f.id for f in concept.flashcards] + [q.id for q in concept.quiz_questions]
    if not item_ids:
        return 0.0

    logs = db.query(ReviewLog).filter(ReviewLog.item_id.in_(item_ids)).all()
    if not logs:
        return 0.0

    correct = sum(1 for lg in logs if lg.was_correct)
    return round(correct / len(logs) * 100, 1)


# ---------- Endpoints ----------

@router.get("/api/modules/{module_id}/knowledge-graph", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Return nodes + edges JSON for D3 visualization."""
    query = db.query(Module).filter(Module.id == module_id)
    if user:
        query = query.filter(Module.user_id == user.id)
    module = query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    concepts = (
        db.query(Concept)
        .options(joinedload(Concept.flashcards), joinedload(Concept.quiz_questions))
        .filter(Concept.module_id == module_id)
        .all()
    )
    if not concepts:
        return KnowledgeGraphResponse(module_name=module.name, nodes=[], edges=[])

    nodes: list[GraphNode] = []
    concept_doc_map: dict[str, set[str]] = {}

    for c in concepts:
        mastery = _compute_concept_mastery(db, c)
        item_count = len(c.flashcards) + len(c.quiz_questions)
        nodes.append(GraphNode(
            id=c.id,
            name=c.name,
            importance=c.importance_score,
            mastery=mastery,
            group="concept",
            parent_id=c.parent_concept_id,
            order_index=c.order_index if c.order_index else 0,
            item_count=item_count,
        ))

        # Track which documents each concept is linked to via flashcards/questions
        doc_ids: set[str] = set()
        for fc in c.flashcards:
            if fc.source_document_id:
                doc_ids.add(fc.source_document_id)
        for qq in c.quiz_questions:
            if qq.source_document_id:
                doc_ids.add(qq.source_document_id)
        concept_doc_map[c.id] = doc_ids

    # Build edges: parent-child hierarchy + shared document relationships
    edges: list[GraphEdge] = []
    concept_ids = [c.id for c in concepts]
    seen_pairs: set[tuple[str, str]] = set()

    # Parent-child edges from taxonomy
    for c in concepts:
        if c.parent_concept_id and c.parent_concept_id in concept_ids:
            edges.append(GraphEdge(
                source=c.parent_concept_id,
                target=c.id,
                type="parent_child",
            ))
            pair = tuple(sorted((c.parent_concept_id, c.id)))
            seen_pairs.add(pair)

    # Shared document edges
    for i, cid_a in enumerate(concept_ids):
        for cid_b in concept_ids[i + 1:]:
            shared = concept_doc_map.get(cid_a, set()) & concept_doc_map.get(cid_b, set())
            if shared:
                pair = tuple(sorted((cid_a, cid_b)))
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    edges.append(GraphEdge(
                        source=cid_a,
                        target=cid_b,
                        type="shared_document",
                    ))

    return KnowledgeGraphResponse(module_name=module.name, nodes=nodes, edges=edges)
