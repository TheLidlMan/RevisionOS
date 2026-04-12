import logging
import os
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import settings, get_cors_origins, get_cors_origin_regex
from database import create_tables, get_pool_snapshot, is_pool_under_pressure
from services.auth_service import validate_auth_settings
from services.pipeline_service import ensure_document_retry_worker_started, stop_document_retry_worker

from routers import modules, documents, flashcards, quizzes, study_sessions, concepts, auth
from routers import settings as settings_router
from routers import weakness_map, knowledge_graph, search as search_router, curriculum, exports
from routers import social, integrations, collaboration, features
from routers import gamification, tutor

fastapi_app = FastAPI(
    title="Revise OS API",
    description="AI-Powered Adaptive Study Platform Backend",
    version="1.0.0",
)

logger = logging.getLogger(__name__)


def _should_log_request_timing(path: str) -> bool:
    interesting_fragments = (
        "/auth/session",
        "/generate-cards",
        "/quizzes/generate",
        "/quizzes/sessions/",
        "/tutor/",
        "/detect-gaps",
        "/synthesis-cards",
        "/elaborate",
        "/free-recall",
        "/documents/clip-url",
        "/exam/",
        "/writing-prompt",
        "/writing/grade",
        "/integrations/",
        "/import-folder/",
    )
    return any(fragment in path for fragment in interesting_fragments)


@fastapi_app.middleware("http")
async def log_targeted_request_timing(request: Request, call_next):
    path = request.url.path
    if not settings.REQUEST_TIMING_LOG_ENABLED or not _should_log_request_timing(path):
        return await call_next(request)

    pool_before = get_pool_snapshot()
    started = perf_counter()
    status_code = 500
    error_name = None

    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    except Exception as exc:
        error_name = type(exc).__name__
        raise
    finally:
        duration_ms = (perf_counter() - started) * 1000
        pool_after = get_pool_snapshot()
        level = logging.WARNING if (
            duration_ms >= settings.REQUEST_TIMING_WARN_MS
            or is_pool_under_pressure(pool_before, settings.POOL_PRESSURE_WARN_RATIO)
            or is_pool_under_pressure(pool_after, settings.POOL_PRESSURE_WARN_RATIO)
        ) else logging.INFO
        logger.log(
            level,
            "request_timing method=%s path=%s status=%s duration_ms=%.1f pool_before=%s pool_after=%s error=%s",
            request.method,
            path,
            status_code,
            duration_ms,
            pool_before,
            pool_after,
            error_name,
        )

# Include routers
fastapi_app.include_router(auth.router)
fastapi_app.include_router(modules.router)
fastapi_app.include_router(documents.router)
fastapi_app.include_router(flashcards.router)
fastapi_app.include_router(quizzes.router)
fastapi_app.include_router(study_sessions.router)
fastapi_app.include_router(concepts.router)
fastapi_app.include_router(settings_router.router)
fastapi_app.include_router(weakness_map.router)
fastapi_app.include_router(knowledge_graph.router)
fastapi_app.include_router(search_router.router)
fastapi_app.include_router(curriculum.router)
fastapi_app.include_router(exports.router)
fastapi_app.include_router(social.router)
fastapi_app.include_router(integrations.router)
fastapi_app.include_router(collaboration.router)
fastapi_app.include_router(features.router)
fastapi_app.include_router(gamification.router)
fastapi_app.include_router(tutor.router)


@fastapi_app.on_event("startup")
async def on_startup():
    validate_auth_settings()
    create_tables()
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    await ensure_document_retry_worker_started()


@fastapi_app.on_event("shutdown")
async def on_shutdown():
    await stop_document_retry_worker()


@fastapi_app.get("/")
def root():
    return {"name": "Revise OS API", "version": "1.0.0", "status": "running"}


@fastapi_app.get("/api/health")
def health_check():
    return {"status": "ok"}


app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
