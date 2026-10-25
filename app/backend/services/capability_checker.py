import os
import json
import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional
from app.backend.config import settings

logger = logging.getLogger("train_your_gemma.capability_checker")


@dataclass
class ModelCapabilities:
    model_id: str
    supports_text: bool
    supports_image: bool
    context_length: int
    details: Dict[str, Any]


# Known multimodal indicators in HuggingFace / open weights model IDs
VISION_INDICATORS = ["vision", "vl", "multimodal", "paligemma", "pixtral", "4-e", "gemma-4-vision"]


def detect_model_capabilities(model_id: Optional[str] = None) -> ModelCapabilities:
    """
    Evaluates capabilities of the target MODEL_ID at startup.
    Supports dynamic detection, offline fallback, and MOCK_MODE without crashing.
    """
    target_id = model_id or settings.MODEL_ID
    normalized_id = target_id.lower()

    # Determine vision / multimodal support
    supports_image = any(ind in normalized_id for ind in VISION_INDICATORS)

    # In MOCK_MODE, we simulate full multimodal capabilities if it's mock or paligemma/gemma
    if settings.MOCK_MODE:
        # Enable vision for mock demonstration so chart/table problems work in demo
        supports_image = True
        context_len = 8192
        details = {
            "mode": "mock",
            "provider": "DigitalOcean GPU / Mock Pipeline",
            "quantization": "4-bit",
        }
    else:
        context_len = 8192
        details = {
            "mode": "live",
            "provider": settings.INFERENCE_BASE_URL,
        }

    caps = ModelCapabilities(
        model_id=target_id,
        supports_text=True,
        supports_image=supports_image,
        context_length=context_len,
        details=details,
    )

    logger.info(
        f"Model capabilities detected for '{target_id}': Text={caps.supports_text}, "
        f"Image={caps.supports_image}, ContextLength={caps.context_length}"
    )

    return caps
