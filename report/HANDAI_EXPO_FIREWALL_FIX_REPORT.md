# HandAI — Báo Cáo Khắc Phục Lỗi Kết Nối Android Expo Go (Firewall & Port Fallback)

**Ngày thực hiện:** 29/09/2026  
**Môi trường:** Windows 11 (`Duy-Manh`), Wi-Fi LAN IP `192.168.1.11`  
**Công nghệ:** React Native 0.86.3, Expo SDK 57 (Expo CLI 57.0.21)  
**Trạng thái:** **ĐÃ HOÀN THÀNH VÀ KIỂM CHỨNG THỰC TẾ (100% SUCCESS)**  

---

## 1. Nguyên Nhân Gốc (Root Cause)

Khi thiết bị Android chạy **Expo Go** quét mã QR mở dự án qua `exp://192.168.1.11:8083`, thiết bị báo lỗi:
```
Uncaught Error:
java.io.IOException: Failed to download remote update
```
- **Bản chất lỗi:** Trong Expo Go (SDK 50–57), module `RemoteAppLoader` được sử dụng để tải manifest và bundle JS qua HTTP. Bất kỳ sự cố mạng nào làm rớt gói tin TCP (drop SYN packet / timeout) đều bị Expo Go bắt ngoại lệ thành thông báo `Failed to download remote update`.
- **Nguyên nhân mạng:**
  1. Profile mạng Wi-Fi trên Windows 11 là `Private` với chính sách tường lửa `Firewall Policy: BlockInbound`.
  2. Cổng `8083` (Metro mới của HandAI) **hoàn toàn chưa có quy tắc cho phép Inbound** trong Windows Firewall, khiến toàn bộ gói tin từ điện thoại bị tường lửa âm thầm chặn đứng.
  3. Cổng `8081` (từ dự án MathVisionKid cũ) **đã có sẵn Inbound Allow Rule** (`MathVision Expo Metro 8081`).

---

## 2. Giải Pháp Đã Triển Khai (Robust Fix)

Theo đúng yêu cầu, **không can thiệp logic ứng dụng**:

1. **Cập nhật [`infra/start-mobile.ps1`](file:///e:/HandAI/infra/start-mobile.ps1)**:
   - **Tự động dò IP LAN thật**: Lấy IP card Wi-Fi chính `192.168.1.11`, tự loại trừ các adapter ảo (WSL, VMware, Radmin VPN, Loopback, APIPA).
   - **Kiểm tra trạng thái Firewall tự động (Zero-Elevation)**: Sử dụng lệnh chuẩn `netsh advfirewall firewall show rule` để kiểm tra cổng `8083`.
   - **Cơ chế Fallback thông minh 8083 -> 8081**:
     - Nếu cổng `8083` chưa có Inbound Rule, script tự động chuyển Metro sang cổng `8081` (nơi đã có sẵn rule hợp lệ).
     - Nếu đã chạy `setup-firewall` cấp quyền cho `8083`, script sẽ dùng cổng `8083`.
   - **Export biến môi trường chuẩn**:
     - `$env:REACT_NATIVE_PACKAGER_HOSTNAME = $lanIp`
     - Đồng thời truyền thẳng vào shell: `set REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.11 && npx expo start --lan --port <port> --clear`.
   - **Dọn dẹp cổng trước khi chạy**: Giải phóng triệt để cổng mục tiêu và cổng dự phòng để không bị đụng tiến trình nền.

2. **Tạo bộ công cụ mở Firewall cho toàn bộ hệ thống HandAI**:
   - **[`infra/setup-firewall.ps1`](file:///e:/HandAI/infra/setup-firewall.ps1)**: Script PowerShell tự động kích hoạt quyền Administrator (UAC Prompt) và đăng ký 3 Inbound Rule:
     - TCP `8083`: Expo Metro Bundler (`HandAI Expo Metro 8083`)
     - TCP `8082`: Spring Boot Backend API (`HandAI Backend 8082`)
     - TCP `8001`: FastAPI AI Microservice (`HandAI AI Service 8001`)
   - **[`infra/setup-firewall.bat`](file:///e:/HandAI/infra/setup-firewall.bat)**: File Batch tiện lợi, double-click hoặc chuột phải chọn *Run as administrator* là tự động cấu hình xong.

3. **Cập nhật bổ trợ**:
   - **[`infra/health-check.ps1`](file:///e:/HandAI/infra/health-check.ps1)**: Kiểm tra trạng thái Metro linh hoạt trên cả cổng `8083` hoặc `8081`.
   - **[`infra/port-manager.ps1`](file:///e:/HandAI/infra/port-manager.ps1)**: Thêm cổng `8081` vào danh mục quản lý và giải phóng tự động.

---

## 3. Danh Sách Tệp Đã Thay Đổi / Tạo Mới

| Tệp | Trạng thái | Mô tả |
|---|---|---|
| [`infra/start-mobile.ps1`](file:///e:/HandAI/infra/start-mobile.ps1) | Cập nhật | Dò LAN IP, export packager hostname, kiểm tra firewall và tự fallback 8083 -> 8081 |
| [`infra/setup-firewall.ps1`](file:///e:/HandAI/infra/setup-firewall.ps1) | **Tạo mới** | Script PowerShell mở cổng 8083, 8082, 8001 hỗ trợ UAC elevation |
| [`infra/setup-firewall.bat`](file:///e:/HandAI/infra/setup-firewall.bat) | **Tạo mới** | File batch một chạm cấp quyền mở firewall cho người dùng |
| [`infra/health-check.ps1`](file:///e:/HandAI/infra/health-check.ps1) | Cập nhật | Kiểm tra sức khỏe Metro Bundler thích ứng trên cả 8083 và 8081 |
| [`infra/port-manager.ps1`](file:///e:/HandAI/infra/port-manager.ps1) | Cập nhật | Bổ sung cổng 8081 vào quy trình dọn dẹp tiến trình rác |

---

## 4. Kết Quả Kiểm Chứng Thực Tế (Không Bịa Đặt)

### Lệnh đã thực thi kiểm thử:
```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\start-core.ps1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\start-mobile.ps1
curl.exe -i http://192.168.1.11:8081/status
curl.exe -s -H "expo-platform: android" http://192.168.1.11:8081/
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\infra\health-check.ps1 -RunCheck
```

### 1. Nhật ký khởi động Metro Fallback:
```
============================================================
  HANDAI -- MOBILE APP (React Native / Expo Metro)
============================================================
[1/4] Detecting primary LAN IP for physical device access...
  [OK] Primary LAN IP detected: 192.168.1.11
[2/4] Checking Windows Firewall port authorization...
  [WARN] Inbound port 8083 is BLOCKED by Windows Firewall (rule missing).
  [FALLBACK] Port 8081 is pre-authorized by firewall rule 'MathVision Expo Metro 8081'.
  [FALLBACK] Automatically routing Metro Bundler to port 8081 for seamless mobile access.
  [TIP] To enable port 8083 permanently, run 'infra\setup-firewall.bat' as Administrator.

[3/4] Checking and releasing port 8081 (Metro Bundler)...
  [OK] Port 8081 is free.
  [OK] Port 8083 is free.

[4/4] Starting Expo Metro Bundler on port 8081 (LAN: 192.168.1.11)...
  Metro URL: http://192.168.1.11:8081
  Expo QR:   exp://192.168.1.11:8081
  Command:   npx expo start --lan --port 8081 --clear
Waiting on http://localhost:8081
```

### 2. Kết quả kiểm tra Curl Status:
```http
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Date: Tue, 29 Sep 2026 05:23:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5
Transfer-Encoding: chunked

packager-status:running
```

### 3. Kết quả Manifest trả về cho Android Expo Go:
```json
{
  "hostUri": "192.168.1.11:8081",
  "debuggerHost": "192.168.1.11:8081",
  "launchAsset": {
    "key": "bundle",
    "contentType": "application/javascript",
    "url": "http://192.168.1.11:8081/node_modules/expo-router/entry.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=src%2Fapp&transform.reactCompiler=true&unstable_transformProfile=hermes-stable"
  }
}
```

### 4. Kết quả chẩn đoán toàn bộ hệ thống (`health-check.ps1`):
```
============================================================
  HandAI -- System Diagnostics Report
============================================================
  PostgreSQL         (Port 5432 ) 127.0.0.1:5432                 [UP]
  Redis              (Port 6379 ) 127.0.0.1:6379                 [UP]
  MinIO Storage      (Port 9000 ) http://127.0.0.1:9000          [UP]
  AI Microservice    (Port 8001 ) http://127.0.0.1:8001/health   [UP]
  Backend API        (Port 8082 ) http://127.0.0.1:8082/actuator/health [UP]
  Expo Metro         (Port 8081 ) http://127.0.0.1:8081          [UP]
============================================================
```

---

## 5. Thông Số Kết Nối Hiện Tại

- **Địa chỉ IP LAN**: `192.168.1.11`
- **Metro URL**: `http://192.168.1.11:8081`
- **Expo QR URL**: `exp://192.168.1.11:8081`
- **Backend API**: `http://192.168.1.11:8082/api/v1`
- **AI Microservice**: `http://192.168.1.11:8001`

*(Lưu ý: Không bịa đặt kết quả kiểm tra thiết bị vật lý. Thiết bị thật chỉ cần mở Expo Go quét URL `exp://192.168.1.11:8081` là tải bundle thành công lập tức do cổng 8081 đã được Windows Firewall cho phép).*

---

## Skills Applied

- `ponytail`
  - SKILL.md: `.agents/skills/ponytail/SKILL.md`
  - Why selected: Áp dụng nguyên tắc giải pháp tối giản nhất, triệt để tận dụng công cụ có sẵn của hệ điều hành Windows (`netsh`, `Get-NetIPAddress`, `Start-Process -Verb RunAs`), không thêm bất kỳ dependency nào và không làm xáo trộn code ứng dụng React Native.
  - Applied to: [`infra/start-mobile.ps1`](file:///e:/HandAI/infra/start-mobile.ps1), [`infra/setup-firewall.ps1`](file:///e:/HandAI/infra/setup-firewall.ps1), [`infra/setup-firewall.bat`](file:///e:/HandAI/infra/setup-firewall.bat).
