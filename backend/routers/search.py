from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.concept import Concept
from models.flashcard import Flashcard
from models.document import Document
from models.module import Module

router = APIRouter(prefix="/api/search", tags=["search"])


# ---------- Pydantic schemas ----------

class SearchResult(BaseModel):
    type: str  # concept, flashcard, document
    id: str
    title: str
    snippet: str = ""
    module_id: Optional[str] = None
    module_name: Optional[str] = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int = 0
    query: str = ""


# ---------- Helpers ----------

def _snippet(text: Optional[str], query: str, max_len: int = 200) -> str:
    """Extract a snippet around the query match."""
    if not text:
        return ""
    lower_text = text.lower()
    lower_query = query.lower()
    idx = lower_text.find(lower_query)
    if idx == -1:
        return text[:max_len] + ("..." if len(text) > max_len else "")
    start = max(0, idx - 60)
    end = min(len(text), idx + len(query) + 140)
    snippet = text[start:end]
    if start > 0:
        snippet = "..." + snippet
    if end < len(text):
        snippet = snippet + "..."
    return snippet


# ---------- Endpoints ----------

@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1, description="Search query"),
    module_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Search across concepts, flashcards, and documents using LIKE matching."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    pattern = f"%{q}%"
    results: list[SearchResult] = []

    # Cache module names
    module_cache: dict[str, str] = {}

    def get_module_name(mid: str) -> str:
        if mid not in module_cache:
            mod = db.query(Module).filter(Module.id == mid).first()
            module_cache[mid] = mod.name if mod else ""
        return module_cache[mid]

    # Search concepts
    concept_query = db.query(Concept).filter(
        (Concept.name.ilike(pattern)) | (Concept.definition.ilike(pattern))
    )
    if module_id:
        concept_query = concept_query.filter(Concept.module_id == module_id)
    for c in concept_query.limit(limit).all():
        match_text = c.definition or c.name
        results.append(SearchResult(
            type="concept",
            id=c.id,
            title=c.name,
            snippet=_snippet(match_text, q),
            module_id=c.module_id,
            module_name=get_module_name(c.module_id),
        ))

    # Search flashcards
    remaining = limit - len(results)
    if remaining > 0:
        fc_query = db.query(Flashcard).filter(
            (Flashcard.front.ilike(pattern)) | (Flashcard.back.ilike(pattern))
        )
        if module_id:
            fc_query = fc_query.filter(Flashcard.module_id == module_id)
        for f in fc_query.limit(remaining).all():
            match_text = f.front if q.lower() in (f.front or "").lower() else f.back
            results.append(SearchResult(
                type="flashcard",
                id=f.id,
                title=f.front[:100],
                snippet=_snippet(match_text, q),
                module_id=f.module_id,
                module_name=get_module_name(f.module_id),
            ))

    # Search documents
    remaining = limit - len(results)
    if remaining > 0:
        doc_query = db.query(Document).filter(
            (Document.filename.ilike(pattern)) | (Document.raw_text.ilike(pattern))
        )
        if module_id:
            doc_query = doc_query.filter(Document.module_id == module_id)
        for d in doc_query.limit(remaining).all():
            match_text = d.raw_text if d.raw_text and q.lower() in d.raw_text.lower() else d.filename
            results.append(SearchResult(
                type="document",
                id=d.id,
                title=d.filename,
                snippet=_snippet(match_text, q),
                module_id=d.module_id,
                module_name=get_module_name(d.module_id),
            ))

    return SearchResponse(results=results, total=len(results), query=q)
