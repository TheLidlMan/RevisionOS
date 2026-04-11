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
        },
        "modules": {
            "exam_date": "DATETIME",
            "pipeline_status": "VARCHAR(20) DEFAULT 'idle' NOT NULL",
            "pipeline_stage": "VARCHAR(50) DEFAULT 'idle' NOT NULL",
            "pipeline_completed": "INTEGER DEFAULT 0 NOT NULL",
            "pipeline_total": "INTEGER DEFAULT 0 NOT NULL",
            "pipeline_error": "TEXT",
            "study_plan_json": "TEXT",
            "study_plan_generated_at": "DATETIME",
        },
        "concepts": {
            "study_weight": "FLOAT DEFAULT 1.0",
        },
        "flashcards": {
            "generation_source": "VARCHAR(10) DEFAULT 'MANUAL' NOT NULL",
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

        conn.execute(text("UPDATE modules SET pipeline_status = 'idle' WHERE pipeline_status IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_stage = 'idle' WHERE pipeline_stage IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_completed = 0 WHERE pipeline_completed IS NULL"))
        conn.execute(text("UPDATE modules SET pipeline_total = 0 WHERE pipeline_total IS NULL"))
        conn.execute(text("UPDATE concepts SET study_weight = COALESCE(study_weight, 1.0)"))
        conn.execute(text("UPDATE flashcards SET generation_source = 'MANUAL' WHERE generation_source IS NULL"))
