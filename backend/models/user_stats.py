import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from database import Base


class UserStats(Base):
    __tablename__ = "user_stats"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)

    # Streaks
    streak_current = Column(Integer, default=0, nullable=False)
    streak_longest = Column(Integer, default=0, nullable=False)
    last_study_date = Column(DateTime, nullable=True)

    # XP and levels
    xp_total = Column(Integer, default=0, nullable=False)
    level = Column(Integer, default=1, nullable=False)

    # Hearts system
    hearts_remaining = Column(Integer, default=15, nullable=False)
    hearts_last_replenish = Column(DateTime, default=datetime.utcnow, nullable=False)
    hearts_enabled = Column(Boolean, default=True, nullable=False)

    # Daily goal
    daily_goal_target = Column(Integer, default=20, nullable=False)
    daily_goal_completed = Column(Integer, default=0, nullable=False)
    daily_goal_date = Column(String(10), nullable=True)  # YYYY-MM-DD

    # Lifetime stats
    total_cards_reviewed = Column(Integer, default=0, nullable=False)
    total_quizzes_completed = Column(Integer, default=0, nullable=False)
    total_perfect_quizzes = Column(Integer, default=0, nullable=False)
    total_study_time_sec = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", backref="stats")


class Achievement(Base):
    __tablename__ = "achievements"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    achievement_key = Column(String(50), nullable=False)  # e.g. "first_card", "streak_7"
    unlocked_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="achievements")
