from sqlalchemy import Column, DateTime, String

from database import Base


class AiRequestLock(Base):
    __tablename__ = "ai_request_locks"

    name = Column(String(50), primary_key=True)
    owner_id = Column(String(36), nullable=True, index=True)
    acquired_at = Column(DateTime, nullable=True)
    heartbeat_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True, index=True)