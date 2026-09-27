# HandAI — System Architecture

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative System Architecture Specification  
> **Scope:** End-to-End Architectural Pipeline from Mobile Capture to Research Export  

---

## 1. High-Level Architectural Flow

HandAI follows a strictly modular, sequential pipeline designed to ensure that raw model capabilities, AI post-correction enhancements, and human interactions are independently observable, measurable, and auditable.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. Mobile Application                           │
│     (Expo 57 / React Native — Camera Capture, Gallery, Crop UI)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTP Multipart Stream / API
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. Backend Gateway                              │
│    (Spring Boot 3.3.4 — MinIO Object Storage, PostgreSQL Audit)        │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Internal HTTP / Binary Image Stream
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     3. Image Processing Layer                          │
│     (FastAPI / OpenCV — Deskew, Illumination Normalization, Otsu)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Binarized Ink Mask / Image Slices
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   4. Text-Line OCR Segmentation                        │
│   (Two-Level Body & Satellite Projection Clustering, Line Bounding)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Cropped Line Tensors [3, 64, 1024]
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    5. CRNN Recognition Engine                          │
│ (PyTorch 2.6 / 2.3 — 4-Block Conv2D + GroupNorm + BiLSTM + CTC Decoder)│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Raw Emitted Tokens & Sequence Conf
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    6. AI Correction Arbitration                        │
│      (Groq Qwen/LLaMA + Gemini Flash Dual Consensus Layer)             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Disambiguated Candidates & Origins
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   7. Evaluation Analytics Layer                        │
│      (Trial Analytics, Global Aggregation, CER/WER, Error Taxonomy)    │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Metric Provenance & Ground Truth Diffs
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     8. Research Export Layer                           │
│        (Academic JSON / CSV Export with Full Provenance Lineage)       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer-by-Layer Architectural Decomposition

### 2.1 Layer 1: Mobile Client Application (`apps/student-mobile`)
- **Technology:** React Native 0.76+ with Expo SDK 57, TypeScript, Expo Router.
- **Role:** Handles physical document capture and research user interaction.
- **Workflow:**
  1. The user captures a handwritten notebook page via `camera.tsx` (using native camera hardware with autofocus) or selects an existing photo from the photo library via `gallery.tsx`.
  2. The image is passed to `crop.tsx`, where native touch coordinates allow the user to isolate the student's handwritten text area and exclude non-document background artifacts.
  3. The cropped image URI is dispatched to the backend via `OcrPilotService.ts`.
  4. The client implements specialized networking guards (`postMultipart`) to handle Expo Winter fetch binary limitations by using native XMLHttpRequest transport directly to React Native's OkHttp layer.

### 2.2 Layer 2: Backend Gateway & Storage (`backend/business-api`)
- **Technology:** Java 21, Spring Boot 3.3.4, Spring Data JPA, MinIO S3 SDK, PostgreSQL 15+.
- **Role:** Manages secure ingestion, immutable file persistence, and audit logging.
- **Workflow:**
  1. `OcrTrialController` receives the multipart image payload at `POST /api/v1/ocr/trials`.
  2. `OcrPilotService` computes the cryptographic SHA-256 hash of the binary stream.
  3. The raw image is persisted immutably in **MinIO Object Storage** under the `ocr-trials` bucket.
  4. An audit entity (`OcrTrial`) is created in the **PostgreSQL** `ocr_trials` table with initial status `UNVERIFIED` and provenance flags (`is_test_data = false`, `domain = 'HANDWRITING_TEXT'`).
  5. The backend relays the binary stream to the internal AI microservice at `http://ai-service:8000/internal/v1/ocr/...` accompanied by the `X-Internal-API-Key` security header.

### 2.3 Layer 3: Image Processing Layer (`ai/runtime/app/api/ocr.py`)
- **Technology:** Python 3.13, OpenCV (`cv2`), NumPy, Pillow.
- **Role:** Converts raw mobile photographs into standardized, noise-reduced visual representations.
- **Mathematical Steps:**
  1. **EXIF Transposition:** Reads image orientation metadata to ensure correct vertical orientation.
  2. **Deskewing (`correct_skew`):** Detects dominant text baseline slant up to ±10° via contour bounding angle medians and applies affine rotation warping:
     $$M = \text{getRotationMatrix2D}(\text{center}, \theta_{\text{median}}, 1.0)$$
  3. **Illumination Normalization:** Corrects uneven shadow and smartphone lighting gradients using morphological background division:
     $$I_{\text{bg}} = \text{morphologyEx}(I_{\text{gray}}, \text{MORPH\_DILATE}, \text{kernel}_{35 \times 35})$$
     $$I_{\text{norm}} = \frac{I_{\text{gray}}}{I_{\text{bg}}} \times 255$$
  4. **Binarization:** Applies Gaussian smoothing followed by Otsu inverse thresholding:
     $$\tau = \text{Otsu}(I_{\text{norm}}), \quad B(x, y) = \begin{cases} 255 & \text{if } I_{\text{norm}}(x, y) < \tau \\ 0 & \text{otherwise} \end{cases}$$
  5. **Horizontal Ruling Suppression:** Applies morphological opening with a wide horizontal structuring element ($W_{\text{kernel}} = \max(50, 0.20 \times \text{width}), H=1$) to subtract continuous notebook grid lines without removing character strokes.

### 2.4 Layer 4: Text-Line OCR Segmentation (`ai/runtime/app/api/ocr.py`)
- **Technology:** Two-Level Projection Profiling & Hysteresis Consolidation.
- **Role:** Identifies individual physical text rows without over-segmenting floating Vietnamese tone marks.
- **Mechanisms:**
  1. **Horizontal Projection Profile:** Computes row-wise ink mass across the binarized mask.
  2. **Primary Body Detection:** Identifies strong text bands satisfying primary line criteria ($W \ge 2.8 \times \text{median\_h}$ and $\text{ink} \ge 4.5 \times \text{median\_h}$).
  3. **Recursive Giant Box Splitting:** Slices accidentally merged multi-line boxes at horizontal projection valleys.
  4. **Satellite Attachment:** Vietnamese diacritics (accents, dots over `i`, circumflexes) are classified as satellites and attached to their closest vertical primary line within $3.5 \times \text{median\_h}$.
  5. **Isolated Noise Suppression:** Satellites unable to attach to any primary line are dropped as non-text specks.

### 2.5 Layer 5: CRNN Recognition Engine (`ai/runtime/app/ocr/crnn_provider.py`)
- **Technology:** PyTorch 2.6.0+cu124 / 2.3, Torchvision.
- **Role:** Deep sequence transcription of cropped line images into UTF-8 text strings.
- **Architecture Pipeline:**
  1. **Preprocessing:** Resizes each line crop to fixed dimensions $H=64, W=1024$ and standardizes using ImageNet parameters ($\mu = [0.485, 0.456, 0.406], \sigma = [0.229, 0.224, 0.225]$).
  2. **CNN Feature Extraction:** 4 blocks of Conv2D ($3 \times 3$, padding 1) + GroupNorm(8, C) + ReLU + MaxPool2D(2, 2) yielding feature map $[B, 512, 8, 128]$.
  3. **Reshape & Permute:** Permutes to $[B, 128, 4096]$ representing 128 sequential time frames along the horizontal axis.
  4. **Recurrent Modeling:** Bidirectional LSTM with 128 hidden units per direction ($256$ total output features per timestep).
  5. **Linear Projection:** Projects recurrent features into 320 logits matching the character vocabulary.
  6. **CTC Decoding:** Greedy decoding or CTC beam search collapses consecutive duplicate characters and drops blank token (index 0).
  7. **Uncertainty Metrics:** Computes mean token confidence, min token confidence, blank ratio, and Shannon entropy:
     $$H = - \sum_{c=1}^{320} P(c) \ln P(c)$$

### 2.6 Layer 6: AI Post-Correction Arbitration (`ai/runtime/app/integrations/`)
- **Technology:** Groq Cloud API (Qwen-3.8-27b / LLaMA), Google Gemini API (Gemini 3.6 Flash).
- **Role:** Resolves visual stroke ambiguities using contextual language modeling while preventing hallucinations.
- **Arbitration Logic:**
  - **Rule 1 (OCR Acceptance):** If CRNN confidence $\ge 92\%$ and raw output matches valid Vietnamese lexicon, raw OCR is accepted (`CRNN_RAW`).
  - **Rule 2 (Dual Consensus):** If Groq and Gemini independently propose identical non-raw text ($S_{\text{Groq}} = S_{\text{Gemini}} \neq S_{\text{CRNN}}$), the suggestion is auto-applied (`AI_CORRECTION`).
  - **Rule 3 (Changed-Span Evidence):** If only one advisor suggests a change, it is accepted only if it satisfies deterministic character evidence (e.g. trailing duplicate removal: `tímm` $\rightarrow$ `tím`) and edit distance ratio $\le 35\%$.
  - **Rule 4 (Human Arbitration):** In ambiguous cases, candidates are displayed on the mobile review screen (`multiline-review.tsx`) for user confirmation.

### 2.7 Layer 7: Evaluation Analytics Layer (`apps/student-mobile/src/services/analytics/`)
- **Technology:** TypeScript Evaluation Store (`handAiAnalyticsStore.ts`).
- **Role:** Real-time computation of academic benchmarking metrics against verified Ground Truths.
- **Metrics Tracked:**
  - **Character Error Rate (CER):** Dynamic programming Levenshtein edit distance at character level:
    $$\text{CER} = \frac{S + D + I}{N_{\text{ref}}} \times 100\%$$
  - **Word Error Rate (WER):** Word-level tokenized Levenshtein distance:
    $$\text{WER} = \frac{\text{WordEdits}(P, R)}{\text{TotalWords}(R)} \times 100\%$$
  - **Line Accuracy:** Percentage of text lines achieving 100% exact match against ground truth.
  - **Ablation Funnel:** Direct performance delta measurement:
    $$\Delta_{\text{AI}} = \text{Accuracy}_{\text{System B}} - \text{Accuracy}_{\text{System A}}$$
  - **8-Class Error Taxonomy:** Line-by-line categorization into specific error categories.

### 2.8 Layer 8: Research Export Layer
- **Technology:** Client-side CSV and JSON serializer.
- **Role:** Generates immutable research artifacts for external data analysis, Python research notebooks, and Capstone reports.
- **Export Guarantees:**
  - Every exported record contains complete provenance: `sessionId`, `datasetVersion`, `modelVersion`, `experimentId`, `trainingDate`, line bounding box coordinates, model raw text, AI suggestion, human verified text, CER, WER, and error taxonomy classification.

---

## 3. Communication Protocols & Security Boundaries

```
[Mobile Device] 
      │
      │ HTTPS / Multipart Form-Data (Port 8080)
      ▼
[Spring Boot Backend] 
      │
      ├── S3 Binary API (Port 9000) ──────────► [MinIO Object Storage]
      │
      ├── JDBC / TCP (Port 5432) ─────────────► [PostgreSQL Database]
      │
      │ HTTP / Raw Binary Stream (Port 8000)
      │ Header: X-Internal-API-Key: <SECRET>
      ▼
[FastAPI AI Runtime]
      │
      ├── PyTorch C++/CUDA Direct Inference ──► [CRNN Model Checkpoint]
      │
      ├── HTTPS / JSON API (Outbound TLS) ────► [Groq API Cloud]
      │
      └── HTTPS / JSON API (Outbound TLS) ────► [Google Gemini API Cloud]
```

- **Authentication:** Spring Boot acts as the sole security authority. Internal calls to FastAPI require the static internal token header `X-Internal-API-Key`.
- **Fail-Closed Privacy:** Training eligibility flag (`training_eligible`) defaults to `FALSE` in PostgreSQL. Test data generated in development is permanently quarantined (`is_test_data = TRUE`) to prevent synthetic contamination of the production training corpus.
