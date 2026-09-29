@echo off
setlocal
title HANDAI -- CORE SERVICES
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-core.ps1"
set CORE_EXIT=%ERRORLEVEL%

if %CORE_EXIT% neq 0 (
    echo.
    echo [ERROR] Core services failed to start.
    pause
    exit /b %CORE_EXIT%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\monitor-services.ps1"
exit /b 0
