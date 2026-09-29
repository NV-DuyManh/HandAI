# infra/port-manager.ps1
# HandAI - Automated Port and Process Management
param(
    [int]$Port = 0,
    [switch]$CleanAll
)

$ErrorActionPreference = "SilentlyContinue"

function Release-Port {
    param([int]$TargetPort)

    if ($TargetPort -le 0) { return $true }

    $maxRetries = 10
    $retryCount = 0

    while ($retryCount -lt $maxRetries) {
        $conns = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
        if (-not $conns) {
            $netstatMatches = netstat -ano | Select-String "\s+TCP\s+.*:$TargetPort\s+.*\s+LISTENING\s+(\d+)"
            if (-not $netstatMatches) {
                Write-Host "  [OK] Port $TargetPort is free." -ForegroundColor Green
                return $true
            }
            $pidsToKill = @()
            foreach ($match in $netstatMatches) {
                if ($match.Matches.Groups.Count -ge 2) {
                    $pidsToKill += [int]$match.Matches.Groups[1].Value
                }
            }
        } else {
            $pidsToKill = $conns | ForEach-Object { $_.OwningProcess } | Where-Object { $_ -gt 0 } | Select-Object -Unique
        }

        if (-not $pidsToKill -or $pidsToKill.Count -eq 0) {
            Write-Host "  [OK] Port $TargetPort is free." -ForegroundColor Green
            return $true
        }

        foreach ($procId in $pidsToKill) {
            $procName = "Unknown"
            try {
                $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($p) { $procName = $p.ProcessName }
            } catch {}

            Write-Host "  [CLEANUP] Releasing port $TargetPort occupied by $procName (PID: $procId)..." -ForegroundColor Yellow

            try {
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            } catch {}

            & taskkill.exe /PID $procId /T /F 2>$null | Out-Null
        }

        Start-Sleep -Milliseconds 600
        $retryCount++
    }

    $finalConns = Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue
    if ($finalConns) {
        Write-Host "  [WARN] Port $TargetPort may still be bound after cleanup attempts." -ForegroundColor DarkYellow
        return $false
    }
    Write-Host "  [OK] Port $TargetPort released successfully." -ForegroundColor Green
    return $true
}

function Clean-HandAIPorts {
    Write-Host "[*] Checking and releasing HandAI ports (8001, 8002, 8080, 8081, 8082, 8083)..." -ForegroundColor Cyan
    $ports = @(8001, 8002, 8080, 8081, 8082, 8083)
    foreach ($p in $ports) {
        Release-Port -TargetPort $p | Out-Null
    }
}

# Only execute when called as script, not when dot-sourced
if ($MyInvocation.InvocationName -ne "." -and ($CleanAll -or ($Port -gt 0))) {
    if ($CleanAll) {
        Clean-HandAIPorts
    } else {
        Release-Port -TargetPort $Port
    }
}
