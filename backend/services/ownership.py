from typing import Optional

from fastapi import HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Query, Session

from models.document import Document
from models.flashcard import Flashcard
from models.module import Module
from models.quiz_question import QuizQuestion
from models.quiz_session import StudySession
from models.user import User


def _matches_owner(column, user: Optional[User]):
    if user:
        return column == user.id
    return column.is_(None)


def scope_modules(query: Query, user: Optional[User]) -> Query:
    return query.filter(_matches_owner(Module.user_id, user))


def scope_documents(query: Query, user: Optional[User]) -> Query:
    return query.filter(Document.module.has(_matches_owner(Module.user_id, user)))


def scope_flashcards(query: Query, user: Optional[User]) -> Query:
    return query.filter(Flashcard.module.has(_matches_owner(Module.user_id, user)))


def scope_quiz_questions(query: Query, user: Optional[User]) -> Query:
    return query.filter(QuizQuestion.module.has(_matches_owner(Module.user_id, user)))


def scope_study_sessions(query: Query, user: Optional[User]) -> Query:
    return query.filter(
        or_(
            _matches_owner(StudySession.user_id, user),
            StudySession.module.has(_matches_owner(Module.user_id, user)),
        )
    )


def get_owned_module(db: Session, module_id: str, user: Optional[User]) -> Optional[Module]:
    return scope_modules(db.query(Module).filter(Module.id == module_id), user).first()


def get_owned_document(db: Session, document_id: str, user: Optional[User]) -> Optional[Document]:
    return scope_documents(db.query(Document).filter(Document.id == document_id), user).first()


def get_owned_flashcard(db: Session, card_id: str, user: Optional[User]) -> Optional[Flashcard]:
    return scope_flashcards(db.query(Flashcard).filter(Flashcard.id == card_id), user).first()


def get_owned_quiz_question(db: Session, question_id: str, user: Optional[User]) -> Optional[QuizQuestion]:
    return scope_quiz_questions(db.query(QuizQuestion).filter(QuizQuestion.id == question_id), user).first()


def get_owned_study_session(db: Session, session_id: str, user: Optional[User]) -> Optional[StudySession]:
    return scope_study_sessions(db.query(StudySession).filter(StudySession.id == session_id), user).first()


def require_owned_module(db: Session, module_id: str, user: Optional[User]) -> Module:
    module = get_owned_module(db, module_id, user)
    if not module:
        raise HTTPException(status_code=404, detail="Module not found")
    return module


def require_owned_document(db: Session, document_id: str, user: Optional[User]) -> Document:
    document = get_owned_document(db, document_id, user)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def require_owned_flashcard(db: Session, card_id: str, user: Optional[User]) -> Flashcard:
    card = get_owned_flashcard(db, card_id, user)
    if not card:
        raise HTTPException(status_code=404, detail="Flashcard not found")
    return card


def require_owned_quiz_question(db: Session, question_id: str, user: Optional[User]) -> QuizQuestion:
    question = get_owned_quiz_question(db, question_id, user)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


def require_owned_study_session(db: Session, session_id: str, user: Optional[User]) -> StudySession:
    session = get_owned_study_session(db, session_id, user)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
