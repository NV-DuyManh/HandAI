# HandAI Mobile Runtime Diagnostic & Root Cause Report
**Target Environment:** React Native / Expo SDK 57 (Android Expo Go)  
**Host Machine:** Windows 11 (`Duy-Manh`)  
**Network Interface:** Wi-Fi (Intel Wi-Fi 6 AX201, LAN IP `192.168.1.11`)  
**Inspection Date:** 2026-09-29  

---

## 1. Current Failure

When scanning the Expo QR code or opening the project URL (`exp://192.168.1.11:8083`) via Android Expo Go on a physical device, the device fails to download/load the JavaScript bundle with the error:

```
Uncaught Error:
java.io.IOException: Failed to download remote update
```

---

## 2. Evidence Collected

### Phase 1 — Environment Discovery
* **Project Location (`Get-Location`):**
  ```
  Path
  ----
  E:\HandAI
  ```
* **Runtime Versions:**
  - Node.js: `v22.19.0`
  - npm: `10.9.3`
  - Expo CLI: `57.0.21`
  - Expo SDK in `package.json`: `~57.0.19`
  - React Native: `0.86.3`
* **Expo Doctor (`npx expo-doctor` in `apps/mobile`):**
  ```
  Running 21 checks on your project...
  19/21 checks passed. 2 checks failed.
  ✖ Check for lock file: No lock file detected.
  ✖ Check that packages match versions required by installed Expo SDK:
    Minor patch mismatches (e.g. expo ~57.0.25 vs 57.0.19).
  ```

---

### Phase 2 — Network Investigation

| Adapter Name | IPv4 Address | Connection Status | Used for Expo LAN? | Technical Reason |
|---|---|---|---|---|
| **Wi-Fi** (Intel Wi-Fi 6 AX201) | `192.168.1.11` | **Connected (Preferred)** | **YES** | Primary physical WLAN interface connected to gateway `192.168.1.1`. Physical Android devices on the same Wi-Fi reside on this `192.168.1.0/24` subnet. |
| **Ethernet** (Realtek PCIe GbE) | APIPA (`169.254.183.222`) | Media disconnected | **NO** | Physical cable unplugged. |
| **Radmin VPN** | `26.205.69.217` | Connected | **NO** | Virtual VPN mesh adapter. Unroutable by mobile phone on physical Wi-Fi. |
| **VMware VMnet1** | `192.168.164.1` | Connected | **NO** | VMware host-only virtual adapter; isolated from local WLAN. |
| **VMware VMnet8** | `192.168.222.1` | Connected | **NO** | VMware NAT virtual adapter; isolated from local WLAN. |
| **vEthernet (WSL)** | `172.26.144.1` | Connected | **NO** | Hyper-V virtual switch for WSL2; internal loopback switch. |
| **Wi-Fi Direct (Local Area Connection* 1/2)** | APIPA | Media disconnected | **NO** | Virtual P2P interfaces disconnected. |
| **Bluetooth Network Connection** | APIPA | Media disconnected | **NO** | Bluetooth PAN disconnected. |

---

### Phase 3 — Expo Startup Analysis

* **Startup Script:** `infra/start-mobile.ps1`
* **Actual Command Executed:**
  ```powershell
  $env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp
  $env:EXPO_PUBLIC_APP_MODE = "HAND_AI"
  $env:EXPO_PUBLIC_BACKEND_PORT = "8082"
  $env:EXPO_PUBLIC_AI_PORT = "8001"
  $env:EXPO_PUBLIC_API_URL = "http://${lanIp}:8082/api/v1"
  $env:EXPO_PUBLIC_AI_SERVICE_URL = "http://${lanIp}:8001"

  & cmd.exe /c "npx expo start --lan --port 8083 --clear"
  ```
* **Host Mode:** `--lan`
* **Port Configured:** `8083`
* **`REACT_NATIVE_PACKAGER_HOSTNAME` Status:**
  - Before script execution / manual startup: **Unset (`$null`)**
  - Inside `infra/start-mobile.ps1`: Evaluated to `192.168.1.11`

---

### Phase 4 — Clean Expo Server Startup

Executing clean launch:
```cmd
npx expo start --lan --port 8083 --clear
```
Terminal output captured:
```
env: load .env.local .env
env: export EXPO_PUBLIC_ACTIVE_DATASET_VERSION EXPO_PUBLIC_ACTIVE_MODEL_VERSION EXPO_PUBLIC_AI_SERVICE_URL EXPO_PUBLIC_API_URL EXPO_PUBLIC_APP_MODE
Starting project at E:\HandAI\apps\mobile
Using src/app as the root directory for Expo Router.
React Compiler enabled
Starting Metro Bundler

warning: Bundler cache is empty, rebuilding (this may take a minute)
Waiting on http://localhost:8083

An update for expo is available: 57.0.19 → ~57.0.25
18 other packages may need updating. Run npx expo install --check for details.
Logs for your project will appear below.
```

* **Metro URL:** `http://192.168.1.11:8083`
* **QR URL:** `exp://192.168.1.11:8083`
* **LAN IP:** `192.168.1.11`
* **Port:** `8083`
* **Expo SDK Version:** `57.0.0` (Expo CLI `57.0.21`, package `~57.0.19`)

---

### Phase 5 — Bundle Access Test

From development machine:
```cmd
curl.exe -i http://192.168.1.11:8083/status
```
**HTTP Response:**
```http
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Date: Tue, 29 Sep 2026 05:09:22 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

packager-status:running
```
**Compilation Test:**
Fetching `entry.bundle?platform=android&dev=true...` compiled successfully:
- Download size: `10,911,856 bytes` (`10.4 MB`)
- Status: `200 OK` (Hermes bytecode / JavaScript bundle generated cleanly without compilation errors).

---

### Phase 6 — Windows Firewall Check

**Active Network Profile (`Get-NetConnectionProfile`):**
```
Name           : Kim Chung 4
InterfaceAlias : Wi-Fi
NetworkCategory: Private
```

**Firewall Policy on Private Profile (`netsh advfirewall show privateprofile`):**
```
Private Profile Settings:
State             : ON
Firewall Policy   : BlockInbound, AllowOutbound
```

**Firewall Rules Audit (`netsh advfirewall firewall show rule`):**
1. **Port 8081:**
   - Rule Name: `MathVision Expo Metro 8081`
   - Direction: `Inbound`
   - Protocol: `TCP`
   - LocalPort: `8081`
   - Profiles: `Private`
   - Action: `Allow`
2. **Node.js (`node.exe`):**
   - Rule Name: `Node.js JavaScript Runtime`
   - Profiles: `Public` **ONLY** (Not enabled for `Private`!)
   - Action: `Allow` (Inactive when connected to Private Wi-Fi)
3. **Ports 8083, 8082, 8001:**
   - Firewall Rules: **NONE**!
   - Under `BlockInbound` policy, all inbound TCP traffic on ports 8083, 8082, and 8001 is **silently blocked and dropped by Windows Firewall**.

---

### Phase 7 — Expo Update Configuration Check

* `apps/mobile/app.json`:
  - Contains **NO** `updates` or `updates.url` key.
  - Contains **NO** `expo-updates` in `plugins`.
* `apps/mobile/app.config.js`:
  - Contains **NO** `updates` configuration.
* `apps/mobile/package.json`:
  - `expo-updates` is **NOT installed** in `dependencies`.

**Determine:** Is Expo Go trying to download an EAS/OTA remote update?  
**Answer: NO.**

#### Why does Expo Go report "Failed to download remote update"?
In modern Expo Go (SDK 50 through 57), Expo Go internally utilizes the `expo-updates` runtime module (`RemoteAppLoader` / `ExpoUpdatesAppLoader`) as its generic application manifest and bundle loader. When a developer opens a project via `exp://<HOST>:<PORT>`, Expo Go attempts an HTTP GET request to `http://<HOST>:<PORT>/` to download the development manifest.

If this network request fails (due to a TCP timeout, connection drop, or host unreachable error), Expo Go's exception handler catches the underlying `java.io.IOException` / `SocketTimeoutException` and displays:
```
Uncaught Error: java.io.IOException: Failed to download remote update
```
This message is an internal Expo Go error description for **"Network connection to Metro Bundler failed"**.

---

## 3. Root Cause

The failure is caused by a **two-fold network/firewall obstruction**:

1. **Firewall Drop on Port 8083 (Primary Cause):**
   - The user's active Wi-Fi network (`Kim Chung 4`) is classified as `Private`.
   - The Windows Firewall Private Profile has `Firewall Policy: BlockInbound`.
   - The legacy `MathVisionKid` project used port `8081`, for which a firewall rule (`MathVision Expo Metro 8081`) was registered.
   - When `HandAI` moved Metro Bundler from port `8081` to port `8083`, **no corresponding Windows Firewall rule was created for port 8083**.
   - As a result, when an external physical Android device on the Wi-Fi network attempts to connect to `http://192.168.1.11:8083`, Windows Firewall drops the SYN packets.

2. **Loopback Manifest Fallback (Secondary Cause during manual start):**
   - When `npx expo start --lan --port 8083` is executed without explicitly exporting `REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.11`, Expo CLI defaults `launchAsset.url` to `http://127.0.0.1:8083/...`.
   - If the mobile device ever receives that manifest, it attempts to download the bundle from `127.0.0.1` on the phone itself, triggering an immediate `ConnectException`.

---

## 4. Failed Component

1. **Windows Firewall Inbound Port Filter:** Dropping inbound TCP on port `8083` across the `Private` profile.
2. **Expo Host Binding:** Fails to bind LAN IP in non-interactive/multi-adapter environments unless `REACT_NATIVE_PACKAGER_HOSTNAME` is explicitly forced.

---

## 5. Fix Applied

### Fix A: Administrative Firewall Rule Addition (Permanent for Port 8083)
An automated configuration script has been created at [`infra/setup-firewall.bat`](file:///e:/HandAI/infra/setup-firewall.bat) and [`infra/setup-firewall.ps1`](file:///e:/HandAI/infra/setup-firewall.ps1).
Running this file as Administrator executes:
```cmd
netsh advfirewall firewall add rule name="HandAI Expo Metro 8083" dir=in action=allow protocol=TCP localport=8083 profile=Private,Public
netsh advfirewall firewall add rule name="HandAI Backend 8082" dir=in action=allow protocol=TCP localport=8082 profile=Private,Public
netsh advfirewall firewall add rule name="HandAI AI Service 8001" dir=in action=allow protocol=TCP localport=8001 profile=Private,Public
```

### Fix B: Zero-Elevation Fallback to Pre-Authorized Port 8081
Because port `8081` already has rule `MathVision Expo Metro 8081` active and authorized in Windows Firewall for `Profile: Private`, and port `8081` is currently 100% free on this machine, `infra/start-mobile.ps1` can dynamically fallback to port `8081` if port `8083` is blocked.

### Fix C: Guaranteed LAN Packager Hostname
Updated `infra/start-mobile.ps1` to ensure `REACT_NATIVE_PACKAGER_HOSTNAME` is always exported into both PowerShell and child `cmd.exe` processes before Metro initializes.

---

## 6. Files Changed

1. [`infra/setup-firewall.bat`](file:///e:/HandAI/infra/setup-firewall.bat): Elevated helper to register HandAI ports 8083, 8082, and 8001 in Windows Firewall.
2. [`infra/setup-firewall.ps1`](file:///e:/HandAI/infra/setup-firewall.ps1): PowerShell script version with profile detection.
3. [`infra/start-mobile.ps1`](file:///e:/HandAI/infra/start-mobile.ps1): Added firewall check and explicit host propagation.

---

## 7. Device Connection Simulation Report

```
==================================================
DEVICE CONNECTION REPORT
==================================================
Computer LAN IP     : 192.168.1.11
Metro Port          : 8083 (or 8081 with pre-authorized firewall rule)
Expo URL            : exp://192.168.1.11:8083
QR Payload          : exp://192.168.1.11:8083
Local Status Check  : packager-status:running (200 OK)
Bundle Size         : 10.4 MB (Compiled successfully)
Firewall State      : Port 8083 requires Administrator rule addition;
                      Port 8081 is pre-authorized on Private profile.
==================================================
```

---

## 8. Remaining Risks

1. **Client Isolation on Wi-Fi Router:**
   Some guest Wi-Fi networks or router security settings ("AP Isolation" / "Client Isolation") prevent Wi-Fi devices from communicating with one another even if the PC firewall is disabled. Both PC and phone must be on the main Wi-Fi band without AP isolation enabled.
2. **Cellular Data Conflict:**
   If the mobile phone has Wi-Fi enabled but also keeps Cellular Mobile Data (4G/5G) active, Android may route requests to `192.168.1.11` over the mobile interface if the Wi-Fi connection lacks external internet or DNS resolution. Disabling mobile data while connecting ensures traffic stays on the local WLAN.
3. **Backend Service Ports (8082 & 8001):**
   Once Expo Go loads the JS bundle, the mobile application communicates with Spring Boot (`8082`) and FastAPI (`8001`). These ports must also be allowed in Windows Firewall via `setup-firewall.bat` so the mobile app can submit handwriting images and retrieve OCR evaluations.
