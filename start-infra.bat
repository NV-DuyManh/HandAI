@echo off
setlocal
title HandAI - Docker Infrastructure
cd /d "%~dp0"

echo ============================================================
echo   HandAI -- Infrastructure (PostgreSQL, MinIO, Redis)
echo ============================================================
echo.

docker compose -f infra\docker-compose.yml up -d
docker compose -f infra\docker-compose.yml ps

echo.
echo Infrastructure containers started.
pause
