from typing import Any

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.schema import CreateColumn

from config import settings

engine_kwargs: dict[str, Any] = {"echo": False}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = settings.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DB_MAX_OVERFLOW
    engine_kwargs["pool_timeout"] = settings.DB_POOL_TIMEOUT
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = settings.DB_POOL_RECYCLE
    engine_kwargs["pool_use_lifo"] = True
    if settings.DATABASE_URL.startswith(("postgresql://", "postgresql+", "postgres://")):
        engine_kwargs["connect_args"] = {
            "options": f"-c statement_timeout={settings.DB_STATEMENT_TIMEOUT_MS}",
        }

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_pool_snapshot() -> dict[str, Any]:
    pool = getattr(engine, "pool", None)
    snapshot: dict[str, Any] = {
        "status": "unavailable",
        "checked_out": None,
        "size": None,
        "overflow": None,
    }
    if pool is None:
        return snapshot

    status_method = getattr(pool, "status", None)
    if callable(status_method):
        try:
            snapshot["status"] = status_method()
        except Exception:
            snapshot["status"] = "unavailable"

    for attr_name, key in (("checkedout", "checked_out"), ("size", "size"), ("overflow", "overflow")):
        method = getattr(pool, attr_name, None)
        if not callable(method):
            continue
        try:
            snapshot[key] = int(method())
        except Exception:
            snapshot[key] = None

    return snapshot


def is_pool_under_pressure(snapshot: dict[str, Any], warn_ratio: float) -> bool:
    checked_out = snapshot.get("checked_out")
    size = snapshot.get("size")
    if not isinstance(checked_out, int) or not isinstance(size, int) or size <= 0:
        return False
    return (checked_out / size) >= warn_ratio


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    import models  # noqa: F401 — registers all models
    Base.metadata.create_all(bind=engine)
    _ensure_runtime_schema()


def _add_missing_columns(conn, inspector, table_name: str, column_names: list[str]) -> None:
    table_names = set(inspector.get_table_names())
    if table_name not in table_names:
        return

    existing = {column["name"] for column in inspector.get_columns(table_name)}
    table = Base.metadata.tables.get(table_name)
    if table is None:
        return

    for column_name in column_names:
        if column_name in existing or column_name not in table.c:
            continue
        column_sql = str(CreateColumn(table.c[column_name]).compile(dialect=conn.dialect))
        quoted_table_name = conn.dialect.identifier_preparer.quote(table_name)
        conn.execute(text(f"ALTER TABLE {quoted_table_name} ADD COLUMN {column_sql}"))


def _ensure_index(conn, existing_indexes_by_table: dict[str, set[str]], table_name: str, index_name: str, column_names: list[str]) -> None:
    existing_indexes = existing_indexes_by_table.get(table_name)
    if existing_indexes is None:
        return

    if index_name in existing_indexes:
        return

    preparer = conn.dialect.identifier_preparer
    quoted_index_name = preparer.quote(index_name)
    quoted_table_name = preparer.quote(table_name)
    quoted_columns = ", ".join(preparer.quote(column_name) for column_name in column_names)
    conn.execute(text(f"CREATE INDEX {quoted_index_name} ON {quoted_table_name} ({quoted_columns})"))
    existing_indexes.add(index_name)


def _ensure_runtime_schema():
    runtime_columns = {
        "documents": [
            "embedding",
            "updated_at",
            "file_size_bytes",
            "file_sha256",
            "processing_stage",
            "processing_error",
            "processing_completed",
            "processing_total",
            "processing_attempts",
            "last_pipeline_updated_at",
            "next_retry_at",
            "cancel_requested_at",
            "cancelled_at",
            "delete_requested_at",
        ],
        "modules": [
            "sort_order",
            "exam_date",
            "pipeline_status",
            "pipeline_stage",
            "pipeline_completed",
            "pipeline_total",
            "pipeline_error",
            "pipeline_updated_at",
            "study_plan_json",
            "study_plan_generated_at",
        ],
        "concepts": ["study_weight"],
        "flashcards": ["generation_source", "updated_at", "study_difficulty", "is_bookmarked"],
        "users": ["auth_provider", "google_subject", "avatar_url", "email_verified_at", "last_login_at"],
        "topic_progress": [
            "status",
            "progress_pct",
            "last_score_pct",
            "confidence_pct",
            "question_count",
            "correct_count",
            "notes",
            "last_activity_at",
            "updated_at",
        ],
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        for table_name, columns in runtime_columns.items():
            _add_missing_columns(conn, inspector, table_name, columns)

        existing_tables = set(inspector.get_table_names())
        for table_name in ["module_jobs", "auth_sessions", "ai_usage_events", "ai_request_locks", "user_stats", "achievements", "topic_progress", "flashcard_assets"]:
            if table_name in existing_tables:
                continue
            Base.metadata.tables[table_name].create(bind=conn)

        inspector = inspect(conn)
        _add_missing_columns(
            conn,
            inspector,
            "module_jobs",
            ["started_at", "finished_at", "cancel_requested_at", "cancelled_at"],
        )
        _add_missing_columns(
            conn,
            inspector,
            "study_sessions",
            ["active_duration_sec", "paused_at", "resumed_at", "timer_state"],
        )

        existing_tables = set(inspector.get_table_names())
        if "modules" in existing_tables:
            conn.execute(text("UPDATE modules SET sort_order = COALESCE(sort_order, 0)"))
            conn.execute(text("UPDATE modules SET pipeline_status = 'idle' WHERE pipeline_status IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_stage = 'idle' WHERE pipeline_stage IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_completed = 0 WHERE pipeline_completed IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_total = 0 WHERE pipeline_total IS NULL"))

        if "documents" in existing_tables:
            conn.execute(text("UPDATE documents SET file_size_bytes = COALESCE(file_size_bytes, 0)"))
            conn.execute(text("UPDATE documents SET processing_stage = COALESCE(processing_stage, 'uploaded')"))
            conn.execute(text("UPDATE documents SET processing_completed = COALESCE(processing_completed, 0)"))
            conn.execute(text("UPDATE documents SET processing_total = COALESCE(processing_total, 0)"))
            conn.execute(text("UPDATE documents SET processing_attempts = COALESCE(processing_attempts, 0)"))
            conn.execute(text("UPDATE documents SET updated_at = COALESCE(updated_at, created_at)"))

        if "concepts" in existing_tables:
            conn.execute(text("UPDATE concepts SET study_weight = COALESCE(study_weight, 1.0)"))

        if "flashcards" in existing_tables:
            conn.execute(text("UPDATE flashcards SET generation_source = 'MANUAL' WHERE generation_source IS NULL"))
            conn.execute(text("UPDATE flashcards SET updated_at = COALESCE(updated_at, created_at)"))
            conn.execute(text("UPDATE flashcards SET study_difficulty = COALESCE(study_difficulty, 'MEDIUM')"))
            conn.execute(text("UPDATE flashcards SET is_bookmarked = COALESCE(is_bookmarked, 0)"))

        if "study_sessions" in existing_tables:
            conn.execute(text("UPDATE study_sessions SET active_duration_sec = COALESCE(active_duration_sec, 0)"))
            conn.execute(text("UPDATE study_sessions SET timer_state = COALESCE(timer_state, 'running')"))
            conn.execute(text("UPDATE study_sessions SET resumed_at = COALESCE(resumed_at, started_at)"))

        if "topic_progress" in existing_tables:
            conn.execute(text("UPDATE topic_progress SET status = COALESCE(status, 'not_started')"))
            conn.execute(text("UPDATE topic_progress SET progress_pct = COALESCE(progress_pct, 0.0)"))
            conn.execute(text("UPDATE topic_progress SET question_count = COALESCE(question_count, 0)"))
            conn.execute(text("UPDATE topic_progress SET correct_count = COALESCE(correct_count, 0)"))
            conn.execute(text("UPDATE topic_progress SET updated_at = COALESCE(updated_at, created_at)"))

        inspector = inspect(conn)
        existing_indexes_by_table = {
            table_name: {index["name"] for index in inspector.get_indexes(table_name)}
            for table_name in existing_tables
        }
        hot_path_indexes = (
            ("flashcards", "ix_flashcards_user_id_due_updated_at", ["user_id", "due", "updated_at"]),
            ("flashcards", "ix_flashcards_module_id_updated_at_id", ["module_id", "updated_at", "id"]),
            ("flashcards", "ix_flashcards_module_id_due_id", ["module_id", "due", "id"]),
            ("flashcards", "ix_flashcards_module_id_bookmarked_updated_at", ["module_id", "is_bookmarked", "updated_at"]),
            ("documents", "ix_documents_module_id_status_delete_requested_at", ["module_id", "processing_status", "delete_requested_at"]),
            ("review_logs", "ix_review_logs_user_id_answered_at", ["user_id", "answered_at"]),
            ("study_sessions", "ix_study_sessions_user_id_started_at", ["user_id", "started_at"]),
        )
        for table_name, index_name, column_names in hot_path_indexes:
            _ensure_index(conn, existing_indexes_by_table, table_name, index_name, column_names)
