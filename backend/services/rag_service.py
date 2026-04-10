"""RAG (Retrieval-Augmented Generation) service.

Provides document retrieval tools for the LLM to search across uploaded content
before generating flashcards, quizzes, etc.
"""
import logging
from typing import Optional

from sqlalchemy.orm import Session

from services import vector_service

logger = logging.getLogger(__name__)


def get_document_summaries(db: Session, module_id: str, user_id: Optional[str] = None) -> list[dict]:
    """Get summaries of all documents in a module for LLM context."""
    from models.document import Document

    query = db.query(Document).filter(
        Document.module_id == module_id,
        Document.processing_status == "done",
    )
    if user_id:
        query = query.filter(Document.user_id == user_id)

    docs = query.all()
    summaries = []
    for d in docs:
        summaries.append({
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "word_count": d.word_count,
            "summary": d.summary or (d.raw_text or "")[:300],
        })
    return summaries


def retrieve_document_chunks(db: Session, document_id: str, chunk_size: int = 4000, overlap: int = 200) -> list[str]:
    """Split a document into overlapping chunks for processing."""
    from models.document import Document

    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc or not doc.raw_text:
        return []

    text = doc.raw_text
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk)
        start = end - overlap
        if start >= len(text):
            break

    return chunks


def retrieve_all_document_chunks(db: Session, module_id: str, chunk_size: int = 4000) -> list[dict]:
    """Get all document chunks for a module, tagged with document info."""
    from models.document import Document

    docs = db.query(Document).filter(
        Document.module_id == module_id,
        Document.processing_status == "done",
    ).all()

    all_chunks = []
    for doc in docs:
        chunks = retrieve_document_chunks(db, doc.id, chunk_size=chunk_size)
        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "document_id": doc.id,
                "filename": doc.filename,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "text": chunk,
            })
    return all_chunks


def search_documents(
    db: Session,
    query: str,
    search_type: str = "semantic",
    top_k: int = 10,
    user_id: Optional[str] = None,
    module_id: Optional[str] = None,
) -> list[dict]:
    """Unified search interface supporting semantic, keyword, and exact search."""
    if search_type == "semantic":
        return vector_service.search_semantic(db, query, top_k=top_k, user_id=user_id)
    elif search_type == "keyword":
        return vector_service.search_keyword(db, query, top_k=top_k, user_id=user_id, module_id=module_id)
    elif search_type == "exact":
        return vector_service.search_exact(db, query, top_k=top_k, user_id=user_id, module_id=module_id)
    else:
        # Hybrid: try semantic first, fall back to keyword
        results = vector_service.search_semantic(db, query, top_k=top_k, user_id=user_id)
        if not results:
            results = vector_service.search_keyword(db, query, top_k=top_k, user_id=user_id, module_id=module_id)
        return results


def build_rag_context(db: Session, module_id: str, query: Optional[str] = None, max_chars: int = 60000) -> str:
    """Build a RAG context string for LLM generation.

    Includes document summaries and optionally retrieves relevant chunks
    based on a query.
    """
    summaries = get_document_summaries(db, module_id)

    context_parts = ["## Available Documents\n"]
    for s in summaries:
        context_parts.append(f"- **{s['filename']}** ({s['word_count']} words): {s['summary']}\n")

    if query:
        # Retrieve relevant chunks via semantic search
        results = vector_service.search_semantic(db, query, top_k=5)
        if results:
            context_parts.append("\n## Relevant Content\n")
            for r in results:
                context_parts.append(f"[{r.get('name', 'Unknown')}]: {r['text'][:1000]}\n")

    context = "\n".join(context_parts)
    if len(context) > max_chars:
        context = context[:max_chars]
    return context
