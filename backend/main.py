import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import create_tables

from routers import modules, documents, flashcards, quizzes, study_sessions, concepts
from routers import settings as settings_router

app = FastAPI(
    title="RevisionOS API",
    description="AI-Powered Adaptive Study Platform Backend",
    version="1.0.0",
)

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(modules.router)
app.include_router(documents.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(study_sessions.router)
app.include_router(concepts.router)
app.include_router(settings_router.router)


@app.on_event("startup")
def on_startup():
    create_tables()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    return {"name": "RevisionOS API", "version": "1.0.0", "status": "running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
