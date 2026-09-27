# HandAI — Project Overview

> **Module Name:** HandAI  
> **System Title:** Vietnamese Primary School Handwriting Recognition System (*Hệ thống Nhận diện Chữ viết tay Học sinh Tiểu học Việt Nam*)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative Technical Documentation  
> **Target Audience:** System Architects, Machine Learning Engineers, Academic Defense Committees, Capstone Evaluators  

---

## 1. System Purpose

**HandAI** is a specialized, research-grade Artificial Intelligence and Big Data module engineered specifically to transcribe, evaluate, and benchmark **Vietnamese handwriting produced by primary school students (Grades 1 through 5)**. 

While generic Optical Character Recognition (OCR) engines excel at Latin print and standardized Western cursive, Vietnamese primary school handwriting presents compounding difficulties that cause standard commercial OCR systems to fail. HandAI addresses this challenge through a hybrid pipeline combining:
1. **Classical Computer Vision** for document deskewing, background illumination correction, and text-line segmentation.
2. **Deep Learning Sequence Recognition** utilizing a PyTorch Convolutional Recurrent Neural Network with Connectionist Temporal Classification loss (**CRNN+CTC**).
3. **Multi-Agent Large Language Model (LLM) Post-Correction** utilizing dual consensus arbitration (Groq and Google Gemini) to resolve visual ambiguities using Vietnamese grammatical and semantic context.
4. **Big Data Analytics & ML Experiment Tracking** providing mathematically verified Character Error Rate (**CER**), Word Error Rate (**WER**), 8-class Error Taxonomy classification, and bidirectional dataset-to-checkpoint lineage.

---

## 2. Problem Statement & Domain Challenges

Vietnamese primary handwriting poses unique technical hurdles rarely encountered in standard Latin or printed OCR tasks:

### 2.1 Complex Diacritical Hierarchy
Vietnamese utilizes **5 tone marks** (*sắc* /acute, *huyền* /grave, *hỏi* /hook, *ngã* /tilde, *nặng* /dot below) and **vowel/consonant modifiers** (*circumflex* on `â, ê, ô`, *breve* on `ă`, *horn* on `ơ, ư`, and crossbar on `đ`). 
- Primary school children frequently place accents with variable vertical drift, slant, or faint pencil pressure.
- Accents often detach from base letters, appearing to generic line segmenters as independent lines, or merging vertically into the line above.

### 2.2 Pedagogical Cursive Constraints (*Chữ Viết Chuẩn Tiểu Học*)
In Vietnamese elementary education (Grades 1–2 transitioning to Grades 3–5), students are taught standardized calligraphy rules (*mẫu chữ viết tay theo Quyết định 3148/QĐ-BGDĐT*):
- Letters feature continuous connecting strokes (*nét nối*), loop flourishes (*nét khuyết*), and variable ligature widths.
- Early learners exhibit inconsistent stroke pressure, irregular character spacing, and variable baseline slant.

### 2.3 Paper Artifacts & Ruled Grids (*Vở Ô Ly*)
Vietnamese elementary school exercise books ubiquitously feature **quadrille grid lines** (*vở 4 ô ly* or *5 ô ly*). 
- Horizontal and vertical grid lines intersect character strokes at thousands of points per page.
- Naive binarization fragments characters into disconnected strokes or merges rulings with horizontal letter crossbars (`đ`, `t`) and minus/equality signs.

---

## 3. System Scope

### 3.1 In-Scope Capabilities
- **End-to-End Image Ingestion:** Camera acquisition and gallery image selection on mobile devices (React Native / Expo 57).
- **Document Preprocessing:** Bilinear deskewing (up to ±10°), morphological background division for uneven lighting, and ruling line suppression.
- **Text-Line Segmentation:** Two-level projection profile clustering that anchors primary text lines while reliably attaching detached diacritics and descenders.
- **Offline CRNN Inference:** Deep sequence transcription using PyTorch 2.6 / 2.3 CRNN-v1.2 running on fixed `[3, 64, 1024]` line crops.
- **Contextual AI Post-Correction:** Dual-provider arbitration (Groq Qwen/LLaMA and Gemini Flash) with strict visual grounding and non-hallucination guardrails.
- **Ground Truth Evaluation Engine:** Exact line-by-line Levenshtein distance metric computation (CER, WER, Line Accuracy) comparing raw OCR, AI suggestion, and human arbitration against ground truth.
- **Big Data Analytics:** Document-level Trial Analytics and global session-aggregated historical analytics.
- **Error Taxonomy & Root Cause Analysis:** Automatic classification of errors into 8 distinct categories (Vietnamese Tone Error, Similar Character Confusion, Missing Character, Extra Character, Low Quality Image, Segmentation Failure, Word Substitution, No Error).
- **Experiment Provenance:** Tracking Dataset Version (`HandAI-v1.2`), Model Version (`CRNN-v1.2-PyTorch`), Checkpoint Hash, and Experiment Run ID (`exp_crnn_v1_2`).
- **Research Data Export:** Clean JSON and CSV research export mechanisms.

### 3.2 Out-of-Scope Capabilities (Strictly Excluded)
To preserve academic isolation, HandAI explicitly excludes:
- Mathematical problem solving and equation evaluation.
- Step-by-step arithmetic error localization.
- Automated teacher grade assignment and grading rubrics.
- Student learning management workflows and classroom gamification.
- Full-page end-to-end unsegmented OCR without line-level detection.

---

## 4. Key Functional Features

| Feature ID | Feature Name | Description | Implementation Path |
|---|---|---|---|
| **FEAT-01** | Mobile Scanner & Acquisition | Native camera and gallery photo capture with focus tips and document preview. | `apps/student-mobile/src/app/camera.tsx`, `gallery.tsx` |
| **FEAT-02** | Text Line Detection | OpenCV morphological filtering and two-level satellite consolidation for ruled paper. | `ai/runtime/app/api/ocr.py` (`/detect-lines`) |
| **FEAT-03** | CRNN Handwriting OCR | PyTorch 4-block Conv2D + GroupNorm + BiLSTM + CTC recognition on 64x1024 crops. | `ai/runtime/app/ocr/crnn_provider.py`, `ai/handoff/.../model.py` |
| **FEAT-04** | Dual AI Post-Correction | Multi-agent contextual correction using Groq and Gemini with consensus arbitration. | `ai/runtime/app/integrations/groq/`, `gemini/` |
| **FEAT-05** | Trial Analytics Dashboard | Document-level recognition quality evaluation against ground truth (CER, WER, Acc). | `apps/student-mobile/src/app/handai-trial-analytics.tsx` |
| **FEAT-06** | Global Analytics Dashboard | Cross-session Big Data aggregation, error distribution charts, and confusion pair stats. | `apps/student-mobile/src/app/handai-analytics.tsx` |
| **FEAT-07** | Error Analysis Module | Automated 8-class error taxonomy and 4-type root cause classifier. | `apps/student-mobile/src/services/analytics/handAiAnalyticsStore.ts` |
| **FEAT-08** | Experiment Tracking | Bidirectional tracking linking session trials to dataset splits and model checkpoints. | `apps/student-mobile/src/services/analytics/handAiAnalyticsStore.ts` |
| **FEAT-09** | Research Data Export | Export of trial metrics, line predictions, and error metadata to JSON and CSV. | `apps/student-mobile/src/services/analytics/handAiAnalyticsStore.ts` |

---

## 5. Relationship with MathVisionKid Repository

The HandAI module resides inside the `MathVisionKid` repository. Its architectural relationship with the host repository is organized as follows:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   MathVisionKid Monorepo Workspace                     │
├──────────────────────────────────┬─────────────────────────────────────┤
│   HandAI Research Subsystem      │   MathVision Kids Core Application  │
│   (SUBJECT OF THIS DOCUMENTATION)│   (OUT OF SCOPE / EXCLUDED)         │
├──────────────────────────────────┼─────────────────────────────────────┤
│ • Vietnamese Primary Handwriting │ • Primary Mathematics Problem Solver│
│ • Line-level CRNN+CTC Model      │ • YOLO Math Layout Detection        │
│ • Groq/Gemini Context Correction │ • Arithmetic Expression Parser      │
│ • CER / WER / Accuracy Analytics │ • Deterministic Grading Rule Engine │
│ • 8-Class Error Taxonomy Engine  │ • Teacher Grading Web App           │
│ • ML Experiment & Dataset Lineage│ • Student Math Exercise Workflow    │
│ • Bypass Auth / Fail-Closed Guard│ • Gamified Student Reward Badges    │
├──────────────────────────────────┴─────────────────────────────────────┤
│                      Shared Infrastructure Layer                        │
├────────────────────────────────────────────────────────────────────────┤
│ • React Native / Expo 57 Mobile Shell (`apps/student-mobile`)          │
│ • Spring Boot 3.3.4 Enterprise Backend (`backend/business-api`)        │
│ • PostgreSQL 15+ Relational Database (`ocr_trials` table)              │
│ • MinIO S3-Compatible Object Storage (`ocr-trials` bucket)             │
│ • FastAPI Python 3.13 AI Runtime Service (`ai/runtime`)                │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.1 Mode Isolation via `appMode.ts`
HandAI runtime behavior is activated via `EXPO_PUBLIC_APP_MODE=HAND_AI` in `apps/student-mobile/src/config/appMode.ts`:
- **When `HAND_AI`:**
  - Branding resolves to `HandAI: Vietnamese Handwriting Recognition System`.
  - Subtitle resolves to `Primary Students Grade 1-5`.
  - Feature flags bypass student login (`bypassLogin: true`) and privacy masking (`bypassPrivacyMasking: true`) to allow direct research scanning of student notebook benchmarks.
  - Math calculations (`showMathCalculations: false`) and arithmetic grading modes (`showArithmeticMode: false`) are completely deactivated.
- **When `MATHVISION_KIDS`:**
  - Standard math learning and grading workflows are executed; HandAI analytics remains dormant.

### 5.2 Shared Infrastructure vs. Isolated Components
- **Shared Infrastructure:**
  - **Networking:** `apiClient.ts` handles communication with Spring Boot backend and AI runtime.
  - **Storage:** MinIO object storage stores uploaded page images and line crops under the `ocr-trials` bucket.
  - **Database:** PostgreSQL stores audit records in table `ocr_trials` (Flyway migrations `V6`, `V7`, `V8`).
- **Isolated HandAI Components:**
  - `handAiAnalyticsStore.ts`: Independent offline/online store for Levenshtein edit distance, error taxonomy, and experiment tracking.
  - `crnn_provider.py`: Independent CRNN OCR inference provider in FastAPI.
  - `handai-trial-analytics.tsx` & `handai-analytics.tsx`: Dedicated research evaluation UI screens.
