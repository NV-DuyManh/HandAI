@echo off
setlocal
title HandAI - AI Microservice (Port 8001)
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-ai.ps1"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] AI Microservice failed to start with error code %EXIT_CODE%.
    if "%~1"=="" pause
    exit /b %EXIT_CODE%
)

if "%~1"=="" (
    echo.
    echo Log file: infra\logs\ai-service.log
    echo AI Microservice is running in background.
    echo Press any key to exit this launcher window...
    pause >nul
)
exit /b 0
