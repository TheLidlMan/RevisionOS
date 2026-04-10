"""Vector search service using sentence-transformers and FAISS for semantic search."""
import base64
import json
import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded globals
_model = None
_index = None
_id_map: list[str] = []
_text_map: dict[str, str] = {}

EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 dimension


def _get_np():
    """Lazy-load numpy."""
    try:
        import numpy as np
        return np
    except ImportError:
        return None


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
            logger.warning(f"Could not load sentence-transformers model: {e}. Falling back to basic search.")
            _model = None
    return _model


def _get_index():
    """Lazy-load or create FAISS index."""
    global _index
    if _index is None:
        try:
            import faiss
            _index = faiss.IndexFlatIP(EMBEDDING_DIM)  # Inner product (cosine after normalization)
            logger.info("Created new FAISS index")
        except Exception as e:
            logger.warning(f"Could not create FAISS index: {e}")
            _index = None
    return _index


def embed_text(text: str) -> Optional[list[float]]:
    """Generate embedding vector for text."""
    model = _get_model()
    if model is None:
        return None
    try:
        embedding = model.encode(text, normalize_embeddings=True)
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


def add_to_index(item_id: str, embedding: list[float], text: str = ""):
    """Add an embedding to the FAISS index."""
    np = _get_np()
    index = _get_index()
    if index is None or np is None:
        return
    global _id_map, _text_map
    try:
        vec = np.array([embedding], dtype=np.float32)
        index.add(vec)
        _id_map.append(item_id)
        if text:
            _text_map[item_id] = text
    except Exception as e:
        logger.error(f"Failed to add to index: {e}")


def search(query: str, top_k: int = 20) -> list[dict]:
    """Semantic search: embed query and find nearest neighbors."""
    np = _get_np()
    index = _get_index()
    model = _get_model()
    if index is None or model is None or np is None or index.ntotal == 0:
        return []

    try:
        query_vec = model.encode(query, normalize_embeddings=True)
        query_vec = np.array([query_vec], dtype=np.float32)

        k = min(top_k, index.ntotal)
        scores, indices = index.search(query_vec, k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(_id_map):
                continue
            item_id = _id_map[idx]
            results.append({
                "id": item_id,
                "score": float(score),
                "text": _text_map.get(item_id, ""),
            })
        return results
    except Exception as e:
        logger.error(f"Search failed: {e}")
        return []


def build_index_from_db(db) -> int:
    """Rebuild the FAISS index from all concepts and documents in the database."""
    from models.concept import Concept
    from models.document import Document

    global _index, _id_map, _text_map

    model = _get_model()
    if model is None:
        return 0

    try:
        import faiss
        _index = faiss.IndexFlatIP(EMBEDDING_DIM)
        _id_map = []
        _text_map = {}

        np = _get_np()
        if np is None:
            return 0

        # Index concepts
        concepts = db.query(Concept).all()
        concept_texts = []
        concept_ids = []
        for c in concepts:
            text = f"{c.name}: {c.definition or ''} {c.explanation or ''}"
            concept_texts.append(text)
            concept_ids.append(f"concept:{c.id}")
            _text_map[f"concept:{c.id}"] = text

        if concept_texts:
            embeddings = model.encode(concept_texts, normalize_embeddings=True, batch_size=32)
            _index.add(np.array(embeddings, dtype=np.float32))
            _id_map.extend(concept_ids)

        # Index documents (first 500 chars of each)
        documents = db.query(Document).filter(Document.raw_text.isnot(None)).all()
        doc_texts = []
        doc_ids = []
        for d in documents:
            text = (d.raw_text or "")[:500]
            if text.strip():
                doc_texts.append(f"{d.filename}: {text}")
                doc_ids.append(f"document:{d.id}")
                _text_map[f"document:{d.id}"] = f"{d.filename}: {text[:200]}"

        if doc_texts:
            embeddings = model.encode(doc_texts, normalize_embeddings=True, batch_size=32)
            _index.add(np.array(embeddings, dtype=np.float32))
            _id_map.extend(doc_ids)

        total = len(concept_ids) + len(doc_ids)
        logger.info(f"Built FAISS index with {total} items ({len(concept_ids)} concepts, {len(doc_ids)} documents)")
        return total
    except Exception as e:
        logger.error(f"Failed to build index: {e}")
        return 0


def encode_embedding(embedding: list[float]) -> str:
    """Encode embedding to base64 string for DB storage."""
    np = _get_np()
    if np is None:
        return ""
    arr = np.array(embedding, dtype=np.float32)
    return base64.b64encode(arr.tobytes()).decode('ascii')


def decode_embedding(encoded: str) -> list[float]:
    """Decode base64 embedding from DB."""
    np = _get_np()
    if np is None:
        return []
    arr = np.frombuffer(base64.b64decode(encoded), dtype=np.float32)
    return arr.tolist()
