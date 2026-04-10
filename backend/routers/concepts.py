from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.concept import Concept

router = APIRouter(prefix="/api/concepts", tags=["concepts"])


# ---------- Pydantic schemas ----------

class ConceptResponse(BaseModel):
    id: str
    module_id: str
    name: str
    definition: Optional[str] = None
    explanation: Optional[str] = None
    importance_score: float = 0.5
    created_at: datetime

    model_config = {"from_attributes": True}


# ---------- Endpoints ----------

@router.get("", response_model=list[ConceptResponse])
def list_concepts(
    module_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Concept)
    if module_id:
        query = query.filter(Concept.module_id == module_id)
    concepts = query.order_by(Concept.importance_score.desc()).all()
    return [
        ConceptResponse(
            id=c.id,
            module_id=c.module_id,
            name=c.name,
            definition=c.definition,
            explanation=c.explanation,
            importance_score=c.importance_score,
            created_at=c.created_at,
        )
        for c in concepts
    ]
