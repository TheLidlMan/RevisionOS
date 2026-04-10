import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models.module import Module
from models.document import Document
from models.flashcard import Flashcard
from models.quiz_question import QuizQuestion

router = APIRouter(prefix="/api/modules", tags=["modules"])


# ---------- Pydantic schemas ----------

class ModuleCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#00b4d8"


class ModuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class ModuleResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    color: str
    created_at: datetime
    updated_at: datetime
    total_cards: int = 0
    due_cards: int = 0
    mastery_pct: float = 0.0
    total_documents: int = 0

    model_config = {"from_attributes": True}


class ModuleDetailResponse(ModuleResponse):
    documents: list[dict] = []


class ModuleStatsResponse(BaseModel):
    id: str
    name: str
    total_cards: int = 0
    due_cards: int = 0
    new_cards: int = 0
    learning_cards: int = 0
    review_cards: int = 0
    mastery_pct: float = 0.0
    total_documents: int = 0
    total_concepts: int = 0
    total_questions: int = 0


# ---------- Helpers ----------

def _compute_module_stats(db: Session, module: Module) -> dict:
    now = datetime.utcnow()
    cards = db.query(Flashcard).filter(Flashcard.module_id == module.id).all()
    total_cards = len(cards)
    due_cards = sum(1 for c in cards if c.due is not None and c.due <= now)
    new_cards = sum(1 for c in cards if c.state == "NEW")
    learning_cards = sum(1 for c in cards if c.state in ("LEARNING", "RELEARNING"))
    review_cards = sum(1 for c in cards if c.state == "REVIEW")
    mastered = sum(1 for c in cards if c.state == "REVIEW" and c.lapses == 0 and c.reps >= 2)
    mastery_pct = (mastered / total_cards * 100) if total_cards > 0 else 0.0

    total_documents = db.query(Document).filter(Document.module_id == module.id).count()

    return {
        "total_cards": total_cards,
        "due_cards": due_cards,
        "new_cards": new_cards,
        "learning_cards": learning_cards,
        "review_cards": review_cards,
        "mastery_pct": round(mastery_pct, 1),
        "total_documents": total_documents,
    }


# ---------- Endpoints ----------

@router.get("", response_model=list[ModuleResponse])
def list_modules(db: Session = Depends(get_db)):
    modules = db.query(Module).order_by(Module.created_at.desc()).all()
    results = []
    for m in modules:
        stats = _compute_module_stats(db, m)
        results.append(ModuleResponse(
            id=m.id,
            name=m.name,
            description=m.description,
            color=m.color,
            created_at=m.created_at,
            updated_at=m.updated_at,
            total_cards=stats["total_cards"],
            due_cards=stats["due_cards"],
            mastery_pct=stats["mastery_pct"],
            total_documents=stats["total_documents"],
        ))
    return results


@router.post("", response_model=ModuleResponse, status_code=201)
def create_module(body: ModuleCreate, db: Session = Depends(get_db)):
    module = Module(name=body.name, description=body.description, color=body.color)
    db.add(module)
    db.commit()
    db.refresh(module)
    return ModuleResponse(
        id=module.id,
        name=module.name,
        description=module.description,
        color=module.color,
        created_at=module.created_at,
        updated_at=module.updated_at,
    )


@router.get("/{module_id}", response_model=ModuleDetailResponse)
def get_module(module_id: str, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    stats = _compute_module_stats(db, module)
    docs = db.query(Document).filter(Document.module_id == module_id).all()
    doc_list = [
        {
            "id": d.id,
            "filename": d.filename,
            "file_type": d.file_type,
            "processing_status": d.processing_status,
            "word_count": d.word_count,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]
    return ModuleDetailResponse(
        id=module.id,
        name=module.name,
        description=module.description,
        color=module.color,
        created_at=module.created_at,
        updated_at=module.updated_at,
        total_cards=stats["total_cards"],
        due_cards=stats["due_cards"],
        mastery_pct=stats["mastery_pct"],
        total_documents=stats["total_documents"],
        documents=doc_list,
    )


@router.patch("/{module_id}", response_model=ModuleResponse)
def update_module(module_id: str, body: ModuleUpdate, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    if body.name is not None:
        module.name = body.name
    if body.description is not None:
        module.description = body.description
    if body.color is not None:
        module.color = body.color
    module.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(module)
    stats = _compute_module_stats(db, module)
    return ModuleResponse(
        id=module.id,
        name=module.name,
        description=module.description,
        color=module.color,
        created_at=module.created_at,
        updated_at=module.updated_at,
        total_cards=stats["total_cards"],
        due_cards=stats["due_cards"],
        mastery_pct=stats["mastery_pct"],
        total_documents=stats["total_documents"],
    )


@router.delete("/{module_id}", status_code=204)
def delete_module(module_id: str, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    db.delete(module)
    db.commit()
    return None


@router.get("/{module_id}/stats", response_model=ModuleStatsResponse)
def get_module_stats(module_id: str, db: Session = Depends(get_db)):
    module = db.query(Module).filter(Module.id == module_id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    stats = _compute_module_stats(db, module)

    from models.concept import Concept
    total_concepts = db.query(Concept).filter(Concept.module_id == module_id).count()
    total_questions = db.query(QuizQuestion).filter(QuizQuestion.module_id == module_id).count()

    return ModuleStatsResponse(
        id=module.id,
        name=module.name,
        total_cards=stats["total_cards"],
        due_cards=stats["due_cards"],
        new_cards=stats["new_cards"],
        learning_cards=stats["learning_cards"],
        review_cards=stats["review_cards"],
        mastery_pct=stats["mastery_pct"],
        total_documents=stats["total_documents"],
        total_concepts=total_concepts,
        total_questions=total_questions,
    )
