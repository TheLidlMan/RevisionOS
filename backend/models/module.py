import uuid
from datetime import datetime

from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship

from database import Base


class Module(Base):
    __tablename__ = "modules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True, default="")
    color = Column(String(7), nullable=False, default="#00b4d8")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    documents = relationship("Document", back_populates="module", cascade="all, delete-orphan")
    concepts = relationship("Concept", back_populates="module", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="module", cascade="all, delete-orphan")
    quiz_questions = relationship("QuizQuestion", back_populates="module", cascade="all, delete-orphan")
    study_sessions = relationship("StudySession", back_populates="module", cascade="all, delete-orphan")
