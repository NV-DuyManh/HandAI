# infra/start-backend.ps1
# HandAI - Start and Verify Spring Boot Backend API (Port 8080)
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

. "$PSScriptRoot\port-manager.ps1"
. "$PSScriptRoot\health-check.ps1"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- BACKEND BUSINESS API (Spring Boot 3.3.4)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Port: 8080 | Endpoint: http://127.0.0.1:8080`n"

# Step 1: Pre-flight check & termination of port 8080
Write-Host "[1/3] Checking if an existing backend process is on port 8080..." -ForegroundColor Cyan
Release-Port -TargetPort 8080 | Out-Null

# Step 2: Launch Spring Boot via Gradle wrapper
$BackendDir = Join-Path $RepoRoot "backend"
$Gradlew = Join-Path $BackendDir "gradlew.bat"
$LogDir = Join-Path $RepoRoot "infra\logs"
$PidDir = Join-Path $RepoRoot "infra\pids"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (-not (Test-Path $PidDir)) { New-Item -ItemType Directory -Path $PidDir -Force | Out-Null }

$LogFile = Join-Path $LogDir "backend.log"
$ErrLog = Join-Path $LogDir "backend.err.log"
$PidFile = Join-Path $PidDir "backend.pid"

Write-Host "[2/3] Launching Spring Boot backend on 127.0.0.1:8080..." -ForegroundColor Cyan
$proc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c `"$Gradlew`" bootRun" `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $PidFile -Value $proc.Id -Force
Write-Host ("  Launched process PID: {0}" -f $proc.Id) -ForegroundColor Gray

# Step 3: Health check verification loop
Write-Host "`n[3/3] Verifying Backend health at http://127.0.0.1:8080/actuator/health..." -ForegroundColor Cyan
$isAlive = Wait-HttpReady -Url "http://127.0.0.1:8080/actuator/health" -ServiceName "Spring Boot Backend" -ExpectedContent '"UP"' -TimeoutSeconds 90

if (-not $isAlive) {
    Write-Host "`n[ERROR] Backend failed to respond within timeout." -ForegroundColor Red
    if (Test-Path $ErrLog) {
        Write-Host "Recent error details:" -ForegroundColor DarkRed
        Get-Content $ErrLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor DarkRed }
    }
    if (Test-Path $LogFile) {
        Write-Host "Recent stdout details:" -ForegroundColor DarkYellow
        Get-Content $LogFile -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor DarkYellow }
    }
    exit 1
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  [OK] BACKEND API IS ALIVE AT http://127.0.0.1:8080" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
exit 0
