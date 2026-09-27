@echo off
setlocal
title HandAI - Backend API (Port 8082)
cd /d "%~dp0backend"

echo ============================================================
echo   HandAI -- Backend Business API (Spring Boot 3.3.4)
echo ============================================================
echo   Directory: %CD%
echo.

if not exist "gradlew.bat" (
    echo [ERROR] gradlew.bat not found in backend directory!
    pause
    exit /b 1
)

echo [*] Starting Spring Boot via Gradle wrapper...
call gradlew.bat bootRun

echo.
echo ============================================================
echo   Backend service stopped.
echo ============================================================
pause
