@echo off
setlocal
:: ==============================================================================
:: HandAI - Windows Firewall Configuration for Physical Mobile Device Testing
:: Run this file as Administrator (Right click -> Run as administrator)
:: ==============================================================================
echo ==============================================================================
echo   HANDAI -- REGISTERING INBOUND FIREWALL RULES (PORTS 8083, 8082, 8001)
echo ==============================================================================
echo.

:: Check for Administrator elevation
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ELEVATION] Administrator privileges required. Prompting for elevation...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c `"%~f0`"' -Verb RunAs"
    exit /b
)

echo [1/3] Adding rule for Expo Metro Bundler (Port 8083)...
netsh advfirewall firewall delete rule name="HandAI Expo Metro 8083" >nul 2>&1
netsh advfirewall firewall add rule name="HandAI Expo Metro 8083" dir=in action=allow protocol=TCP localport=8083 profile=Private,Public

echo [2/3] Adding rule for Spring Boot Backend API (Port 8082)...
netsh advfirewall firewall delete rule name="HandAI Backend 8082" >nul 2>&1
netsh advfirewall firewall add rule name="HandAI Backend 8082" dir=in action=allow protocol=TCP localport=8082 profile=Private,Public

echo [3/3] Adding rule for FastAPI AI Service (Port 8001)...
netsh advfirewall firewall delete rule name="HandAI AI Service 8001" >nul 2>&1
netsh advfirewall firewall add rule name="HandAI AI Service 8001" dir=in action=allow protocol=TCP localport=8001 profile=Private,Public

echo.
echo ==============================================================================
echo   [SUCCESS] HandAI Firewall Rules Registered Successfully!
echo   Physical mobile devices on your Wi-Fi can now reach:
echo     - Expo Metro Bundler: Port 8083
echo     - Spring Boot API:    Port 8082
echo     - FastAPI AI Service: Port 8001
echo ==============================================================================
echo.
pause
