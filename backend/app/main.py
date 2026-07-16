from pathlib import Path
import sys
import logging

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from sqlalchemy.exc import OperationalError, ProgrammingError
from sqlalchemy.orm import Session
import uvicorn

from app.api.routes import auth, cv_ranking, improvements, profile
from app.core.config import settings
from app.db.session import get_db

app = FastAPI(title="FitCV API", version="0.1.0")
logger = logging.getLogger(__name__)
uploads_dir = Path(__file__).resolve().parents[1] / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


@app.exception_handler(OperationalError)
async def database_unavailable_handler(request: Request, exc: OperationalError) -> JSONResponse:
    logger.error(
        "DATABASE_UNAVAILABLE %s %s: %s",
        request.method,
        request.url.path,
        exc.orig,
    )
    return JSONResponse(
        status_code=503,
        content={"detail": "Database is temporarily unavailable. Check the MySQL connection."},
    )


@app.exception_handler(ProgrammingError)
async def database_schema_error_handler(request: Request, exc: ProgrammingError) -> JSONResponse:
    error_code = exc.orig.args[0] if getattr(exc.orig, "args", None) else None
    logger.error(
        "DATABASE_QUERY_FAILED %s %s: %s",
        request.method,
        request.url.path,
        exc.orig,
    )
    if error_code == 1146:
        return JSONResponse(
            status_code=503,
            content={"detail": "Database schema is out of date. Apply the pending migrations."},
        )
    return JSONResponse(
        status_code=500,
        content={"detail": "Database query failed."},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(cv_ranking.router, prefix="/api/hr/cv-ranking", tags=["cv-ranking"])
app.include_router(improvements.router, prefix="/api/match-results", tags=["improvement-reports"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health/database")
def database_health_check(db: Session = Depends(get_db)) -> dict[str, str]:
    db.execute(text("SELECT 1"))
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
