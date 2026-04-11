from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, declarative_base

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


def _ensure_runtime_schema():
    if not settings.DATABASE_URL.startswith("sqlite"):
        return

    runtime_columns = {
        "documents": {
            "embedding": "TEXT",
            "updated_at": "DATETIME",
            "file_size_bytes": "INTEGER DEFAULT 0",
            "file_sha256": "VARCHAR(64)",
            "processing_stage": "VARCHAR(50) DEFAULT 'uploaded'",
            "processing_error": "TEXT",
            "processing_completed": "INTEGER DEFAULT 0 NOT NULL",
            "processing_total": "INTEGER DEFAULT 0 NOT NULL",
            "last_pipeline_updated_at": "DATETIME",
            "cancel_requested_at": "DATETIME",
            "cancelled_at": "DATETIME",
            "delete_requested_at": "DATETIME",
        },
        "modules": {
            "exam_date": "DATETIME",
            "pipeline_status": "VARCHAR(20) DEFAULT 'idle' NOT NULL",
            "pipeline_stage": "VARCHAR(50) DEFAULT 'idle' NOT NULL",
            "pipeline_completed": "INTEGER DEFAULT 0 NOT NULL",
            "pipeline_total": "INTEGER DEFAULT 0 NOT NULL",
            "pipeline_error": "TEXT",
            "pipeline_updated_at": "DATETIME",
            "study_plan_json": "TEXT",
            "study_plan_generated_at": "DATETIME",
        },
        "concepts": {
            "study_weight": "FLOAT DEFAULT 1.0",
        },
        "flashcards": {
            "generation_source": "VARCHAR(10) DEFAULT 'MANUAL' NOT NULL",
            "updated_at": "DATETIME",
        },
        "users": {
            "auth_provider": "VARCHAR(20) DEFAULT 'local'",
            "google_subject": "VARCHAR",
            "avatar_url": "VARCHAR",
            "email_verified_at": "DATETIME",
            "last_login_at": "DATETIME",
        },
    }

    with engine.begin() as conn:
        inspector = inspect(conn)
        for table_name, columns in runtime_columns.items():
            if table_name not in inspector.get_table_names():
                continue

            existing = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_sql in columns.items():
                if column_name in existing:
                    continue
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))

        if "module_jobs" not in inspector.get_table_names():
            Base.metadata.tables["module_jobs"].create(bind=conn)

        if "auth_sessions" not in inspector.get_table_names():
            Base.metadata.tables["auth_sessions"].create(bind=conn)

        module_job_columns = {
            "started_at": "DATETIME",
            "finished_at": "DATETIME",
            "cancel_requested_at": "DATETIME",
            "cancelled_at": "DATETIME",
        }
        if "module_jobs" in inspector.get_table_names():
            existing_job_columns = {column["name"] for column in inspector.get_columns("module_jobs")}
            for column_name, column_sql in module_job_columns.items():
                if column_name in existing_job_columns:
                    continue
                conn.execute(text(f"ALTER TABLE module_jobs ADD COLUMN {column_name} {column_sql}"))

        if "ai_usage_events" not in inspector.get_table_names():
            Base.metadata.tables["ai_usage_events"].create(bind=conn)

        conn.execute(text("UPDATE modules SET pipeline_status = 'idle' WHERE pipeline_status IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_stage = 'idle' WHERE pipeline_stage IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_completed = 0 WHERE pipeline_completed IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_total = 0 WHERE pipeline_total IS NULL"))
        conn.execute(text("UPDATE documents SET file_size_bytes = COALESCE(file_size_bytes, 0)"))
        conn.execute(text("UPDATE documents SET processing_stage = COALESCE(processing_stage, 'uploaded')"))
        conn.execute(text("UPDATE documents SET processing_completed = COALESCE(processing_completed, 0)"))
        conn.execute(text("UPDATE documents SET processing_total = COALESCE(processing_total, 0)"))
        conn.execute(text("UPDATE documents SET updated_at = COALESCE(updated_at, created_at)"))
        conn.execute(text("UPDATE concepts SET study_weight = COALESCE(study_weight, 1.0)"))
        conn.execute(text("UPDATE flashcards SET generation_source = 'MANUAL' WHERE generation_source IS NULL"))
        conn.execute(text("UPDATE flashcards SET updated_at = COALESCE(updated_at, created_at)"))
