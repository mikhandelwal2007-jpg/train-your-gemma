import os
from pathlib import Path
from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from app.backend.config import settings

# Ensure data directory exists
if settings.DATABASE_URL.startswith("sqlite"):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    parent_dir = Path(db_path).parent
    parent_dir.mkdir(parents=True, exist_ok=True)

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args,
)


def init_db() -> None:
    # Enable WAL mode and foreign keys for SQLite
    if settings.DATABASE_URL.startswith("sqlite"):
        with engine.connect() as connection:
            connection.exec_driver_sql("PRAGMA journal_mode=WAL;")
            connection.exec_driver_sql("PRAGMA foreign_keys=ON;")
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
