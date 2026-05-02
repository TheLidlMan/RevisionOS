import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class QuizQuestion(Base):
    __tablename__ = "quiz_questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True, index=True)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(15), nullable=False)  # MCQ, SHORT_ANSWER, TRUE_FALSE, FILL_BLANK, EXAM_STYLE
    options = Column(Text, nullable=True)  # JSON string for MCQ options
    correct_answer = Column(Text, nullable=False)
    explanation = Column(Text, nullable=True, default="")
    difficulty = Column(String(10), nullable=False, default="MEDIUM")  # EASY, MEDIUM, HARD, EXAM
    source_document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    times_answered = Column(Integer, default=0)
    times_correct = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="quiz_questions")
    concept = relationship("Concept", back_populates="quiz_questions")
    source_document = relationship("Document", back_populates="quiz_questions")
