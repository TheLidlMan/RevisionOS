from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.concept import Concept
from models.flashcard import Flashcard
from models.document import Document
from models.module import Module
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(prefix="/api/search", tags=["search"])


# ---------- Pydantic schemas ----------

class SearchResult(BaseModel):
    type: str  # concept, flashcard, document
    id: str
    title: str
    snippet: str = ""
    score: Optional[float] = None
    module_id: Optional[str] = None
    module_name: Optional[str] = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int = 0
    query: str = ""


# ---------- Helpers ----------


def _apply_owned_scope(query, model, user: OptionalType[User]):
    if user:
        return query.filter(model.user_id == user.id)
    return query.filter(model.user_id.is_(None))


def _get_module_name(db: Session, module_cache: dict[str, str], mid: str, user: OptionalType[User]) -> str:
    if mid not in module_cache:
        module_query = _apply_owned_scope(db.query(Module).filter(Module.id == mid), Module, user)
        mod = module_query.first()
        module_cache[mid] = mod.name if mod else ""
    return module_cache[mid]


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
    type: Optional[str] = Query(None, description="Search type: semantic, keyword, exact"),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    """Search across all content. Supports semantic, keyword, and exact modes."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    module_cache: dict[str, str] = {}
    search_type = type or "semantic"

    # Try vector-based search (semantic or exact) first
    if search_type in ("semantic", "exact"):
        try:
            from services import vector_service

            if search_type == "exact":
                vector_results = vector_service.search_exact(
                    db,
                    q,
                    top_k=limit,
                    user_id=user.id if user else None,
                    module_id=module_id,
                )
            else:
                vector_results = vector_service.search_semantic(
                    db,
                    q,
                    top_k=limit,
                    user_id=user.id if user else None,
                )

            if vector_results:
                semantic_results: list[SearchResult] = []
                for vr in vector_results:
                    parts = vr["id"].split(":", 1)
                    if len(parts) != 2:
                        continue

                    item_type, item_id = parts
                    result: SearchResult | None = None

                    if item_type == "concept":
                        concept_query = _apply_owned_scope(
                            db.query(Concept).filter(Concept.id == item_id),
                            Concept,
                            user,
                        )
                        if module_id:
                            concept_query = concept_query.filter(Concept.module_id == module_id)
                        concept = concept_query.first()
                        if concept:
                            result = SearchResult(
                                type="concept",
                                id=concept.id,
                                title=concept.name,
                                snippet=_snippet(concept.definition or concept.explanation or vr.get("text", ""), q),
                                score=vr["score"],
                                module_id=concept.module_id,
                                module_name=_get_module_name(db, module_cache, concept.module_id, user),
                            )
                    elif item_type == "document":
                        doc_query = _apply_owned_scope(
                            db.query(Document).filter(Document.id == item_id),
                            Document,
                            user,
                        )
                        if module_id:
                            doc_query = doc_query.filter(Document.module_id == module_id)
                        document = doc_query.first()
                        if document:
                            result = SearchResult(
                                type="document",
                                id=document.id,
                                title=document.filename,
                                snippet=_snippet(document.raw_text or vr.get("text", ""), q),
                                score=vr["score"],
                                module_id=document.module_id,
                                module_name=_get_module_name(db, module_cache, document.module_id, user),
                            )
                    elif item_type == "flashcard":
                        flashcard_query = _apply_owned_scope(
                            db.query(Flashcard).filter(Flashcard.id == item_id),
                            Flashcard,
                            user,
                        )
                        if module_id:
                            flashcard_query = flashcard_query.filter(Flashcard.module_id == module_id)
                        flashcard = flashcard_query.first()
                        if flashcard:
                            match_text = flashcard.front if q.lower() in (flashcard.front or "").lower() else flashcard.back
                            result = SearchResult(
                                type="flashcard",
                                id=flashcard.id,
                                title=flashcard.front[:100],
                                snippet=_snippet(match_text or vr.get("text", ""), q),
                                score=vr["score"],
                                module_id=flashcard.module_id,
                                module_name=_get_module_name(db, module_cache, flashcard.module_id, user),
                            )

                    if result and (result.module_id is None or result.module_name):
                        semantic_results.append(result)

                if semantic_results:
                    return SearchResponse(
                        results=semantic_results[:limit],
                        total=len(semantic_results),
                        query=q,
                    )
        except Exception:
            pass  # Fall through to keyword search

    # Keyword search fallback
    pattern = f"%{q}%"
    results: list[SearchResult] = []

    concept_query = _apply_owned_scope(db.query(Concept), Concept, user).filter(
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
            module_name=_get_module_name(db, module_cache, c.module_id, user),
        ))

    remaining = limit - len(results)
    if remaining > 0:
        fc_query = _apply_owned_scope(db.query(Flashcard), Flashcard, user).filter(
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
                module_name=_get_module_name(db, module_cache, f.module_id, user),
            ))

    remaining = limit - len(results)
    if remaining > 0:
        doc_query = _apply_owned_scope(db.query(Document), Document, user).filter(
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
                module_name=_get_module_name(db, module_cache, d.module_id, user),
            ))

    return SearchResponse(results=results, total=len(results), query=q)
