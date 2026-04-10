import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from database import Base


class StudySession(Base):
    __tablename__ = "study_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=True)
    session_type = Column(String(20), nullable=False)  # FLASHCARDS, QUIZ, MIXED, WEAKNESS_DRILL
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    total_items = Column(Integer, default=0)
    correct = Column(Integer, default=0)
    incorrect = Column(Integer, default=0)
    skipped = Column(Integer, default=0)
    score_pct = Column(Float, default=0.0)

    module = relationship("Module", back_populates="study_sessions")
    review_logs = relationship("ReviewLog", back_populates="session", cascade="all, delete-orphan")
