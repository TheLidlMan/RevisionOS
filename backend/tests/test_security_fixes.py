import json
import os
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
import asyncio
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault("DATABASE_URL", f"sqlite:///{Path(tempfile.gettempdir()) / 'revisionos-security-tests.db'}")
os.environ.setdefault("JWT_SECRET", "RevisionOS_TestSecret_123!Secure")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-client")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-secret")

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient

import cache
import database
from database import SessionLocal, create_tables
from main import app, fastapi_app
from models.concept import Concept
from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.quiz_question import QuizQuestion
from models.quiz_session import StudySession
from models.review_log import ReviewLog
from models.user import User
from models.user_stats import UserStats
from routers import auth as auth_router
from routers import collaboration, settings as settings_router
from services.ai_request_lock_service import serialized_ai_request
from services.auth_service import (
    SESSION_COOKIE_NAME,
    _get_secret_key,
    create_access_token,
    create_session,
    get_user_from_session_token,
    validate_return_to,
)
from services.security import reset_rate_limits
from config import settings

fastapi_app.router.on_startup.clear()
fastapi_app.router.on_shutdown.clear()


class SecurityFixesTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = Path(tempfile.mkdtemp(prefix="revisionos-security-"))
        cls.settings_file = cls.test_dir / "settings.json"
        settings_router.SETTINGS_FILE = cls.settings_file
        import config
        config.SETTINGS_FILE = cls.settings_file

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.test_dir, ignore_errors=True)

    def setUp(self):
        collaboration._rooms.clear()
        collaboration._connections.clear()
        auth_router._oauth_states.clear()
        reset_rate_limits()
        cache._store.clear()
        settings.GROQ_API_KEY = ""
        if self.settings_file.exists():
            self.settings_file.unlink()
        database.Base.metadata.drop_all(bind=database.engine)
        create_tables()
        self.client = TestClient(app)
        self.client.headers.update({
            "Origin": settings.PUBLIC_APP_URL,
            "Referer": f"{settings.PUBLIC_APP_URL}/dashboard",
        })

    def tearDown(self):
        self.client.close()

    def _create_user(self, email: str, display_name: str = "User Name"):
        with SessionLocal() as db:
            user = User(email=email, display_name=display_name)
            db.add(user)
            db.commit()
            db.refresh(user)
            token = create_session(db, user)
            return user.id, token

    def _create_module_with_question(self, user_id: str):
        with SessionLocal() as db:
            module = Module(user_id=user_id, name="Biology")
            db.add(module)
            db.flush()
            db.add(
                QuizQuestion(
                    user_id=user_id,
                    module_id=module.id,
                    question_text="Q",
                    question_type="MCQ",
                    options=json.dumps(["A", "B"]),
                    correct_answer="A",
                )
            )
            db.commit()
            return module.id

    def _create_module_with_document(self, user_id: str):
        with SessionLocal() as db:
            module = Module(user_id=user_id, name="History")
            db.add(module)
            db.flush()
            document = Document(
                user_id=user_id,
                module_id=module.id,
                filename="notes.txt",
                file_type="TXT",
                file_path="/tmp/private/notes.txt",
                raw_text="Important notes",
                processed=True,
                processing_status="done",
                word_count=2,
            )
            db.add(document)
            db.commit()
            return module.id, document.id

    def _create_module_with_flashcard(self, user_id: str):
        with SessionLocal() as db:
            module = Module(user_id=user_id, name="Physics")
            db.add(module)
            db.flush()
            card = Flashcard(
                user_id=user_id,
                module_id=module.id,
                front="Question",
                back="Answer",
                card_type="BASIC",
                state="NEW",
            )
            db.add(card)
            db.commit()
            db.refresh(card)
            return module.id, card.id

    def _create_module_with_due_flashcards(self, user_id: str):
        with SessionLocal() as db:
            module = Module(user_id=user_id, name="Chemistry")
            db.add(module)
            db.flush()
            due_now = datetime.utcnow() - timedelta(minutes=5)
            cards = [
                Flashcard(
                    user_id=user_id,
                    module_id=module.id,
                    front="Q1",
                    back="A1",
                    card_type="BASIC",
                    state="NEW",
                    due=due_now,
                ),
                Flashcard(
                    user_id=user_id,
                    module_id=module.id,
                    front="Q2",
                    back="A2",
                    card_type="BASIC",
                    state="NEW",
                    due=due_now,
                ),
            ]
            db.add_all(cards)
            db.commit()
            return module.id, [card.id for card in cards]

    def test_gamification_achievements_include_progress_metadata(self):
        user_id, token = self._create_user("gamification@example.com")

        with SessionLocal() as db:
            module = Module(user_id=user_id, name="Biology", study_plan_json='{"weeks":[]}')
            db.add(module)
            db.flush()
            db.add(Document(
                user_id=user_id,
                module_id=module.id,
                filename="notes.txt",
                file_type="TXT",
                file_path="/tmp/private/notes.txt",
                raw_text="Important notes",
                processed=True,
                processing_status="done",
                word_count=2,
            ))
            db.add(Concept(module_id=module.id, name="Cells", definition="Basic unit of life"))
            db.add(Flashcard(
                user_id=user_id,
                module_id=module.id,
                front="Q",
                back="A",
                card_type="BASIC",
                state="REVIEW",
            ))
            db.add(UserStats(
                user_id=user_id,
                streak_current=4,
                streak_longest=4,
                xp_total=250,
                level=2,
                total_cards_reviewed=42,
                total_quizzes_completed=3,
                total_perfect_quizzes=1,
            ))
            db.commit()

        response = self.client.get(
            "/api/gamification/achievements",
            cookies={SESSION_COOKIE_NAME: token},
        )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        first_card = next(item for item in payload if item["achievement_key"] == "first_card")
        streak = next(item for item in payload if item["achievement_key"] == "streak_7")
        planner = next(item for item in payload if item["achievement_key"] == "curriculum")

        self.assertEqual(first_card["category"], "review")
        self.assertEqual(first_card["progress_current"], 42)
        self.assertEqual(first_card["progress_target"], 1)
        self.assertGreaterEqual(first_card["progress_pct"], 100)
        self.assertEqual(streak["progress_current"], 4)
        self.assertEqual(streak["progress_target"], 7)
        self.assertEqual(planner["progress_current"], 1)
        self.assertEqual(planner["category"], "planning")

    def test_profile_update_rejects_blank_display_name(self):
        _, token = self._create_user("profile@example.com")
        response = self.client.patch(
            "/api/auth/me",
            cookies={SESSION_COOKIE_NAME: token},
            json={"display_name": "   "},
        )
        self.assertEqual(response.status_code, 422)

    def test_settings_endpoints_require_authentication(self):
        get_response = self.client.get("/api/settings")
        patch_response = self.client.patch("/api/settings", json={"theme": "light"})
        self.assertEqual(get_response.status_code, 401)
        self.assertEqual(patch_response.status_code, 401)

    def test_validate_api_key_requires_authentication(self):
        response = self.client.post("/api/settings/validate-api-key", json={"api_key": "test"})
        self.assertEqual(response.status_code, 401)

    def test_validate_api_key_is_rate_limited(self):
        _, token = self._create_user("settings@example.com")

        async def fake_validate_api_key(_: str) -> bool:
            return False

        with patch("routers.settings.validate_api_key", side_effect=fake_validate_api_key):
            for _ in range(5):
                response = self.client.post(
                    "/api/settings/validate-api-key",
                    cookies={SESSION_COOKIE_NAME: token},
                    json={"api_key": "test"},
                )
                self.assertEqual(response.status_code, 200)

            limited = self.client.post(
                "/api/settings/validate-api-key",
                cookies={SESSION_COOKIE_NAME: token},
                json={"api_key": "test"},
            )

        self.assertEqual(limited.status_code, 429)

    def test_google_start_is_rate_limited(self):
        for _ in range(10):
            response = self.client.get("/api/auth/google/start")
            self.assertEqual(response.status_code, 200)

        limited = self.client.get("/api/auth/google/start")
        self.assertEqual(limited.status_code, 429)

    def test_google_callback_is_rate_limited(self):
        for _ in range(10):
            response = self.client.get("/api/auth/google/callback", allow_redirects=False)
            self.assertEqual(response.status_code, 302)

        limited = self.client.get("/api/auth/google/callback", allow_redirects=False)
        self.assertEqual(limited.status_code, 429)

    def test_quiz_status_requires_module_ownership(self):
        owner_id, owner_token = self._create_user("owner@example.com")
        _, attacker_token = self._create_user("attacker@example.com")
        module_id = self._create_module_with_question(owner_id)

        anonymous = self.client.get(f"/api/modules/{module_id}/quiz-status")
        attacker = self.client.get(
            f"/api/modules/{module_id}/quiz-status",
            cookies={SESSION_COOKIE_NAME: attacker_token},
        )
        owner = self.client.get(
            f"/api/modules/{module_id}/quiz-status",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.json()["question_count"], 1)

    def test_collaboration_room_endpoints_require_membership(self):
        owner_id, owner_token = self._create_user("collab-owner@example.com", "Owner")
        _, outsider_token = self._create_user("collab-outsider@example.com", "Outsider")
        module_id = self._create_module_with_question(owner_id)

        created = self.client.post(
            "/api/collab/rooms",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"module_id": module_id, "name": "Private room", "room_type": "study"},
        )
        room_id = created.json()["id"]

        anonymous = self.client.get("/api/collab/rooms")
        outsider_list = self.client.get("/api/collab/rooms", cookies={SESSION_COOKIE_NAME: outsider_token})
        outsider_room = self.client.get(f"/api/collab/rooms/{room_id}", cookies={SESSION_COOKIE_NAME: outsider_token})
        owner_room = self.client.get(f"/api/collab/rooms/{room_id}", cookies={SESSION_COOKIE_NAME: owner_token})

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(outsider_list.status_code, 200)
        self.assertEqual(outsider_list.json(), [])
        self.assertEqual(outsider_room.status_code, 404)
        self.assertEqual(owner_room.status_code, 200)

    def test_collaboration_websocket_requires_authenticated_member(self):
        owner_id, owner_token = self._create_user("socket-owner@example.com", "Owner")
        _, outsider_token = self._create_user("socket-outsider@example.com", "Outsider")
        module_id = self._create_module_with_question(owner_id)

        created = self.client.post(
            "/api/collab/rooms",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"module_id": module_id, "name": "Socket room", "room_type": "study"},
        )
        room_id = created.json()["id"]

        with self.assertRaises(Exception):
            with self.client.websocket_connect(f"/api/collab/rooms/{room_id}/ws") as websocket:
                websocket.receive_json()

        with self.assertRaises(Exception):
            with self.client.websocket_connect(
                f"/api/collab/rooms/{room_id}/ws",
                headers={"cookie": f"{SESSION_COOKIE_NAME}={outsider_token}"},
            ) as websocket:
                websocket.receive_json()

        with self.client.websocket_connect(
            f"/api/collab/rooms/{room_id}/ws",
            headers={"cookie": f"{SESSION_COOKIE_NAME}={owner_token}"},
        ) as websocket:
            room_state = websocket.receive_json()
            self.assertEqual(room_state["type"], "room_state")
            websocket.send_json({"type": "join", "user": {"user_id": "spoofed", "display_name": "Spoofed"}})
            joined = websocket.receive_json()
            self.assertEqual(joined["data"]["user_id"], owner_id)
            self.assertEqual(joined["data"]["display_name"], "Owner")

    def test_settings_update_rejects_global_api_key_changes(self):
        _, token = self._create_user("persist@example.com")
        response = self.client.patch(
            "/api/settings",
            cookies={SESSION_COOKIE_NAME: token},
            json={"groq_api_key": "gsk_live_secret_value_12345678", "theme": "light"},
        )

        self.assertEqual(response.status_code, 403)

    def test_validate_return_to_rejects_prefix_smuggling(self):
        valid_url = "https://app.reviseos.co.uk/modules/123"
        malicious_url = "https://app.reviseos.co.uk.evil.example/modules/123"
        self.assertEqual(validate_return_to(valid_url), valid_url)
        self.assertIsNone(validate_return_to(malicious_url))

    def test_weak_jwt_secret_is_rejected(self):
        original_secret = settings.JWT_SECRET
        settings.JWT_SECRET = "a" * 32
        try:
            with self.assertRaises(RuntimeError):
                _get_secret_key()
        finally:
            settings.JWT_SECRET = original_secret

    def test_security_headers_are_set(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.headers["x-frame-options"], "DENY")
        self.assertEqual(response.headers["x-content-type-options"], "nosniff")
        self.assertIn("default-src 'self'", response.headers["content-security-policy"])

    def test_cors_preflight_uses_explicit_allowlists(self):
        response = self.client.options(
            "/api/health",
            headers={
                "Origin": "https://app.reviseos.co.uk",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "authorization,content-type",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(response.headers["access-control-allow-methods"], "*")
        self.assertNotEqual(response.headers["access-control-allow-headers"], "*")

    def test_integration_imports_require_owned_module(self):
        owner_id, _owner_token = self._create_user("integration-owner@example.com")
        _, attacker_token = self._create_user("integration-attacker@example.com")
        module_id = self._create_module_with_question(owner_id)

        anonymous = self.client.post(
            "/api/integrations/notion/import",
            json={"notion_token": "token", "page_id": "page", "module_id": module_id},
        )
        attacker = self.client.post(
            "/api/integrations/google-drive/import",
            cookies={SESSION_COOKIE_NAME: attacker_token},
            json={"access_token": "token", "file_id": "file", "module_id": module_id},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)

    def test_document_index_requires_document_owner(self):
        owner_id, owner_token = self._create_user("docs-owner@example.com")
        _, attacker_token = self._create_user("docs-attacker@example.com")
        _, document_id = self._create_module_with_document(owner_id)

        anonymous = self.client.post(f"/api/documents/{document_id}/index")
        attacker = self.client.post(
            f"/api/documents/{document_id}/index",
            cookies={SESSION_COOKIE_NAME: attacker_token},
        )
        owner = self.client.post(
            f"/api/documents/{document_id}/index",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertNotEqual(owner.status_code, 401)

    def test_batch_review_requires_flashcard_owner(self):
        owner_id, owner_token = self._create_user("card-owner@example.com")
        _, attacker_token = self._create_user("card-attacker@example.com")
        _, card_id = self._create_module_with_flashcard(owner_id)

        anonymous = self.client.post(
            "/api/flashcards/review/batch",
            json=[{"id": card_id, "rating": "GOOD"}],
        )
        attacker = self.client.post(
            "/api/flashcards/review/batch",
            cookies={SESSION_COOKIE_NAME: attacker_token},
            json=[{"id": card_id, "rating": "GOOD"}],
        )
        owner = self.client.post(
            "/api/flashcards/review/batch",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json=[{"id": card_id, "rating": "GOOD"}],
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(owner.json()["reviewed"], 1)

    def test_quiz_session_creation_requires_owned_questions(self):
        owner_id, owner_token = self._create_user("quiz-owner@example.com")
        _, attacker_token = self._create_user("quiz-attacker@example.com")
        module_id = self._create_module_with_question(owner_id)
        with SessionLocal() as db:
            question_id = db.query(QuizQuestion.id).filter(QuizQuestion.module_id == module_id).scalar()

        anonymous = self.client.post(
            "/api/quizzes/sessions",
            json={"question_ids": [question_id]},
        )
        attacker = self.client.post(
            "/api/quizzes/sessions",
            cookies={SESSION_COOKIE_NAME: attacker_token},
            json={"question_ids": [question_id]},
        )
        owner = self.client.post(
            "/api/quizzes/sessions",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"question_ids": [question_id]},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertEqual(owner.status_code, 200)
        self.assertEqual(len(owner.json()["questions"]), 1)

    def test_folder_import_requires_safe_root_and_owned_module(self):
        owner_id, owner_token = self._create_user("folder-owner@example.com")
        _, attacker_token = self._create_user("folder-attacker@example.com")
        module_id = self._create_module_with_question(owner_id)

        safe_dir = Path(settings.FOLDER_IMPORT_ROOT)
        safe_dir.mkdir(parents=True, exist_ok=True)
        external_dir = self.test_dir / "outside-import-root"
        external_dir.mkdir(parents=True, exist_ok=True)

        anonymous = self.client.post(
            f"/api/documents/import-folder/{module_id}",
            json={"path": str(safe_dir)},
        )
        attacker = self.client.post(
            f"/api/documents/import-folder/{module_id}",
            cookies={SESSION_COOKIE_NAME: attacker_token},
            json={"path": str(safe_dir)},
        )
        owner = self.client.post(
            f"/api/documents/import-folder/{module_id}",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"path": str(external_dir)},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertEqual(owner.status_code, 403)

    def test_document_responses_hide_internal_file_paths(self):
        owner_id, owner_token = self._create_user("response-owner@example.com")
        module_id, document_id = self._create_module_with_document(owner_id)

        document_response = self.client.get(
            f"/api/documents/{document_id}",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )
        module_response = self.client.get(
            f"/api/modules/{module_id}",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )

        self.assertEqual(document_response.status_code, 200)
        self.assertEqual(module_response.status_code, 200)
        self.assertNotIn("file_path", document_response.json())
        self.assertNotIn("file_path", module_response.json()["documents"][0])

    def test_due_flashcard_batch_review_rewarms_due_cache(self):
        owner_id, owner_token = self._create_user("due-owner@example.com")
        module_id, card_ids = self._create_module_with_due_flashcards(owner_id)

        due_response = self.client.get(
            "/api/flashcards",
            cookies={SESSION_COOKIE_NAME: owner_token},
            params={"module_id": module_id, "due": "true", "limit": 1000},
        )
        self.assertEqual(due_response.status_code, 200)

        expected_cache_key = f"cache:flashcards:{owner_id}:due:{module_id}:limit:1000"
        self.assertIn(expected_cache_key, cache._store)

        review_response = self.client.post(
            "/api/flashcards/review/batch",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json=[{"id": card_ids[0], "rating": "GOOD"}],
        )
        self.assertEqual(review_response.status_code, 200)
        self.assertIn(expected_cache_key, cache._store)

    def test_export_json_streams_complete_module_payload(self):
        owner_id, owner_token = self._create_user("export-owner@example.com")
        module_id, _document_id = self._create_module_with_document(owner_id)
        with SessionLocal() as db:
            module = db.query(Module).filter(Module.id == module_id).first()
            db.add(
                Flashcard(
                    user_id=owner_id,
                    module_id=module_id,
                    front="Front",
                    back="Back",
                    card_type="BASIC",
                    tags=json.dumps(["tag-one"]),
                )
            )
            db.add(
                QuizQuestion(
                    user_id=owner_id,
                    module_id=module_id,
                    question_text="Question",
                    question_type="MCQ",
                    correct_answer="Answer",
                )
            )
            db.commit()
            self.assertIsNotNone(module)

        response = self.client.get(
            f"/api/modules/{module_id}/export-json",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["module"]["name"], "History")
        self.assertEqual(len(payload["documents"]), 1)
        self.assertEqual(len(payload["flashcards"]), 1)
        self.assertEqual(len(payload["quiz_questions"]), 1)
        self.assertIn("exported_at", payload)

    def test_leaderboard_returns_ranked_entries_and_your_rank(self):
        top_user_id, _ = self._create_user("leaderboard-top@example.com", "Top User")
        current_user_id, current_token = self._create_user("leaderboard-current@example.com", "Current User")

        with SessionLocal() as db:
            top_session = StudySession(user_id=top_user_id, session_type="FLASHCARDS", started_at=datetime.utcnow())
            current_session = StudySession(user_id=current_user_id, session_type="FLASHCARDS", started_at=datetime.utcnow())
            db.add_all([top_session, current_session])
            db.flush()
            db.add_all(
                [
                    ReviewLog(
                        user_id=top_user_id,
                        session_id=top_session.id,
                        item_id="top-1",
                        item_type="FLASHCARD",
                        rating="GOOD",
                        answered_at=datetime.utcnow(),
                    ),
                    ReviewLog(
                        user_id=top_user_id,
                        session_id=top_session.id,
                        item_id="top-2",
                        item_type="FLASHCARD",
                        rating="GOOD",
                        answered_at=datetime.utcnow(),
                    ),
                    ReviewLog(
                        user_id=current_user_id,
                        session_id=current_session.id,
                        item_id="current-1",
                        item_type="FLASHCARD",
                        rating="GOOD",
                        answered_at=datetime.utcnow(),
                    ),
                ]
            )
            db.commit()

        response = self.client.get(
            "/api/social/leaderboard",
            cookies={SESSION_COOKIE_NAME: current_token},
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["entries"][0]["user_id"], top_user_id)
        self.assertEqual(payload["entries"][0]["rank"], 1)
        self.assertEqual(payload["your_rank"], 2)

    def test_csrf_protection_blocks_cookie_authenticated_state_change_without_origin(self):
        _, token = self._create_user("csrf@example.com")
        with TestClient(app) as client:
            response = client.patch(
                "/api/settings",
                cookies={SESSION_COOKIE_NAME: token},
                json={"theme": "light"},
            )
        self.assertEqual(response.status_code, 403)

    def test_google_callback_requires_matching_oauth_state_cookie(self):
        started = self.client.get("/api/auth/google/start")
        self.assertEqual(started.status_code, 200)
        state = next(iter(auth_router._oauth_states.keys()))
        self.client.cookies.set(auth_router.OAUTH_STATE_COOKIE_NAME, "wrong-state")

        callback = self.client.get(
            f"/api/auth/google/callback?code=test-code&state={state}",
            allow_redirects=False,
        )

        self.assertEqual(callback.status_code, 302)
        self.assertIn("error=invalid_state", callback.headers["location"])

    def test_create_session_invalidates_previous_session_token(self):
        user_id, old_token = self._create_user("session@example.com")
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == user_id).first()
            new_token = create_session(db, user)
            self.assertIsNone(get_user_from_session_token(db, old_token))
            self.assertIsNotNone(get_user_from_session_token(db, new_token))

    def test_invalid_bearer_sub_claim_is_rejected(self):
        token = create_access_token({"sub": 123})
        response = self.client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(response.status_code, 401)

    def test_content_map_requires_owned_module(self):
        owner_id, owner_token = self._create_user("map-owner@example.com")
        _, attacker_token = self._create_user("map-attacker@example.com")
        module_id, _document_id = self._create_module_with_document(owner_id)

        anonymous = self.client.get(f"/api/concepts/content-map/{module_id}")
        attacker = self.client.get(
            f"/api/concepts/content-map/{module_id}",
            cookies={SESSION_COOKIE_NAME: attacker_token},
        )
        owner = self.client.get(
            f"/api/concepts/content-map/{module_id}",
            cookies={SESSION_COOKIE_NAME: owner_token},
        )

        self.assertEqual(anonymous.status_code, 401)
        self.assertEqual(attacker.status_code, 404)
        self.assertEqual(owner.status_code, 200)

    def test_create_collaboration_room_requires_owned_module(self):
        owner_id, owner_token = self._create_user("collab-module-owner@example.com")
        _, attacker_token = self._create_user("collab-module-attacker@example.com")
        module_id = self._create_module_with_question(owner_id)

        response = self.client.post(
            "/api/collab/rooms",
            cookies={SESSION_COOKIE_NAME: attacker_token},
            json={"module_id": module_id, "name": "Private room", "room_type": "study"},
        )

        self.assertEqual(response.status_code, 404)

    def test_quiz_list_hides_correct_answers(self):
        owner_id, owner_token = self._create_user("quiz-list@example.com")
        module_id = self._create_module_with_question(owner_id)

        response = self.client.get(
            "/api/questions",
            cookies={SESSION_COOKIE_NAME: owner_token},
            params={"module_id": module_id},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertNotIn("correct_answer", response.json()[0])

    def test_keyword_search_escapes_sql_wildcards(self):
        owner_id, owner_token = self._create_user("search-owner@example.com")
        with SessionLocal() as db:
            module = Module(user_id=owner_id, name="Search")
            db.add(module)
            db.flush()
            db.add(Flashcard(user_id=owner_id, module_id=module.id, front="Alpha", back="Beta", card_type="BASIC", state="NEW"))
            db.commit()

        response = self.client.get(
            "/api/search",
            cookies={SESSION_COOKIE_NAME: owner_token},
            params={"q": "%", "type": "keyword"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["total"], 0)

    def test_flashcard_asset_upload_rejects_content_type_bypass(self):
        owner_id, owner_token = self._create_user("asset-owner@example.com")
        _, card_id = self._create_module_with_flashcard(owner_id)

        response = self.client.post(
            f"/api/flashcards/{card_id}/assets",
            cookies={SESSION_COOKIE_NAME: owner_token},
            files={"image": ("evil.png", b"not-an-image", "image/png")},
        )

        self.assertEqual(response.status_code, 400)

    def test_document_upload_enforces_maximum_size(self):
        owner_id, owner_token = self._create_user("upload-owner@example.com")
        with SessionLocal() as db:
            module = Module(user_id=owner_id, name="Uploads")
            db.add(module)
            db.commit()
            db.refresh(module)
            module_id = module.id

        original_limit = settings.MAX_UPLOAD_BYTES
        settings.MAX_UPLOAD_BYTES = 4
        try:
            response = self.client.post(
                "/api/documents/upload",
                cookies={SESSION_COOKIE_NAME: owner_token},
                data={"module_id": module_id},
                files={"file": ("big.txt", b"12345", "text/plain")},
            )
        finally:
            settings.MAX_UPLOAD_BYTES = original_limit

        self.assertEqual(response.status_code, 413)

    def test_json_import_requires_auth_and_enforces_size_limit(self):
        _, token = self._create_user("import-owner@example.com")
        anonymous = self.client.post(
            "/api/modules/import-json",
            files={"file": ("module.json", b"{}", "application/json")},
        )
        self.assertEqual(anonymous.status_code, 401)

        original_limit = settings.MAX_IMPORT_JSON_BYTES
        settings.MAX_IMPORT_JSON_BYTES = 8
        try:
            response = self.client.post(
                "/api/modules/import-json",
                cookies={SESSION_COOKIE_NAME: token},
                files={"file": ("module.json", b'{"module":{"name":"too big"}}', "application/json")},
            )
        finally:
            settings.MAX_IMPORT_JSON_BYTES = original_limit

        self.assertEqual(response.status_code, 413)

    def test_serialized_ai_request_rejects_invalid_lock_names(self):
        with self.assertRaises(ValueError):
            asyncio.run(self._acquire_invalid_ai_lock())

    async def _acquire_invalid_ai_lock(self):
        async with serialized_ai_request("groq_global;drop"):
            return None


if __name__ == "__main__":
    unittest.main()
