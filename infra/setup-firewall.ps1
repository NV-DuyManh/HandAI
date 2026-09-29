# infra/setup-firewall.ps1
# HandAI - Windows Firewall Configuration for Mobile Device Access
# Registers inbound rules for Expo Metro (8083), Backend (8082), and AI Service (8001)

$ErrorActionPreference = "Stop"

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- REGISTERING INBOUND FIREWALL RULES" -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

# Check Administrator privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[ELEVATION] Administrator privileges are required to configure Windows Firewall." -ForegroundColor Yellow
    Write-Host "[ELEVATION] Requesting elevation prompt (UAC)..." -ForegroundColor Yellow
    try {
        Start-Process powershell.exe -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
        Write-Host "  [OK] Elevated PowerShell process launched." -ForegroundColor Green
        exit 0
    } catch {
        Write-Host "[ERROR] Could not automatically elevate." -ForegroundColor Red
        Write-Host "Please right-click PowerShell and choose 'Run as Administrator', or right-click 'infra\setup-firewall.bat' -> 'Run as administrator'." -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "[1/3] Adding inbound rule for Expo Metro Bundler (Port 8083)..." -ForegroundColor Cyan
netsh advfirewall firewall delete rule name="HandAI Expo Metro 8083" 2>$null | Out-Null
& netsh advfirewall firewall add rule name="HandAI Expo Metro 8083" dir=in action=allow protocol=TCP localport=8083 profile=Private,Public | Out-Null
Write-Host "  [OK] Rule registered: HandAI Expo Metro 8083 (TCP:8083, Profiles: Private, Public)" -ForegroundColor Green

Write-Host "[2/3] Adding inbound rule for Spring Boot Backend API (Port 8082)..." -ForegroundColor Cyan
netsh advfirewall firewall delete rule name="HandAI Backend 8082" 2>$null | Out-Null
& netsh advfirewall firewall add rule name="HandAI Backend 8082" dir=in action=allow protocol=TCP localport=8082 profile=Private,Public | Out-Null
Write-Host "  [OK] Rule registered: HandAI Backend 8082 (TCP:8082, Profiles: Private, Public)" -ForegroundColor Green

Write-Host "[3/3] Adding inbound rule for FastAPI AI Service (Port 8001)..." -ForegroundColor Cyan
netsh advfirewall firewall delete rule name="HandAI AI Service 8001" 2>$null | Out-Null
& netsh advfirewall firewall add rule name="HandAI AI Service 8001" dir=in action=allow protocol=TCP localport=8001 profile=Private,Public | Out-Null
Write-Host "  [OK] Rule registered: HandAI AI Service 8001 (TCP:8001, Profiles: Private, Public)" -ForegroundColor Green

Write-Host ""
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "  [SUCCESS] All HandAI Inbound Firewall Rules Registered Successfully!" -ForegroundColor Green
Write-Host "  Physical Android / iOS devices on your local Wi-Fi can now communicate with:" -ForegroundColor White
Write-Host "    - Expo Metro Bundler: Port 8083" -ForegroundColor White
Write-Host "    - Backend REST API:   Port 8082" -ForegroundColor White
Write-Host "    - AI Microservice:    Port 8001" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
