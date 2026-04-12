import math
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.user_stats import UserStats, Achievement
from services.auth_service import get_current_user

router = APIRouter(tags=["gamification"])

# ---------- XP Constants ----------

XP_CARD_REVIEWED = 10
XP_QUIZ_COMPLETED = 50
XP_PERFECT_QUIZ = 100
XP_STREAK_BONUS = 5  # per day of active streak
XP_COMEBACK_BONUS = 75
XP_DAILY_GOAL_MET = 30
HEARTS_MAX = 15
HEARTS_REPLENISH_MINUTES = 10

# Level formula: level = floor(sqrt(xp / 100)) + 1
# So level 2 at 100 XP, level 3 at 400 XP, level 10 at 8100 XP, etc.


def _xp_for_level(level: int) -> int:
    """Return total XP required to reach a given level."""
    return ((level - 1) ** 2) * 100


def _level_from_xp(xp: int) -> int:
    return int(math.sqrt(xp / 100)) + 1


# ---------- Achievement Definitions ----------

ACHIEVEMENT_DEFS = {
    "first_card": {"name": "Flashcard Rookie", "description": "Review your first card", "icon": "🃏"},
    "first_quiz": {"name": "Quiz Starter", "description": "Complete your first quiz", "icon": "📝"},
    "streak_3": {"name": "On a Roll", "description": "3-day streak", "icon": "🔥"},
    "streak_7": {"name": "Week Warrior", "description": "7-day streak", "icon": "⚔️"},
    "streak_30": {"name": "Monthly Master", "description": "30-day streak", "icon": "👑"},
    "cards_100": {"name": "Century", "description": "Review 100 cards total", "icon": "💯"},
    "cards_1000": {"name": "Card Shark", "description": "Review 1000 cards total", "icon": "🦈"},
    "mastered_50": {"name": "Half Century", "description": "Master 50 cards", "icon": "🏆"},
    "perfect_quiz": {"name": "Flawless", "description": "Score 100% on a quiz", "icon": "💎"},
    "first_module": {"name": "Module Unlocked", "description": "Create your first module", "icon": "📦"},
    "first_upload": {"name": "Document Digested", "description": "Upload your first document", "icon": "📄"},
    "weak_drilled": {"name": "Weakness Slayer", "description": "Complete a Weakness Drill session", "icon": "⚡"},
    "curriculum": {"name": "Planner", "description": "Generate a curriculum", "icon": "📅"},
    "night_owl": {"name": "Night Owl", "description": "Study after 11pm", "icon": "🦉"},
    "early_bird": {"name": "Early Bird", "description": "Study before 7am", "icon": "🐦"},
    "speed_demon": {"name": "Speed Demon", "description": "Answer 10 cards in under 60 seconds", "icon": "⚡"},
    "comeback": {"name": "Comeback Kid", "description": "Return after 3+ day break", "icon": "🔄"},
    "anki_export": {"name": "Anki Convert", "description": "Export your first Anki deck", "icon": "📤"},
    "bulk_import": {"name": "File Hoarder", "description": "Import 10+ documents", "icon": "📚"},
    "knowledge_graph": {"name": "Connected Mind", "description": "View knowledge graph with 20+ nodes", "icon": "🧠"},
}


# ---------- Pydantic Schemas ----------

class UserStatsResponse(BaseModel):
    streak_current: int = 0
    streak_longest: int = 0
    last_study_date: Optional[datetime] = None
    xp_total: int = 0
    level: int = 1
    xp_for_current_level: int = 0
    xp_for_next_level: int = 100
    hearts_remaining: int = 15
    hearts_enabled: bool = True
    daily_goal_target: int = 20
    daily_goal_completed: int = 0
    daily_goal_date: Optional[str] = None
    total_cards_reviewed: int = 0
    total_quizzes_completed: int = 0
    total_perfect_quizzes: int = 0
    total_study_time_sec: int = 0


class AchievementResponse(BaseModel):
    achievement_key: str
    name: str
    description: str
    icon: str
    unlocked_at: datetime


class AchievementDefResponse(BaseModel):
    achievement_key: str
    name: str
    description: str
    icon: str
    unlocked: bool
    unlocked_at: Optional[datetime] = None


class XPAwardResponse(BaseModel):
    xp_earned: int
    xp_total: int
    level: int
    level_up: bool
    new_achievements: list[AchievementResponse]


class DailyGoalUpdate(BaseModel):
    target: int


class HeartsToggle(BaseModel):
    enabled: bool


class HeartUseResponse(BaseModel):
    hearts_remaining: int
    hearts_enabled: bool
    replenish_at: Optional[datetime] = None


class QuizCompletionAwardRequest(BaseModel):
    score_pct: float


# ---------- Helpers ----------

def _get_or_create_stats(db: Session, user_id: str) -> UserStats:
    stats = db.query(UserStats).filter(UserStats.user_id == user_id).first()
    if not stats:
        stats = UserStats(user_id=user_id)
        db.add(stats)
        db.commit()
        db.refresh(stats)
    return stats


def _check_and_unlock(
    db: Session,
    user_id: str,
    achievement_key: str,
) -> Optional[AchievementResponse]:
    """Check and unlock an achievement if not already unlocked."""
    if achievement_key not in ACHIEVEMENT_DEFS:
        return None
    existing = (
        db.query(Achievement)
        .filter(Achievement.user_id == user_id, Achievement.achievement_key == achievement_key)
        .first()
    )
    if existing:
        return None
    ach = Achievement(user_id=user_id, achievement_key=achievement_key)
    db.add(ach)
    db.commit()
    db.refresh(ach)
    defn = ACHIEVEMENT_DEFS[achievement_key]
    return AchievementResponse(
        achievement_key=achievement_key,
        name=defn["name"],
        description=defn["description"],
        icon=defn["icon"],
        unlocked_at=ach.unlocked_at,
    )


def _replenish_hearts(stats: UserStats) -> None:
    """Replenish hearts based on time elapsed."""
    if stats.hearts_remaining >= HEARTS_MAX:
        return
    now = datetime.utcnow()
    elapsed = (now - stats.hearts_last_replenish).total_seconds()
    hearts_to_add = int(elapsed // (HEARTS_REPLENISH_MINUTES * 60))
    if hearts_to_add > 0:
        stats.hearts_remaining = min(HEARTS_MAX, stats.hearts_remaining + hearts_to_add)
        stats.hearts_last_replenish = stats.hearts_last_replenish + timedelta(
            minutes=hearts_to_add * HEARTS_REPLENISH_MINUTES
        )


def _update_streak(stats: UserStats) -> list[AchievementResponse]:
    """Update streak based on last study date. Returns any new achievements."""
    new_achievements: list[AchievementResponse] = []
    today = datetime.utcnow().date()

    # Reset daily goal if new day
    today_str = today.isoformat()
    if stats.daily_goal_date != today_str:
        stats.daily_goal_completed = 0
        stats.daily_goal_date = today_str

    if stats.last_study_date:
        last_date = stats.last_study_date.date() if isinstance(stats.last_study_date, datetime) else stats.last_study_date
        days_gap = (today - last_date).days
        if days_gap == 0:
            return new_achievements  # Already studied today
        elif days_gap == 1:
            stats.streak_current += 1
        elif days_gap >= 2:
            stats.streak_current = 1
    else:
        stats.streak_current = 1

    stats.last_study_date = datetime.utcnow()
    stats.streak_longest = max(stats.streak_longest, stats.streak_current)
    return new_achievements


def award_xp(db: Session, user_id: str, xp_amount: int, reason: str = "") -> XPAwardResponse:
    """Award XP to a user and check for level ups and achievements."""
    stats = _get_or_create_stats(db, user_id)
    old_level = _level_from_xp(stats.xp_total)
    stats.xp_total += xp_amount
    new_level = _level_from_xp(stats.xp_total)
    stats.level = new_level
    db.commit()

    new_achievements: list[AchievementResponse] = []

    return XPAwardResponse(
        xp_earned=xp_amount,
        xp_total=stats.xp_total,
        level=new_level,
        level_up=new_level > old_level,
        new_achievements=new_achievements,
    )


def process_card_review(db: Session, user_id: str) -> XPAwardResponse:
    """Process a card review: award XP, update stats, check achievements."""
    stats = _get_or_create_stats(db, user_id)
    new_achievements: list[AchievementResponse] = []

    # Check comeback before updating streak
    comeback_bonus_applied = False
    if stats.last_study_date:
        days_gap = (datetime.utcnow().date() - stats.last_study_date.date()).days
        if days_gap >= 3:
            comeback_bonus_applied = True
            ach = _check_and_unlock(db, user_id, "comeback")
            if ach:
                new_achievements.append(ach)

    streak_achs = _update_streak(stats)
    new_achievements.extend(streak_achs)

    stats.total_cards_reviewed += 1
    stats.daily_goal_completed += 1

    # Calculate XP
    xp = XP_CARD_REVIEWED
    if comeback_bonus_applied:
        xp += XP_COMEBACK_BONUS
    xp += min(stats.streak_current, 30) * XP_STREAK_BONUS  # Streak bonus capped at 30 days

    old_level = stats.level
    stats.xp_total += xp
    stats.level = _level_from_xp(stats.xp_total)

    # Check achievements
    if stats.total_cards_reviewed == 1:
        ach = _check_and_unlock(db, user_id, "first_card")
        if ach:
            new_achievements.append(ach)
    if stats.total_cards_reviewed >= 100:
        ach = _check_and_unlock(db, user_id, "cards_100")
        if ach:
            new_achievements.append(ach)
    if stats.total_cards_reviewed >= 1000:
        ach = _check_and_unlock(db, user_id, "cards_1000")
        if ach:
            new_achievements.append(ach)

    # Streak achievements
    if stats.streak_current >= 3:
        ach = _check_and_unlock(db, user_id, "streak_3")
        if ach:
            new_achievements.append(ach)
    if stats.streak_current >= 7:
        ach = _check_and_unlock(db, user_id, "streak_7")
        if ach:
            new_achievements.append(ach)
    if stats.streak_current >= 30:
        ach = _check_and_unlock(db, user_id, "streak_30")
        if ach:
            new_achievements.append(ach)

    # Time-based achievements
    hour = datetime.utcnow().hour
    if hour >= 23 or hour < 5:
        ach = _check_and_unlock(db, user_id, "night_owl")
        if ach:
            new_achievements.append(ach)
    if 5 <= hour < 7:
        ach = _check_and_unlock(db, user_id, "early_bird")
        if ach:
            new_achievements.append(ach)

    # Daily goal check
    if stats.daily_goal_completed >= stats.daily_goal_target:
        xp += XP_DAILY_GOAL_MET
        stats.xp_total += XP_DAILY_GOAL_MET

    _replenish_hearts(stats)
    db.commit()

    return XPAwardResponse(
        xp_earned=xp,
        xp_total=stats.xp_total,
        level=stats.level,
        level_up=stats.level > old_level,
        new_achievements=new_achievements,
    )


def process_quiz_complete(db: Session, user_id: str, score_pct: float) -> XPAwardResponse:
    """Process quiz completion: award XP, check achievements."""
    stats = _get_or_create_stats(db, user_id)
    new_achievements: list[AchievementResponse] = []

    stats.total_quizzes_completed += 1

    xp = XP_QUIZ_COMPLETED
    is_perfect = score_pct >= 99.9

    if is_perfect:
        stats.total_perfect_quizzes += 1
        xp += XP_PERFECT_QUIZ
        ach = _check_and_unlock(db, user_id, "perfect_quiz")
        if ach:
            new_achievements.append(ach)

    if stats.total_quizzes_completed == 1:
        ach = _check_and_unlock(db, user_id, "first_quiz")
        if ach:
            new_achievements.append(ach)

    old_level = stats.level
    stats.xp_total += xp
    stats.level = _level_from_xp(stats.xp_total)
    db.commit()

    return XPAwardResponse(
        xp_earned=xp,
        xp_total=stats.xp_total,
        level=stats.level,
        level_up=stats.level > old_level,
        new_achievements=new_achievements,
    )


# ---------- Endpoints ----------

@router.get("/api/gamification/stats", response_model=UserStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not user:
        return UserStatsResponse()

    stats = _get_or_create_stats(db, user.id)
    _replenish_hearts(stats)
    db.commit()

    level = _level_from_xp(stats.xp_total)
    return UserStatsResponse(
        streak_current=stats.streak_current,
        streak_longest=stats.streak_longest,
        last_study_date=stats.last_study_date,
        xp_total=stats.xp_total,
        level=level,
        xp_for_current_level=_xp_for_level(level),
        xp_for_next_level=_xp_for_level(level + 1),
        hearts_remaining=stats.hearts_remaining,
        hearts_enabled=stats.hearts_enabled,
        daily_goal_target=stats.daily_goal_target,
        daily_goal_completed=stats.daily_goal_completed,
        daily_goal_date=stats.daily_goal_date,
        total_cards_reviewed=stats.total_cards_reviewed,
        total_quizzes_completed=stats.total_quizzes_completed,
        total_perfect_quizzes=stats.total_perfect_quizzes,
        total_study_time_sec=stats.total_study_time_sec,
    )


@router.get("/api/gamification/achievements", response_model=list[AchievementDefResponse])
def get_achievements(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    unlocked_map: dict[str, datetime] = {}
    if user:
        unlocked = db.query(Achievement).filter(Achievement.user_id == user.id).all()
        unlocked_map = {a.achievement_key: a.unlocked_at for a in unlocked}

    result = []
    for key, defn in ACHIEVEMENT_DEFS.items():
        result.append(AchievementDefResponse(
            achievement_key=key,
            name=defn["name"],
            description=defn["description"],
            icon=defn["icon"],
            unlocked=key in unlocked_map,
            unlocked_at=unlocked_map.get(key),
        ))
    return result


@router.post("/api/gamification/daily-goal", response_model=UserStatsResponse)
def update_daily_goal(
    body: DailyGoalUpdate,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    stats = _get_or_create_stats(db, user.id)
    stats.daily_goal_target = max(1, min(body.target, 500))
    db.commit()
    db.refresh(stats)

    level = _level_from_xp(stats.xp_total)
    return UserStatsResponse(
        streak_current=stats.streak_current,
        streak_longest=stats.streak_longest,
        last_study_date=stats.last_study_date,
        xp_total=stats.xp_total,
        level=level,
        xp_for_current_level=_xp_for_level(level),
        xp_for_next_level=_xp_for_level(level + 1),
        hearts_remaining=stats.hearts_remaining,
        hearts_enabled=stats.hearts_enabled,
        daily_goal_target=stats.daily_goal_target,
        daily_goal_completed=stats.daily_goal_completed,
        daily_goal_date=stats.daily_goal_date,
        total_cards_reviewed=stats.total_cards_reviewed,
        total_quizzes_completed=stats.total_quizzes_completed,
        total_perfect_quizzes=stats.total_perfect_quizzes,
        total_study_time_sec=stats.total_study_time_sec,
    )


@router.post("/api/gamification/hearts/toggle", response_model=HeartUseResponse)
def toggle_hearts(
    body: HeartsToggle,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    stats = _get_or_create_stats(db, user.id)
    stats.hearts_enabled = body.enabled
    if body.enabled:
        _replenish_hearts(stats)
    db.commit()

    replenish_at = None
    if stats.hearts_remaining < HEARTS_MAX and stats.hearts_enabled:
        replenish_at = stats.hearts_last_replenish + timedelta(minutes=HEARTS_REPLENISH_MINUTES)

    return HeartUseResponse(
        hearts_remaining=stats.hearts_remaining,
        hearts_enabled=stats.hearts_enabled,
        replenish_at=replenish_at,
    )


@router.post("/api/gamification/hearts/use", response_model=HeartUseResponse)
def use_heart(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Deduct one heart on a wrong answer."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    stats = _get_or_create_stats(db, user.id)
    _replenish_hearts(stats)

    if not stats.hearts_enabled:
        return HeartUseResponse(
            hearts_remaining=stats.hearts_remaining,
            hearts_enabled=False,
        )

    if stats.hearts_remaining <= 0:
        replenish_at = stats.hearts_last_replenish + timedelta(minutes=HEARTS_REPLENISH_MINUTES)
        raise HTTPException(
            status_code=429,
            detail="Out of hearts",
            headers={"X-Replenish-At": replenish_at.isoformat()},
        )

    if stats.hearts_remaining == HEARTS_MAX:
        stats.hearts_last_replenish = datetime.utcnow()
    stats.hearts_remaining -= 1
    db.commit()

    replenish_at = None
    if stats.hearts_remaining < HEARTS_MAX:
        replenish_at = stats.hearts_last_replenish + timedelta(minutes=HEARTS_REPLENISH_MINUTES)

    return HeartUseResponse(
        hearts_remaining=stats.hearts_remaining,
        hearts_enabled=stats.hearts_enabled,
        replenish_at=replenish_at,
    )


@router.post("/api/gamification/xp/award", response_model=XPAwardResponse)
def award_xp_endpoint(
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    """Award XP for a card review. Called by frontend after each review."""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return process_card_review(db, user.id)


@router.post("/api/gamification/quiz-complete", response_model=XPAwardResponse)
def award_quiz_completion(
    body: QuizCompletionAwardRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_current_user),
):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return process_quiz_complete(db, user.id, body.score_pct)
