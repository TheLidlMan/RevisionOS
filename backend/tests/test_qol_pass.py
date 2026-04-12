import json
import os
import shutil
import tempfile
import unittest
import uuid
import asyncio
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("JWT_SECRET", "revisionos-test-secret-key-000000")
os.environ.setdefault(
    "DATABASE_URL",
    f"sqlite:///{Path(tempfile.gettempdir()) / 'revisionos-qol-pass-tests.sqlite3'}",
)

from fastapi.testclient import TestClient

import main
from config import settings
from database import Base, SessionLocal, engine
from models.concept import Concept
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.quiz_question import QuizQuestion
from models.user import User
from services.auth_service import get_current_user

CURRENT_USER = None


async def _noop_async():
    return None


def _override_current_user():
    return CURRENT_USER


def _seed_user(email: str, display_name: str) -> User:
    return User(id=str(uuid.uuid4()), email=email, display_name=display_name, is_active=True)


class BalancedQolPassRouteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        main.ensure_document_retry_worker_started = _noop_async
        main.stop_document_retry_worker = _noop_async
        main.fastapi_app.dependency_overrides[get_current_user] = _override_current_user
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        main.fastapi_app.dependency_overrides.clear()
        cls.client.close()

    def setUp(self):
        global CURRENT_USER
        CURRENT_USER = None
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        self.upload_dir = tempfile.mkdtemp(prefix="revisionos-test-uploads-")
        settings.UPLOAD_DIR = self.upload_dir

        with SessionLocal() as db:
            self.owner = _seed_user("owner@example.com", "Owner")
            self.other_user = _seed_user("other@example.com", "Other")
            db.add_all([self.owner, self.other_user])
            self.owner_id = self.owner.id
            self.other_user_id = self.other_user.id

            self.owner_module = Module(id=str(uuid.uuid4()), user_id=self.owner.id, name="Owned", color="#123456")
            self.other_module = Module(id=str(uuid.uuid4()), user_id=self.other_user.id, name="Other", color="#654321")
            db.add_all([self.owner_module, self.other_module])
            self.owner_module_id = self.owner_module.id
            self.other_module_id = self.other_module.id

            db.add_all(
                [
                    Concept(
                        id=str(uuid.uuid4()),
                        user_id=self.owner.id,
                        module_id=self.owner_module.id,
                        name="Owned concept",
                        definition="Owned definition",
                    ),
                    Concept(
                        id=str(uuid.uuid4()),
                        user_id=self.other_user.id,
                        module_id=self.other_module.id,
                        name="Other concept",
                        definition="Other definition",
                    ),
                ]
            )

            self.owner_question = QuizQuestion(
                id=str(uuid.uuid4()),
                user_id=self.owner.id,
                module_id=self.owner_module.id,
                question_text="Owned question",
                question_type="MCQ",
                options='["A","B","C","D"]',
                correct_answer="A",
                explanation="Owned explanation",
                difficulty="MEDIUM",
            )
            self.other_question = QuizQuestion(
                id=str(uuid.uuid4()),
                user_id=self.other_user.id,
                module_id=self.other_module.id,
                question_text="Other question",
                question_type="MCQ",
                options='["A","B","C","D"]',
                correct_answer="B",
                explanation="Other explanation",
                difficulty="MEDIUM",
            )
            db.add_all([self.owner_question, self.other_question])
            self.owner_flashcard = Flashcard(
                id=str(uuid.uuid4()),
                user_id=self.owner.id,
                module_id=self.owner_module.id,
                front="Owned front",
                back="Owned back",
                tags='["tag-a", "tag-b"]',
                state="REVIEW",
                lapses=0,
                reps=2,
            )
            db.add(self.owner_flashcard)
            db.commit()
            self.owner_question_id = self.owner_question.id
            self.other_question_id = self.other_question.id
            self.owner_flashcard_id = self.owner_flashcard.id

    def tearDown(self):
        shutil.rmtree(self.upload_dir, ignore_errors=True)

    def _as_owner(self):
        global CURRENT_USER
        CURRENT_USER = type("AuthUser", (), {"id": self.owner_id})()

    def test_flashcard_create_uses_module_owner_and_rejects_foreign_module(self):
        self._as_owner()

        forbidden = self.client.post(
            "/api/flashcards",
            json={"module_id": self.other_module_id, "front": "Q", "back": "A"},
        )
        self.assertEqual(forbidden.status_code, 404)

        created = self.client.post(
            "/api/flashcards",
            json={"module_id": self.owner_module_id, "front": "Front", "back": "Back"},
        )
        self.assertEqual(created.status_code, 201)

        with SessionLocal() as db:
            from models.flashcard import Flashcard

            card = db.query(Flashcard).filter(Flashcard.module_id == self.owner_module_id).first()
            self.assertIsNotNone(card)
            self.assertEqual(card.user_id, self.owner_id)

    def test_quiz_session_rejects_foreign_question_ids(self):
        self._as_owner()

        response = self.client.post(
            "/api/quizzes/sessions",
            json={
                "module_id": self.owner_module_id,
                "session_type": "QUIZ",
                "question_ids": [self.owner_question_id, self.other_question_id],
            },
        )

        self.assertEqual(response.status_code, 404)

    def test_curriculum_requires_owned_module(self):
        self._as_owner()
        response = self.client.get(f"/api/modules/{self.other_module_id}/curriculum")
        self.assertEqual(response.status_code, 404)

    def test_integrations_require_owned_module(self):
        self._as_owner()
        response = self.client.post(
            "/api/integrations/notion/import",
            json={"notion_token": "token", "page_id": "page", "module_id": self.other_module_id},
        )
        self.assertEqual(response.status_code, 404)

    def test_weakness_map_rejects_foreign_module_filter(self):
        self._as_owner()
        response = self.client.get(f"/api/weakness-map?module_id={self.other_module_id}")
        self.assertEqual(response.status_code, 404)

    def test_free_recall_rejects_foreign_module(self):
        self._as_owner()
        response = self.client.post(
            f"/api/modules/{self.other_module_id}/free-recall",
            json={"topic": "Topic", "user_text": "Recall"},
        )
        self.assertEqual(response.status_code, 404)

    def test_import_folder_imports_text_files(self):
        self._as_owner()
        import_dir = tempfile.mkdtemp(prefix="revisionos-import-folder-")
        try:
            source_file = Path(import_dir) / "notes.txt"
            source_file.write_text("folder import regression coverage", encoding="utf-8")

            response = self.client.post(
                f"/api/documents/import-folder/{self.owner_module_id}",
                json={"path": import_dir},
            )
            self.assertEqual(response.status_code, 200)
            payload = response.json()
            self.assertEqual(payload["imported"], 1)
            self.assertEqual(payload["failed"], 0)

            with SessionLocal() as db:
                doc = db.query(Document).filter(Document.module_id == self.owner_module_id).one()
                self.assertEqual(doc.raw_text, "folder import regression coverage")
                self.assertEqual(doc.user_id, self.owner_id)
        finally:
            shutil.rmtree(import_dir, ignore_errors=True)

    def test_import_folder_accepts_legacy_folder_path_key(self):
        self._as_owner()
        import_dir = tempfile.mkdtemp(prefix="revisionos-import-folder-legacy-")
        try:
            source_file = Path(import_dir) / "legacy.txt"
            source_file.write_text("legacy folder path", encoding="utf-8")

            response = self.client.post(
                f"/api/documents/import-folder/{self.owner_module_id}",
                json={"folder_path": import_dir},
            )

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["imported"], 1)
        finally:
            shutil.rmtree(import_dir, ignore_errors=True)

    def test_export_anki_returns_apkg_download(self):
        self._as_owner()

        response = self.client.get(f"/api/modules/{self.owner_module_id}/export-anki")

        self.assertEqual(response.status_code, 200)
        self.assertIn("attachment; filename=", response.headers["content-disposition"])
        self.assertGreater(len(response.content), 0)

    def test_json_export_normalizes_arrays_and_import_accepts_legacy_strings(self):
        self._as_owner()

        export_response = self.client.get(f"/api/modules/{self.owner_module_id}/export-json")
        self.assertEqual(export_response.status_code, 200)
        exported = export_response.json()
        self.assertEqual(exported["flashcards"][0]["tags"], ["tag-a", "tag-b"])
        self.assertEqual(exported["quiz_questions"][0]["options"], ["A", "B", "C", "D"])

        legacy_payload = {
            "module": {"name": "Legacy Import", "description": "", "color": "#abcdef"},
            "documents": [],
            "concepts": [],
            "flashcards": [{"front": "Legacy front", "back": "Legacy back", "tags": '["legacy"]'}],
            "quiz_questions": [{
                "question_text": "Legacy question",
                "question_type": "MCQ",
                "options": '["X","Y"]',
                "correct_answer": "X",
                "explanation": "",
                "difficulty": "MEDIUM",
            }],
        }

        import_response = self.client.post(
            "/api/modules/import-json",
            files={"file": ("legacy.json", json.dumps(legacy_payload).encode("utf-8"), "application/json")},
        )
        self.assertEqual(import_response.status_code, 200)

        imported_module_id = import_response.json()["module_id"]
        with SessionLocal() as db:
            imported_card = db.query(Flashcard).filter(Flashcard.module_id == imported_module_id).one()
            imported_question = db.query(QuizQuestion).filter(QuizQuestion.module_id == imported_module_id).one()
            self.assertEqual(imported_card.tags, '["legacy"]')
            self.assertEqual(imported_question.options, '["X","Y"]')

    def test_upload_document_background_completion_uses_request_scoped_db_safely(self):
        self._as_owner()

        def fake_background(document_id: str, _module_id: str, _job_id: str) -> None:
            with SessionLocal() as db:
                doc = db.query(Document).filter(Document.id == document_id).one()
                doc.raw_text = "uploaded document"
                doc.word_count = 2
                doc.processed = True
                doc.processing_status = "done"
                doc.processing_stage = "completed"
                db.commit()

        with patch("routers.documents._run_document_pipeline_background", side_effect=fake_background):
            response = self.client.post(
                "/api/documents/upload",
                data={"module_id": self.owner_module_id},
                files={"file": ("upload.txt", b"uploaded document", "text/plain")},
            )

        self.assertEqual(response.status_code, 201)
        with SessionLocal() as db:
            doc = db.query(Document).filter(Document.module_id == self.owner_module_id).one()
            self.assertTrue(doc.processed)
            self.assertEqual(doc.processing_status, "done")

    def test_streaming_upload_emits_final_event(self):
        self._as_owner()

        async def fake_pipeline(document_id: str, _module_id: str, _job_id: str, event_handler=None) -> None:
            with SessionLocal() as db:
                doc = db.query(Document).filter(Document.id == document_id).one()
                doc.raw_text = "streamed upload"
                doc.word_count = 2
                doc.processed = True
                doc.processing_status = "done"
                doc.processing_stage = "completed"
                db.commit()
            if event_handler:
                event_handler({"event": "status", "stage": "processing"})
                event_handler({"event": "final", "stage": "done"})

        original_run_coroutine_threadsafe = asyncio.run_coroutine_threadsafe

        def blocking_run_coroutine_threadsafe(coro, loop):
            future = original_run_coroutine_threadsafe(coro, loop)
            future.result(timeout=1)
            return future

        with (
            patch("routers.documents.process_document_pipeline", new=fake_pipeline),
            patch("routers.documents.asyncio.run_coroutine_threadsafe", new=blocking_run_coroutine_threadsafe),
        ):
            response = self.client.post(
                "/api/documents/upload-stream",
                data={"module_id": self.owner_module_id},
                files={"file": ("stream.txt", b"streamed upload", "text/plain")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertIn('"event": "final"', response.text)
        self.assertIn('"processing_status": "done"', response.text)


if __name__ == "__main__":
    unittest.main()
