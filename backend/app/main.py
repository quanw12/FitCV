from pathlib import Path
import asyncio
import sys
from contextlib import asynccontextmanager

if __package__ in {None, ""}:
    sys.path.append(str(Path(__file__).resolve().parents[1]))

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn

from app.api.routes import (
    analyzer,
    ai_tasks,
    applications,
    auth,
    cv_ranking,
    cv_rebuild,
    email_webhooks,
    email_workflow,
    improvements,
    job_search,
    jobs,
    pipeline,
    profile,
    reports,
)
from app.core.config import settings
from app.services.ai_worker import run_worker


@asynccontextmanager
async def lifespan(_: FastAPI):
    stop = asyncio.Event()
    worker_task = (
        asyncio.create_task(run_worker(stop))
        if settings.ai_worker_enabled and "pytest" not in sys.modules
        else None
    )
    try:
        yield
    finally:
        if worker_task is not None:
            stop.set()
            await worker_task


app = FastAPI(title="FitCV API", version="0.1.0", lifespan=lifespan)

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
app.include_router(ai_tasks.router, prefix="/api/ai/tasks", tags=["ai-tasks"])
app.include_router(analyzer.router, prefix="/api", tags=["cv-jd-analyzer"])
app.include_router(job_search.router, prefix="/api", tags=["job-search"])
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(cv_ranking.router, prefix="/api/hr/cv-ranking", tags=["cv-ranking"])
app.include_router(improvements.router, prefix="/api/match-results", tags=["improvement-reports"])
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(pipeline.router, prefix="/api/hr/pipeline", tags=["pipeline"])
app.include_router(reports.router, prefix="/api/hr/reports", tags=["reports"])
app.include_router(
    email_workflow.router,
    prefix="/api/hr/emails",
    tags=["candidate-emails"],
)
app.include_router(cv_rebuild.router, prefix="/api/cv", tags=["cv-rebuild"])
app.include_router(
    email_webhooks.router,
    prefix="/api/webhooks/email",
    tags=["email-webhooks"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        loop="none",
    )
