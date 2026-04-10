import uuid
from datetime import datetime

from sqlalchemy import Column, String, Float, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Concept(Base):
    __tablename__ = "concepts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    definition = Column(Text, nullable=True, default="")
    explanation = Column(Text, nullable=True, default="")
    importance_score = Column(Float, default=0.5)
    parent_concept_id = Column(String(36), ForeignKey("concepts.id", ondelete="SET NULL"), nullable=True)
    order_index = Column(Integer, default=0)  # Logical ordering within parent
    source_document_ids = Column(Text, nullable=True, default="[]")  # JSON array of document IDs
    related_concept_ids = Column(Text, nullable=True, default="[]")  # JSON array for knowledge graph edges
    embedding = Column(Text, nullable=True)  # Base64-encoded embedding vector
    created_at = Column(DateTime, default=datetime.utcnow)

    module = relationship("Module", back_populates="concepts")
    parent = relationship("Concept", remote_side="Concept.id", backref="children", foreign_keys=[parent_concept_id])
    flashcards = relationship("Flashcard", back_populates="concept")
    quiz_questions = relationship("QuizQuestion", back_populates="concept")
