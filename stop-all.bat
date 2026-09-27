@echo off
setlocal
title HandAI - Stop All
echo ============================================================
echo   Stopping all HandAI processes...
echo ============================================================

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8001" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8082" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8083" ^| findstr "LISTENING"') do taskkill /f /t /pid %%a >nul 2>&1

cd /d "%~dp0"
if exist infra\docker-compose.yml (
    docker compose -f infra\docker-compose.yml down >nul 2>&1
)

echo Done. All HandAI services stopped.
pause
