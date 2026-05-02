import json
import os
import shutil
import sys
import tempfile
import unittest
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

import database
from database import SessionLocal, create_tables
from main import app, fastapi_app
from models.module import Module
from models.quiz_question import QuizQuestion
from models.user import User
from routers import auth as auth_router
from routers import collaboration, settings as settings_router
from services.auth_service import SESSION_COOKIE_NAME, _get_secret_key, create_session, validate_return_to
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
        settings.GROQ_API_KEY = ""
        if self.settings_file.exists():
            self.settings_file.unlink()
        database.Base.metadata.drop_all(bind=database.engine)
        create_tables()
        self.client = TestClient(app)

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
        _, owner_token = self._create_user("collab-owner@example.com", "Owner")
        _, outsider_token = self._create_user("collab-outsider@example.com", "Outsider")

        created = self.client.post(
            "/api/collab/rooms",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"module_id": "module-1", "name": "Private room", "room_type": "study"},
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

        created = self.client.post(
            "/api/collab/rooms",
            cookies={SESSION_COOKIE_NAME: owner_token},
            json={"module_id": "module-1", "name": "Socket room", "room_type": "study"},
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

    def test_settings_update_keeps_api_key_out_of_persisted_file(self):
        _, token = self._create_user("persist@example.com")
        response = self.client.patch(
            "/api/settings",
            cookies={SESSION_COOKIE_NAME: token},
            json={"groq_api_key": "gsk_live_secret_value_12345678", "theme": "light"},
        )

        self.assertEqual(response.status_code, 200)
        persisted = json.loads(self.settings_file.read_text(encoding="utf-8"))
        self.assertNotIn("groq_api_key", persisted)
        self.assertEqual(persisted["theme"], "light")
        self.assertEqual(response.json()["groq_api_key"], "gsk_...5678")

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


if __name__ == "__main__":
    unittest.main()
