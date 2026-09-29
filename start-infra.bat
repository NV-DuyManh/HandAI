@echo off
setlocal
title HandAI - Docker Infrastructure
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-infra.ps1"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Infrastructure startup failed with error code %EXIT_CODE%.
    if "%~1"=="" pause
    exit /b %EXIT_CODE%
)

if "%~1"=="" (
    echo.
    echo Press any key to exit...
    pause >nul
)
exit /b 0
