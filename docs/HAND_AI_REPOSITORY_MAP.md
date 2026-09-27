# HandAI — Repository Map & Source Code Directory

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Documentation Type:** Structural Codebase Decomposition & Component Mapping  
> **Audit Status:** Verified against Active Filesystem  

---

## 1. Directory Tree Overview

The HandAI module spans across frontend, backend, AI microservice, dataset, and documentation directories within the monorepo:

```
MathVisionKid/
├── apps/
│   └── student-mobile/                  # [FRONTEND] React Native / Expo 57 Mobile Scanner & UI
│       └── src/
│           ├── app/                     # Screen routing (Expo Router)
│           │   ├── camera.tsx           # Camera scanner screen
│           │   ├── gallery.tsx          # Gallery image picker screen
│           │   ├── crop.tsx             # Interactive canvas cropping
│           │   ├── handai-analytics.tsx # Global Analytics & Experiment Tracking Dashboard
│           │   ├── handai-trial-analytics.tsx # Document Trial Evaluation Dashboard
│           │   ├── (tabs)/              # Primary navigation tabs
│           │   └── ocr-pilot/           # Multi-line review and arbitration screens
│           ├── config/
│           │   ├── appMode.ts           # HandAI vs MathVision runtime mode toggle
│           │   └── env.ts               # Host resolution & network environment
│           └── services/
│               ├── analytics/
│               │   └── handAiAnalyticsStore.ts # Core evaluation engine, CER/WER, error taxonomy
│               ├── api/
│               │   ├── apiClient.ts     # Axios HTTP transport with auth interceptors
│               │   └── OcrPilotService.ts # Frontend API service for OCR & line detection
│               └── image/
│                   └── imagePipeline.ts # Local file URI normalization and MIME detection
│
├── backend/
│   └── business-api/                    # [BACKEND] Spring Boot 3.3.4 Enterprise Service
│       └── src/
│           └── main/
│               ├── java/com/mathvisionkids/api/ocr/
│               │   ├── OcrTrialController.java # REST Controller: /api/v1/ocr/trials
│               │   ├── OcrPilotService.java    # Business service, MinIO sync, AI relay
│               │   ├── OcrTrial.java           # JPA Entity for PostgreSQL table ocr_trials
│               │   ├── OcrTrialRepository.java # Spring Data JPA repository
│               │   ├── OcrTrialResponse.java   # Response DTO
│               │   ├── OcrFeedbackRequest.java # Human feedback & verification DTO
│               │   ├── OcrMetricsResponse.java # Backend metrics aggregation DTO
│               │   └── OcrStorageVerifier.java # Storage integrity & SHA-256 verification
│               └── resources/
│                   └── db/migration/    # [DATABASE] Flyway PostgreSQL Migrations
│                       ├── V6__add_ocr_trial_and_feedback.sql
│                       ├── V7__add_ocr_trial_integrity_and_provenance.sql
│                       └── V8__privacy_fail_closed_and_tester_audit.sql
│
├── ai/
│   ├── runtime/                         # [AI RUNTIME] FastAPI Python 3.13 Microservice
│   │   ├── app/
│   │   │   ├── main.py                  # FastAPI app entry point & router registration
│   │   │   ├── config.py                # Pydantic v2 application configuration & env vars
│   │   │   ├── api/
│   │   │   │   └── ocr.py               # Line detection & recognition HTTP endpoints
│   │   │   ├── ocr/
│   │   │   │   ├── crnn_provider.py     # Production PyTorch CRNN inference adapter
│   │   │   │   ├── factory.py           # Provider factory pattern
│   │   │   │   └── model.py             # CRNN PyTorch nn.Module architecture
│   │   │   ├── schemas/
│   │   │   │   └── ocr_pilot.py         # Pydantic request/response schemas
│   │   │   └── integrations/
│   │   │       ├── groq/                # Groq LLM integration (Vision & Text Advisor)
│   │   │       │   ├── document_corrector.py # Batch line post-correction
│   │   │       │   ├── line_analyzer.py # Vision-assisted line analysis
│   │   │       │   ├── prompts.py       # Versioned system & user prompts
│   │   │       │   └── key_pool.py      # Multi-key rotation & cooldown pool
│   │   │       └── gemini/              # Google Gemini LLM integration (2nd Advisor)
│   │   │           ├── document_corrector.py # Secondary consensus corrector
│   │   │           └── key_pool.py      # Gemini API key pool & rotation
│   │   └── models/
│   │       └── ocr/
│   │           └── crnn_vi_handwriting_v1/ # Model weights & manifest directory
│   │               ├── best_cer.pth     # PyTorch checkpoint (SHA256: a807eaa...)
│   │               ├── vocab.json       # 320-character CTC vocabulary
│   │               └── model_manifest.json # Complete metadata, CER, step record
│   │
│   ├── handoff/                         # [AI PACKAGING] Model Handoff Staging
│   │   └── staging/ocr_engine_handoff_final/ocr_engine/
│   │       ├── model.py                 # Pure PyTorch CRNN architecture
│   │       ├── predict.py               # Standalone inference & micro-batching
│   │       ├── test_predict.py          # Unit test verification suite
│   │       └── MODEL_CARD.md            # Academic model card
│   │
│   ├── datasets/                        # [DATASET] Dataset Metadata & Splits
│   │   ├── manifests/                   # Dataset version manifests
│   │   ├── splits/                      # Train / Validation / Test disjoint splits
│   │   └── README.md                    # Data workspace specifications
│   │
│   └── training/                        # [TRAINING] Model Training Workspace
│       ├── configs/
│       │   └── crnn_vi_handwriting_v2_training_config.yaml # Production training YAML
│       └── README.md                    # DVC and MLflow tracking guidelines
│
└── reports/current/                     # [REPORTS] Validation & Research Reports
    ├── HAND_AI_MODEL_CARD.md
    ├── HAND_AI_DATASET_CARD.md
    ├── HAND_AI_BENCHMARK_REPORT.md
    ├── HAND_AI_ERROR_ANALYSIS_REPORT.md
    └── HAND_AI_DATASET_EXPERIMENT_TRACKING_REPORT.md
```

---

## 2. Frontend Component Mapping (`apps/student-mobile`)

| File Path | Role | Key Functions / Responsibilities |
|---|---|---|
| `src/config/appMode.ts` | App Mode Governance | Switches runtime mode between `MATHVISION_KIDS` and `HAND_AI`. Defines feature flags (`bypassLogin`, `bypassPrivacyMasking`, `showMathCalculations: false`). |
| `src/services/analytics/handAiAnalyticsStore.ts` | Analytics & Evaluation Engine | Implements Levenshtein CER, Word Levenshtein WER, 8-class Error Taxonomy, 4-class Root Cause analysis, ablation calculations, and JSON/CSV research export. |
| `src/services/api/OcrPilotService.ts` | Frontend API Gateway | Handles multipart image upload, calls `/api/v1/ocr/trials`, `/detect-lines`, `/recognize-line`, and `/advise-lines`. Implements trial caching. |
| `src/app/camera.tsx` | Mobile Capture Screen | Fullscreen native camera interface with flash control, guideline box, and high-resolution photo acquisition. |
| `src/app/gallery.tsx` | Media Picker Screen | Native image selection from device photo album with MIME verification and URI sanitization. |
| `src/app/crop.tsx` | Image Cropper | Interactive coordinate crop tool to isolate the handwriting worksheet region from background desk clutter. |
| `src/app/ocr-pilot/line-crop.tsx` | Text-Line Visualizer | Interactive canvas displaying detected line bounding boxes (`LineBox[]`) overlaid on the cropped page. |
| `src/app/ocr-pilot/multiline-review.tsx` | Line Review & Arbitration | User interface displaying raw CRNN OCR output, AI suggestions, and manual editing field for each line. |
| `src/app/ocr-pilot/multiline-result.tsx` | Result Summary | Final summary screen showing transcribed lines, decision sources (`CRNN_RAW`, `AI_CORRECTION`, `MANUAL_EDIT`), and navigation to analytics. |
| `src/app/handai-trial-analytics.tsx` | Active Trial Dashboard | Evaluates the single current document session: Line Accuracy, CER, WER, AI Improvement funnel, and line-by-line error tags. |
| `src/app/handai-analytics.tsx` | Global Analytics Dashboard | Cross-session research dashboard: Overall Accuracy, CER, WER, Error Distribution chart, Top Confusion Pairs, and 7-column Model Experiment Tracking Table. |

---

## 3. Backend Component Mapping (`backend/business-api`)

| File Path | Role | Key Functions / Responsibilities |
|---|---|---|
| `OcrTrialController.java` | REST Endpoint Controller | Exposes `/api/v1/ocr/trials` (POST create, GET by ID, POST feedback, GET metrics). Handles multipart file uploads. |
| `OcrPilotService.java` | Business Logic Service | Validates image bytes, computes SHA-256 hash, uploads to MinIO bucket `ocr-trials`, makes synchronous internal HTTP call with `X-Internal-API-Key` to FastAPI `/internal/v1/ocr/recognize-line`, and persists entity. |
| `OcrTrial.java` | JPA Persistence Entity | Maps to table `ocr_trials`. Tracks `trial_id`, `line_image_object_key`, `line_image_sha256`, `predicted_text`, `verified_text_raw`, `verdict`, `model_name`, `checkpoint_sha256`, `confidence`, `is_test_data`. |
| `OcrTrialRepository.java` | Data Access Object | Spring Data JPA repository providing query methods: `findByVerdict()`, `countByTrainingEligibleTrue()`, `findHistoricalMetrics()`. |
| `V6__add_ocr_trial_and_feedback.sql` | Database Migration | Creates initial `ocr_trials` table with indexes on `user_id`, `verdict`, `training_eligible`, and `created_at`. |
| `V7__add_ocr_trial_integrity_and_provenance.sql` | Database Migration | Adds `is_test_data`, `domain`, `data_origin`, `verified_text_normalized`, and `confidence` columns. Quarantines prior test rows. |
| `V8__privacy_fail_closed_and_tester_audit.sql` | Database Migration | Enforces fail-closed privacy: changes `privacy_confirmed` column default to `FALSE` and audits historical test rows. |

---

## 4. AI Microservice Component Mapping (`ai/runtime`)

| File Path | Role | Key Functions / Responsibilities |
|---|---|---|
| `app/main.py` | FastAPI Application Core | Initializes FastAPI app, registers API routers (`/internal/v1/ocr`), checks Groq model availability on startup, exposes `/health` and `/ready`. |
| `app/config.py` | Configuration Manager | Pydantic v2 Settings class loading environment variables for ports, Redis, MinIO, internal API keys, Groq API keys, and Gemini API keys. |
| `app/api/ocr.py` | OCR API Endpoints | Hosts `/detect-lines` (OpenCV deskew and morphological segmentation), `/recognize-line` (CRNN inference), and `/advise-lines` (Groq/Gemini correction). |
| `app/ocr/crnn_provider.py` | PyTorch Provider Adapter | Thread-safe singleton that loads `best_cer.pth` and `vocab.json`, performs image preprocessing (64x1024, ImageNet norm), executes forward pass, and performs greedy CTC / beam search decoding. |
| `app/ocr/model.py` | PyTorch Neural Network | Defines the CRNN model architecture: 4-block Conv2D + GroupNorm(8, C) + BiLSTM(128) + Linear(320). |
| `app/integrations/groq/document_corrector.py` | Groq LLM Advisor | Calls Groq Vision/Text models with document context to propose spelling and diacritic corrections on raw CRNN lines. |
| `app/integrations/gemini/document_corrector.py` | Gemini LLM Advisor | Calls Google Gemini Flash models to independently review lines and provide consensus verification. |
| `app/integrations/groq/prompts.py` | Prompt Engineering | Versioned prompt templates enforcing strict rules: transcribe visible text only, correct diacritics, never calculate math answers. |
| `models/ocr/crnn_vi_handwriting_v1/model_manifest.json` | Checkpoint Manifest | Authoritative record of model weights: parameter count (5,962,560), validation CER (0.1134), training step (16,900), and input contract. |

---

## 5. Shared Infrastructure vs. HandAI-Exclusive Components

| Component / Subsystem | Categorization | Detailed Explanation |
|---|---|---|
| `apps/student-mobile` Shell | **Shared Infrastructure** | The underlying React Native framework, Expo build scripts, theme tokens, and navigation router are shared with MathVision Kids. |
| `handAiAnalyticsStore.ts` | **HandAI Exclusive** | Exclusively handles Vietnamese handwriting metrics, CER/WER, error taxonomy, and experiment tracking. |
| `handai-trial-analytics.tsx` | **HandAI Exclusive** | Dedicated screen for handwriting recognition trial evaluation. |
| `handai-analytics.tsx` | **HandAI Exclusive** | Dedicated screen for global handwriting analytics and model experiment comparisons. |
| Spring Boot Backend Core | **Shared Infrastructure** | User authentication, JWT tokens, MinIO S3 integration, and PostgreSQL connection pool serve both systems. |
| `ocr_trials` Table & Controller | **HandAI Exclusive** | Specifically tracks handwriting OCR trials, model versions, image hashes, and ground truth feedback. |
| FastAPI Microservice Core | **Shared Infrastructure** | Server framework, Celery/Redis background worker queue, and health check endpoints are shared. |
| `crnn_provider.py` & Checkpoint | **HandAI Exclusive** | The Vietnamese handwriting CRNN+CTC model (`best_cer.pth`) is used exclusively for handwriting text recognition. |
| YOLO Arithmetic Detector | **Out of Scope (MathVision)** | YOLO object detector for math worksheets is completely bypassed in HandAI mode. |
| Arithmetic Parser & Rule Engine | **Out of Scope (MathVision)** | Mathematical grading logic is completely excluded from HandAI. |
