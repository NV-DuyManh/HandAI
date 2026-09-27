@echo off
setlocal
title HandAI - AI Microservice (Port 8001)
cd /d "%~dp0ai-service"

echo ============================================================
echo   HandAI -- AI Microservice (FastAPI + PyTorch CRNN)
echo ============================================================
echo   Directory: %CD%
echo.

if exist ".venv\Scripts\activate.bat" (
    echo [*] Activating Python virtual environment...
    call .venv\Scripts\activate.bat
) else (
    echo [WARN] .venv not found in ai-service. Using system Python...
)

echo [*] Starting Uvicorn server on http://127.0.0.1:8001 ...
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

echo.
echo ============================================================
echo   AI Microservice stopped.
echo ============================================================
pause
