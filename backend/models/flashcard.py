import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False, index=True)
    concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True, index=True)
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    card_type = Column(String(10), nullable=False, default="BASIC")  # BASIC, CLOZE
    cloze_text = Column(Text, nullable=True)
    source_document_id = Column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True, index=True)
    source_excerpt = Column(Text, nullable=True)
    tags = Column(Text, nullable=True, default="[]")  # JSON string
    generation_source = Column(String(10), nullable=False, default="MANUAL")  # AUTO, MANUAL

    # FSRS scheduling fields
    due = Column(DateTime, default=datetime.utcnow)
    stability = Column(Float, default=0.0)
    difficulty = Column(Float, default=0.0)
    elapsed_days = Column(Integer, default=0)
    scheduled_days = Column(Integer, default=0)
    reps = Column(Integer, default=0)
    lapses = Column(Integer, default=0)
    state = Column(String(15), default="NEW")  # NEW, LEARNING, REVIEW, RELEARNING
    last_review = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="flashcards")
    concept = relationship("Concept", back_populates="flashcards")
    source_document = relationship("Document", back_populates="flashcards")
