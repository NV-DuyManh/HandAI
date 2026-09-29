@echo off
setlocal
title HandAI - Backend API (Port 8080)
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-backend.ps1"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Backend API failed to start with error code %EXIT_CODE%.
    if "%~1"=="" pause
    exit /b %EXIT_CODE%
)

if "%~1"=="" (
    echo.
    echo Log file: infra\logs\backend.log
    echo Backend API is running in background.
    echo Press any key to exit this launcher window...
    pause >nul
)
exit /b 0
