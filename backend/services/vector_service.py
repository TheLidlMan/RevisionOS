"""Vector search service using sentence-transformers with pgvector/fallback for semantic search."""
import heapq
import logging
import os
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from services.security import escape_like_query

logger = logging.getLogger(__name__)

_model = None
EMBEDDING_DIM = 384
_ALLOWED_EMBEDDING_TABLES = {"concepts": "concepts", "documents": "documents"}
_BATCH_SIZE = 100


def _get_model():
    """Lazy-load the sentence transformer model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            model_name = os.getenv("EMBEDDINGS_MODEL", "all-MiniLM-L6-v2")
            _model = SentenceTransformer(model_name)
            logger.info(f"Loaded embedding model: {model_name}")
        except Exception as e:
            logger.warning(f"Could not load sentence-transformers model: {e}")
            _model = None
    return _model


def embed_text(text_input: str) -> Optional[list[float]]:
    """Generate embedding vector for text."""
    model = _get_model()
    if model is None:
        return None
    try:
        embedding = model.encode(text_input, normalize_embeddings=True)
        return embedding.tolist()
    except Exception as e:
        logger.error(f"Embedding failed: {e}")
        return None


def embed_texts(texts: list[str]) -> Optional[list[list[float]]]:
    """Generate embeddings for multiple texts."""
    model = _get_model()
    if model is None:
        return None
    try:
        embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32)
        return embeddings.tolist()
    except Exception as e:
        logger.error(f"Batch embedding failed: {e}")
        return None


def store_embedding(db: Session, table: str, item_id: str, embedding: list[float]):
    """Store an embedding vector in the DB (base64-encoded for portability)."""
    import base64, struct

    safe_table = _ALLOWED_EMBEDDING_TABLES.get(table)
    if safe_table is None:
        raise ValueError(f"Unsupported embedding table: {table}")

    blob = struct.pack(f'{len(embedding)}f', *embedding)
    encoded = base64.b64encode(blob).decode('ascii')
    db.execute(
        text(f"UPDATE {safe_table} SET embedding = :vec WHERE id = :id"),
        {"vec": encoded, "id": item_id},
    )


def _decode_embedding(encoded: str) -> Optional[list[float]]:
    """Decode base64-encoded embedding."""
    if not encoded:
        return None
    try:
        import base64, struct
        blob = base64.b64decode(encoded)
        return list(struct.unpack(f'{len(blob) // 4}f', blob))
    except Exception:
        return None


def _batched_query(query, batch_size: int = _BATCH_SIZE):
    offset = 0
    while True:
        batch = query.limit(batch_size).offset(offset).all()
        if not batch:
            break
        for row in batch:
            yield row
        offset += batch_size


def _push_scored_result(heap: list[tuple[float, str, dict]], result: dict, top_k: int) -> None:
    entry = (result["score"], result["id"], result)
    if len(heap) < top_k:
        heapq.heappush(heap, entry)
        return

    if entry[0] > heap[0][0]:
        heapq.heapreplace(heap, entry)


def search_semantic(
    db: Session,
    query: str,
    top_k: int = 20,
    user_id: Optional[str] = None,
    module_id: Optional[str] = None,
) -> list[dict]:
    """Semantic search with batched in-memory scoring when pgvector is unavailable."""
    model = _get_model()
    if model is None:
        return []

    try:
        query_vec = model.encode(query, normalize_embeddings=True).tolist()
    except Exception as e:
        logger.error(f"Query embedding failed: {e}")
        return []

    from models.concept import Concept
    from models.document import Document

    logger.debug("pgvector search is not configured; using batched in-memory semantic search")
    scored_results: list[tuple[float, str, dict]] = []

    # Search concepts
    concept_q = db.query(Concept).filter(Concept.embedding.isnot(None)).order_by(Concept.id.asc())
    if user_id:
        concept_q = concept_q.filter(Concept.user_id == user_id)
    if module_id:
        concept_q = concept_q.filter(Concept.module_id == module_id)
    for c in _batched_query(concept_q):
        vec = _decode_embedding(c.embedding)
        if vec:
            score = sum(a * b for a, b in zip(query_vec, vec, strict=True))
            _push_scored_result(scored_results, {
                "id": f"concept:{c.id}",
                "score": float(score),
                "text": f"{c.name}: {c.definition or ''}",
                "name": c.name,
                "module_id": c.module_id,
            }, top_k)

    # Search documents
    doc_q = db.query(Document).filter(Document.embedding.isnot(None)).order_by(Document.id.asc())
    if user_id:
        doc_q = doc_q.filter(Document.user_id == user_id)
    if module_id:
        doc_q = doc_q.filter(Document.module_id == module_id)
    for d in _batched_query(doc_q):
        vec = _decode_embedding(d.embedding)
        if vec:
            score = sum(a * b for a, b in zip(query_vec, vec, strict=True))
            _push_scored_result(scored_results, {
                "id": f"document:{d.id}",
                "score": float(score),
                "text": f"{d.filename}: {d.summary or (d.raw_text or '')[:200]}",
                "name": d.filename,
                "module_id": d.module_id,
            }, top_k)

    return [result for _, _, result in sorted(scored_results, key=lambda item: item[0], reverse=True)]


def search(query: str, top_k: int = 20) -> list[dict]:
    """Legacy search interface for backward compatibility. Uses in-memory approach."""
    model = _get_model()
    if model is None:
        return []
    # This needs a DB session; return empty for legacy callers
    return []


def search_keyword(db: Session, query: str, top_k: int = 20, user_id: Optional[str] = None, module_id: Optional[str] = None) -> list[dict]:
    """Keyword search using SQL ILIKE across concepts and documents."""
    from models.concept import Concept
    from models.document import Document

    pattern = f"%{escape_like_query(query)}%"
    results = []

    concept_q = db.query(Concept).filter(
        (Concept.name.ilike(pattern, escape="\\")) | (Concept.definition.ilike(pattern, escape="\\"))
    )
    if user_id:
        concept_q = concept_q.filter(Concept.user_id == user_id)
    if module_id:
        concept_q = concept_q.filter(Concept.module_id == module_id)

    for c in concept_q.limit(top_k).all():
        results.append({
            "id": f"concept:{c.id}",
            "score": 0.8,
            "text": f"{c.name}: {c.definition or ''}",
            "name": c.name,
            "module_id": c.module_id,
        })

    remaining = top_k - len(results)
    if remaining > 0:
        doc_q = db.query(Document).filter(
            (Document.filename.ilike(pattern, escape="\\")) | (Document.raw_text.ilike(pattern, escape="\\"))
        )
        if user_id:
            doc_q = doc_q.filter(Document.user_id == user_id)
        if module_id:
            doc_q = doc_q.filter(Document.module_id == module_id)

        for d in doc_q.limit(remaining).all():
            results.append({
                "id": f"document:{d.id}",
                "score": 0.6,
                "text": f"{d.filename}: {(d.raw_text or '')[:200]}",
                "name": d.filename,
                "module_id": d.module_id,
            })

    return results


def search_exact(db: Session, query: str, top_k: int = 20, user_id: Optional[str] = None, module_id: Optional[str] = None) -> list[dict]:
    """Exact/grep search for precise text matches in document content."""
    from models.document import Document

    results = []
    doc_q = db.query(Document).filter(Document.raw_text.ilike(f"%{escape_like_query(query)}%", escape="\\"))
    if user_id:
        doc_q = doc_q.filter(Document.user_id == user_id)
    if module_id:
        doc_q = doc_q.filter(Document.module_id == module_id)

    for d in doc_q.limit(top_k).all():
        raw = d.raw_text or ""
        idx = raw.lower().find(query.lower())
        if idx >= 0:
            start = max(0, idx - 100)
            end = min(len(raw), idx + len(query) + 100)
            snippet = raw[start:end]
            if start > 0:
                snippet = "..." + snippet
            if end < len(raw):
                snippet = snippet + "..."
        else:
            snippet = raw[:200]

        results.append({
            "id": f"document:{d.id}",
            "score": 1.0,
            "text": snippet,
            "name": d.filename,
            "module_id": d.module_id,
        })

    return results


def build_index_from_db(db: Session) -> int:
    """Compute and store embeddings for all concepts and documents."""
    from models.concept import Concept
    from models.document import Document

    model = _get_model()
    if model is None:
        return 0

    total = 0

    try:
        concepts = db.query(Concept).all()
        for c in concepts:
            txt = f"{c.name}: {c.definition or ''} {c.explanation or ''}"
            emb = embed_text(txt)
            if emb:
                store_embedding(db, "concepts", c.id, emb)
                total += 1

        documents = db.query(Document).filter(Document.raw_text.isnot(None)).all()
        for d in documents:
            txt = d.summary or f"{d.filename}: {(d.raw_text or '')[:500]}"
            emb = embed_text(txt)
            if emb:
                store_embedding(db, "documents", d.id, emb)
                total += 1

        if total:
            db.commit()
    except Exception:
        db.rollback()
        raise

    logger.info(f"Built embeddings for {total} items")
    return total
