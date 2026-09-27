@echo off
cd /d "%~dp0"

start "HandAI - All Services" cmd /k "%~dp0start-services.bat"
start "HandAI - Mobile (Expo QR)" cmd /k "%~dp0start-mobile.bat"
exit /b 0
