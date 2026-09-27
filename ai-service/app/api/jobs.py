import uuid
import logging
from fastapi import APIRouter, HTTPException
from app.schemas.jobs import JobRequest, JobResponse
from app.jobs.tasks import process_submission

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=JobResponse)
async def submit_job(request: JobRequest):
    # Spring Boot owns the jobId lifecycle. jobId is strictly required.
    job_id = str(request.jobId)

    logger.info(
        "Received job",
        extra={"job_id": job_id, "submission_id": request.submissionId}
    )

    # Enqueue Celery task with the authoritative jobId
    process_submission.delay(job_id, request.model_dump(mode="json"))

    return JobResponse(jobId=job_id, status="QUEUED")
