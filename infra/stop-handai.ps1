# infra/stop-handai.ps1
# HandAI - Clean Process Shutdown
$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HandAI -- Stopping All Services" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Kill listening ports 8000, 8080, 8081
$PortsToCheck = @(8000, 8080, 8081)
foreach ($port in $PortsToCheck) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            $procId = $conn.OwningProcess
            if ($procId -and $procId -gt 0) {
                Write-Host "Releasing port $port (PID: $procId)..." -ForegroundColor Gray
                & taskkill /PID $procId /T /F 2>$null | Out-Null
            }
        }
    } catch {}
}

# 2. Stop Docker Compose infrastructure
Write-Host "Stopping Docker infrastructure..." -ForegroundColor Gray
$composeFile = Join-Path $RepoRoot "infra\docker-compose.yml"
if (Test-Path $composeFile) {
    & docker compose -f $composeFile stop postgres minio redis 2>$null | Out-Null
}

Write-Host "`nAll HandAI services stopped successfully." -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
