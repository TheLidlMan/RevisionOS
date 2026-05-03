from datetime import datetime, timezone
from typing import Optional

from fsrs import Scheduler, Card, Rating, State


# Map string ratings to FSRS Rating enum
RATING_MAP = {
    "AGAIN": Rating.Again,
    "HARD": Rating.Hard,
    "GOOD": Rating.Good,
    "EASY": Rating.Easy,
}

# Map FSRS State enum to our string representation
STATE_MAP = {
    State.Learning: "LEARNING",
    State.Review: "REVIEW",
    State.Relearning: "RELEARNING",
}

STATE_REVERSE_MAP = {
    "LEARNING": State.Learning,
    "REVIEW": State.Review,
    "RELEARNING": State.Relearning,
}

_scheduler = Scheduler()


def _to_app_state(fsrs_state: State, _step: int = 0) -> str:
    """Convert fsrs State into app-level state string."""
    return STATE_MAP.get(fsrs_state, "NEW")


def schedule_review(card_data: dict, rating: str) -> dict:
    """
    Takes current card FSRS state + rating string, returns updated scheduling fields.

    card_data keys used: due, stability, difficulty, elapsed_days, scheduled_days,
                         reps, lapses, state, last_review
    rating: one of AGAIN, HARD, GOOD, EASY
    """
    fsrs_rating = RATING_MAP.get(rating.upper())
    if fsrs_rating is None:
        raise ValueError(f"Invalid rating: {rating}. Must be one of: AGAIN, HARD, GOOD, EASY")

    card = Card()

    # Populate card from DB data
    if card_data.get("due"):
        due_val = card_data["due"]
        if isinstance(due_val, str):
            due_val = datetime.fromisoformat(due_val)
        if due_val.tzinfo is None:
            due_val = due_val.replace(tzinfo=timezone.utc)
        card.due = due_val

    if card_data.get("stability") is not None and card_data["stability"] != 0.0:
        card.stability = card_data["stability"]
    if card_data.get("difficulty") is not None and card_data["difficulty"] != 0.0:
        card.difficulty = card_data["difficulty"]

    state_str = card_data.get("state", "NEW")
    if state_str in STATE_REVERSE_MAP:
        card.state = STATE_REVERSE_MAP[state_str]

    if card_data.get("last_review"):
        lr = card_data["last_review"]
        if isinstance(lr, str):
            lr = datetime.fromisoformat(lr)
        if lr.tzinfo is None:
            lr = lr.replace(tzinfo=timezone.utc)
        card.last_review = lr

    updated_card, _review_log = _scheduler.review_card(card, fsrs_rating)

    study_difficulty = (card_data.get("study_difficulty") or "MEDIUM").upper()
    bias = {"EASY": -0.15, "MEDIUM": 0.0, "HARD": 0.2}.get(study_difficulty, 0.0)

    # Convert due to naive UTC for storage
    new_due = updated_card.due
    if new_due.tzinfo is not None:
        new_due = new_due.replace(tzinfo=None)

    new_last_review: Optional[datetime] = None
    if updated_card.last_review is not None:
        new_last_review = updated_card.last_review
        if new_last_review.tzinfo is not None:
            new_last_review = new_last_review.replace(tzinfo=None)

    # Track reps and lapses ourselves since fsrs v4 Card doesn't store them
    prev_reps = card_data.get("reps", 0)
    prev_lapses = card_data.get("lapses", 0)
    new_reps = prev_reps + 1
    new_lapses = prev_lapses + (1 if fsrs_rating == Rating.Again else 0)

    # Compute elapsed_days
    elapsed_days = 0
    if card_data.get("last_review") and new_last_review:
        old_lr = card_data["last_review"]
        if isinstance(old_lr, str):
            old_lr = datetime.fromisoformat(old_lr)
        if old_lr.tzinfo is None:
            old_lr = old_lr.replace(tzinfo=timezone.utc)
        elapsed_days = max((new_last_review.replace(tzinfo=timezone.utc) - old_lr).days, 0)

    # scheduled_days = days until next review from last review
    scheduled_days = 0
    if new_last_review and new_due:
        nr = new_last_review.replace(tzinfo=timezone.utc) if new_last_review.tzinfo is None else new_last_review
        nd = new_due.replace(tzinfo=timezone.utc) if new_due.tzinfo is None else new_due
        scheduled_days = max((nd - nr).days, 0)

    if new_last_review and bias != 0.0:
        adjusted_days = max(1, round(scheduled_days * (1 - bias)))
        scheduled_days = adjusted_days
        new_due = new_last_review + (new_due - new_last_review) * (adjusted_days / max((new_due - new_last_review).days, 1))
        if new_due.tzinfo is not None:
            new_due = new_due.replace(tzinfo=None)

    app_state = _to_app_state(updated_card.state)

    return {
        "due": new_due,
        "stability": updated_card.stability or 0.0,
        "difficulty": updated_card.difficulty or 0.0,
        "elapsed_days": elapsed_days,
        "scheduled_days": scheduled_days,
        "reps": new_reps,
        "lapses": new_lapses,
        "state": app_state,
        "last_review": new_last_review,
    }
