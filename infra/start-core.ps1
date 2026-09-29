# infra/start-core.ps1
# HandAI - Core Stack Orchestration (Infrastructure + AI + Backend)
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- CORE SERVICES ORCHESTRATION" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Repository root: $RepoRoot`n"

$LogDir = Join-Path $RepoRoot "infra\logs"
$PidDir = Join-Path $RepoRoot "infra\pids"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
if (-not (Test-Path $PidDir)) { New-Item -ItemType Directory -Path $PidDir -Force | Out-Null }

# Source helper modules
. "$PSScriptRoot\port-manager.ps1"
. "$PSScriptRoot\health-check.ps1"

# -----------------------------------------------------------------------------
# STEP 0: Pre-flight Port & Process Cleanup (8001, 8002, 8082, 8083)
# -----------------------------------------------------------------------------
Write-Host "[STEP 0/4] Releasing any lingering HandAI ports..." -ForegroundColor Yellow
Clean-HandAIPorts

# Clean any existing pid files
Get-ChildItem -Path $PidDir -Filter *.pid -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue

# -----------------------------------------------------------------------------
# STEP 1: Docker Infrastructure (PostgreSQL, MinIO, Redis)
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 1/4] Starting Docker Infrastructure (PostgreSQL, MinIO, Redis)..." -ForegroundColor Yellow
$composeFile = Join-Path $RepoRoot "infra\docker-compose.yml"

$dockerAlive = $false
try {
    & docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $dockerAlive = $true }
} catch {}

if (-not $dockerAlive) {
    Write-Host "  Docker engine is not responding. Starting Docker Desktop..." -ForegroundColor Yellow
    $candidates = @(
        (Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"),
        (if ($env:ProgramFilesX86) { Join-Path $env:ProgramFilesX86 "Docker\Docker\Docker Desktop.exe" }),
        (if (${env:ProgramFiles(x86)}) { Join-Path ${env:ProgramFiles(x86)} "Docker\Docker\Docker Desktop.exe" }),
        (Join-Path $env:LOCALAPPDATA "Programs\Docker\Docker\Docker Desktop.exe")
    )
    $ddPath = $null
    foreach ($c in $candidates) {
        if ($c -and (Test-Path $c)) { $ddPath = $c; break }
    }
    if ($ddPath) {
        Start-Process -FilePath $ddPath
        Write-Host "  Waiting for Docker engine to become ready (up to 45s)..." -ForegroundColor Yellow
        for ($i = 0; $i -lt 45; $i++) {
            Start-Sleep -Seconds 1
            & docker info 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $dockerAlive = $true
                Write-Host "  [OK] Docker engine is ready." -ForegroundColor Green
                break
            }
        }
    }
}

Write-Host "  Executing: docker compose -f infra\docker-compose.yml up -d postgres minio redis" -ForegroundColor Gray
& docker compose -f $composeFile up -d postgres minio redis 2>$null | Out-Null


# Wait for TCP readiness
$pgReady = Wait-TcpPort -TargetHost "127.0.0.1" -Port 5432 -ServiceName "PostgreSQL" -TimeoutSeconds 30
$redisReady = Wait-TcpPort -TargetHost "127.0.0.1" -Port 6379 -ServiceName "Redis" -TimeoutSeconds 20
$minioReady = Wait-TcpPort -TargetHost "127.0.0.1" -Port 9000 -ServiceName "MinIO S3" -TimeoutSeconds 25

if (-not ($pgReady -and $redisReady -and $minioReady)) {
    Write-Host "  [ERROR] Infrastructure readiness check failed." -ForegroundColor Red
    exit 1
}

# Ensure MinIO buckets exist
try {
    & docker exec handai-minio mc alias set local http://127.0.0.1:9000 minioadmin minioadmin123 2>&1 | Out-Null
    & docker exec handai-minio mc mb --ignore-existing local/ocr-trials 2>&1 | Out-Null
    & docker exec handai-minio mc mb --ignore-existing local/mathvision 2>&1 | Out-Null
} catch {}

Write-Host "  [OK] Infrastructure (PostgreSQL, Redis, MinIO) is fully operational." -ForegroundColor Green

# -----------------------------------------------------------------------------
# STEP 2: FastAPI AI Microservice (Port 8001)
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 2/4] Starting FastAPI AI Microservice (Port 8001)..." -ForegroundColor Yellow

$AiDir = Join-Path $RepoRoot "ai-service"
$AiVenvPy = Join-Path $AiDir ".venv\Scripts\python.exe"
$PythonExe = if (Test-Path $AiVenvPy) { $AiVenvPy } else { "python" }

$AiLog = Join-Path $LogDir "ai-service.log"
$AiErrLog = Join-Path $LogDir "ai-service.err.log"
$AiPidFile = Join-Path $PidDir "ai-service.pid"

# Double check port 8001
Release-Port -TargetPort 8001 | Out-Null

$aiProc = Start-Process -FilePath $PythonExe `
    -ArgumentList "-m uvicorn app.main:app --host 0.0.0.0 --port 8001" `
    -WorkingDirectory $AiDir `
    -RedirectStandardOutput $AiLog `
    -RedirectStandardError $AiErrLog `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $AiPidFile -Value $aiProc.Id -Force
Write-Host "  AI Service process launched (PID: $($aiProc.Id))." -ForegroundColor Gray

# Wait for HTTP readiness
$aiReady = Wait-HttpReady -Url "http://127.0.0.1:8001/health" -ServiceName "FastAPI AI Service" -ExpectedContent '"status"' -TimeoutSeconds 30

if (-not $aiReady) {
    Write-Host "  [ERROR] AI Service failed to respond on http://127.0.0.1:8001/health." -ForegroundColor Red
    if (Test-Path $AiErrLog) {
        Write-Host "  Recent error log:" -ForegroundColor DarkRed
        Get-Content $AiErrLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    exit 1
}
Write-Host "  [OK] AI Service is READY and responding on http://127.0.0.1:8001." -ForegroundColor Green

# -----------------------------------------------------------------------------
# STEP 3: Spring Boot Backend API (Port 8080)
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 3/4] Starting Spring Boot Backend API (Port 8080)..." -ForegroundColor Yellow

$BackendDir = Join-Path $RepoRoot "backend"
$Gradlew = Join-Path $BackendDir "gradlew.bat"
$BackendLog = Join-Path $LogDir "backend.log"
$BackendErrLog = Join-Path $LogDir "backend.err.log"
$BackendPidFile = Join-Path $PidDir "backend.pid"

# Double check port 8080
Release-Port -TargetPort 8080 | Out-Null

$beProc = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c `"$Gradlew`" bootRun" `
    -WorkingDirectory $BackendDir `
    -RedirectStandardOutput $BackendLog `
    -RedirectStandardError $BackendErrLog `
    -WindowStyle Hidden `
    -PassThru

Set-Content -Path $BackendPidFile -Value $beProc.Id -Force
Write-Host "  Backend process launched (PID: $($beProc.Id))." -ForegroundColor Gray

# Wait for Spring Boot Actuator health endpoint
$beReady = Wait-HttpReady -Url "http://127.0.0.1:8080/actuator/health" -ServiceName "Spring Boot Backend" -ExpectedContent '"UP"' -TimeoutSeconds 90

if (-not $beReady) {
    Write-Host "  [ERROR] Backend failed to report healthy on http://127.0.0.1:8080/actuator/health." -ForegroundColor Red
    if (Test-Path $BackendErrLog) {
        Write-Host "  Recent error log:" -ForegroundColor DarkRed
        Get-Content $BackendErrLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkRed }
    }
    if (Test-Path $BackendLog) {
        Write-Host "  Recent stdout log:" -ForegroundColor DarkYellow
        Get-Content $BackendLog -Tail 15 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
    }
    exit 1
}
Write-Host "  [OK] Backend API is READY and responding on http://127.0.0.1:8080." -ForegroundColor Green

# -----------------------------------------------------------------------------
# STEP 4: Comprehensive System Health Check
# -----------------------------------------------------------------------------
Write-Host "`n[STEP 4/4] Verifying all core services..." -ForegroundColor Yellow
$report = Get-ServiceHealthReport

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- ALL CORE SERVICES ONLINE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL 16:      127.0.0.1:5432                       [HEALTHY]" -ForegroundColor Green
Write-Host "  MinIO S3 Store:     http://127.0.0.1:9000                [HEALTHY]" -ForegroundColor Green
Write-Host "  Redis Cache:        127.0.0.1:6379                       [HEALTHY]" -ForegroundColor Green
Write-Host "  FastAPI AI Service: http://127.0.0.1:8001/health         [HEALTHY]" -ForegroundColor Green
Write-Host "  Spring Boot API:    http://127.0.0.1:8080/actuator/health [HEALTHY]" -ForegroundColor Green
Write-Host "  Logs:               infra\logs\" -ForegroundColor Gray
Write-Host "  Stop All:           stop-all.bat" -ForegroundColor Gray
Write-Host "============================================================`n" -ForegroundColor Cyan

exit 0
