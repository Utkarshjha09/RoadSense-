from contextlib import asynccontextmanager
import os

from fastapi import FastAPI

from app.api.events import router as events_router
from app.core.db import close_pool, run_schema_migrations
from app.core.queue import close_redis
from app.services.inference import get_inference_status


@asynccontextmanager
async def lifespan(_: FastAPI):
    if os.getenv("SKIP_DB_STARTUP", "").strip() not in {"1", "true", "TRUE", "yes", "YES"}:
        run_schema_migrations()
    try:
        yield
    finally:
        close_redis()
        close_pool()


app = FastAPI(title="RoadSense Cloud API", version="0.1.0", lifespan=lifespan)
app.include_router(events_router)


@app.get("/")
def root() -> dict[str, object]:
    return {
        "service": "RoadSense Cloud API",
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health() -> dict[str, str]:
    status = get_inference_status()
    return {
        "status": "ok",
        "model_ready": "true" if bool(status.get("ready")) else "false",
        "model_version": str(status.get("version", "unknown")),
    }
