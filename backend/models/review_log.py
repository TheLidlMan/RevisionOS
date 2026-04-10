import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(String(36), ForeignKey("study_sessions.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String(36), nullable=False)
    item_type = Column(String(15), nullable=False)  # FLASHCARD, QUESTION
    rating = Column(String(10), nullable=False)  # AGAIN, HARD, GOOD, EASY or score
    time_taken_seconds = Column(Float, default=0.0)
    answered_at = Column(DateTime, default=datetime.utcnow)
    was_correct = Column(Boolean, default=False)
    user_answer = Column(Text, nullable=True)

    session = relationship("StudySession", back_populates="review_logs")
