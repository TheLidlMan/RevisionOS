import json
import logging
from typing import Any, AsyncIterator, Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
JSON_RESPONSE_FORMAT = {"type": "json_object"}


def _default_temperature(value: Optional[float]) -> float:
    return settings.LLM_TEMPERATURE if value is None else value


def _default_top_p(value: Optional[float]) -> float:
    return settings.LLM_TOP_P if value is None else value


def _default_max_completion_tokens(value: Optional[int]) -> int:
    return settings.LLM_MAX_COMPLETION_TOKENS if value is None else value


def _normalize_message_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                text_parts.append(str(item.get("text", "")))
            elif isinstance(item, str):
                text_parts.append(item)
        return "".join(text_parts)
    if content is None:
        return ""
    return str(content)


def _build_envelope(kind: str, data: dict[str, Any], *, model: Optional[str] = None) -> dict[str, Any]:
    envelope = {
        "ok": True,
        "kind": kind,
        "data": data,
    }
    if model:
        envelope["model"] = model
    return envelope


def encode_sse_event(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event)}\n\n"


def _extract_message_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise KeyError("choices")
    message = choices[0].get("message") or {}
    return _normalize_message_content(message.get("content"))


def _extract_delta_text(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        return ""
    delta = choices[0].get("delta") or {}
    content = delta.get("content")
    return _normalize_message_content(content)


def _parse_json_response(text: str) -> list | dict:
    """Extract JSON from LLM response text."""
    text = (text or "").strip()
    if not text:
        raise ValueError("Empty response")
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()
    return json.loads(text)


def _normalize_json_object(raw_text: str, expected_payload_key: Optional[str]) -> dict[str, Any]:
    parsed = _parse_json_response(raw_text)
    if isinstance(parsed, dict):
        return parsed
    key = expected_payload_key or "items"
    return {key: parsed}


def _build_payload(
    *,
    candidate_model: str,
    messages: list[dict[str, Any]],
    temperature: Optional[float],
    top_p: Optional[float],
    max_completion_tokens: Optional[int],
    token_field: str,
    response_format: Optional[dict[str, str]],
    stream: bool,
) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "model": candidate_model,
        "messages": messages,
        "temperature": _default_temperature(temperature),
        "top_p": _default_top_p(top_p),
        token_field: _default_max_completion_tokens(max_completion_tokens),
    }
    if response_format:
        payload["response_format"] = response_format
    if stream:
        payload["stream"] = True
    return payload


def _should_add_max_tokens_fallback(token_field: str, status: int, body_lower: str) -> bool:
    return (
        token_field == "max_completion_tokens"
        and status == 400
        and (
            "max_tokens" in body_lower
            or "max_completion_tokens" in body_lower
            or "unknown field" in body_lower
            or "unrecognized" in body_lower
        )
    )


def _should_disable_response_format(
    response_format: Optional[dict[str, str]],
    status: int,
    body_lower: str,
    allow_json_fallback: bool,
) -> bool:
    return bool(
        response_format
        and allow_json_fallback
        and status == 400
        and "response_format" in body_lower
    )


async def _request_groq_completion(
    messages: list[dict[str, Any]],
    *,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    max_completion_tokens: Optional[int] = None,
    response_format: Optional[dict[str, str]] = None,
    api_key: Optional[str] = None,
    allow_json_fallback: bool = True,
) -> tuple[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key or settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    primary_model = model or settings.LLM_MODEL
    models_to_try = [primary_model]
    if primary_model != settings.LLM_FALLBACK_MODEL:
        models_to_try.append(settings.LLM_FALLBACK_MODEL)

    async with httpx.AsyncClient(timeout=60.0) as client:
        errors: list[str] = []

        for candidate_model in models_to_try:
            token_fields = ["max_completion_tokens"]
            response_formats = [response_format]

            for token_field in token_fields:
                for candidate_response_format in response_formats:
                    payload = _build_payload(
                        candidate_model=candidate_model,
                        messages=messages,
                        temperature=temperature,
                        top_p=top_p,
                        max_completion_tokens=max_completion_tokens,
                        token_field=token_field,
                        response_format=candidate_response_format,
                        stream=False,
                    )
                    try:
                        response = await client.post(GROQ_API_URL, headers=headers, json=payload)
                        response.raise_for_status()
                        return _extract_message_content(response.json()), candidate_model
                    except httpx.HTTPStatusError as exc:
                        status = exc.response.status_code
                        response_body = (exc.response.text or "")[:500]
                        body_lower = response_body.lower()

                        if _should_add_max_tokens_fallback(token_field, status, body_lower) and "max_tokens" not in token_fields:
                            token_fields.append("max_tokens")

                        if _should_disable_response_format(candidate_response_format, status, body_lower, allow_json_fallback) and None not in response_formats:
                            response_formats.append(None)

                        error_msg = (
                            f"model={candidate_model}, status={status}, token_field={token_field}, "
                            f"response_format={'json_object' if candidate_response_format else 'none'}, "
                            f"response={response_body}"
                        )
                        logger.warning("Groq API call failed: %s", error_msg)
                        errors.append(error_msg)
                    except httpx.RequestError as exc:
                        error_msg = f"model={candidate_model}, request_error={exc}"
                        logger.warning("Groq API request error: %s", error_msg)
                        errors.append(error_msg)
                        break
                    except KeyError as exc:
                        error_msg = f"model={candidate_model}, malformed_response={exc}"
                        logger.warning("Groq API malformed response: %s", error_msg)
                        errors.append(error_msg)
                        break

        joined = " | ".join(errors[-3:]) if errors else "Unknown error"
        raise RuntimeError(f"Groq API call failed after trying available models: {joined}")


async def stream_groq_completion(
    messages: list[dict[str, Any]],
    *,
    kind: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    max_completion_tokens: Optional[int] = None,
    response_format: Optional[dict[str, str]] = None,
    expected_payload_key: Optional[str] = None,
) -> AsyncIterator[dict[str, Any]]:
    if not settings.LLM_STREAMING_ENABLED:
        envelope = await _call_groq(
            messages,
            kind=kind,
            model=model,
            temperature=temperature,
            top_p=top_p,
            max_completion_tokens=max_completion_tokens,
            response_format=response_format,
            expected_payload_key=expected_payload_key,
            stream=False,
        )
        yield {"event": "status", "kind": kind, "message": "Streaming disabled, returning final response"}
        yield {"event": "final", "kind": kind, "envelope": envelope}
        return

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = _build_payload(
        candidate_model=model or settings.LLM_MODEL,
        messages=messages,
        temperature=temperature,
        top_p=top_p,
        max_completion_tokens=max_completion_tokens,
        token_field="max_completion_tokens",
        response_format=response_format,
        stream=True,
    )

    yield {"event": "status", "kind": kind, "message": "Connecting to Groq"}

    buffer = ""
    last_partial: Optional[str] = None

    async with httpx.AsyncClient(timeout=None) as client:
        try:
            async with client.stream("POST", GROQ_API_URL, headers=headers, json=payload) as response:
                response.raise_for_status()
                yield {"event": "status", "kind": kind, "message": "Streaming response"}
                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data_line = line[5:].strip()
                    if not data_line or data_line == "[DONE]":
                        continue

                    chunk = json.loads(data_line)
                    delta_text = _extract_delta_text(chunk)
                    if not delta_text:
                        continue

                    buffer += delta_text
                    yield {"event": "delta", "kind": kind, "delta": delta_text}

                    try:
                        partial = _normalize_json_object(buffer, expected_payload_key)
                    except (json.JSONDecodeError, ValueError):
                        partial = None

                    if partial is not None:
                        partial_signature = json.dumps(partial, sort_keys=True)
                        if partial_signature != last_partial:
                            last_partial = partial_signature
                            yield {"event": "partial", "kind": kind, "data": partial}
        except Exception as exc:
            yield {"event": "error", "kind": kind, "message": str(exc)}
            raise

    parsed = _normalize_json_object(buffer, expected_payload_key)
    envelope = _build_envelope(kind, parsed, model=model or settings.LLM_MODEL)
    yield {"event": "final", "kind": kind, "envelope": envelope}


async def _call_groq(
    messages: list[dict[str, Any]],
    *,
    kind: str = "completion",
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    top_p: Optional[float] = None,
    max_completion_tokens: Optional[int] = None,
    max_tokens: Optional[int] = None,
    response_format: Optional[dict[str, str]] = None,
    stream: bool = False,
    expected_payload_key: Optional[str] = None,
    allow_json_fallback: bool = True,
) -> dict[str, Any]:
    if stream:
        events: list[dict[str, Any]] = []
        final_envelope: Optional[dict[str, Any]] = None
        async for event in stream_groq_completion(
            messages,
            kind=kind,
            model=model,
            temperature=temperature,
            top_p=top_p,
            max_completion_tokens=max_completion_tokens or max_tokens,
            response_format=response_format,
            expected_payload_key=expected_payload_key,
        ):
            events.append(event)
            if event["event"] == "final":
                final_envelope = event["envelope"]
        if not final_envelope:
            raise RuntimeError("Groq streaming completed without a final envelope")
        final_envelope["events"] = events
        return final_envelope

    raw_text, resolved_model = await _request_groq_completion(
        messages,
        model=model,
        temperature=temperature,
        top_p=top_p,
        max_completion_tokens=max_completion_tokens or max_tokens,
        response_format=response_format,
        allow_json_fallback=allow_json_fallback,
    )
    parsed = _normalize_json_object(raw_text, expected_payload_key)
    return _build_envelope(kind, parsed, model=resolved_model)


def _json_response_format() -> Optional[dict[str, str]]:
    return JSON_RESPONSE_FORMAT if settings.LLM_JSON_MODE_ENABLED else None


def _json_messages(system_prompt: str, user_prompt: str) -> list[dict[str, str]]:
    return [
        {"role": "system", "content": system_prompt.strip()},
        {"role": "user", "content": user_prompt.strip()},
    ]


async def generate_flashcards(text: str, num_cards: int, subject: str) -> list[dict[str, Any]]:
    """Generate fill-in-the-gap flashcards from text using Groq API."""
    messages = _json_messages(
        "You create exam-focused cloze flashcards grounded only in the provided material.",
        (
            f"Subject: {subject}\n"
            f"Create {num_cards} flashcards from the material below.\n\n"
            "Requirements:\n"
            "- Return a JSON object with a `cards` array.\n"
            "- Each card must have `front`, `back`, `type`, `concept_name`, and `tags`.\n"
            "- Every `front` must contain exactly one `___` blank.\n"
            "- `back` is the missing word or phrase.\n"
            "- `type` must always be `CLOZE`.\n"
            "- Focus on key definitions, thresholds, relationships, and non-trivial exam material.\n\n"
            "Material:\n"
            f"{text}"
        ),
    )

    try:
        envelope = await _call_groq(
            messages,
            kind="flashcards",
            max_completion_tokens=8192,
            response_format=_json_response_format(),
            expected_payload_key="cards",
        )
        cards = envelope.get("data", {}).get("cards", [])
        return cards if isinstance(cards, list) else []
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse flashcard response: %s", exc)
        return []


async def generate_flashcards_for_concept(
    concept_name: str,
    concept_definition: str,
    context: str,
    num_cards: int,
    subject: str,
) -> list[dict[str, Any]]:
    """Generate targeted cloze cards for a single concept."""
    messages = _json_messages(
        "You create focused cloze flashcards for a single concept and stay faithful to the supplied context.",
        (
            f"Subject: {subject}\n"
            f"Target concept: {concept_name}\n"
            f"Concept definition: {concept_definition}\n\n"
            f"Create {num_cards} flashcards only about {concept_name}.\n\n"
            "Requirements:\n"
            "- Return a JSON object with a `cards` array.\n"
            "- Each card must have `front`, `back`, `concept_name`, and `tags`.\n"
            "- `front` must contain exactly one `___` blank.\n"
            "- `concept_name` must repeat the target concept name.\n"
            "- `tags` must include the concept name.\n"
            "- Avoid duplicates and trivial wording.\n\n"
            "Context:\n"
            f"{context}"
        ),
    )

    try:
        envelope = await _call_groq(
            messages,
            kind="concept_flashcards",
            max_completion_tokens=4096,
            response_format=_json_response_format(),
            expected_payload_key="cards",
        )
        cards = envelope.get("data", {}).get("cards", [])
        return cards if isinstance(cards, list) else []
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse concept flashcard response: %s", exc)
        return []


async def generate_flashcards_chunked(
    chunks: list[dict[str, Any]],
    subject: str,
    cards_per_chunk: int = 25,
    max_total_cards: Optional[int] = None,
) -> list[dict[str, Any]]:
    """Generate flashcards from multiple document chunks."""
    all_cards: list[dict[str, Any]] = []
    for chunk_info in chunks:
        remaining_cards = None if max_total_cards is None else max_total_cards - len(all_cards)
        if remaining_cards is not None and remaining_cards <= 0:
            break

        chunk_text = chunk_info.get("text", "")
        if not chunk_text.strip():
            continue

        filename = chunk_info.get("filename", "")
        context = f"From document: {filename}\n\n{chunk_text}" if filename else chunk_text

        try:
            requested_cards = cards_per_chunk if remaining_cards is None else min(cards_per_chunk, remaining_cards)
            cards = await generate_flashcards(context, requested_cards, subject)
            valid_cards: list[dict[str, Any]] = []
            for card in cards:
                if not isinstance(card, dict):
                    logger.warning(
                        "Skipping malformed flashcard item for document_id=%s: %r",
                        chunk_info.get("document_id"),
                        card,
                    )
                    continue
                card["source_document_id"] = chunk_info.get("document_id")
                card["source_excerpt"] = chunk_text[:200]
                valid_cards.append(card)
            if remaining_cards is not None:
                valid_cards = valid_cards[:remaining_cards]
            all_cards.extend(valid_cards)
        except Exception as exc:
            logger.warning("Failed to generate cards for chunk: %s", exc)
            continue

    return all_cards


async def generate_quiz_questions(
    text: str,
    num_questions: int,
    question_types: list[str],
    difficulty: str,
    subject: str = "this subject",
) -> list[dict[str, Any]]:
    """Generate quiz questions from text using Groq API."""
    type_instructions = []
    for qt in question_types:
        if qt == "MCQ":
            type_instructions.append("multiple choice questions with 4 options and exactly 1 correct answer")
        elif qt == "SHORT_ANSWER":
            type_instructions.append("short answer questions with concise model answers")
        elif qt == "TRUE_FALSE":
            type_instructions.append("true/false questions")
        elif qt == "FILL_BLANK":
            type_instructions.append("fill in the blank questions")
        elif qt == "EXAM_STYLE":
            type_instructions.append("exam-style questions worth roughly 8-12 marks")

    messages = _json_messages(
        f"You are an experienced {subject} examiner writing rigorous questions.",
        (
            f"Generate {num_questions} questions from the material below.\n"
            f"Question types to include: {', '.join(type_instructions) if type_instructions else 'a balanced mix'}.\n"
            f"Target difficulty: {difficulty}.\n\n"
            "Return a JSON object with a `questions` array.\n"
            "Each question object must include:\n"
            "- `question_text`\n"
            "- `type`\n"
            "- `options` (array for MCQ, otherwise null)\n"
            "- `correct_answer`\n"
            "- `explanation`\n"
            "- `difficulty`\n\n"
            "Questions should reward understanding, application, and analysis over rote recall.\n\n"
            "Material:\n"
            f"{text}"
        ),
    )

    try:
        envelope = await _call_groq(
            messages,
            kind="quiz_questions",
            max_completion_tokens=4096,
            response_format=_json_response_format(),
            expected_payload_key="questions",
        )
        questions = envelope.get("data", {}).get("questions", [])
        return questions if isinstance(questions, list) else []
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse quiz question response: %s", exc)
        return []


async def grade_answer(question: str, correct_answer: str, user_answer: str) -> dict[str, Any]:
    """Grade a short answer using Groq API."""
    messages = _json_messages(
        "You are grading a student's answer. Be fair, rigorous, and concise.",
        (
            f"Question: {question}\n"
            f"Model answer: {correct_answer}\n"
            f"Student answer: {user_answer}\n\n"
            "Return a JSON object with:\n"
            "- `score` as an integer from 0 to 100\n"
            "- `feedback`\n"
            "- `what_was_correct`\n"
            "- `what_was_missing`\n"
            "- `improved_answer`\n"
        ),
    )

    try:
        envelope = await _call_groq(
            messages,
            kind="answer_grading",
            max_completion_tokens=1024,
            response_format=_json_response_format(),
            expected_payload_key="score",
        )
        data = envelope.get("data", {})
        return data if isinstance(data, dict) else {"score": 0, "feedback": "Failed to parse grading response"}
    except (json.JSONDecodeError, ValueError):
        return {"score": 0, "feedback": "Failed to parse grading response"}


async def validate_api_key(api_key: str) -> bool:
    """Test if a Groq API key is valid."""
    payload = {
        "model": settings.LLM_FALLBACK_MODEL,
        "messages": [{"role": "user", "content": "Say hello"}],
        "max_completion_tokens": 5,
        "temperature": settings.LLM_TEMPERATURE,
        "top_p": settings.LLM_TOP_P,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
            return response.status_code == 200
        except httpx.RequestError:
            return False
