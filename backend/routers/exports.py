import io
import json
import os
import random
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.module import Module
from models.document import Document
from models.concept import Concept
from models.flashcard import Flashcard
from models.quiz_question import QuizQuestion
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from models.user import User

router = APIRouter(tags=["exports"])


# ---------- Pydantic schemas ----------

class ExportModuleResponse(BaseModel):
    module: dict
    documents: list[dict]
    concepts: list[dict]
    flashcards: list[dict]
    quiz_questions: list[dict]
    exported_at: str


class ImportModuleResponse(BaseModel):
    module_id: str
    module_name: str
    documents_imported: int = 0
    concepts_imported: int = 0
    flashcards_imported: int = 0
    questions_imported: int = 0


# ---------- Helpers ----------

def _serialize_datetime(val: Optional[datetime]) -> Optional[str]:
    if val is None:
        return None
    return val.isoformat()


def _module_to_export_dict(db: Session, module: Module) -> dict:
    """Serialize entire module data for JSON export."""
    documents = db.query(Document).filter(Document.module_id == module.id).all()
    concepts = db.query(Concept).filter(Concept.module_id == module.id).all()
    flashcards = db.query(Flashcard).filter(Flashcard.module_id == module.id).all()
    questions = db.query(QuizQuestion).filter(QuizQuestion.module_id == module.id).all()

    return {
        "module": {
            "name": module.name,
            "description": module.description,
            "color": module.color,
        },
        "documents": [
            {
                "filename": d.filename,
                "file_type": d.file_type,
                "word_count": d.word_count,
                "raw_text": d.raw_text or "",
            }
            for d in documents
        ],
        "concepts": [
            {
                "name": c.name,
                "definition": c.definition,
                "explanation": c.explanation,
                "importance_score": c.importance_score,
            }
            for c in concepts
        ],
        "flashcards": [
            {
                "front": f.front,
                "back": f.back,
                "card_type": f.card_type,
                "cloze_text": f.cloze_text,
                "source_excerpt": f.source_excerpt,
                "tags": f.tags,
            }
            for f in flashcards
        ],
        "quiz_questions": [
            {
                "question_text": q.question_text,
                "question_type": q.question_type,
                "options": q.options,
                "correct_answer": q.correct_answer,
                "explanation": q.explanation,
                "difficulty": q.difficulty,
            }
            for q in questions
        ],
        "exported_at": datetime.utcnow().isoformat(),
    }


# ---------- Endpoints ----------

@router.get("/api/modules/{module_id}/export-anki")
def export_anki(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Generate .apkg file via genanki and return as file download."""
    import genanki

    query = db.query(Module).filter(Module.id == module_id)
    if user:
        query = query.filter(Module.user_id == user.id)
    module = query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    flashcards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
    if not flashcards:
        raise HTTPException(status_code=400, detail="No flashcards to export")

    # Create a deterministic model ID from module ID
    model_id = random.Random(module_id).randint(1 << 30, 1 << 31)
    deck_id = random.Random(module_id + "_deck").randint(1 << 30, 1 << 31)

    anki_model = genanki.Model(
        model_id,
        f"Revise OS - {module.name}",
        fields=[
            {"name": "Front"},
            {"name": "Back"},
        ],
        templates=[
            {
                "name": "Card 1",
                "qfmt": "{{Front}}",
                "afmt": '{{FrontSide}}<hr id="answer">{{Back}}',
            },
        ],
    )

    deck = genanki.Deck(deck_id, f"Revise OS::{module.name}")

    for card in flashcards:
        note = genanki.Note(
            model=anki_model,
            fields=[card.front, card.back],
        )
        deck.add_note(note)

    # Write to in-memory buffer
    buf = io.BytesIO()
    package = genanki.Package(deck)
    package.write_to_file(buf)
    buf.seek(0)

    safe_name = "".join(c for c in module.name if c.isalnum() or c in (" ", "-", "_")).strip()
    filename = f"{safe_name}.apkg"

    return StreamingResponse(
        buf,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/modules/{module_id}/export-json")
def export_json(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Dump all module data as JSON download."""
    query = db.query(Module).filter(Module.id == module_id)
    if user:
        query = query.filter(Module.user_id == user.id)
    module = query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    data = _module_to_export_dict(db, module)
    json_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
    buf = io.BytesIO(json_bytes)

    safe_name = "".join(c for c in module.name if c.isalnum() or c in (" ", "-", "_")).strip()
    filename = f"{safe_name}_export.json"

    return StreamingResponse(
        buf,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/api/modules/import-json", response_model=ImportModuleResponse)
def import_json(file: UploadFile = File(...), db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    """Import module from JSON file."""
    try:
        content = file.file.read()
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    if "module" not in data:
        raise HTTPException(status_code=400, detail="JSON missing 'module' key")

    mod_data = data["module"]
    module = Module(
        name=mod_data.get("name", "Imported Module"),
        description=mod_data.get("description", ""),
        color=mod_data.get("color", "#00b4d8"),
        user_id=user.id if user else None,
    )
    db.add(module)
    db.flush()

    # Import documents (metadata + text only, no files)
    docs_imported = 0
    doc_map: dict[int, str] = {}  # index -> new doc id for linking
    for i, d_data in enumerate(data.get("documents", [])):
        doc = Document(
            module_id=module.id,
            filename=d_data.get("filename", "imported_doc"),
            file_type=d_data.get("file_type", "TXT"),
            file_path="",
            raw_text=d_data.get("raw_text", ""),
            word_count=d_data.get("word_count", 0),
            processed=True,
            processing_status="done",
        )
        db.add(doc)
        db.flush()
        doc_map[i] = doc.id
        docs_imported += 1

    # Import concepts
    concepts_imported = 0
    concept_map: dict[int, str] = {}
    for i, c_data in enumerate(data.get("concepts", [])):
        concept = Concept(
            module_id=module.id,
            name=c_data.get("name", ""),
            definition=c_data.get("definition", ""),
            explanation=c_data.get("explanation", ""),
            importance_score=c_data.get("importance_score", 0.5),
        )
        db.add(concept)
        db.flush()
        concept_map[i] = concept.id
        concepts_imported += 1

    # Import flashcards
    flashcards_imported = 0
    for f_data in data.get("flashcards", []):
        tags = f_data.get("tags", "[]")
        if isinstance(tags, list):
            tags = json.dumps(tags)
        card = Flashcard(
            module_id=module.id,
            front=f_data.get("front", ""),
            back=f_data.get("back", ""),
            card_type=f_data.get("card_type", "BASIC"),
            cloze_text=f_data.get("cloze_text"),
            source_excerpt=f_data.get("source_excerpt"),
            tags=tags,
            due=datetime.utcnow(),
            state="NEW",
        )
        db.add(card)
        flashcards_imported += 1

    # Import quiz questions
    questions_imported = 0
    for q_data in data.get("quiz_questions", []):
        options = q_data.get("options")
        if isinstance(options, list):
            options = json.dumps(options)
        question = QuizQuestion(
            module_id=module.id,
            question_text=q_data.get("question_text", ""),
            question_type=q_data.get("question_type", "MCQ"),
            options=options,
            correct_answer=q_data.get("correct_answer", ""),
            explanation=q_data.get("explanation", ""),
            difficulty=q_data.get("difficulty", "MEDIUM"),
        )
        db.add(question)
        questions_imported += 1

    db.commit()

    return ImportModuleResponse(
        module_id=module.id,
        module_name=module.name,
        documents_imported=docs_imported,
        concepts_imported=concepts_imported,
        flashcards_imported=flashcards_imported,
        questions_imported=questions_imported,
    )
