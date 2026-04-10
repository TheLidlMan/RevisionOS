import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    definition = Column(Text, nullable=True, default="")
    explanation = Column(Text, nullable=True, default="")
    importance_score = Column(Float, default=0.5)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="concepts")
    flashcards = relationship("Flashcard", back_populates="concept")
    quiz_questions = relationship("QuizQuestion", back_populates="concept")
