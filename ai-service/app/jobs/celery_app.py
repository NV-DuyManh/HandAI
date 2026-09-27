from celery import Celery
from app.config import settings

celery_app = Celery(
    "ai_service",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.jobs.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_time_limit=300, # 5 min hard limit
)
