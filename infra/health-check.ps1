# infra/health-check.ps1
# HandAI - Comprehensive System Diagnostics and Health Checks
param(
    [switch]$Detailed,
    [switch]$Json,
    [switch]$RunCheck
)

$ErrorActionPreference = "SilentlyContinue"

function Test-TcpConnectionFast {
    param(
        [string]$TargetHost = "127.0.0.1",
        [int]$Port = 80,
        [int]$TimeoutMs = 1500
    )
    $tcp = New-Object System.Net.Sockets.TcpClient
    try {
        $iar = $tcp.BeginConnect($TargetHost, $Port, $null, $null)
        $success = $iar.AsyncWaitHandle.WaitOne($TimeoutMs, $false)
        if (-not $success) {
            $tcp.Close()
            return $false
        }
        $tcp.EndConnect($iar)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-TcpPort {
    param(
        [string]$TargetHost = "127.0.0.1",
        [int]$Port,
        [string]$ServiceName,
        [int]$TimeoutSeconds = 30
    )
    Write-Host -NoNewline "  [*] Waiting for $ServiceName ($TargetHost`:$Port)... "
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        if (Test-TcpConnectionFast -TargetHost $TargetHost -Port $Port -TimeoutMs 1000) {
            Write-Host "READY ($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
            return $true
        }
        Start-Sleep -Milliseconds 600
    }
    Write-Host "TIMEOUT (${TimeoutSeconds}s)" -ForegroundColor Red
    return $false
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [string]$ServiceName,
        [string]$ExpectedContent = "",
        [int]$TimeoutSeconds = 60
    )
    Write-Host -NoNewline "  [*] Waiting for $ServiceName ($Url)... "
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $resp = Invoke-RestMethod -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
            if ($resp) {
                $text = if ($resp -is [string]) { $resp } else { $resp | ConvertTo-Json -Compress }
                if (-not $ExpectedContent -or ($text -match $ExpectedContent)) {
                    Write-Host "READY ($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
                    return $true
                }
            }
        } catch {
            # Try raw web request as fallback
            try {
                $raw = Invoke-WebRequest -Uri $Url -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
                if ($raw.StatusCode -ge 200 -and $raw.StatusCode -lt 400) {
                    $rawText = if ($raw.Content -is [byte[]]) { [System.Text.Encoding]::UTF8.GetString($raw.Content) } else { [string]$raw.Content }
                    if (-not $ExpectedContent -or ($rawText -match $ExpectedContent)) {
                        Write-Host "READY ($([math]::Round($sw.Elapsed.TotalSeconds, 1))s)" -ForegroundColor Green
                        return $true
                    }
                }
            } catch {}
        }
        Start-Sleep -Milliseconds 800
    }
    Write-Host "TIMEOUT (${TimeoutSeconds}s)" -ForegroundColor Red
    return $false
}

function Get-ServiceHealthReport {
    $report = [PSCustomObject]@{
        Postgres  = $false
        Redis     = $false
        MinIO     = $false
        AiService = $false
        Backend   = $false
        ExpoMetro = $false
    }

    # 1. PostgreSQL (5432)
    $report.Postgres = Test-TcpConnectionFast -Port 5432

    # 2. Redis (6379)
    $report.Redis = Test-TcpConnectionFast -Port 6379

    # 3. MinIO (9000)
    $report.MinIO = Test-TcpConnectionFast -Port 9000

    # 4. FastAPI AI Service (8001)
    try {
        $aiResp = Invoke-RestMethod -Uri "http://127.0.0.1:8001/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($aiResp -and ($aiResp.status -eq "ok" -or $aiResp -match "ok")) { $report.AiService = $true }
    } catch {}

    # 5. Spring Boot Backend (8080)
    try {
        $beResp = Invoke-RestMethod -Uri "http://127.0.0.1:8080/actuator/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction SilentlyContinue
        if ($beResp -and ($beResp.status -eq "UP" -or $beResp -match "UP")) { $report.Backend = $true }
    } catch {}

    # 6. Expo Metro Bundler (8083 or 8081 fallback)
    $report.ExpoMetro = (Test-TcpConnectionFast -Port 8083) -or (Test-TcpConnectionFast -Port 8081)

    return $report
}

function Show-HealthReport {
    if ($Json) {
        $r = Get-ServiceHealthReport
        $r | ConvertTo-Json
        return
    }

    Write-Host "`n============================================================" -ForegroundColor Cyan
    Write-Host "  HandAI -- System Diagnostics Report" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan

    $r = Get-ServiceHealthReport

    function Format-StatusLine($name, $port, $url, $status) {
        $statText = if ($status) { "[UP]" } else { "[DOWN]" }
        $color = if ($status) { "Green" } else { "Red" }
        Write-Host ("  {0,-18} (Port {1,-5}) {2,-30} " -f $name, $port, $url) -NoNewline
        Write-Host $statText -ForegroundColor $color
    }

    $metroPortActive = if (Test-TcpConnectionFast -Port 8083) { 8083 } elseif (Test-TcpConnectionFast -Port 8081) { 8081 } else { 8083 }

    Format-StatusLine "PostgreSQL" 5432 "127.0.0.1:5432" $r.Postgres
    Format-StatusLine "Redis" 6379 "127.0.0.1:6379" $r.Redis
    Format-StatusLine "MinIO Storage" 9000 "http://127.0.0.1:9000" $r.MinIO
    Format-StatusLine "AI Microservice" 8001 "http://127.0.0.1:8001/health" $r.AiService
    Format-StatusLine "Backend API" 8080 "http://127.0.0.1:8080/actuator/health" $r.Backend
    Format-StatusLine "Expo Metro" $metroPortActive "http://127.0.0.1:$metroPortActive" $r.ExpoMetro

    Write-Host "============================================================`n" -ForegroundColor Cyan

    $allCoreOk = $r.Postgres -and $r.Redis -and $r.MinIO -and $r.AiService -and $r.Backend
    if ($allCoreOk) { exit 0 } else { exit 1 }
}

# Only run report if explicitly called directly, not when dot-sourced
if ($MyInvocation.InvocationName -ne "." -and ($Json -or $Detailed -or $RunCheck -or ($MyInvocation.Line -match 'health-check\.ps1'))) {
    Show-HealthReport
}
