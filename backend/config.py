from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    DATABASE_URL: str = "sqlite:///./revisionos.db"
    LLM_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    LLM_FALLBACK_MODEL: str = "llama-3.1-8b-instant"
    MAX_CONTEXT_TOKENS: int = 800000
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
