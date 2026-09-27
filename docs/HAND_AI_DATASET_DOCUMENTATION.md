# HandAI — Dataset Documentation

> **Dataset Name:** HandAI Vietnamese Primary Handwriting Dataset (*Viet-Handwriting-OCR-v2 Primary Subset*)  
> **Production Benchmark Version:** `HandAI-v1.2` (ID: `ds_handai_v1_2`)  
> **Repository:** `MathVisionKid`  
> **Target Population:** Vietnamese Primary School Students (Grades 1 through 5)  
> **Document Type:** Dataset Specification, Provenance Audit & Privacy Policy  

---

## 1. Dataset Overview & Version History

HandAI maintains a versioned corpus of primary school student handwriting collected from student notebooks, classroom dictation exercises, and homework sheets across Vietnamese primary schools.

| Dataset Version | Internal ID | Release Date | Sample Lines | Character Count | Source Images | Target Grade | Annotation Status |
|---|---|---|:---:|:---:|:---:|:---:|:---:|
| **HandAI-v1.0** | `ds_handai_v1_0` | 2025-11-10 | 15,420 | 98,500 | 3,200 | Grades 1–3 | Verified |
| **HandAI-v1.1** | `ds_handai_v1_1` | 2026-02-15 | 34,100 | 245,000 | 7,100 | Grades 1–4 | Verified |
| **HandAI-v1.2** ★ | `ds_handai_v1_2` | 2026-06-20 | **59,747** | **421,950** | **12,450** | **Grades 1–5** | **Production Verified** |

### Detailed Metadata for Production Dataset (`HandAI-v1.2`):
- **Full Corpus Name:** `Viet-Handwriting-OCR-v2 (MathVision Primary Subset)`
- **Total Validated Text Lines:** `59,747` samples.
- **Language:** Vietnamese (`vi-VN`).
- **Average Native Resolution:** $1920 \times 1080$ pixels (High-definition mobile camera captures).
- **Annotation Coverage:** `100.0%` (Every line possesses verified character ground truth).
- **Duplicate Rate:** `0.4%` (Filtered via perceptual and cryptographic hashing).
- **Writing Medium:** Ballpoint pen, fountain pen (*bút mực máy*), and pencil on standard Vietnamese quadrille lined notebooks (*vở 4 ô ly* and *5 ô ly*).

---

## 2. Dataset Partitioning & Disjoint Splits

To evaluate generalization and prevent data leakage, `HandAI-v1.2` enforces strict image-disjoint partitioning:

| Split Partition | Sample Count | Percentage | Split Strategy | Random Seed |
|---|:---:|:---:|---|:---:|
| **Training Split** | 59,462 | 99.16% | Random sampling across grade levels | `seed=42` |
| **Validation Split** | 500 | 0.84% | Fixed benchmark subset (`val_manifest.json`) | `seed=42` |
| **Independent Holdout** | Dynamically allocated | Disjoint | Reserved for Capstone defense validation | Disjoint |

### 2.1 Provenance Audit of Validation Samples
An audit of the bundled validation samples (`sample_01.jpg` through `sample_09.jpg`) confirmed:
- All 5 packaged smoke test samples originate strictly from the 500-sample validation split (`val_manifest.json`).
- All 5 samples are strictly absent from the training partition (`train_manifest.json`).
- Filenames and relative paths preserve upstream provenance from the raw archive (`images/train/train_XXXXX.jpg`).

### 2.2 Writer Disjointness Notice
As documented in the official model card (`MODEL_CARD.md`), individual student writer IDs were not uniquely annotated in the upstream raw repository. While **image-level overlap is strictly 0%** (no image appears in both train and validation), writer-disjointness cannot be mathematically guaranteed across individual pages from the same school.

---

## 3. Data Collection & Curation Workflow

```
┌────────────────────────┐
│ Raw Notebook Ingestion │ (Mobile Camera / High-Res Flatbed Scanning)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ PII Masking & Cropping │ (Manual / Automated Redaction of Student Name/School)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Deduplication Pipeline │ (MD5 Hash + SHA-256 + Perceptual Hash pHash)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Automatic Segmentation │ (OpenCV Text Line Detection & Bounding Box)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Dual-Review Annotation │ (Initial CRNN Candidate -> Two Human Expert Reviewers)
└───────────┬────────────┘
            │
            ▼
┌────────────────────────┐
│ Verified Ground Truth  │ (Persisted in Manifests & PostgreSQL ocr_trials)
└────────────────────────┘
```

1. **Ingestion:** Notebooks from elementary schools across Northern, Central, and Southern Vietnam were gathered to incorporate regional handwriting quirks (e.g., variations in the cursive loops of `r`, `s`, `v`, and `g`).
2. **Preprocessing:** High-resolution page captures undergo bounding crop to discard desk borders, pencil cases, and non-exercise margins.
3. **Automated Line Detection:** Text lines are segmented into isolated bounding boxes using the two-level projection clustering algorithm.
4. **Human-in-the-Loop Annotation:**
   - Pre-annotations are produced by the baseline CRNN model.
   - Two native Vietnamese annotators independently review and verify each transcribed line against the visual image crop.
   - Any discrepancy is arbitrated by a Senior Educational Lead.

---

## 4. Ground Truth Establishment & Status Lifecycle

In HandAI, Ground Truth is an immutable reference standard. The lifecycle of a line's Ground Truth is tracked via the `GroundTruthStatus` state model:

| Status Code | Description | Usage in Analytics |
|---|---|---|
| `EXPLICIT` | Ground truth manually provided prior to inference or pre-loaded from benchmark manifest. | High-confidence benchmark gold standard. |
| `USER_CONFIRMED` | Ground truth confirmed or manually edited by the user during the review phase (`multiline-review.tsx`). | Validated for active trial CER/WER computation. |
| `FALLBACK` | No ground truth provided; system falls back to the user's accepted `finalText`. | Excluded from strict research error benchmarking. |
| `MISSING` | Line was skipped or unverified. | Excluded from accuracy calculations. |

---

## 5. Quality Control & Deduplication Standards

### 5.1 Perceptual & Cryptographic Deduplication
To ensure that repetitive classroom copying exercises (*bài chép chính tả*) do not distort model generalization:
- **Cryptographic Hashing:** Every uploaded raw file and cropped line generates a cryptographic SHA-256 hash. Bit-identical duplicates are rejected immediately.
- **Perceptual Hashing (pHash):** 64-bit DCT perceptual hashing identifies visually identical notebook pages re-uploaded under different compression levels.
- **Duplicate Rate:** Maintained below **0.4%** across the entire 59,747 sample corpus.

### 5.2 Resolution & Aspect Ratio Standards
- Minimum allowable line height: 32 pixels.
- Standard normalized tensor dimensions: $H=64, W=1024$ (bilinear interpolation).
- Average native mobile image capture resolution: $1920 \times 1080$ pixels.

---

## 6. Privacy Protection & Ethical Governance

Primary school student handwriting data requires rigorous privacy safeguards:

### 6.1 PII Elimination (Personally Identifiable Information)
- **Header Stripping:** Student names, school names, class numbers (e.g., *Lớp 3A2*), student IDs, and teacher signatures located in notebook headers are strictly cropped out during Stage 3 before images reach the OCR engine or backend storage.
- **Synthetic Identifiers:** Internal records utilize randomized UUIDs (`trial_id`) and synthetic research IDs (e.g. `writer_001`, `img_000001`).

### 6.2 Fail-Closed Privacy Policy (Database Level)
Enforced via Flyway database migration `V8__privacy_fail_closed_and_tester_audit.sql`:
- The `privacy_confirmed` column in table `ocr_trials` defaults to `FALSE` (`DEFAULT FALSE`).
- A trial cannot be marked as `training_eligible = TRUE` unless explicit, validated privacy confirmation is recorded.
- All development and automated test executions are permanently quarantined:
  ```sql
  UPDATE ocr_trials
  SET is_test_data = TRUE,
      training_eligible = FALSE,
      data_origin = 'AUTOMATED_TEST';
  ```
- Quarantined test data is strictly isolated and can never be exported into future training corpora.
