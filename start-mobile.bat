@echo off
setlocal
title HandAI - Mobile Scanner (Expo Metro)
cd /d "%~dp0apps\mobile"

echo ============================================================
echo   HandAI -- Mobile Scanner UI (React Native / Expo 57)
echo ============================================================
echo   Directory: %CD%
echo.

echo [*] Starting Expo Metro Bundler in HandAI mode (Port 8083)...
call npx expo start --port 8083 --clear

echo.
echo ============================================================
echo   Expo Metro stopped.
echo ============================================================
pause
