# MathVision Kids AI Service

This is the FastAPI AI Runtime Foundation for MathVision Kids.

## Purpose
This service acts as the orchestration layer for processing student math submissions. It receives analysis jobs from the Spring Boot backend, orchestrates recognition (OCR), parses handwritten structures, performs deterministic mathematical validation (addition and subtraction), applies pedagogical logic (earliest error and hint generation), and invokes an authenticated callback to the Spring Boot backend with structured results.

## Architecture
- **FastAPI**: Provides `/internal/v1/jobs` for accepting jobs and `/health`, `/ready` for diagnostics.
- **Celery & Redis**: Provides an asynchronous queue to process ML tasks outside the HTTP lifecycle.
- **Deterministic Validation**: Pure Python structural logic that guarantees mathematical correctness.
- **Mock Recognition**: Uses `FixtureRecognitionEngine` for deterministic pipeline testing without a trained model.

## Runtime Modes
- `FIXTURE`: (Default) Deterministic engine for E2E testing without ML models.
- `MODEL`: Attempts to load actual trained model manifests (Currently returns MODEL_NOT_AVAILABLE until teammate handoff).

## Local Setup
1. `python -m venv .venv`
2. `.venv\Scripts\activate` (Windows)
3. `pip install -r requirements.txt`
4. Copy `.env.example` to `.env` and fill in necessary details.
5. Start Redis (e.g. via Docker).
6. Start Celery worker: `celery -A app.jobs.celery_app worker --loglevel=info -P solo`
7. Start FastAPI server: `uvicorn app.main:app --reload`
