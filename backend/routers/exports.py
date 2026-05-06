import csv
import io
import json
import os
import random
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models.module import Module
from models.document import Document
from models.concept import Concept
from models.flashcard import Flashcard
from models.quiz_question import QuizQuestion
from typing import Optional as OptionalType
from services.auth_service import get_current_user
from services.auth_service import require_user
from models.user import User

router = APIRouter(tags=["exports"])
_EXPORT_BATCH_SIZE = 100


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


class CardImportPreviewResponse(BaseModel):
    columns: list[str]
    preview_rows: list[dict]
    total_rows: int
    suggested_mapping: dict[str, str | None]


class CardImportCommitResponse(BaseModel):
    imported: int
    skipped: int


# ---------- Helpers ----------



def _owned_module_or_404(db: Session, module_id: str, user: User) -> Module:
    module = db.query(Module).filter(Module.id == module_id, Module.user_id == user.id).first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module

def _serialize_datetime(val: Optional[datetime]) -> Optional[str]:
    if val is None:
        return None
    return val.isoformat()


def _normalize_tags(raw_tags) -> list[str]:
    if isinstance(raw_tags, str):
        raw_tags = [part.strip() for part in raw_tags.split(",")]
    if not isinstance(raw_tags, list):
        return []
    return sorted({str(tag).strip().lower() for tag in raw_tags if str(tag).strip()})


def _normalize_study_difficulty(value: Optional[str]) -> str:
    normalized = (value or "MEDIUM").strip().upper()
    if normalized not in {"EASY", "MEDIUM", "HARD"}:
        return "MEDIUM"
    return normalized


def _read_limited_upload(file: UploadFile, *, max_bytes: int) -> bytes:
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail="Import file exceeds the maximum allowed size")
    return content


def _validate_import_records(name: str, value: object) -> list[dict]:
    if value is None:
        return []
    if not isinstance(value, list):
        raise HTTPException(status_code=400, detail=f"Imported {name} must be an array")
    if len(value) > settings.MAX_IMPORT_RECORDS:
        raise HTTPException(status_code=400, detail=f"Imported {name} exceed the maximum allowed records")
    rows = [row for row in value if isinstance(row, dict)]
    if len(rows) != len(value):
        raise HTTPException(status_code=400, detail=f"Imported {name} contain invalid entries")
    return rows


def _parse_card_rows(filename: str, content: bytes) -> tuple[list[str], list[dict]]:
    ext = os.path.splitext(filename or "")[1].lower()
    if ext == ".json":
        payload = json.loads(content.decode("utf-8"))
        if isinstance(payload, dict):
            rows = payload.get("flashcards") or payload.get("cards") or []
        elif isinstance(payload, list):
            rows = payload
        else:
            raise ValueError("JSON must contain an array of cards")
        parsed_rows = [{str(key): value for key, value in row.items()} for row in rows if isinstance(row, dict)]
        columns = sorted({key for row in parsed_rows for key in row.keys()})
        return columns, parsed_rows

    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file must include a header row")
    rows = [dict(row) for row in reader]
    return [field for field in reader.fieldnames if field], rows


def _suggest_mapping(columns: list[str]) -> dict[str, str | None]:
    lower_map = {column.lower(): column for column in columns}

    def pick(*names: str) -> str | None:
        for name in names:
            if name in lower_map:
                return lower_map[name]
        return None

    return {
        "front": pick("front", "question", "prompt"),
        "back": pick("back", "answer", "response"),
        "tags": pick("tags", "tag"),
        "study_difficulty": pick("study_difficulty", "difficulty"),
        "is_bookmarked": pick("bookmarked", "is_bookmarked", "favorite", "favourite"),
    }


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


def _iter_json_array(query, serializer):
    yield "["
    first = True
    for item in query.yield_per(_EXPORT_BATCH_SIZE):
        if not first:
            yield ","
        yield json.dumps(serializer(item), ensure_ascii=False)
        first = False
    yield "]"


def _iter_module_export_json(db: Session, module: Module):
    yield '{"module":'
    yield json.dumps(
        {
            "name": module.name,
            "description": module.description,
            "color": module.color,
        },
        ensure_ascii=False,
    )
    yield ',"documents":'
    yield from _iter_json_array(
        db.query(Document).filter(Document.module_id == module.id),
        lambda d: {
            "filename": d.filename,
            "file_type": d.file_type,
            "word_count": d.word_count,
            "raw_text": d.raw_text or "",
        },
    )
    yield ',"concepts":'
    yield from _iter_json_array(
        db.query(Concept).filter(Concept.module_id == module.id),
        lambda c: {
            "name": c.name,
            "definition": c.definition,
            "explanation": c.explanation,
            "importance_score": c.importance_score,
        },
    )
    yield ',"flashcards":'
    yield from _iter_json_array(
        db.query(Flashcard).filter(Flashcard.module_id == module.id),
        lambda f: {
            "front": f.front,
            "back": f.back,
            "card_type": f.card_type,
            "cloze_text": f.cloze_text,
            "source_excerpt": f.source_excerpt,
            "tags": f.tags,
        },
    )
    yield ',"quiz_questions":'
    yield from _iter_json_array(
        db.query(QuizQuestion).filter(QuizQuestion.module_id == module.id),
        lambda q: {
            "question_text": q.question_text,
            "question_type": q.question_type,
            "options": q.options,
            "correct_answer": q.correct_answer,
            "explanation": q.explanation,
            "difficulty": q.difficulty,
        },
    )
    yield ',"exported_at":'
    yield json.dumps(datetime.utcnow().isoformat(), ensure_ascii=False)
    yield "}"


# ---------- Endpoints ----------

@router.get("/api/modules/{module_id}/export-anki")
def export_anki(module_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    """Generate .apkg file via genanki and return as file download."""
    import genanki

    module = _owned_module_or_404(db, module_id, user)

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
def export_json(module_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    """Dump all module data as JSON download."""
    module = _owned_module_or_404(db, module_id, user)

    safe_name = "".join(c for c in module.name if c.isalnum() or c in (" ", "-", "_")).strip()
    filename = f"{safe_name}_export.json"

    return StreamingResponse(
        _iter_module_export_json(db, module),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/api/modules/{module_id}/export-cards-json")
def export_cards_json(module_id: str, db: Session = Depends(get_db), user: User = Depends(require_user)):
    module = _owned_module_or_404(db, module_id, user)

    flashcards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
    payload = {
        "module": {"id": module.id, "name": module.name},
        "cards": [
            {
                "front": card.front,
                "back": card.back,
                "tags": json.loads(card.tags or "[]"),
                "study_difficulty": getattr(card, "study_difficulty", "MEDIUM"),
                "bookmarked": bool(getattr(card, "is_bookmarked", False)),
                "due": _serialize_datetime(card.due),
            }
            for card in flashcards
        ],
    }
    safe_name = "".join(c for c in module.name if c.isalnum() or c in (" ", "-", "_")).strip()
    json_bytes = json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(json_bytes),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_cards.json"'},
    )


@router.get("/api/modules/{module_id}/export-cards-csv")
def export_cards_csv(module_id: str, db: Session = Depends(get_db), user: OptionalType[User] = Depends(get_current_user)):
    query = db.query(Module).filter(Module.id == module_id)
    if user:
        query = query.filter(Module.user_id == user.id)
    module = query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    flashcards = db.query(Flashcard).filter(Flashcard.module_id == module_id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["front", "back", "tags", "study_difficulty", "bookmarked", "due"])
    for card in flashcards:
        writer.writerow([
            card.front,
            card.back,
            ",".join(json.loads(card.tags or "[]")),
            getattr(card, "study_difficulty", "MEDIUM"),
            "true" if bool(getattr(card, "is_bookmarked", False)) else "false",
            _serialize_datetime(card.due) or "",
        ])

    safe_name = "".join(c for c in module.name if c.isalnum() or c in (" ", "-", "_")).strip()
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_cards.csv"'},
    )


@router.post("/api/modules/{module_id}/import-cards/preview", response_model=CardImportPreviewResponse)
def preview_card_import(
    module_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module_query = db.query(Module).filter(Module.id == module_id)
    if user:
        module_query = module_query.filter(Module.user_id == user.id)
    if not module_query.first():
        raise HTTPException(status_code=404, detail="Module not found")

    try:
        content = file.file.read()
        columns, rows = _parse_card_rows(file.filename or "cards.csv", content)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid import file: {exc}")

    return CardImportPreviewResponse(
        columns=columns,
        preview_rows=rows[:10],
        total_rows=len(rows),
        suggested_mapping=_suggest_mapping(columns),
    )


@router.post("/api/modules/{module_id}/import-cards", response_model=CardImportCommitResponse)
def import_cards(
    module_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(...),
    db: Session = Depends(get_db),
    user: OptionalType[User] = Depends(get_current_user),
):
    module_query = db.query(Module).filter(Module.id == module_id)
    if user:
        module_query = module_query.filter(Module.user_id == user.id)
    module = module_query.first()
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")

    try:
        mapping_data = json.loads(mapping)
        if not isinstance(mapping_data, dict):
            raise ValueError("mapping must be an object")
        content = file.file.read()
        _columns, rows = _parse_card_rows(file.filename or "cards.csv", content)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid import file: {exc}")

    imported = 0
    skipped = 0
    for row in rows:
        front_column = mapping_data.get("front")
        back_column = mapping_data.get("back")
        if not front_column or not back_column:
            raise HTTPException(status_code=400, detail="front and back mapping are required")

        mapped_front = str(row.get(front_column, "")).strip()
        mapped_back = str(row.get(back_column, "")).strip()
        if not mapped_front or not mapped_back:
            skipped += 1
            continue

        tags_value = row.get(mapping_data.get("tags", ""), [])
        bookmark_value = str(row.get(mapping_data.get("is_bookmarked", ""), "")).strip().lower()
        flashcard = Flashcard(
            user_id=module.user_id,
            module_id=module.id,
            front=mapped_front,
            back=mapped_back,
            card_type="BASIC",
            tags=json.dumps(_normalize_tags(tags_value)),
            due=datetime.utcnow(),
            state="NEW",
            study_difficulty=_normalize_study_difficulty(str(row.get(mapping_data.get("study_difficulty", ""), ""))),
            is_bookmarked=bookmark_value in {"1", "true", "yes", "y"},
        )
        db.add(flashcard)
        imported += 1

    db.commit()
    return CardImportCommitResponse(imported=imported, skipped=skipped)


@router.post("/api/modules/import-json", response_model=ImportModuleResponse)
def import_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_user),
):
    """Import module from JSON file."""
    try:
        content = _read_limited_upload(file, max_bytes=settings.MAX_IMPORT_JSON_BYTES)
        data = json.loads(content.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    if not isinstance(data, dict) or "module" not in data:
        raise HTTPException(status_code=400, detail="JSON missing 'module' key")

    mod_data = data["module"]
    if not isinstance(mod_data, dict):
        raise HTTPException(status_code=400, detail="Imported module metadata is invalid")
    module_name = str(mod_data.get("name", "Imported Module")).strip()[:255] or "Imported Module"
    module = Module(
        name=module_name,
        description=str(mod_data.get("description", ""))[:2000],
        color=str(mod_data.get("color", "#00b4d8"))[:32] or "#00b4d8",
        user_id=user.id,
    )
    db.add(module)
    db.flush()

    # Import documents (metadata + text only, no files)
    docs_imported = 0
    doc_map: dict[int, str] = {}  # index -> new doc id for linking
    for i, d_data in enumerate(_validate_import_records("documents", data.get("documents"))):
        doc = Document(
            user_id=module.user_id,
            module_id=module.id,
            filename=str(d_data.get("filename", "imported_doc"))[:255] or "imported_doc",
            file_type=str(d_data.get("file_type", "TXT"))[:20] or "TXT",
            file_path="",
            raw_text=str(d_data.get("raw_text", ""))[: settings.MAX_PROMPT_CHARS],
            word_count=max(0, int(d_data.get("word_count", 0) or 0)),
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
    for i, c_data in enumerate(_validate_import_records("concepts", data.get("concepts"))):
        concept = Concept(
            user_id=module.user_id,
            module_id=module.id,
            name=str(c_data.get("name", ""))[:255],
            definition=str(c_data.get("definition", ""))[:4000],
            explanation=str(c_data.get("explanation", ""))[:12000],
            importance_score=float(c_data.get("importance_score", 0.5) or 0.5),
        )
        db.add(concept)
        db.flush()
        concept_map[i] = concept.id
        concepts_imported += 1

    # Import flashcards
    flashcards_imported = 0
    for f_data in _validate_import_records("flashcards", data.get("flashcards")):
        tags = f_data.get("tags", "[]")
        cloze_text = f_data.get("cloze_text")
        source_excerpt = f_data.get("source_excerpt")
        if isinstance(tags, str):
            try:
                parsed_tags = json.loads(tags) if tags.startswith("[") else tags
            except json.JSONDecodeError:
                parsed_tags = tags
        else:
            parsed_tags = tags
        card = Flashcard(
            user_id=module.user_id,
            module_id=module.id,
            front=str(f_data.get("front", ""))[:4000],
            back=str(f_data.get("back", ""))[:12000],
            card_type=str(f_data.get("card_type", "BASIC"))[:20] or "BASIC",
            cloze_text=str(cloze_text)[:12000] if cloze_text is not None else None,
            source_excerpt=str(source_excerpt)[:2000] if source_excerpt is not None else None,
            tags=json.dumps(_normalize_tags(parsed_tags)),
            due=datetime.utcnow(),
            state="NEW",
            study_difficulty=_normalize_study_difficulty(f_data.get("study_difficulty")),
            is_bookmarked=bool(f_data.get("bookmarked") or f_data.get("is_bookmarked")),
        )
        db.add(card)
        flashcards_imported += 1

    # Import quiz questions
    questions_imported = 0
    for q_data in _validate_import_records("quiz_questions", data.get("quiz_questions")):
        options = q_data.get("options")
        if isinstance(options, list):
            options = json.dumps(options)
        question = QuizQuestion(
            user_id=module.user_id,
            module_id=module.id,
            question_text=str(q_data.get("question_text", ""))[:4000],
            question_type=str(q_data.get("question_type", "MCQ"))[:20] or "MCQ",
            options=options,
            correct_answer=str(q_data.get("correct_answer", ""))[:2000],
            explanation=str(q_data.get("explanation", ""))[:4000],
            difficulty=str(q_data.get("difficulty", "MEDIUM"))[:20] or "MEDIUM",
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
