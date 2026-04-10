import json
import logging
from pathlib import Path

from pydantic_settings import BaseSettings


logger = logging.getLogger(__name__)
SETTINGS_FILE = Path(__file__).resolve().parent / "settings.json"
PERSISTED_SETTINGS_MAP = {
    "groq_api_key": "GROQ_API_KEY",
    "llm_model": "LLM_MODEL",
    "llm_fallback_model": "LLM_FALLBACK_MODEL",
    "daily_new_cards_limit": "DAILY_NEW_CARDS_LIMIT",
    "cards_per_document": "CARDS_PER_DOCUMENT",
    "questions_per_document": "QUESTIONS_PER_DOCUMENT",
    "weakness_threshold": "WEAKNESS_THRESHOLD",
    "desired_retention": "DESIRED_RETENTION",
}


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    JWT_SECRET: str = ""
    DATABASE_URL: str = "sqlite:///./revisionos.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    LLM_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    LLM_FALLBACK_MODEL: str = "llama-3.1-8b-instant"
    MAX_CONTEXT_TOKENS: int = 800000
    MAX_PROMPT_CHARS: int = 120000
    UPLOAD_DIR: str = "./uploads"
    DAILY_NEW_CARDS_LIMIT: int = 20
    CARDS_PER_DOCUMENT: int = 20
    QUESTIONS_PER_DOCUMENT: int = 10
    WEAKNESS_THRESHOLD: float = 0.7
    DESIRED_RETENTION: float = 0.9

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()


def get_cors_origins() -> list[str]:
    return [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]


def _load_persisted_settings() -> dict:
    if not SETTINGS_FILE.exists():
        return {}

    try:
        return json.loads(SETTINGS_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to load persisted settings from %s: %s", SETTINGS_FILE, exc)
        return {}


def reload_runtime_settings() -> None:
    persisted = _load_persisted_settings()
    for json_key, attr_name in PERSISTED_SETTINGS_MAP.items():
        if json_key not in persisted:
            continue

        value = persisted[json_key]
        if json_key == "groq_api_key" and isinstance(value, str) and "..." in value:
            logger.warning("Ignoring masked Groq API key found in persisted settings")
            continue

        setattr(settings, attr_name, value)


reload_runtime_settings()
