from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

_database_url = settings.database_url

if _database_url.startswith("sqlite"):
    # File-based SQLite is shared across FastAPI's thread pool, so it must
    # allow cross-thread use; pooling stays minimal for an embedded engine.
    engine = create_engine(
        _database_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    # Server databases benefit from an explicit pool so concurrent requests
    # reuse connections instead of opening a new one per request.
    engine = create_engine(
        _database_url,
        pool_pre_ping=True,
        pool_size=10,
        max_overflow=20,
        pool_recycle=1800,
        pool_timeout=30,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
