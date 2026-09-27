# HandAI — Complete Technical Summary & Microservice Separation Plan

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative Synthesis & Extraction Blueprint  
> **Audience:** Lead Architects, Defense Committee Members, Engineering Leadership  

---

## 1. Executive Summary

**HandAI** is an advanced, specialized Optical Character Recognition (OCR), Artificial Intelligence, and Big Data evaluation system engineered specifically for **Vietnamese primary school handwriting (Grades 1 through 5)**. 

### Core Value Proposition
Vietnamese elementary handwriting features intricate diacritical hierarchies (5 tone marks, multiple vowel/consonant modifiers), cursive ligatures, and quadrille notebook ruling lines (*vở ô ly*) that cause generic commercial OCR systems to fail. HandAI solves this domain challenge by deploying a multi-layered hybrid architecture:
1. **Classical Computer Vision** (OpenCV): Provides deskewing (up to $\pm 10^\circ$), morphological illumination correction, ruling line suppression, and two-level satellite-preserving text-line segmentation.
2. **Deep Sequence Modeling** (PyTorch): Transcribes lines via a 5.96M parameter CRNN architecture (4-block Conv2D + GroupNorm + BiLSTM + CTC decoding) achieving **94.0% Line Accuracy** on benchmark testing.
3. **Multi-Agent Contextual Post-Correction** (Groq & Gemini): Resolves lookalike cursive confusions and subtle diacritical drops using dual-consensus linguistic arbitration, boosting system accuracy to **96.4%**.
4. **Research-Grade Big Data Analytics**: Computes mathematically verified Character Error Rate (**CER: 5.0%**), Word Error Rate (**WER: 8.0%**), 8-class Error Taxonomy attribution, and bidirectional ML experiment provenance.

---

## 2. Technical Synthesis

```
┌────────────────────────────────────────────────────────────────────────┐
│                        HandAI Technical Synthesis                      │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Mobile Acquisition: React Native / Expo 57                          │
│    • Hardware camera capture, gallery selection, interactive crop UI   │
│    • Native XMLHttpRequest binary transport (bypasses Winter fetch bug)│
├────────────────────────────────────────────────────────────────────────┤
│ 2. Backend Gateway: Java 21 / Spring Boot 3.3.4                        │
│    • MinIO S3 object storage for raw images and line crops             │
│    • PostgreSQL 15+ persistence with Flyway migrations (V6, V7, V8)    │
│    • Fail-closed privacy governance (quarantines test data)            │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Image Preprocessing & Line Segmentation: Python 3.13 / OpenCV       │
│    • Morphological illumination division (kernel 35x35)                │
│    • Otsu inverted thresholding and horizontal ruling line removal     │
│    • Two-level body & satellite clustering (preserves floating accents)│
├────────────────────────────────────────────────────────────────────────┤
│ 4. Neural Network Recognition: PyTorch 2.6.0+cu124 / 2.3.0             │
│    • CRNN: 4-block Conv2D + GroupNorm(8, C) + BiLSTM(128) + Linear(320)│
│    • Checkpoint best_cer.pth (SHA256: a807eaa..., 5,962,560 params)    │
│    • Greedy CTC and Beam Search (width=15, top-k=5) decoding           │
├────────────────────────────────────────────────────────────────────────┤
│ 5. AI Post-Correction: Groq (Qwen/LLaMA) + Google Gemini Flash         │
│    • Dual-consensus arbitration (accepts suggestions when models agree)│
│    • Deterministic evidence rules (deduplicates trailing strokes)      │
│    • Max edit ratio <= 35% guardrail against hallucinations            │
├────────────────────────────────────────────────────────────────────────┤
│ 6. Analytics & Provenance: handAiAnalyticsStore.ts                     │
│    • Levenshtein CER (5.0%) and Word Levenshtein WER (8.0%)            │
│    • 8-Class Error Taxonomy (Tone 35%, Similar 25%, Missing 20%)       │
│    • 5-Stage Provenance Chain: Dataset -> Model -> Run -> Trial -> Data│
│    • Research JSON & CSV data export                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Production Benchmark Summary

| Evaluation Dimension | System A (CRNN Only) | System B (CRNN + AI) | System C (CRNN + AI + Human) |
|---|:---:|:---:|:---:|
| **Line Accuracy (%)** | 94.0% | 96.4% | 98.8% |
| **Character Error Rate (CER)** | 5.0% | 2.1% | 0.8% |
| **Word Error Rate (WER)** | 8.0% | 4.5% | 1.5% |
| **Character Accuracy (%)** | 95.0% | 97.9% | 99.2% |
| **Word Accuracy (%)** | 92.0% | 95.5% | 98.5% |
| **Average Document Latency** | $\sim 1.2\text{s}$ | $\sim 2.5\text{s}$ | User Dependent |
| **Primary Error Mode** | Tone accents (35%) | Complex cursive (40%)| Out-of-vocabulary terms |

---

## 4. Standalone Microservice Separation Plan

Currently, HandAI is hosted inside the `MathVisionKid` monorepo. To extract HandAI into an **independent, self-contained microservice repository** (`github.com/MathVisionKid/HandAI-Core`), follow this 6-step blueprint:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Separation Architecture                         │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
┌──────────────────────────────────┐        ┌──────────────────────────────────┐
│        HandAI Standalone         │        │         MathVision Kids          │
│        (New Repository)          │        │        (Host Repository)         │
├──────────────────────────────────┤        ├──────────────────────────────────┤
│ • HandAI Mobile App (Scanner UI) │        │ • Core Math Learning Platform    │
│ • HandAI FastAPI Service (8000)  │        │ • YOLO Layout Math Detection     │
│ • HandAI Lightweight DB (Postgres│        │ • Arithmetic Parser & Rule Engine│
│ • HandAI S3 Storage (MinIO)      │        │ • Teacher Portal & Grading Web   │
│ • CRNN PyTorch Weights & Models  │        │ • Student Practice Mobile App    │
│ • Full Analytics & Error Engine  │        │ • Retains HandAI as Remote Client│
└──────────────────────────────────┘        └──────────────────────────────────┘
```

### Phase 1: AI Runtime Extraction
1. **Target Directory:** Create standalone repo root `/handai-ai-service`.
2. **Files to Migrate:**
   - `ai/runtime/app/api/ocr.py` $\rightarrow$ `/app/api/ocr.py`
   - `ai/runtime/app/ocr/` (entire directory: `crnn_provider.py`, `model.py`, `factory.py`, `provider.py`)
   - `ai/runtime/app/integrations/groq/` and `gemini/`
   - `ai/runtime/app/schemas/ocr_pilot.py`
   - `ai/runtime/models/ocr/crnn_vi_handwriting_v1/` (`best_cer.pth`, `vocab.json`, `model_manifest.json`)
3. **Decoupling Action:** Remove references to YOLO detector and arithmetic parsers in `main.py`. Retain only `/detect-lines`, `/recognize-line`, and `/advise-lines`.

### Phase 2: Backend Persistence & Storage Extraction
1. **Target Directory:** Create lightweight Spring Boot or FastAPI backend gateway `/handai-backend`.
2. **Files to Migrate:**
   - `OcrTrialController.java`, `OcrPilotService.java`, `OcrTrial.java`, `OcrTrialRepository.java`.
   - Flyway database migrations `V6`, `V7`, `V8`.
3. **Decoupling Action:**
   - Remove user authentication dependencies on `users` table; replace with standalone API key or OAuth2 client credentials.
   - Configure independent PostgreSQL schema (`handai_db`) and MinIO bucket (`handai-storage`).

### Phase 3: Mobile Client Packaging
1. **Target Directory:** Package standalone mobile scanner app `/handai-mobile`.
2. **Files to Migrate:**
   - Screens: `camera.tsx`, `gallery.tsx`, `crop.tsx`, `handai-trial-analytics.tsx`, `handai-analytics.tsx`, `ocr-pilot/line-crop.tsx`, `multiline-review.tsx`, `multiline-result.tsx`.
   - Core Store: `services/analytics/handAiAnalyticsStore.ts`.
   - API Services: `services/api/OcrPilotService.ts`, `services/image/imagePipeline.ts`.
3. **Decoupling Action:**
   - In `appMode.ts`, set `EXPO_PUBLIC_APP_MODE=HAND_AI` as permanent default.
   - Strip tabs for Math exercises and teacher workflows from `(tabs)/_layout.tsx`.

### Phase 4: Containerization & Deployment Orchestration
Create a standalone `docker-compose.yml` for HandAI:

```yaml
version: '3.8'
services:
  handai-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: handai_db
      POSTGRES_USER: handai
      POSTGRES_PASSWORD: handai_secret_password
    ports:
      - "5432:5432"
    volumes:
      - handai_pgdata:/var/lib/postgresql/data

  handai-storage:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: handaiadmin
      MINIO_ROOT_PASSWORD: handaiadmin123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - handai_miniodata:/data

  handai-ai-service:
    build: ./handai-ai-service
    ports:
      - "8000:8000"
    environment:
      - INTERNAL_API_KEY=handai-secure-token
      - OCR_PROVIDER=crnn_vi_handwriting_v1
      - GROQ_ENABLED=true
      - GROQ_API_KEYS=${GROQ_API_KEYS}
      - GEMINI_ENABLED=true
      - GEMINI_API_KEYS=${GEMINI_API_KEYS}
    depends_on:
      - handai-storage

volumes:
  handai_pgdata:
  handai_miniodata:
```

### Phase 5: Verification & Zero-Downtime Cutover
1. Run test suite: Verify that all 16 test suites and 157 unit tests in `student-mobile` pass against the isolated endpoint.
2. In the parent MathVisionKid app, configure `services/api/OcrPilotService.ts` to call the new standalone HandAI microservice URL via standard REST contract.

---

## 5. Master Index of HandAI Technical Documentation

The 13 technical documentation files created in this package provide complete, verified coverage of the HandAI system:

1. [HAND_AI_PROJECT_OVERVIEW.md](file:///e:/MathVisionKid/HAND_AI_PROJECT_OVERVIEW.md) — System purpose, challenges, scope, features, and MathVision relationship.
2. [HAND_AI_REPOSITORY_MAP.md](file:///e:/MathVisionKid/HAND_AI_REPOSITORY_MAP.md) — Exact codebase directory map, file roles, and component ownership.
3. [HAND_AI_SYSTEM_ARCHITECTURE.md](file:///e:/MathVisionKid/HAND_AI_SYSTEM_ARCHITECTURE.md) — End-to-end 8-layer architecture from Mobile to Research Export.
4. [HAND_AI_AI_PIPELINE.md](file:///e:/MathVisionKid/HAND_AI_AI_PIPELINE.md) — 7-stage AI pipeline specification with I/O contracts and technologies.
5. [HAND_AI_MODEL_DOCUMENTATION.md](file:///e:/MathVisionKid/HAND_AI_MODEL_DOCUMENTATION.md) — Deep neural CRNN architecture, PyTorch source, parameters, CTC decoding.
6. [HAND_AI_DATASET_DOCUMENTATION.md](file:///e:/MathVisionKid/HAND_AI_DATASET_DOCUMENTATION.md) — Dataset versions (59,747 samples), splits, annotation, and privacy policy.
7. [HAND_AI_ANALYTICS_BIGDATA.md](file:///e:/MathVisionKid/HAND_AI_ANALYTICS_BIGDATA.md) — Trial/Global analytics, CER/WER formulations, and ablation benchmarks.
8. [HAND_AI_ERROR_ANALYSIS.md](file:///e:/MathVisionKid/HAND_AI_ERROR_ANALYSIS.md) — 8-class error taxonomy, Unicode NFD tone detection, and root-cause classifier.
9. [HAND_AI_EXPERIMENT_TRACKING.md](file:///e:/MathVisionKid/HAND_AI_EXPERIMENT_TRACKING.md) — Bidirectional ML provenance chain, 7-column table, and export schemas.
10. [HAND_AI_TECH_STACK.md](file:///e:/MathVisionKid/HAND_AI_TECH_STACK.md) — Comprehensive technology matrix across frontend, backend, AI, and storage.
11. [HAND_AI_RUNNING_GUIDE.md](file:///e:/MathVisionKid/HAND_AI_RUNNING_GUIDE.md) — Installation, environment variables, launch commands, and troubleshooting.
12. [HAND_AI_LIMITATIONS_FUTURE.md](file:///e:/MathVisionKid/HAND_AI_LIMITATIONS_FUTURE.md) — Current technical limitations and the future engineering roadmap.
13. [HAND_AI_COMPLETE_TECHNICAL_SUMMARY.md](file:///e:/MathVisionKid/HAND_AI_COMPLETE_TECHNICAL_SUMMARY.md) — Master technical summary and microservice separation plan.
