@echo off
setlocal
title HANDAI -- CORE SERVICES
cd /d "%~dp0"

echo ============================================================
echo   HANDAI -- COMPLETE SYSTEM LAUNCHER
echo ============================================================
echo   Root: %~dp0
echo.

:: STEP 1: Start Core Stack Services (Infrastructure, AI, Backend)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-core.ps1"
set CORE_EXIT=%ERRORLEVEL%

if %CORE_EXIT% neq 0 (
    echo.
    echo ============================================================
    echo   [ERROR] HANDAI CORE SERVICES FAILED TO START!
    echo   Please inspect the logs in infra\logs\
    echo ============================================================
    echo.
    echo Press any key to exit...
    pause >nul
    exit /b %CORE_EXIT%
)

:: STEP 2: Only after all core services are READY, launch Mobile Expo in Terminal 2
echo [LAUNCH] Launching Mobile Scanner App in dedicated window (HANDAI -- MOBILE APP)...
start "HANDAI -- MOBILE APP" cmd.exe /c "title HANDAI -- MOBILE APP && call "%~dp0start-mobile.bat""

echo.
echo ============================================================
echo   HANDAI -- SYSTEM READY!
echo ============================================================
echo   - PostgreSQL:     127.0.0.1:5432
echo   - MinIO S3 Store: http://127.0.0.1:9000  (Console: :9001)
echo   - Redis Cache:    127.0.0.1:6379
echo   - AI Service:     http://127.0.0.1:8001/health
echo   - Backend API:    http://127.0.0.1:8080/actuator/health
echo   - Mobile Scanner: Visible Metro terminal (Port 8083)
echo   - Stop All:       Double-click stop-all.bat
echo ============================================================
echo.

:: Keep Terminal 1 open as the live supervisor console
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\monitor-services.ps1"

exit /b 0
