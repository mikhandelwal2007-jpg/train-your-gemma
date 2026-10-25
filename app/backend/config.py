import os
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    MOCK_MODE: bool = True

    DATABASE_URL: str = "sqlite:///./data/train_your_gemma.db"

    # Model configuration (configurable via MODEL_ID env var, Section 2)
    MODEL_ID: str = "google/gemma-2-2b-it"
    INFERENCE_BASE_URL: str = "http://localhost:8001/v1"
    INFERENCE_API_KEY: str = "mock-key"

    # Verification & sandboxing
    VERIFICATION_TIMEOUT_SECONDS: float = 3.0
    VERIFICATION_MAX_MEMORY_MB: int = 512

    # Training & Queue
    MIN_LABELS: int = 150
    MIN_FLAW_TYPES: int = 3
    MAX_GPU_HOURS_PER_DAY: float = 4.0
    ADAPTER_OUTPUT_DIR: str = "./ml/adapters"

    # Security
    SECRET_KEY: str = "change_me_super_secret_session_key_32bytes_min"
    ADMIN_API_KEY: str = "admin-secret-key-for-internal-operations"


settings = Settings()
