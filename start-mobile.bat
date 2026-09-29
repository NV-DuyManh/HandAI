@echo off
setlocal
title HANDAI -- MOBILE APP
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0infra\start-mobile.ps1"
set EXIT_CODE=%ERRORLEVEL%

if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Mobile Expo Bundler exited with code %EXIT_CODE%.
    pause
    exit /b %EXIT_CODE%
)
pause
exit /b 0
