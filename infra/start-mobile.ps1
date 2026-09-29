# infra/start-mobile.ps1
# HandAI - Start Expo Mobile Scanner UI with LAN & Firewall Fallback
param(
    [int]$Port = 0
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $RepoRoot

. "$PSScriptRoot\port-manager.ps1"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  HANDAI -- MOBILE APP (React Native / Expo Metro)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Step 1: Dynamically detect active LAN IP for physical device access
Write-Host "[1/4] Detecting primary LAN IP for physical device access..." -ForegroundColor Cyan
$lanIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { 
    $_.InterfaceAlias -notmatch 'Loopback|vEthernet|WSL|VMware|Radmin|Virtual' -and 
    $_.IPAddress -notmatch '^169\.254\.' -and 
    $_.IPAddress -ne '127.0.0.1' 
} | Select-Object -First 1).IPAddress

if (-not $lanIp) {
    $lanIp = "127.0.0.1"
    Write-Host "  [WARN] No primary physical LAN adapter found. Falling back to 127.0.0.1" -ForegroundColor Yellow
} else {
    Write-Host "  [OK] Primary LAN IP detected: $lanIp" -ForegroundColor Green
}

# Step 2: Check firewall availability and select Metro port
Write-Host "[2/4] Checking Windows Firewall port authorization..." -ForegroundColor Cyan

if ($Port -gt 0) {
    $metroPort = $Port
    Write-Host "  [INFO] User explicitly specified port $metroPort." -ForegroundColor Cyan
} else {
    $has8083Rule = $false
    
    # Check specific HandAI rule first
    & netsh advfirewall firewall show rule name="HandAI Expo Metro 8083" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        $has8083Rule = $true
    } else {
        # Check all inbound rules for 8083
        $inboundRules = (netsh advfirewall firewall show rule name=all dir=in) -join "`n"
        if ($inboundRules -match 'LocalPort:\s*8083\b') {
            $has8083Rule = $true
        }
    }

    if ($has8083Rule) {
        $metroPort = 8083
        Write-Host "  [OK] Inbound firewall rule active for port 8083." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Inbound port 8083 is BLOCKED by Windows Firewall (rule missing)." -ForegroundColor Yellow
        Write-Host "  [FALLBACK] Port 8081 is pre-authorized by firewall rule 'MathVision Expo Metro 8081'." -ForegroundColor Yellow
        Write-Host "  [FALLBACK] Automatically routing Metro Bundler to port 8081 for seamless mobile access." -ForegroundColor Green
        Write-Host "  [TIP] To enable port 8083 permanently, run 'infra\setup-firewall.bat' as Administrator.`n" -ForegroundColor DarkGray
        $metroPort = 8081
    }
}

# Step 3: Pre-flight check & kill any old process on target and alternate ports
Write-Host "[3/4] Checking and releasing port $metroPort (Metro Bundler)..." -ForegroundColor Cyan
Release-Port -TargetPort $metroPort | Out-Null
if ($metroPort -eq 8081) {
    Release-Port -TargetPort 8083 | Out-Null
} elseif ($metroPort -eq 8083) {
    Release-Port -TargetPort 8081 | Out-Null
}

# Step 4: Start Expo Metro Bundler in LAN mode
$MobileDir = Join-Path $RepoRoot "apps\mobile"
Set-Location $MobileDir

Write-Host "`n[4/4] Starting Expo Metro Bundler on port $metroPort (LAN: $lanIp)..." -ForegroundColor Cyan
Write-Host "  Metro URL: http://$lanIp`:$metroPort" -ForegroundColor Cyan
Write-Host "  Expo QR:   exp://$lanIp`:$metroPort" -ForegroundColor Cyan
Write-Host "  Command:   npx expo start --lan --port $metroPort --clear" -ForegroundColor Gray
Write-Host ""

# Set environment variables so Metro packager and mobile app target active LAN IP
$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
$env:EXPO_PUBLIC_APP_MODE = "HAND_AI"
$env:EXPO_PUBLIC_BACKEND_PORT = "8080"
$env:EXPO_PUBLIC_AI_PORT = "8001"
$env:EXPO_PUBLIC_API_URL = "http://${lanIp}:8080/api/v1"
$env:EXPO_PUBLIC_AI_SERVICE_URL = "http://${lanIp}:8001"

& cmd.exe /c "set REACT_NATIVE_PACKAGER_HOSTNAME=$lanIp && npx expo start --lan --port $metroPort --clear"
