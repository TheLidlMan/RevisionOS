from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.schema import CreateColumn

from config import settings

engine_kwargs = {"echo": False}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


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
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}"))


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
            "last_pipeline_updated_at",
            "cancel_requested_at",
            "cancelled_at",
            "delete_requested_at",
        ],
        "modules": [
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
        "flashcards": ["generation_source", "updated_at"],
        "users": ["auth_provider", "google_subject", "avatar_url", "email_verified_at", "last_login_at"],
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        for table_name, columns in runtime_columns.items():
            _add_missing_columns(conn, inspector, table_name, columns)

        existing_tables = set(inspector.get_table_names())
        for table_name in ["module_jobs", "auth_sessions", "ai_usage_events"]:
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

        existing_tables = set(inspector.get_table_names())
        if "modules" in existing_tables:
            conn.execute(text("UPDATE modules SET pipeline_status = 'idle' WHERE pipeline_status IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_stage = 'idle' WHERE pipeline_stage IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_completed = 0 WHERE pipeline_completed IS NULL"))
            conn.execute(text("UPDATE modules SET pipeline_total = 0 WHERE pipeline_total IS NULL"))

        if "documents" in existing_tables:
            conn.execute(text("UPDATE documents SET file_size_bytes = COALESCE(file_size_bytes, 0)"))
            conn.execute(text("UPDATE documents SET processing_stage = COALESCE(processing_stage, 'uploaded')"))
            conn.execute(text("UPDATE documents SET processing_completed = COALESCE(processing_completed, 0)"))
            conn.execute(text("UPDATE documents SET processing_total = COALESCE(processing_total, 0)"))
            conn.execute(text("UPDATE documents SET updated_at = COALESCE(updated_at, created_at)"))

        if "concepts" in existing_tables:
            conn.execute(text("UPDATE concepts SET study_weight = COALESCE(study_weight, 1.0)"))

        if "flashcards" in existing_tables:
            conn.execute(text("UPDATE flashcards SET generation_source = 'MANUAL' WHERE generation_source IS NULL"))
            conn.execute(text("UPDATE flashcards SET updated_at = COALESCE(updated_at, created_at)"))
