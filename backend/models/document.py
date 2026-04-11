import uuid
from datetime import datetime

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    module_id = Column(String(36), ForeignKey("modules.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String, nullable=False)
    file_type = Column(String(10), nullable=False)  # PDF, TXT, PPTX, DOCX, MD, MP3, MP4, IMAGE
    file_path = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True, default="")
    processed = Column(Boolean, default=False)
    processing_status = Column(String(20), default="pending")  # pending, processing, done, failed
    word_count = Column(Integer, default=0)
    transcript = Column(Text, nullable=True)  # Whisper transcription output
    summary = Column(Text, nullable=True)  # AI-generated document summary
    slide_count = Column(Integer, nullable=True)  # For PPTX files
    embedding = Column(Text, nullable=True)  # Base64-encoded embedding vector
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    module = relationship("Module", back_populates="documents")
    flashcards = relationship("Flashcard", back_populates="source_document")
    quiz_questions = relationship("QuizQuestion", back_populates="source_document")
