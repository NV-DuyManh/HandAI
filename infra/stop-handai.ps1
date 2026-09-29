# infra/stop-handai.ps1
# HandAI - Clean Process Shutdown & Environment Reset
$ErrorActionPreference = "SilentlyContinue"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- STOPPING ALL SERVICES" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Stop tracked PIDs safely
$PidDir = Join-Path $RepoRoot "infra\pids"
if (Test-Path $PidDir) {
    Get-ChildItem -Path $PidDir -Filter *.pid | ForEach-Object {
        $pidFile = $_.FullName
        $svcName = $_.BaseName
        $procId = (Get-Content $pidFile -ErrorAction SilentlyContinue).Trim()
        if ($procId -match '^\d+$') {
            Write-Host "  Stopping $svcName (PID: $procId)..." -ForegroundColor Yellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
        }
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
}

# 2. Release HandAI ports (8001, 8002, 8082, 8083)
. "$PSScriptRoot\port-manager.ps1"
Clean-HandAIPorts

# 3. Terminate any visible console windows associated with HandAI
try {
    Get-Process | Where-Object {
        $_.MainWindowTitle -match "HANDAI" -or
        $_.MainWindowTitle -match "HandAI"
    } | ForEach-Object {
        if ($_.Id -ne $PID) {
            Write-Host "  Closing HandAI window: $($_.MainWindowTitle) (PID: $($_.Id))..." -ForegroundColor Yellow
            Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
        }
    }
} catch {}

# 4. Stop Docker Compose infrastructure
Write-Host "  Stopping Docker Compose containers (PostgreSQL, MinIO, Redis)..." -ForegroundColor Yellow
$composeFile = Join-Path $RepoRoot "infra\docker-compose.yml"
if (Test-Path $composeFile) {
    & docker compose -f $composeFile stop postgres minio redis 2>$null | Out-Null
}

Write-Host "`n[OK] All HandAI services and background processes stopped successfully." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
