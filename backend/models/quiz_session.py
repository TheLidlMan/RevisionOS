import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class StudySession(Base):
    __tablename__ = "study_sessions"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ready', 'generating', 'in_progress', 'completed')",
            name="ck_study_sessions_status",
        ),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=True, index=True)
    session_type = Column(String(20), nullable=False)  # FLASHCARDS, QUIZ, MIXED, WEAKNESS_DRILL
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    total_items = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    incorrect = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    score_pct = Column(Float, default=0.0)
    status = Column(String(20), default="in_progress", nullable=False)  # ready, generating, in_progress, completed
    active_duration_sec = Column(Integer, default=0, nullable=False)
    paused_at = Column(DateTime, nullable=True)
    resumed_at = Column(DateTime, default=datetime.utcnow, nullable=True)
    timer_state = Column(String(20), default="running", nullable=False)

    module = relationship("Module", back_populates="study_sessions")
    review_logs = relationship("ReviewLog", back_populates="session", cascade="all, delete-orphan")
