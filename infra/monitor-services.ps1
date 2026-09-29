# infra/monitor-services.ps1
# HandAI - Core Services Active Supervision & Heartbeat Monitor
$ErrorActionPreference = "SilentlyContinue"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$PidDir = Join-Path $RepoRoot "infra\pids"
$AiPidFile = Join-Path $PidDir "ai-service.pid"
$BackendPidFile = Join-Path $PidDir "backend.pid"

Write-Host "Monitoring background service health (AI: 8001, Backend: 8080)..." -ForegroundColor Gray
Write-Host "Press [Ctrl+C] to exit supervisor or double-click stop-all.bat to stop all services.`n" -ForegroundColor DarkGray

$counter = 0
while ($true) {
    Start-Sleep -Seconds 4
    $counter++

    # Check AI Service process
    if (Test-Path $AiPidFile) {
        $aiPid = (Get-Content $AiPidFile -ErrorAction SilentlyContinue).Trim()
        if ($aiPid -match '^\d+$') {
            $p = Get-Process -Id $aiPid -ErrorAction SilentlyContinue
            if (-not $p) {
                Write-Host "`n[ALERT] FastAPI AI Service (PID: $aiPid) terminated unexpectedly!" -ForegroundColor Red
                Write-Host "Check logs in: infra\logs\ai-service.err.log`n" -ForegroundColor Yellow
            }
        }
    }

    # Check Backend process
    if (Test-Path $BackendPidFile) {
        $bePid = (Get-Content $BackendPidFile -ErrorAction SilentlyContinue).Trim()
        if ($bePid -match '^\d+$') {
            $p = Get-Process -Id $bePid -ErrorAction SilentlyContinue
            if (-not $p) {
                Write-Host "`n[ALERT] Spring Boot Backend (PID: $bePid) terminated unexpectedly!" -ForegroundColor Red
                Write-Host "Check logs in: infra\logs\backend.err.log`n" -ForegroundColor Yellow
            }
        }
    }
}
