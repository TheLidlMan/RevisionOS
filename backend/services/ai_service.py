import json
import logging
from typing import Optional

import httpx

from config import settings

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


async def _call_groq(
    messages: list[dict],
    model: Optional[str] = None,
    temperature: float = 0.7,
    max_tokens: int = 4096,
) -> str:
    """Call Groq API with fallback model support."""
    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }
    primary_model = model or settings.LLM_MODEL
    models_to_try = [primary_model]
    if primary_model != settings.LLM_FALLBACK_MODEL:
        models_to_try.append(settings.LLM_FALLBACK_MODEL)

    async with httpx.AsyncClient(timeout=60.0) as client:
        errors: list[str] = []

        for candidate_model in models_to_try:
            token_fields = ["max_tokens"]

            for token_field in token_fields:
                payload = {
                    "model": candidate_model,
                    "messages": messages,
                    "temperature": temperature,
                    token_field: max_tokens,
                }

                try:
                    response = await client.post(GROQ_API_URL, headers=headers, json=payload)
                    response.raise_for_status()
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                except httpx.HTTPStatusError as e:
                    status = e.response.status_code
                    response_body = (e.response.text or "")[:500]
                    body_lower = response_body.lower()

                    # Some OpenAI-compatible providers require max_completion_tokens.
                    if (
                        token_field == "max_tokens"
                        and status == 400
                        and (
                            "max_tokens" in body_lower
                            or "max_completion_tokens" in body_lower
                            or "unknown field" in body_lower
                            or "unrecognized" in body_lower
                        )
                    ):
                        token_fields.append("max_completion_tokens")

                    error_msg = (
                        f"model={candidate_model}, status={status}, token_field={token_field}, "
                        f"response={response_body}"
                    )
                    logger.warning("Groq API call failed: %s", error_msg)
                    errors.append(error_msg)
                except httpx.RequestError as e:
                    error_msg = f"model={candidate_model}, request_error={e}"
                    logger.warning("Groq API request error: %s", error_msg)
                    errors.append(error_msg)
                    break
                except KeyError as e:
                    error_msg = f"model={candidate_model}, malformed_response={e}"
                    logger.warning("Groq API malformed response: %s", error_msg)
                    errors.append(error_msg)
                    break

        joined = " | ".join(errors[-3:]) if errors else "Unknown error"
        raise RuntimeError(f"Groq API call failed after trying available models: {joined}")


def _parse_json_response(text: str) -> list | dict:
    """Extract JSON from LLM response text."""
    text = text.strip()
    # Try to find JSON block in markdown code fences
    if "```json" in text:
        start = text.index("```json") + 7
        end = text.index("```", start)
        text = text[start:end].strip()
    elif "```" in text:
        start = text.index("```") + 3
        end = text.index("```", start)
        text = text[start:end].strip()

    return json.loads(text)


async def generate_flashcards(text: str, num_cards: int, subject: str) -> list[dict]:
    """Generate fill-in-the-gap flashcards from text using Groq API.
    
    All cards are cloze/fill-in-the-blank type where key terms are blanked out.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are creating fill-in-the-blank study flashcards. Every card must be a sentence "
                "or short paragraph with exactly ONE key term, definition, or concept replaced by '___' (three underscores). "
                "The answer is the missing word or phrase. Focus on terms likely to appear in exams."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create {num_cards} fill-in-the-blank flashcards from this {subject} content.\n\n"
                "Rules:\n"
                "- Each card has a 'front' field: a sentence with ONE key term replaced by '___'\n"
                "- Each card has a 'back' field: the missing term/answer\n"
                "- All cards are type 'CLOZE'\n"
                "- Focus on: key definitions, important figures/thresholds, relationships between concepts\n"
                "- Include cards of varying difficulty\n"
                "- The blanked term should be specific (not 'it' or 'this')\n"
                "- Do NOT create trivial cards\n\n"
                "Return ONLY valid JSON array:\n"
                '[{"front": "The ___ is the process by which...", "back": "osmosis", '
                '"type": "CLOZE", "concept_name": "topic this relates to", "tags": []}]\n\n'
                f"Content:\n{text}"
            ),
        },
    ]

    response_text = await _call_groq(messages, max_tokens=8192)
    try:
        cards = _parse_json_response(response_text)
        if isinstance(cards, dict) and "cards" in cards:
            cards = cards["cards"]
        if not isinstance(cards, list):
            cards = [cards]
        return cards
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse flashcard response: {e}")
        return []


async def generate_flashcards_for_concept(
    concept_name: str,
    concept_definition: str,
    context: str,
    num_cards: int,
    subject: str,
) -> list[dict]:
    """Generate targeted cloze cards for a single concept."""
    messages = [
        {
            "role": "system",
            "content": (
                "You create fill-in-the-blank study flashcards focused on a single concept. "
                "Every card must contain exactly one ___ blank and stay grounded in the supplied context."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Subject: {subject}\n"
                f"Target concept: {concept_name}\n"
                f"Concept definition: {concept_definition}\n\n"
                f"Create {num_cards} cloze flashcards only about {concept_name}.\n"
                "Rules:\n"
                "- front: sentence with one missing term shown as ___\n"
                "- back: the missing answer\n"
                "- concept_name: repeat the target concept name\n"
                "- tags: include the concept name\n"
                "- Avoid duplicate or trivial cards\n\n"
                "Return ONLY valid JSON array:\n"
                '[{"front":"... ___ ...","back":"...","concept_name":"...","tags":["..."]}]\n\n'
                f"Context:\n{context}"
            ),
        },
    ]

    response_text = await _call_groq(messages, max_tokens=4096)
    try:
        cards = _parse_json_response(response_text)
        if isinstance(cards, dict) and "cards" in cards:
            cards = cards["cards"]
        if not isinstance(cards, list):
            cards = [cards]
        return cards
    except (json.JSONDecodeError, ValueError) as e:
        logger.error("Failed to parse concept flashcard response: %s", e)
        return []


async def generate_flashcards_chunked(
    chunks: list[dict],
    subject: str,
    cards_per_chunk: int = 25,
    max_total_cards: Optional[int] = None,
) -> list[dict]:
    """Generate flashcards from multiple document chunks.
    
    Each chunk generates cards_per_chunk cards, producing massive numbers of cards.
    """
    all_cards = []
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
            valid_cards = []
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
        except Exception as e:
            logger.warning(f"Failed to generate cards for chunk: {e}")
            continue
    
    return all_cards


async def generate_quiz_questions(
    text: str,
    num_questions: int,
    question_types: list[str],
    difficulty: str,
    subject: str = "this subject",
) -> list[dict]:
    """Generate quiz questions from text using Groq API."""
    type_instructions = []
    for qt in question_types:
        if qt == "MCQ":
            type_instructions.append("multiple choice questions (4 options, only 1 correct)")
        elif qt == "SHORT_ANSWER":
            type_instructions.append("short answer questions (2-4 sentence answers)")
        elif qt == "TRUE_FALSE":
            type_instructions.append("true/false questions")
        elif qt == "FILL_BLANK":
            type_instructions.append("fill in the blank questions")
        elif qt == "EXAM_STYLE":
            type_instructions.append("exam-style questions (worth 8-12 marks, require detailed answers)")

    types_str = ", ".join(type_instructions) if type_instructions else "a mix of question types"

    messages = [
        {
            "role": "system",
            "content": f"You are an experienced {subject} examiner writing exam questions.",
        },
        {
            "role": "user",
            "content": (
                f"Generate {num_questions} exam questions from this content.\n"
                f"Include: {types_str}\n"
                f"Target difficulty: {difficulty}\n\n"
                "For each question include: question_text, type (MCQ/SHORT_ANSWER/TRUE_FALSE/FILL_BLANK/EXAM_STYLE), "
                "options (array of strings if MCQ, null otherwise), correct_answer, explanation, "
                "difficulty (EASY/MEDIUM/HARD/EXAM).\n\n"
                "Make questions that test UNDERSTANDING not just recall. "
                "Use application and analysis where possible.\n\n"
                "Return ONLY valid JSON array of question objects.\n\n"
                f"Content:\n{text}"
            ),
        },
    ]

    response_text = await _call_groq(messages, max_tokens=4096)
    try:
        questions = _parse_json_response(response_text)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except (json.JSONDecodeError, ValueError) as e:
        logger.error(f"Failed to parse quiz question response: {e}")
        return []


async def grade_answer(question: str, correct_answer: str, user_answer: str) -> dict:
    """Grade a short answer using Groq API."""
    messages = [
        {
            "role": "system",
            "content": "You are grading a student's answer. Be fair but rigorous.",
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n"
                f"Model Answer: {correct_answer}\n"
                f"Student Answer: {user_answer}\n\n"
                "Score this 0-100 based on:\n"
                "- Accuracy of facts stated\n"
                "- Key concepts mentioned\n"
                "- Conceptual understanding demonstrated\n\n"
                'Return ONLY valid JSON: {{"score": int, "feedback": "...", '
                '"what_was_correct": "...", "what_was_missing": "...", "improved_answer": "..."}}'
            ),
        },
    ]

    response_text = await _call_groq(messages, max_tokens=1024)
    try:
        result = _parse_json_response(response_text)
        if isinstance(result, dict):
            return result
        return {"score": 0, "feedback": "Failed to parse grading response"}
    except (json.JSONDecodeError, ValueError):
        return {"score": 0, "feedback": "Failed to parse grading response"}


async def validate_api_key(api_key: str) -> bool:
    """Test if a Groq API key is valid."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_FALLBACK_MODEL,
        "messages": [{"role": "user", "content": "Say hello"}],
        "max_tokens": 5,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
            return response.status_code == 200
        except httpx.RequestError:
            return False
