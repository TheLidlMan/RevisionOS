import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from database import Base


class FlashcardAsset(Base):
    __tablename__ = "flashcard_assets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    flashcard_id = Column(String(36), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String, nullable=False)
    mime_type = Column(String(100), nullable=False, default="image/png")
    original_filename = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    flashcard = relationship("Flashcard", back_populates="assets")
