from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session
from app.backend.config import settings
from app.backend.database import init_db, get_session
from app.backend.services.problem_loader import seed_database_from_json
from app.backend.services.capability_checker import detect_model_capabilities, ModelCapabilities

active_capabilities: ModelCapabilities = detect_model_capabilities(settings.MODEL_ID)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global active_capabilities
    # 1. Initialize database schema
    init_db()

    # 2. Check and report model capabilities (Section 2, item 6)
    active_capabilities = detect_model_capabilities(settings.MODEL_ID)

    # 3. Seed starter/mock problems and traces in MOCK_MODE or development
    with Session(get_session().__next__().bind) as session:
        seed_database_from_json(session)

    yield


app = FastAPI(
    title="Train Your Gemma API",
    description="Backend API for Train Your Gemma reasoning critic trainer and flight test benchmark",
    version="0.1.0",
    lifespan=lifespan,
)

from pathlib import Path
from fastapi.staticfiles import StaticFiles
from app.backend.api.routes import router as gameplay_router

images_dir = Path("data/images")
if images_dir.exists():
    app.mount("/data/images", StaticFiles(directory="data/images"), name="images")

# Register API routes
app.include_router(gameplay_router)

# CORS middleware for development frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "mock_mode": settings.MOCK_MODE,
        "model_id": settings.MODEL_ID,
        "capabilities": {
            "supports_text": active_capabilities.supports_text if active_capabilities else True,
            "supports_image": active_capabilities.supports_image if active_capabilities else False,
            "context_length": active_capabilities.context_length if active_capabilities else 8192,
        } if active_capabilities else None,
    }
