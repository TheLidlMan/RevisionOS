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
    model = model or settings.LLM_MODEL

    headers = {
        "Authorization": f"Bearer {settings.GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            response = await client.post(GROQ_API_URL, headers=headers, json=payload)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPStatusError, httpx.RequestError, KeyError) as e:
            if model != settings.LLM_FALLBACK_MODEL:
                logger.warning(f"Primary model failed ({e}), trying fallback model")
                return await _call_groq(
                    messages,
                    model=settings.LLM_FALLBACK_MODEL,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
            raise RuntimeError(f"Groq API call failed: {e}") from e


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
    """Generate flashcards from text using Groq API."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are creating high-quality study flashcards following best practices: "
                "atomic (one fact per card), clear, testable."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Create {num_cards} flashcards from this {subject} content. Mix of:\n"
                "- Basic Q&A (most cards)\n"
                '- Cloze deletions for key terms (format: "The {{{{c1::term}}}} is defined as...")\n'
                "- Definition cards\n\n"
                "Focus on: concepts likely to be examined, non-obvious relationships, specific figures/thresholds.\n"
                "Do NOT create trivial or obvious cards.\n\n"
                'Return ONLY valid JSON array: [{{"front": "...", "back": "...", "type": "basic"|"cloze", '
                '"cloze_text": "..." or null, "tags": []}}]\n\n'
                f"Content:\n{text}"
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
        logger.error(f"Failed to parse flashcard response: {e}")
        return []


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
