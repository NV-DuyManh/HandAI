@echo off
setlocal
title HandAI - Stop All Services
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\stop-handai.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if "%~1"=="" (
    echo Press any key to close this window...
    pause >nul
)
exit /b %EXIT_CODE%
