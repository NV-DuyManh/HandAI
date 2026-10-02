# infra/start-ai.ps1
# HandAI - Start and Verify FastAPI AI Microservice (Port 8001)
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

. "$PSScriptRoot\port-manager.ps1"
. "$PSScriptRoot\health-check.ps1"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- AI MICROSERVICE (FastAPI + PyTorch CRNN)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Host: 127.0.0.1 | Port: 8001`n"

# Step 1: Pre-flight check & termination of port 8001
Write-Host "[1/3] Checking if an existing AI process is on port 8001..." -ForegroundColor Cyan
Release-Port -TargetPort 8001 | Out-Null

# Step 2: Launch FastAPI via uvicorn
$AiDir = Join-Path $RepoRoot "ai-service"
$VenvPy = Join-Path $AiDir ".venv\Scripts\python.exe"
$PythonExe = if (Test-Path $VenvPy) { $VenvPy } else { "python" }
$LogDir = Join-Path $RepoRoot "infra\logs"
$PidDir = Join-Path $RepoRoot "infra\pids"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (-not (Test-Path $PidDir)) { New-Item -ItemType Directory -Path $PidDir -Force | Out-Null }

$LogFile = Join-Path $LogDir "ai-service.log"
$ErrLog = Join-Path $LogDir "ai-service.err.log"
$PidFile = Join-Path $PidDir "ai-service.pid"

Write-Host "[2/3] Launching FastAPI AI service on 0.0.0.0:8001..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8001" `
    -WorkingDirectory $AiDir `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError $ErrLog `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $PidFile -Value $proc.Id -Force
Write-Host ("  Launched process PID: {0}" -f $proc.Id) -ForegroundColor Gray

# Step 3: Health check verification loop
Write-Host "`n[3/3] Verifying AI Service health at http://127.0.0.1:8001/health..." -ForegroundColor Cyan
$isAlive = Wait-HttpReady -Url "http://127.0.0.1:8001/health" -ServiceName "FastAPI AI" -ExpectedContent '"status"' -TimeoutSeconds 30

if (-not $isAlive) {
    Write-Host "`n[ERROR] AI Service failed to respond within timeout." -ForegroundColor Red
    if (Test-Path $ErrLog) {
        Write-Host "Recent error details:" -ForegroundColor DarkRed
        Get-Content $ErrLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host ("  " + $_) -ForegroundColor DarkRed }
    }
    exit 1
}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  [OK] AI MICROSERVICE IS ALIVE AT http://127.0.0.1:8001" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
exit 0
