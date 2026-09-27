# HandAI — Technical Stack Specification

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative Technology Stack Specification  

---

## 1. Complete Technology Stack Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Mobile Layer                           │
│  React Native 0.76+ • Expo SDK 57 • TypeScript 5.3+ • Expo Router v4   │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP REST / Multipart Binary
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Backend Business Gateway                          │
│   Java 21 LTS • Spring Boot 3.3.4 • Spring Data JPA • Hibernate 6      │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │ JDBC                             │ S3 SDK
                   ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Relational Database           │  │    Object Storage Service    │
│  PostgreSQL 15+ • Flyway Migration   │  │   MinIO S3-Compatible Server │
└──────────────────────────────────────┘  └──────────────────────────────┘
                   │
                   ▼ Internal HTTP (Port 8000)
┌────────────────────────────────────────────────────────────────────────┐
│                        AI Runtime Microservice                         │
│     Python 3.13 • FastAPI 0.115+ • Uvicorn • Pydantic v2 • Celery      │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │ Torch / C++                      │ HTTPS TLS
                   ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│        Deep Learning Engine          │  │    Cloud LLM Post-Advisors   │
│ PyTorch 2.6.0+cu124 / 2.3.0 • OpenCV │  │ Groq (Qwen/LLaMA) • Gemini   │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 2. Frontend Technologies (`apps/student-mobile`)

| Technology / Library | Version | Role in HandAI |
|---|---|---|
| **React Native** | `0.76+` | Native cross-platform mobile runtime engine. |
| **Expo SDK** | `57.0.0` | Native mobile application toolchain and platform SDK. |
| **Expo Router** | `~4.0.0` | File-system-based screen navigation and deep linking. |
| **TypeScript** | `^5.3.3` | Strict type safety for data models, CER/WER, and error records. |
| **Expo Camera** | SDK 57 | Hardware camera interface with flash and continuous autofocus. |
| **Expo Image Picker** | SDK 57 | Native media picker for selecting photos from device gallery. |
| **Expo SecureStore** | SDK 57 | Encrypted on-device persistence for tokens and trial cache. |
| **Axios** | `^1.7.0` | HTTP client transport with interceptors and timeout management. |
| **Lucide / Ionicons** | `@expo/vector-icons` | High-fidelity UI icons for scanner, status, and analytics cards. |

---

## 3. Backend Technologies (`backend/business-api`)

| Technology / Library | Version | Role in HandAI |
|---|---|---|
| **Java JDK** | `21 LTS` (Eclipse Temurin) | Modern Java runtime with virtual threads and pattern matching. |
| **Spring Boot** | `3.3.4` | Enterprise service framework, dependency injection, and REST API. |
| **Spring Data JPA** | `3.3.4` | ORM abstraction over Hibernate 6 for database entities. |
| **PostgreSQL Driver** | `42.7.4` | High-performance JDBC driver for PostgreSQL. |
| **Flyway** | `10.x` | Database schema version control and migrations (`V6`, `V7`, `V8`). |
| **MinIO Java SDK** | `8.5.10` | S3-compatible client for storing raw document photos and line crops. |
| **Lombok** | `1.18.34` | Code generator reducing boilerplate for entities and DTOs. |
| **Gradle** | `8.10` | Multi-module build automation tool. |

---

## 4. AI & Machine Learning Technologies (`ai/runtime`)

| Technology / Library | Version | Role in HandAI |
|---|---|---|
| **Python** | `3.13.9` / `3.11+` | Core language for AI microservice and computer vision. |
| **FastAPI** | `^0.115.0` | Asynchronous high-performance web framework for AI APIs. |
| **Uvicorn** | `^0.31.0` | ASGI server running FastAPI asynchronously. |
| **PyTorch** | `2.6.0+cu124` / `2.3.0` | Deep learning framework executing the CRNN sequence model. |
| **Torchvision** | `0.21.0+cu124` | Computer vision transformations (Resize, Normalize, ToTensor). |
| **OpenCV (`opencv-python`)** | `4.11.0.86` | Classical image processing: deskewing, Otsu, morphology, projection. |
| **NumPy** | `2.4.4` / `^1.26.0` | High-performance multidimensional array math and tensor slicing. |
| **Pillow (`PIL`)** | `12.2.0` | Image format conversion and EXIF orientation handling. |
| **Pydantic** | `^2.9.0` | Runtime data validation and JSON schema serialization. |
| **HTTPX** | `^0.27.0` | Asynchronous HTTP client for outbound Groq and Gemini API calls. |

---

## 5. Cloud LLM Advisor Integrations

| Provider | Models Deployed | Role in Pipeline |
|---|---|---|
| **Groq Cloud API** | `qwen/qwen3.8-27b`, `llama-3.3-70b-versatile` | Primary fast-inference contextual post-corrector and line analyzer. |
| **Google Gemini API** | `gemini-3.6-flash`, `gemini-flash-lite-latest` | Secondary independent consensus advisor for spelling verification. |

---

## 6. Database & Object Storage Infrastructure

| Subsystem | Technology | Storage Schema & Configuration |
|---|---|---|
| **Relational Database** | **PostgreSQL 15+** | Stores table `ocr_trials` tracking trial IDs, SHA256 hashes, predicted text, verified text, verdict, and model metadata. |
| **Object Storage** | **MinIO S3** | S3-compatible bucket `ocr-trials` storing immutable high-res uploads (`pageImageObjectKey`, `lineImageObjectKey`). |
| **In-Memory Cache / Queue** | **Redis 7.2** | Background worker queue for Celery tasks and LLM response caching. |
| **Containerization** | **Docker & Docker Compose** | Multi-container local orchestration (`docker-compose.yml`). |
