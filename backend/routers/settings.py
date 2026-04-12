import json
import os
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from config import reload_runtime_settings, settings
from services.ai_service import validate_api_key

router = APIRouter(prefix="/api/settings", tags=["settings"])

SETTINGS_FILE = Path(__file__).resolve().parent.parent / "settings.json"

DEFAULT_SETTINGS = {
    "groq_api_key": "",
    "llm_model_fast": "llama-3.1-8b-instant",
    "llm_model": "openai/gpt-oss-120b",
    "llm_model_quality": "openai/gpt-oss-20b",
    "llm_fallback_model": "llama-3.3-70b-versatile",
    "llm_temperature": 0.1,
    "llm_top_p": 1.0,
    "llm_max_completion_tokens": 4096,
    "llm_json_mode_enabled": True,
    "llm_streaming_enabled": True,
    "daily_new_cards_limit": 20,
    "cards_per_document": 200,
    "questions_per_document": 10,
    "weakness_threshold": 0.7,
    "desired_retention": 0.9,
    "theme": "dark",
}


# ---------- Pydantic schemas ----------

class SettingsResponse(BaseModel):
    groq_api_key: str = ""
    llm_model_fast: str = "llama-3.1-8b-instant"
    llm_model: str = "openai/gpt-oss-120b"
    llm_model_quality: str = "openai/gpt-oss-20b"
    llm_fallback_model: str = "llama-3.3-70b-versatile"
    llm_temperature: float = 0.1
    llm_top_p: float = 1.0
    llm_max_completion_tokens: int = 4096
    llm_json_mode_enabled: bool = True
    llm_streaming_enabled: bool = True
    daily_new_cards_limit: int = 20
    cards_per_document: int = 200
    questions_per_document: int = 10
    weakness_threshold: float = 0.7
    desired_retention: float = 0.9
    theme: str = "dark"


class SettingsUpdate(BaseModel):
    groq_api_key: Optional[str] = None
    llm_model_fast: Optional[str] = None
    llm_model: Optional[str] = None
    llm_model_quality: Optional[str] = None
    llm_fallback_model: Optional[str] = None
    llm_temperature: Optional[float] = None
    llm_top_p: Optional[float] = None
    llm_max_completion_tokens: Optional[int] = None
    llm_json_mode_enabled: Optional[bool] = None
    llm_streaming_enabled: Optional[bool] = None
    daily_new_cards_limit: Optional[int] = None
    cards_per_document: Optional[int] = None
    questions_per_document: Optional[int] = None
    weakness_threshold: Optional[float] = None
    desired_retention: Optional[float] = None
    theme: Optional[str] = None


class ValidateKeyRequest(BaseModel):
    api_key: str


class ValidateKeyResponse(BaseModel):
    valid: bool
    message: str


# ---------- Helpers ----------

def _load_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            merged = {**DEFAULT_SETTINGS, **data}
            return merged
    return dict(DEFAULT_SETTINGS)


def _save_settings(data: dict) -> None:
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


# ---------- Endpoints ----------

@router.get("", response_model=SettingsResponse)
def get_settings():
    data = _load_settings()
    # Mask API key for display
    key = data.get("groq_api_key", "")
    if key and len(key) > 8:
        data["groq_api_key"] = key[:4] + "..." + key[-4:]
    return SettingsResponse(**data)


@router.patch("", response_model=SettingsResponse)
def update_settings(body: SettingsUpdate):
    current = _load_settings()
    update_data = body.model_dump(exclude_none=True)

    if "cards_per_document" in update_data:
        update_data["cards_per_document"] = max(
            1,
            min(int(update_data["cards_per_document"]), settings.MAX_CARDS_PER_REQUEST),
        )
    if "questions_per_document" in update_data:
        update_data["questions_per_document"] = max(
            1,
            min(int(update_data["questions_per_document"]), settings.MAX_QUESTIONS_PER_REQUEST),
        )
    if "llm_max_completion_tokens" in update_data:
        update_data["llm_max_completion_tokens"] = max(1, int(update_data["llm_max_completion_tokens"]))
    if "llm_temperature" in update_data:
        update_data["llm_temperature"] = max(0.0, min(float(update_data["llm_temperature"]), 2.0))
    if "llm_top_p" in update_data:
        update_data["llm_top_p"] = max(0.0, min(float(update_data["llm_top_p"]), 1.0))

    current.update(update_data)
    _save_settings(current)
    reload_runtime_settings()

    # Mask key in response
    resp = dict(current)
    key = resp.get("groq_api_key", "")
    if key and len(key) > 8:
        resp["groq_api_key"] = key[:4] + "..." + key[-4:]
    return SettingsResponse(**resp)


@router.post("/validate-api-key", response_model=ValidateKeyResponse)
async def validate_key(body: ValidateKeyRequest):
    if not body.api_key:
        return ValidateKeyResponse(valid=False, message="API key is empty")
    is_valid = await validate_api_key(body.api_key)
    if is_valid:
        return ValidateKeyResponse(valid=True, message="API key is valid")
    return ValidateKeyResponse(valid=False, message="API key is invalid or Groq API is unreachable")
