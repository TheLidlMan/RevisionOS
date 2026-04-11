import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings, get_cors_origins, get_cors_origin_regex
from database import create_tables
from services.auth_service import validate_auth_settings

from routers import modules, documents, flashcards, quizzes, study_sessions, concepts, auth
from routers import settings as settings_router
from routers import weakness_map, knowledge_graph, search as search_router, curriculum, exports
from routers import social, integrations, collaboration, features

app = FastAPI(
    title="Revise OS API",
    description="AI-Powered Adaptive Study Platform Backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(modules.router)
app.include_router(documents.router)
app.include_router(flashcards.router)
app.include_router(quizzes.router)
app.include_router(study_sessions.router)
app.include_router(concepts.router)
app.include_router(settings_router.router)
app.include_router(weakness_map.router)
app.include_router(knowledge_graph.router)
app.include_router(search_router.router)
app.include_router(curriculum.router)
app.include_router(exports.router)
app.include_router(social.router)
app.include_router(integrations.router)
app.include_router(collaboration.router)
app.include_router(features.router)


@app.on_event("startup")
def on_startup():
    validate_auth_settings()
    create_tables()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)


@app.get("/")
def root():
    return {"name": "Revise OS API", "version": "1.0.0", "status": "running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
