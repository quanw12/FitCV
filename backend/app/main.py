from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.api.routes import (
    analyzer,
    applications,
    auth,
    cv_ranking,
    email_workflow,
    improvements,
    jobs,
    pipeline,
    profile,
)
from app.core.config import settings

app = FastAPI(title="FitCV API", version="0.1.0")

settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(analyzer.router, prefix="/api", tags=["cv-jd-analyzer"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(cv_ranking.router, prefix="/api/hr/cv-ranking", tags=["cv-ranking"])
app.include_router(improvements.router, prefix="/api/match-results", tags=["improvement-reports"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(pipeline.router, prefix="/api/hr/pipeline", tags=["pipeline"])
app.include_router(
    email_workflow.router,
    prefix="/api/hr/emails",
    tags=["candidate-emails"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
