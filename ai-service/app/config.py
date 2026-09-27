from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, AliasChoices
from typing import Optional

_SERVICE_DIR = Path(__file__).resolve().parent.parent
_ENV_FILES = [str(_SERVICE_DIR / ".env"), ".env"]

class Settings(BaseSettings):
    app_env: str = "development"
    runtime_mode: str = "FIXTURE"
    
    port: int = 8000
    host: str = Field(default="127.0.0.1", validation_alias=AliasChoices("AI_HOST", "HOST", "host"))
    
    redis_url: str = "redis://localhost:6379/0"
    
    spring_callback_base_url: str = "http://localhost:8080/internal/v1/ai/jobs"
    # Internal API callback authentication (overridden via INTERNAL_API_KEY)
    internal_api_key: str = "secret-key-default"  # Local non-secret development default
    
    model_manifest_path: Optional[str] = None
    model_artifact_path: Optional[str] = None

    # MinIO storage configuration (private internal access only)
    # Production values must be provided via environment variables (MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "minioadmin"      # Local non-secret development default
    minio_secret_key: str = "minioadmin123"   # Local non-secret development default
    minio_secure: bool = False
    minio_bucket: str = "mathvision"

    # OCR configuration
    # Default is "noop" (disabled/test provider) to protect established grading runtime.
    # Set OCR_PROVIDER="crnn_vi_handwriting_v1" for explicit staging/dev testing.
    ocr_provider: str = "noop"
    ocr_model_dir: Optional[str] = None
    ocr_bridge_mode: str = "off"  # "off" | "shadow"

    # Canonical runtime override (demoted from production default in GROQ.5)
    canonical_runtime_override_enabled: bool = False

    # Groq Vision Integration
    # All keys in ONE comma-separated variable: GROQ_API_KEYS="key1,key2,key3"
    groq_enabled: bool = False
    groq_api_keys: str = ""  # Raw comma-separated key list — never log this
    groq_primary_vision_model: str = "qwen/qwen3.8-27b"
    groq_fallback_vision_model: str = "qwen/qwen3.6-27b"
    groq_line_assist_mode: str = "suspicious_only"  # "suspicious_only" | "always" | "off"
    groq_consensus_mode: str = "adaptive"
    groq_accept_confidence_threshold: float = 0.80
    groq_second_pass_confidence_threshold: float = 0.82
    groq_timeout_seconds: float = 25.0
    groq_connect_timeout_seconds: float = 8.0
    groq_max_request_attempts: int = 3
    groq_retry_base_ms: int = 400
    groq_retry_max_ms: int = 4000
    groq_key_cooldown_seconds: int = 60
    groq_auth_disable_seconds: int = 1800
    groq_rotate_on_429: bool = False
    groq_max_long_edge: int = 2200
    groq_jpeg_quality: int = 92
    groq_cache_ttl_seconds: int = 300

    # Groq Post-Correction (Role B)
    groq_post_correction_enabled: bool = True
    groq_post_correction_trigger_confidence: float = 0.82
    groq_post_correction_auto_apply_confidence: float = 0.92
    groq_post_correction_max_edit_ratio: float = 0.35
    groq_ocr_correction_prompt_version: str = "groq-ocr-correction-v1"
    groq_correction_cache_ttl_seconds: int = 3600
    # Physical Android Trace & Observability (Development mode only; default False for production safety)
    ocr_physical_trace_enabled: bool = False

    # Gemini 2nd Advisor Integration
    gemini_enabled: bool = False
    gemini_api_keys: str = ""  # Raw comma-separated key list — never log this
    gemini_model: str = "gemini-3.6-flash"
    gemini_fallback_enabled: bool = False
    gemini_fallback_model: str = "gemini-flash-lite-latest"
    gemini_post_correction_enabled: bool = True
    gemini_timeout_seconds: float = 18.0
    gemini_connect_timeout_seconds: float = 4.0
    gemini_rotate_on_429: bool = False
    gemini_key_cooldown_seconds: int = 300
    gemini_max_key_attempts_per_request: int = 3  # Maximum unique keys to attempt per line request
    gemini_correction_prompt_version: str = "gemini-ocr-correction-v1"
    gemini_correction_cache_ttl_seconds: int = 3600

    # Cloud Advisor Concurrency (PROD.2G)
    cloud_advisor_max_concurrency: int = 3

    # PROD.3F / PROD.3F.1 Always-Review Policy (Handwriting domain-specific)
    hwtext_always_review_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("HWTEXT_ALWAYS_REVIEW_ENABLED", "hwtext_always_review_enabled"),
        description="When True, every recognized handwriting line receives AI review in healthy runtime"
    )
    always_review_enabled: bool = False

    model_config = SettingsConfigDict(env_file=_ENV_FILES, env_file_encoding="utf-8", extra="ignore")

settings = Settings()

