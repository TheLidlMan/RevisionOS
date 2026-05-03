import hashlib
import logging
import os
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

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

# Compress responses larger than 500 bytes with gzip
fastapi_app.add_middleware(GZipMiddleware, minimum_size=500)

logger = logging.getLogger(__name__)
MAX_ETAG_BODY_BYTES = 1_000_000


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
async def etag_middleware(request: Request, call_next):
    """Add ETag headers on GET responses for cacheable API endpoints."""
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    content_length = response.headers.get("content-length")
    parsed_length = int(content_length) if content_length and content_length.isdigit() else None
    if (
        request.method == "GET"
        and response.status_code == 200
        and request.url.path.startswith("/api/")
        and "text/event-stream" not in content_type
        and "attachment" not in response.headers.get("content-disposition", "")
        and response.headers.get("etag") is None
        and ("application/json" in content_type or content_type.startswith("text/"))
        and (parsed_length is None or parsed_length <= MAX_ETAG_BODY_BYTES)
    ):
        body = getattr(response, "body", None)
        if body is None:
            return response
        if len(body) > MAX_ETAG_BODY_BYTES:
            return response
        etag = f'"{hashlib.md5(body, usedforsecurity=False).hexdigest()}"'
        if_none_match = request.headers.get("if-none-match", "")
        if if_none_match == etag:
            from fastapi.responses import Response as FResponse
            return FResponse(status_code=304, headers={"ETag": etag, "Cache-Control": "no-cache"})
        response.headers["ETag"] = etag
        response.headers["Cache-Control"] = "no-cache"
    return response


@fastapi_app.middleware("http")
async def request_timing_middleware(request: Request, call_next):
    """Log slow requests and pool pressure warnings."""
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


# Global exception handler for unhandled errors
@fastapi_app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions and return a safe 500 response."""
    logger.exception("Unhandled exception: %s", exc)
    return {"detail": "An internal error occurred. Please try again later."}


app = CORSMiddleware(
    app=fastapi_app,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
