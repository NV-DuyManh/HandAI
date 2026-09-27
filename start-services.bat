@echo off
title HandAI - All Services (AI:8001 + Backend:8082)
cd /d "%~dp0"

echo ============================================================
echo   HANDAI -- ALL SERVICES (Hạ tầng + AI Service + Backend)
echo ============================================================
echo.

:: 1. Docker Infrastructure
echo [1/3] Kiem tra Docker ha tang (PostgreSQL, MinIO, Redis)...
where docker >nul 2>&1
if %errorlevel% equ 0 (
    docker compose -f infra\docker-compose.yml up -d postgres minio redis 2>nul
    docker exec handai-minio mc alias set local http://127.0.0.1:9000 minioadmin minioadmin123 >nul 2>&1
    docker exec handai-minio mc mb --ignore-existing local/ocr-trials >nul 2>&1
    echo       [OK] Docker containers active.
) else (
    echo       [NOTE] Docker khong co trong PATH.
)

:: 2. Start AI Service in background of this terminal
echo.
echo [2/3] Khoi dong AI Microservice (FastAPI Port 8001)...
cd /d "%~dp0ai-service"
if exist ".venv\Scripts\python.exe" (
    start /b "" ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001
) else (
    start /b "" python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
)
echo       [OK] FastAPI uvicorn dang chay tai http://127.0.0.1:8001
ping -n 3 127.0.0.1 >nul

:: 3. Start Spring Boot in foreground of this terminal
echo.
echo [3/3] Khoi dong Backend Gateway (Spring Boot Port 8082)...
cd /d "%~dp0backend"
call gradlew.bat bootRun

echo.
echo ============================================================
echo   Services da dung.
echo ============================================================
pause
