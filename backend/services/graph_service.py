import json
import logging
from typing import Any, Optional

from sqlalchemy.orm import Session, joinedload

from config import settings
from models.concept import Concept
from models.document import Document
from models.module import Module
from models.review_log import ReviewLog
from models.topic_progress import TopicProgress

_neo4j_import_error: Exception | None = None
try:
    from neo4j import GraphDatabase
except Exception as exc:  # pragma: no cover - optional dependency import safeguard
    GraphDatabase = None
    _neo4j_import_error = exc

logger = logging.getLogger(__name__)
if _neo4j_import_error is not None:
    logger.warning("Neo4j driver import failed; graph sync will fall back to SQL only: %s", _neo4j_import_error)


def neo4j_enabled() -> bool:
    return bool(settings.NEO4J_URI and settings.NEO4J_PASSWORD and GraphDatabase is not None)


def graph_backend_name() -> str:
    return "neo4j" if neo4j_enabled() else "sql"


def _safe_json_list(raw_value: Optional[str]) -> list[str]:
    if not raw_value:
        return []
    try:
        parsed = json.loads(raw_value)
    except (TypeError, json.JSONDecodeError):
        return []
    if not isinstance(parsed, list):
        return []
    return [str(item) for item in parsed if item]


def _default_progress_status(progress_pct: float) -> str:
    if progress_pct >= 85:
        return "mastered"
    if progress_pct >= 60:
        return "solid"
    if progress_pct > 0:
        return "in_progress"
    return "not_started"


def _compute_concept_mastery(db: Session, concept: Concept) -> float:
    item_ids = [f.id for f in concept.flashcards] + [q.id for q in concept.quiz_questions]
    if not item_ids:
        return 0.0

    logs = db.query(ReviewLog).filter(ReviewLog.item_id.in_(item_ids)).all()
    if not logs:
        return 0.0

    correct = sum(1 for log in logs if log.was_correct)
    return round(correct / len(logs) * 100, 1)


def build_module_graph_snapshot(db: Session, module_id: str, user_id: Optional[str] = None) -> dict[str, Any]:
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        return {"module_name": "", "nodes": [], "edges": [], "document_count": 0, "graph_backend": graph_backend_name()}

    concepts = (
        db.query(Concept)
        .options(joinedload(Concept.flashcards), joinedload(Concept.quiz_questions))
        .filter(Concept.module_id == module_id)
        .order_by(Concept.parent_concept_id.is_(None).desc(), Concept.order_index.asc(), Concept.importance_score.desc())
        .all()
    )
    documents = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.delete_requested_at.is_(None))
        .order_by(Document.created_at.asc())
        .all()
    )

    progress_rows = []
    if user_id:
        progress_rows = (
            db.query(TopicProgress)
            .filter(TopicProgress.module_id == module_id, TopicProgress.user_id == user_id)
            .all()
        )
    progress_by_concept = {row.concept_id: row for row in progress_rows}

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    concept_ids = {concept.id for concept in concepts}
    seen_edges: set[tuple[str, str, str]] = set()

    for concept in concepts:
        mastery = _compute_concept_mastery(db, concept)
        progress = progress_by_concept.get(concept.id)
        progress_pct = round(float(progress.progress_pct), 1) if progress else mastery
        nodes.append(
            {
                "id": concept.id,
                "name": concept.name,
                "importance": round(float(concept.importance_score or 0.5), 3),
                "mastery": mastery,
                "group": "concept",
                "parent_id": concept.parent_concept_id,
                "order_index": concept.order_index or 0,
                "item_count": len(concept.flashcards) + len(concept.quiz_questions),
                "progress_pct": progress_pct,
                "progress_status": progress.status if progress else _default_progress_status(progress_pct),
                "score_pct": round(float(progress.last_score_pct), 1) if progress and progress.last_score_pct is not None else None,
            }
        )

        if concept.parent_concept_id and concept.parent_concept_id in concept_ids:
            edge = (concept.parent_concept_id, concept.id, "parent_child")
            if edge not in seen_edges:
                seen_edges.add(edge)
                edges.append({"source": edge[0], "target": edge[1], "type": edge[2]})

        for related_id in _safe_json_list(concept.related_concept_ids):
            if related_id not in concept_ids or related_id == concept.id:
                continue
            ordered = tuple(sorted((concept.id, related_id)))
            edge = (ordered[0], ordered[1], "related")
            if edge not in seen_edges:
                seen_edges.add(edge)
                edges.append({"source": edge[0], "target": edge[1], "type": edge[2]})

    concept_doc_map: dict[str, set[str]] = {}
    for concept in concepts:
        doc_ids = set(_safe_json_list(concept.source_document_ids))
        for flashcard in concept.flashcards:
            if flashcard.source_document_id:
                doc_ids.add(flashcard.source_document_id)
        for question in concept.quiz_questions:
            if question.source_document_id:
                doc_ids.add(question.source_document_id)
        concept_doc_map[concept.id] = doc_ids

    concept_id_list = [concept.id for concept in concepts]
    for index, concept_id in enumerate(concept_id_list):
        for other_id in concept_id_list[index + 1:]:
            if concept_doc_map.get(concept_id, set()) & concept_doc_map.get(other_id, set()):
                ordered = tuple(sorted((concept_id, other_id)))
                edge = (ordered[0], ordered[1], "shared_document")
                if edge not in seen_edges:
                    seen_edges.add(edge)
                    edges.append({"source": edge[0], "target": edge[1], "type": edge[2]})

    return {
        "module_name": module.name,
        "nodes": nodes,
        "edges": edges,
        "document_count": len(documents),
        "graph_backend": graph_backend_name(),
    }


def _neo4j_driver():
    if not neo4j_enabled():
        return None
    return GraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USERNAME, settings.NEO4J_PASSWORD),
    )


def sync_module_graph(db: Session, module_id: str, user_id: Optional[str] = None) -> bool:
    if not neo4j_enabled():
        return False

    snapshot = build_module_graph_snapshot(db, module_id, user_id)
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        return False

    documents = (
        db.query(Document)
        .filter(Document.module_id == module_id, Document.delete_requested_at.is_(None))
        .order_by(Document.created_at.asc())
        .all()
    )
    concept_doc_links = []
    concepts = db.query(Concept).filter(Concept.module_id == module_id).all()
    for concept in concepts:
        for document_id in _safe_json_list(concept.source_document_ids):
            concept_doc_links.append({"document_id": document_id, "concept_id": concept.id})

    module_payload = {
        "id": module.id,
        "name": module.name,
        "description": module.description or "",
        "color": module.color,
        "graph_backend": "neo4j",
    }
    document_payload = [
        {
            "id": document.id,
            "module_id": module.id,
            "filename": document.filename,
            "file_type": document.file_type,
            "summary": document.summary or "",
            "processing_status": document.processing_status,
        }
        for document in documents
    ]

    driver = _neo4j_driver()
    if driver is None:
        return False

    try:
        with driver.session(database=settings.NEO4J_DATABASE) as session:
            session.run(
                """
                MERGE (m:Module {id: $module.id})
                SET m += $module
                """,
                module=module_payload,
            )
            session.run(
                """
                MATCH (m:Module {id: $module_id})-[:HAS_DOCUMENT]->(d:Document)
                WHERE NOT d.id IN $document_ids
                DETACH DELETE d
                """,
                module_id=module_id,
                document_ids=[document["id"] for document in document_payload],
            )
            session.run(
                """
                MATCH (m:Module {id: $module_id})-[:HAS_CONCEPT]->(c:Concept)
                WHERE NOT c.id IN $concept_ids
                DETACH DELETE c
                """,
                module_id=module_id,
                concept_ids=[node["id"] for node in snapshot["nodes"]],
            )
            session.run(
                """
                UNWIND $documents AS document
                MATCH (m:Module {id: $module_id})
                MERGE (d:Document {id: document.id})
                SET d += document
                MERGE (m)-[:HAS_DOCUMENT]->(d)
                """,
                module_id=module_id,
                documents=document_payload,
            )
            session.run(
                """
                UNWIND $concepts AS concept
                MATCH (m:Module {id: $module_id})
                MERGE (c:Concept {id: concept.id})
                SET c += concept
                MERGE (m)-[:HAS_CONCEPT]->(c)
                """,
                module_id=module_id,
                concepts=snapshot["nodes"],
            )
            session.run(
                """
                MATCH (m:Module {id: $module_id})-[:HAS_CONCEPT]->(c:Concept)
                OPTIONAL MATCH (c)-[r:PARENT_OF|RELATED_TO|SHARED_DOCUMENT]->(:Concept)
                DELETE r
                """,
                module_id=module_id,
            )
            session.run(
                """
                MATCH (m:Module {id: $module_id})-[:HAS_DOCUMENT]->(d:Document)
                OPTIONAL MATCH (d)-[r:CONTAINS]->(:Concept)
                DELETE r
                """,
                module_id=module_id,
            )
            session.run(
                """
                UNWIND $links AS link
                MATCH (d:Document {id: link.document_id})
                MATCH (c:Concept {id: link.concept_id})
                MERGE (d)-[:CONTAINS]->(c)
                """,
                links=concept_doc_links,
            )
            session.run(
                """
                UNWIND $edges AS edge
                MATCH (source:Concept {id: edge.source})
                MATCH (target:Concept {id: edge.target})
                CALL {
                    WITH source, target, edge
                    WITH source, target, edge WHERE edge.type = 'parent_child'
                    MERGE (source)-[:PARENT_OF]->(target)
                    RETURN 1 AS _
                    UNION
                    WITH source, target, edge
                    WITH source, target, edge WHERE edge.type = 'related'
                    MERGE (source)-[:RELATED_TO]->(target)
                    RETURN 1 AS _
                    UNION
                    WITH source, target, edge
                    WITH source, target, edge WHERE edge.type = 'shared_document'
                    MERGE (source)-[:SHARED_DOCUMENT]->(target)
                    RETURN 1 AS _
                }
                RETURN count(*) AS applied
                """,
                edges=snapshot["edges"],
            )
        return True
    except Exception as exc:  # pragma: no cover - depends on external service
        logger.warning("Neo4j sync failed for module %s: %s", module_id, exc)
        return False
    finally:
        driver.close()


def get_module_graph(db: Session, module_id: str, user_id: Optional[str] = None) -> dict[str, Any]:
    snapshot = build_module_graph_snapshot(db, module_id, user_id)
    if not neo4j_enabled():
        return snapshot

    sync_module_graph(db, module_id, user_id)
    driver = _neo4j_driver()
    if driver is None:
        return snapshot

    try:
        with driver.session(database=settings.NEO4J_DATABASE) as session:
            result = session.run(
                """
                MATCH (m:Module {id: $module_id})
                OPTIONAL MATCH (m)-[:HAS_CONCEPT]->(c:Concept)
                WITH m, collect(DISTINCT c) AS nodes
                OPTIONAL MATCH (m)-[:HAS_CONCEPT]->(source:Concept)-[r:PARENT_OF|RELATED_TO|SHARED_DOCUMENT]->(target:Concept)<-[:HAS_CONCEPT]-(m)
                RETURN m.name AS module_name,
                       nodes,
                       collect(DISTINCT CASE
                            WHEN r IS NULL THEN NULL
                            ELSE {
                                source: source.id,
                                target: target.id,
                                type: CASE type(r)
                                    WHEN 'PARENT_OF' THEN 'parent_child'
                                    WHEN 'RELATED_TO' THEN 'related'
                                   ELSE 'shared_document'
                               END
                           }
                       END) AS edges
                """,
                module_id=module_id,
            ).single()
    except Exception as exc:  # pragma: no cover - depends on external service
        logger.warning("Neo4j graph read failed for module %s: %s", module_id, exc)
        driver.close()
        return snapshot
    finally:
        driver.close()

    if result is None:
        return snapshot

    neo4j_nodes = []
    for node in result.get("nodes", []):
        if node is None:
            continue
        neo4j_nodes.append(
            {
                "id": node.get("id"),
                "name": node.get("name"),
                "importance": float(node.get("importance", node.get("importance_score", 0.5)) or 0.5),
                "mastery": float(node.get("mastery", 0.0) or 0.0),
                "group": node.get("group", "concept"),
                "parent_id": node.get("parent_id"),
                "order_index": int(node.get("order_index", 0) or 0),
                "item_count": int(node.get("item_count", 0) or 0),
                "progress_pct": float(node.get("progress_pct", node.get("mastery", 0.0)) or 0.0),
                "progress_status": node.get("progress_status", _default_progress_status(float(node.get("progress_pct", 0.0) or 0.0))),
                "score_pct": float(node.get("score_pct")) if node.get("score_pct") is not None else None,
            }
        )

    neo4j_edges = [edge for edge in result.get("edges", []) if edge]
    if not neo4j_nodes:
        return snapshot

    snapshot["module_name"] = result.get("module_name") or snapshot["module_name"]
    snapshot["nodes"] = neo4j_nodes
    snapshot["edges"] = neo4j_edges
    snapshot["graph_backend"] = "neo4j"
    return snapshot
