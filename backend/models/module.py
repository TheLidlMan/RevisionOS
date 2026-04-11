import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship

from database import Base


class Module(Base):
    __tablename__ = "modules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    color = Column(String(7), nullable=False, default="#00b4d8")
    exam_date = Column(DateTime, nullable=True)
    pipeline_status = Column(String(20), nullable=False, default="idle")
    pipeline_stage = Column(String(50), nullable=False, default="idle")
    pipeline_completed = Column(Integer, nullable=False, default=0)
    pipeline_total = Column(Integer, nullable=False, default=0)
    pipeline_error = Column(Text, nullable=True)
    pipeline_updated_at = Column(DateTime, nullable=True)
    study_plan_json = Column(Text, nullable=True)
    study_plan_generated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="module", cascade="all, delete-orphan")
    concepts = relationship("Concept", back_populates="module", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="module", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="module", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="module", cascade="all, delete-orphan")
    jobs = relationship("ModuleJob", back_populates="module", cascade="all, delete-orphan")
