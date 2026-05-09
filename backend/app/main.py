"""FastAPI 入口。Electron 在开发期通过 npm run dev:py 启动，
生产期由主进程作为 sidecar 启动。"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.tasks import router as tasks_router
from .services import storage
from .services.task_manager import manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    storage.init_db()
    await manager.init()
    yield


app = FastAPI(title="auto-resume backend", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
