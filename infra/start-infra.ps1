# infra/start-infra.ps1
# HandAI - Start and Verify Docker Infrastructure
$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

. "$PSScriptRoot\health-check.ps1"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- DOCKER INFRASTRUCTURE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL (5432) | MinIO S3 (9000/9001) | Redis (6379)`n"

$composeFile = Join-Path $RepoRoot "infra\docker-compose.yml"

Write-Host "[1/4] Checking and starting Docker infrastructure..." -ForegroundColor Cyan

# Check if Docker engine is alive, launch Docker Desktop if needed
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

& docker compose -f $composeFile up -d postgres minio redis
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to execute docker compose up." -ForegroundColor Red
    exit 1
}


Write-Host "`n[2/4] Verifying PostgreSQL connection..." -ForegroundColor Cyan
$pgOk = Wait-TcpPort -TargetHost "127.0.0.1" -Port 5432 -ServiceName "PostgreSQL" -TimeoutSeconds 30

Write-Host "[3/4] Verifying Redis connection..." -ForegroundColor Cyan
$redisOk = Wait-TcpPort -TargetHost "127.0.0.1" -Port 6379 -ServiceName "Redis" -TimeoutSeconds 20

Write-Host "[4/4] Verifying MinIO Storage connection..." -ForegroundColor Cyan
$minioOk = Wait-TcpPort -TargetHost "127.0.0.1" -Port 9000 -ServiceName "MinIO" -TimeoutSeconds 25

if (-not ($pgOk -and $redisOk -and $minioOk)) {
    Write-Host "`n[ERROR] One or more infrastructure services failed to initialize." -ForegroundColor Red
    exit 1
}

# Ensure MinIO buckets exist
try {
    & docker exec handai-minio mc alias set local http://127.0.0.1:9000 minioadmin minioadmin123 2>&1 | Out-Null
    & docker exec handai-minio mc mb --ignore-existing local/ocr-trials 2>&1 | Out-Null
    & docker exec handai-minio mc mb --ignore-existing local/mathvision 2>&1 | Out-Null
} catch {}

Write-Host "`n============================================================" -ForegroundColor Green
Write-Host "  [OK] ALL INFRASTRUCTURE SERVICES ARE READY!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
exit 0
