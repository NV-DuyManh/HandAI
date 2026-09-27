import httpx
import logging
from app.config import settings
from app.schemas.jobs import AiCallbackRequest

logger = logging.getLogger(__name__)

def send_callback(job_id: str, payload: AiCallbackRequest):
    url = f"{settings.spring_callback_base_url}/{job_id}/callback"
    headers = {
        "X-Internal-API-Key": settings.internal_api_key,
        "Content-Type": "application/json"
    }
    
    logger.info(f"Sending callback for job {job_id} to {url} with status {payload.status}")
    
    try:
        # Bounded retry is handled by Celery task retries if this throws an exception
        with httpx.Client(timeout=10.0) as client:
            response = client.post(url, headers=headers, json=payload.model_dump(exclude_none=True))
            response.raise_for_status()
            logger.info(f"Callback successful for job {job_id}")
    except httpx.HTTPError as e:
        logger.error(f"Callback failed for job {job_id}: {e}")
        raise e
