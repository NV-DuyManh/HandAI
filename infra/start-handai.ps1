# infra/start-handai.ps1
# HandAI - Unified Local Launcher
$ErrorActionPreference = "Continue"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HandAI -- Vietnamese Handwriting Recognition System" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Repository root: $RepoRoot`n"

# 1. Start Services Window
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title HandAI - All Services && `"$RepoRoot\start-services.bat`""

# 2. Start Mobile Scanner Window
Start-Process -FilePath "cmd.exe" -ArgumentList "/c title HandAI - Mobile (Expo QR) && `"$RepoRoot\start-mobile.bat`""

Write-Host "Done. Launched HandAI services and Mobile Expo QR in 2 visible windows." -ForegroundColor Green
