import json
import logging
from pathlib import Path

from pydantic_settings import BaseSettings


logger = logging.getLogger(__name__)
SETTINGS_FILE = Path(__file__).resolve().parent / "settings.json"
DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "https://revisionos-frontend.pages.dev",
    "https://reviseos.co.uk",
    "https://login.reviseos.co.uk",
    "https://app.reviseos.co.uk",
    "https://api.reviseos.co.uk",
]
DEFAULT_CORS_ORIGIN_REGEX = r"https://([A-Za-z0-9-]+\.)?(revisionos-frontend\.pages\.dev|reviseos\.co\.uk)"
PERSISTED_SETTINGS_MAP = {
    "groq_api_key": "GROQ_API_KEY",
    "llm_model_fast": "LLM_MODEL_FAST",
    "llm_model": "LLM_MODEL",
    "llm_model_quality": "LLM_MODEL_QUALITY",
    "llm_fallback_model": "LLM_FALLBACK_MODEL",
    "llm_temperature": "LLM_TEMPERATURE",
    "llm_top_p": "LLM_TOP_P",
    "llm_max_completion_tokens": "LLM_MAX_COMPLETION_TOKENS",
    "llm_json_mode_enabled": "LLM_JSON_MODE_ENABLED",
    "llm_streaming_enabled": "LLM_STREAMING_ENABLED",
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
    CORS_ORIGINS: str = ",".join(DEFAULT_CORS_ORIGINS)
    CORS_ORIGIN_REGEX: str = DEFAULT_CORS_ORIGIN_REGEX
    LLM_MODEL_FAST: str = "llama-3.1-8b-instant"
    LLM_MODEL: str = "openai/gpt-oss-120b"
    LLM_MODEL_QUALITY: str = "openai/gpt-oss-20b"
    LLM_FALLBACK_MODEL: str = "llama-3.3-70b-versatile"
    LLM_TEMPERATURE: float = 0.1
    LLM_TOP_P: float = 1.0
    LLM_MAX_COMPLETION_TOKENS: int = 4096
    LLM_MAX_COMPLETION_TOKENS_BULK: int = 32768
    LLM_JSON_MODE_ENABLED: bool = True
    LLM_STREAMING_ENABLED: bool = True
    MAX_CONTEXT_TOKENS: int = 800000
    MAX_PROMPT_CHARS: int = 120000
    UPLOAD_DIR: str = "./uploads"
    FOLDER_IMPORT_ROOT: str = "./uploads/folder-imports"
    DAILY_NEW_CARDS_LIMIT: int = 50
    AI_MONTHLY_REQUEST_LIMIT: int = 500
    CARDS_PER_DOCUMENT: int = 200
    QUESTIONS_PER_DOCUMENT: int = 10
    MAX_CARDS_PER_REQUEST: int = 200
    MAX_QUESTIONS_PER_REQUEST: int = 20
    WEAKNESS_THRESHOLD: float = 0.7
    DESIRED_RETENTION: float = 0.9
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    WHISPER_HQ_MODEL: str = "whisper-large-v3"
    NEO4J_URI: str = ""
    NEO4J_USERNAME: str = "neo4j"
    NEO4J_PASSWORD: str = ""
    NEO4J_DATABASE: str = "neo4j"
    REQUEST_TIMING_LOG_ENABLED: bool = True
    REQUEST_TIMING_WARN_MS: int = 1000
    AUTH_SESSION_WARN_MS: int = 250
    POOL_PRESSURE_WARN_RATIO: float = 0.8

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "https://api.reviseos.co.uk/api/auth/google/callback"

    # Public URLs
    PUBLIC_APP_URL: str = "https://app.reviseos.co.uk"
    PUBLIC_LOGIN_URL: str = "https://app.reviseos.co.uk/login"
    PUBLIC_MARKETING_URL: str = "https://reviseos.co.uk"
    PUBLIC_API_URL: str = "https://api.reviseos.co.uk"

    # Session cookies
    SESSION_COOKIE_DOMAIN: str = ".reviseos.co.uk"
    SESSION_COOKIE_SECURE: bool = True
    SESSION_MAX_AGE_DAYS: int = 7
    TRUSTED_PROXY_IPS: str = ""

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


settings = Settings()


def get_cors_origins() -> list[str]:
    configured_origins = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]
    merged_origins = dict.fromkeys([*DEFAULT_CORS_ORIGINS, *configured_origins])
    return list(merged_origins)


def get_cors_origin_regex() -> str | None:
    regexes = [DEFAULT_CORS_ORIGIN_REGEX]
    configured_regex = settings.CORS_ORIGIN_REGEX.strip()
    if configured_regex and configured_regex != DEFAULT_CORS_ORIGIN_REGEX:
        regexes.append(configured_regex)

    if not regexes:
        return None

    if len(regexes) == 1:
        return regexes[0]

    return "|".join(f"(?:{regex})" for regex in regexes)


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

        if attr_name == "DAILY_NEW_CARDS_LIMIT":
            try:
                value = max(0, int(value))
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid persisted daily_new_cards_limit value: %r", value)
                continue

        if attr_name == "CARDS_PER_DOCUMENT":
            try:
                value = max(1, min(int(value), settings.MAX_CARDS_PER_REQUEST))
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid persisted cards_per_document value: %r", value)
                continue

        if attr_name == "QUESTIONS_PER_DOCUMENT":
            try:
                value = max(1, min(int(value), settings.MAX_QUESTIONS_PER_REQUEST))
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid persisted questions_per_document value: %r", value)
                continue

        if attr_name == "LLM_MAX_COMPLETION_TOKENS":
            try:
                value = max(1, int(value))
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid persisted llm_max_completion_tokens value: %r", value)
                continue

        if attr_name in {"LLM_TEMPERATURE", "LLM_TOP_P"}:
            try:
                value = float(value)
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid persisted %s value: %r", attr_name, value)
                continue

        if attr_name in {"LLM_JSON_MODE_ENABLED", "LLM_STREAMING_ENABLED"}:
            if isinstance(value, str):
                value = value.strip().lower() in {"1", "true", "yes", "on"}
            else:
                value = bool(value)

        setattr(settings, attr_name, value)


reload_runtime_settings()
