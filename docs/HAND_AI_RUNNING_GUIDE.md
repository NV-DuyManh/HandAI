# HandAI — System Running & Operations Guide

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative Deployment & Operations Manual  

---

## 1. Prerequisites & Environment Requirements

Before launching HandAI, ensure the host machine meets the following environment specifications:

| Requirement | Minimum Version | Recommended Version | Verification Command |
|---|---|---|---|
| **Operating System** | Windows 10/11 64-bit, macOS 13+, or Ubuntu 22.04 LTS | Windows 11 AMD64 / Ubuntu 22.04 | `cmd.exe /c ver` or `uname -a` |
| **Java JDK** | OpenJDK 21 LTS | Eclipse Temurin 21.0.4+ | `java -version` |
| **Python** | Python 3.11+ | Python 3.13.9 | `python --version` |
| **Node.js** | Node.js 20 LTS | Node.js 20.18+ / 22.x | `node -v` |
| **Package Manager**| npm 10+ | npm 10.8+ | `npm -v` |
| **Database** | PostgreSQL 15+ | PostgreSQL 16.x | `psql --version` |
| **Object Storage** | MinIO Server | MinIO RELEASE.2024+ | `minio --version` |

---

## 2. Configuration & Environment Variables

### 2.1 Frontend Environment (`apps/student-mobile/.env`)
Create or verify `.env` inside `apps/student-mobile/`:

```bash
# HandAI Mode Toggle (Enables HandAI branding, analytics & bypasses login)
EXPO_PUBLIC_APP_MODE=HAND_AI

# Backend Business API URL
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1

# Direct AI Service URL (Optional fallback)
EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:8000

# Active Model & Dataset Configuration
EXPO_PUBLIC_ACTIVE_MODEL_VERSION=CRNN-v1.2-PyTorch
EXPO_PUBLIC_ACTIVE_DATASET_VERSION=HandAI-v1.2
```

### 2.2 AI Runtime Environment (`ai/runtime/.env`)
Create or verify `.env` inside `ai/runtime/`:

```bash
# Service Configuration
HOST=127.0.0.1
PORT=8000
APP_ENV=development
RUNTIME_MODE=LIVE

# Internal Security Authentication
INTERNAL_API_KEY=secret-key-default

# OCR Provider Configuration
OCR_PROVIDER=crnn_vi_handwriting_v1
OCR_MODEL_DIR=models/ocr/crnn_vi_handwriting_v1
OCR_DEVICE=cpu   # Use 'cuda' if NVIDIA GPU with PyTorch CUDA is installed

# Groq Cloud LLM Advisor Integration
GROQ_ENABLED=true
GROQ_API_KEYS=your_groq_api_key_1,your_groq_api_key_2
GROQ_PRIMARY_VISION_MODEL=qwen/qwen3.8-27b
GROQ_POST_CORRECTION_ENABLED=true

# Google Gemini Cloud LLM Advisor Integration
GEMINI_ENABLED=true
GEMINI_API_KEYS=your_gemini_api_key_1
GEMINI_MODEL=gemini-3.6-flash
GEMINI_POST_CORRECTION_ENABLED=true

# MinIO Storage Settings
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_SECURE=false
MINIO_BUCKET=ocr-trials
```

### 2.3 Backend Business API Environment (`backend/business-api/.env`)
Create or verify `.env` inside `backend/business-api/`:

```bash
# Server Port
SERVER_PORT=8080

# PostgreSQL Connection
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/mathvision
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres

# AI Microservice URL & Secret
AI_SERVICE_URL=http://localhost:8000
INTERNAL_API_KEY=secret-key-default

# MinIO Configuration
MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=ocr-trials
```

---

## 3. Step-by-Step Launch Commands

### Option A: Automated Multi-Process Launcher (Windows)
From the repository root, run the preflight batch launcher:
```cmd
RUN_MATHVISION.bat
```
This script validates ports (8080, 8000, 5432, 9000), checks dependencies, and launches the services.

### Option B: Manual Service-by-Service Execution

#### Step 1: Start PostgreSQL and MinIO
Ensure local PostgreSQL and MinIO services are active:
- PostgreSQL running on port `5432` with database `mathvision`.
- MinIO running on port `9000` (Console on `9001`) with bucket `ocr-trials` created.

#### Step 2: Start the AI Microservice (FastAPI)
```bash
cd ai/runtime
# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies if needed:
pip install -r requirements.txt

# Start Uvicorn ASGI server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Step 3: Start the Backend Gateway (Spring Boot)
```bash
cd backend/business-api
# Build and run with Gradle
# Windows:
gradlew.bat bootRun
# Linux/macOS:
./gradlew bootRun
```
Spring Boot automatically applies Flyway migrations (`V6`, `V7`, `V8`) to set up the `ocr_trials` table.

#### Step 4: Start the Mobile Client (React Native / Expo 57)
```bash
cd apps/student-mobile
npm install

# Launch Expo development server in HandAI mode:
npx expo start --clear
```
- Press `a` to run on connected Android device/emulator.
- Press `w` to run in web browser for rapid UI testing.
- Scan QR code with Expo Go on a physical smartphone.

---

## 4. System Health Checks & Verification

Verify each service endpoint:

| Target Service | Check Method | Expected Response |
|---|---|---|
| **AI Service Health** | `curl http://localhost:8000/health` | `{"status":"ok","service":"mathvision-ai-service"}` |
| **Groq LLM Status** | `curl http://localhost:8000/internal/v1/groq-health` | `{"groq_enabled":true,"available_keys":...}` |
| **CRNN Line Inference** | `curl -X POST http://localhost:8000/internal/v1/ocr/recognize-line -H "X-Internal-API-Key: secret-key-default" --data-binary @line.jpg` | JSON with `recognized_text`, `model_name`, `confidence` |
| **Backend API Health** | `curl http://localhost:8080/api/v1/ocr/trials/metrics` | JSON with `totalTrials`, `accuracyRate` |
| **Mobile App Mode** | Check app header in mobile scanner | Displays `HandAI: Vietnamese Handwriting Recognition System` |

---

## 5. Troubleshooting & Known Workarounds

### Issue 1: Expo SDK 57 `FormData` Binary Serialization Error
- **Symptom:** Mobile app throws `TypeError: Unsupported FormDataPart implementation` when uploading photos.
- **Root Cause:** Expo SDK 57 overrides `global.fetch` with `winter/fetch` which only handles strings or Blobs, failing on React Native `{uri, name, type}` file objects.
- **Resolution:** `OcrPilotService.ts` bypasses `fetch` using native `XMLHttpRequest`, directing multipart requests straight to React Native's native OkHttp layer.

### Issue 2: Tomcat 8KB Header Buffer Exceeded
- **Symptom:** Backend returns HTTP 400 Bad Request or HTTP 431 Request Header Fields Too Large.
- **Root Cause:** Appending large image metadata in URL query strings exceeds default Tomcat HTTP header size.
- **Resolution:** All metadata fields are packed into `FormData` request body parts; query strings are kept minimal.

### Issue 3: Missing PyTorch Weights File
- **Symptom:** AI microservice logs `FileNotFoundError: OCR checkpoint not found: ... best_cer.pth`.
- **Resolution:** Verify that `best_cer.pth` exists in `ai/runtime/models/ocr/crnn_vi_handwriting_v1/`. Ensure SHA-256 matches `a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941`.

### Issue 4: Android Port Forwarding (Localhost Connection Refused)
- **Symptom:** Physical Android device connected via USB cannot connect to `http://localhost:8080` or `http://localhost:8000`.
- **Resolution:** Execute ADB reverse port forwarding commands:
  ```cmd
  adb reverse tcp:8080 tcp:8080
  adb reverse tcp:8000 tcp:8000
  adb reverse tcp:8081 tcp:8081
  ```
