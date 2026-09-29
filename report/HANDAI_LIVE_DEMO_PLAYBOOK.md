# HandAI Capstone Defense — Live Demo Playbook (3–5 Minutes)

> **Document Type**: Comprehensive Defense Demonstration Protocol  
> **Duration**: 3–5 Minutes (Target: 3 minutes 45 seconds)  
> **Evaluator Perspective**: Rigorous Academic Committee Assessment  
> **Primary Philosophy**: Focus on **Transparency**, **AI Contribution**, and **Big Data Analytics** — not just black-box OCR output.  
> **Source of Truth**: `report/HANDAI_FINAL_CONSISTENCY_AUDIT.md`  

---

```
SKILL ROUTING
Task domains: Capstone live demo protocol, UI verification, system architecture
Skills matched:
- slides (.agents/skills/slides/SKILL.md)
- ui-ux-pro-max (.agents/skills/ui-ux-pro-max/SKILL.md)
Skills loaded: YES
```

---

## 1. DEMO TIMING BUDGET (3m 45s TOTAL)

```
[0:00 - 0:30] Step 1: Image Ingestion & Boundary Setup
[0:30 - 0:55] Step 2: Adaptive Preprocessing & Binarization
[0:55 - 1:25] Step 3: Line Segmentation & Ascender Handling
[1:25 - 1:55] Step 4: Raw OCR CRNN Visual Inference (Stage 1)
[1:55 - 2:30] Step 5: Contextual AI Correction & Tone Recovery (Stage 2)
[2:30 - 3:00] Step 6: Human-in-the-Loop Verification & Audit Log (Stage 3)
[3:00 - 3:25] Step 7: Big Data Analytics & Confidence Calibration
[3:25 - 3:45] Step 8: Error Taxonomy & Longitudinal Learning Feedback
```

---

## 2. STEP-BY-STEP DEMO SEQUENCE

### STEP 1: Upload Handwriting Image (0:00 – 0:30)

* **What to demonstrate**:
  * Open HandAI Mobile app on `/ocr-pilot`.
  * Select the standardized benchmark test asset: `ai-service/notebook_extracted.png` (a genuine Vietnamese primary school notebook page with ruled grid lines, ascenders/descenders, and diacritics).
  * Show the interactive boundary selection box with corner handles.
* **Why it matters**:
  * Proves the system handles authentic, imperfect classroom artifacts rather than pre-cleaned synthetic scans.
  * Shows the committee that input acquisition respects camera distortions and varying aspect ratios.
* **Possible failure**:
  * File picker timeout, mobile simulator permissions error, or corrupt camera stream.
* **Backup plan**:
  * Have 3 pre-loaded samples pinned directly in the demo quick-access tray (`Sample A: Grade 2 Essay`, `Sample B: Math Numbers & Text`, `Sample C: Cursive Handwriting`). One-tap loads the cached image instantly.

---

### STEP 2: Show Preprocessing (0:30 – 0:55)

* **What to demonstrate**:
  * In `/crop` and backend inspection, show the preprocessing pipeline transforming raw RGB capture:
    1. Grayscale conversion.
    2. Adaptive thresholding / Gaussian filtering to suppress notebook grid lines (ô ly).
    3. Aspect-ratio preserving height normalization to 32px height (`1 x 32 x W`).
  * Point out the blur variance check (Laplacian variance metric: threshold $\ge 60.0$).
* **Why it matters**:
  * Demonstrates domain-specific computer vision engineering.
  * Primary school grid lines create severe horizontal noise; suppressing them without eroding delicate diacritics (dấu hỏi, ngã, sắc, huyền) is a core technical challenge.
* **Possible failure**:
  * Image variance calculation reports false blur warning due to high-contrast ruled lines.
* **Backup plan**:
  * Toggle "Auto-enhance / Contrast normalize" switch on the UI. Show the pre-rendered preprocessing comparison card in the audit inspector.

---

### STEP 3: Show Line Segmentation (0:55 – 1:25)

* **What to demonstrate**:
  * The multiline decomposition view on `/ocr-pilot/multiline-result`.
  * The system highlights bounding boxes for each separate handwritten line.
  * Specifically draw attention to **Line 2 and Line 3** where a descender (letter `g` or `y`) extends into the ascender zone of the line below (letter `h` or `b`).
  * Show how the adaptive vertical projection profile splits the text strips without slicing off the diacritics.
* **Why it matters**:
  * Proves the pipeline is a complete document digitization system, not just an isolated single-word classifier.
  * Directly addresses the #2 cause in our Error Taxonomy (Line Segmentation Failure, 19.6%).
* **Possible failure**:
  * Overlapping cursive letters cause two lines to merge into a single candidate strip.
* **Backup plan**:
  * Use the manual line-split slider or select "Pre-segmented Line 1" to immediately isolate the primary text line for OCR inference.

---

### STEP 4: Show Raw OCR Result (Stage 1) (1:25 – 1:55)

* **What to demonstrate**:
  * Point to the **"Raw OCR (CRNN)"** display card.
  * Highlight the raw predicted text: e.g., *"Hoc sinh chăm chi hoc tap"* (Note: Missing diacritics on *học* $\to$ *hoc*, *chỉ* $\to$ *chi*).
  * Display the model telemetry badge:
    * Model: `crnn_vi_handwriting_v1` (5.96M parameters).
    * Execution Latency: `418ms` (FastAPI local inference).
    * Model Confidence: `84.2%`.
* **Why it matters**:
  * **Complete Transparency**: Shows the examiners the raw optical capability without marketing disguise.
  * Proves our CRNN baseline achieves 11.34% Validation CER and 88.66% Character Accuracy on optical strokes alone.
* **Possible failure**:
  * FastAPI local worker connection dropped (`ECONNREFUSED` on port 8001).
* **Backup plan**:
  * Local caching layer in `handAiAnalyticsStore` retains the last validated inference payload and displays: `[Offline Cached Inference: Step 16,900 Checkpoint]`.

---

### STEP 5: Show AI Corrected Result (Stage 2) (1:55 – 2:30)

* **What to demonstrate**:
  * Point to the **"AI Suggestion (Context Advisor)"** display card immediately below the Raw OCR.
  * Show the corrected string: *"Học sinh chăm chỉ học tập"*.
  * Highlight the exact character diffs in green:
    * `o` $\to$ `ọ` (Restored dot below).
    * `i` $\to$ `ỉ` (Restored question-tone mark).
  * Point out the Advisor metadata badge:
    * Provider: `FastAPI Context Model / Language Advisor`.
    * Confidence: `92.4%`.
    * Reason: `"Recovered dropped diacritics based on Vietnamese syllable syntax"`.
* **Why it matters**:
  * **Proves the Measurable AI Contribution**: Visually demonstrates how the secondary stage drives CER down from **11.34% to 8.21%** (a 27.6% error reduction).
  * Explains that the AI acts as an auditable corrector rather than an unconstrained hallucination engine.
* **Possible failure**:
  * External LLM API rate limit or latency spike (> 3 seconds).
* **Backup plan**:
  * The system defaults to deterministic n-gram / lexicon rule-based corrector which executes locally in $< 15\text{ms}$.

---

### STEP 6: Show Human Verification (Stage 3) (2:30 – 3:00)

* **What to demonstrate**:
  * Show the 3 actionable teacher verdict buttons:
    1. **"Xác nhận AI"** (Accept AI suggestion).
    2. **"Giữ OCR gốc"** (Keep Raw OCR).
    3. **"Sửa thủ công"** (Manual teacher override).
  * Tap **"Xác nhận AI"**.
  * Show the state transition to **"Final Verified Output"** (Badge turns Emerald Green).
  * Open the audit trail inspection drawer: Show the generated JSON audit log:
    ```json
    {
      "sessionId": "sess_20260928_101",
      "rawOcrText": "Hoc sinh chăm chi hoc tap",
      "suggestedText": "Học sinh chăm chỉ học tập",
      "verifiedText": "Học sinh chăm chỉ học tập",
      "verdict": "AI_ACCEPTED",
      "teacherId": "TCH_PRIMARY_04"
    }
    ```
* **Why it matters**:
  * **Ethical AI & Academic Credibility**: Proves HandAI enforces Human-in-the-Loop.
  * Every teacher verification automatically becomes a gold-standard **Ground Truth record**, allowing the system to continuously measure empirical CER/WER without artificial labeling costs.
* **Possible failure**:
  * Spring Boot backend returns HTTP 400 or network lag during audit event write.
* **Backup plan**:
  * `handAiAnalyticsStore` stores the audit event optimistically in AsyncStorage / local state, updating the UI with zero latency and syncing asynchronously.

---

### STEP 7: Show Analytics Dashboard (3:00 – 3:25)

* **What to demonstrate**:
  * Navigate to `/handai-analytics`.
  * Point to the 4 Top-line KPI Cards:
    * **CER**: `11.34%` (Raw) $\to$ `8.21%` (Post-AI).
    * **WER**: `26.50%` (Raw) $\to$ `20.15%` (Post-AI).
    * **Accuracy**: `88.66%` $\to$ `91.79%`.
    * **Total Processed Lines**: `510 Field Candidate Lines`.
  * Tap **Confidence Calibration**:
    * Show the 5-bin calibration curve:
      * $\ge 90\%$ Conf $\to$ 91.2% Empirical Accuracy.
      * $80-89\%$ Conf $\to$ 82.3% Empirical Accuracy.
      * $< 60\%$ Conf $\to$ 40.0% Empirical Accuracy (Flagged with Red Warning: *"Mandatory Re-scan"*).
* **Why it matters**:
  * **Big Data Value**: Transforms isolated OCR into an institutional learning analytics platform.
  * Proves our model knows what it does not know (calibrated uncertainty).
* **Possible failure**:
  * Analytics screen fails to fetch remote stats.
* **Backup plan**:
  * Local persistence initializes immediately with the verified research benchmarks (`BENCHMARK_EXPERIMENTS` Step 16,900).

---

### STEP 8: Show Error Analysis & Teacher Feedback (3:25 – 3:45)

* **What to demonstrate**:
  * Scroll down to **"Error Taxonomy & Root Cause Breakdown"**:
    * Optical Character Failures: `64.7%` (Shape confusion `41.2%` + Tone drops `23.5%`).
    * Segmentation Collisions: `19.6%`.
    * Image Quality Degradation: `9.8%`.
    * AI Over-correction Rate: `5.9%`.
  * Highlight the **"Top Character Confusion Pairs"**: `n → m` (12), `u → ư` (8), `d → đ` (7).
  * Tap **"Export Research Report"**: Show one-click markdown report generation copied to clipboard.
* **Why it matters**:
  * **Scientific Humility & Actionable Insights**: Examiners respect projects that diagnose failure modes rather than claiming perfection.
  * Teachers can see which specific letters their students are writing sloppily across the semester.
* **Possible failure**:
  * Clipboard permission blocked in web browser.
* **Backup plan**:
  * Fallback modal pops up with the full formatted text ready to view on screen.

---

## 3. VERBAL SCRIPT FOR THE PRESENTER (CONCISE 3.5-MINUTE RUN)

| Time | Action | What to Say |
|:---:|---|---|
| **0:00** | Select image on `/ocr-pilot` | *"Em xin bắt đầu phần Demo thực tế của hệ thống HandAI với trang vở thực nghiệm của học sinh tiểu học gồm chữ viết tay có dấu thanh và dòng kẻ ô ly."* |
| **0:30** | Show crop & preprocessing | *"Bước 1 là tiền xử lý: Hệ thống chuẩn hóa chiều cao ảnh về 32px và lọc nhiễu đường kẻ ô ly bằng adaptive filtering để bảo toàn tối đa nét dấu thanh tiếng Việt."* |
| **1:00** | Show line segmentation | *"Bước 2 là phân đoạn dòng: Hệ thống tự động nhận diện các dòng chữ, giải quyết xung đột giữa các nét móc trên và nét móc dưới của học sinh."* |
| **1:30** | Point to Raw OCR | *"Bước 3 là đầu ra OCR thô: Mô hình CRNN 5.96 triệu tham số dự đoán chuỗi ký tự với độ trễ 0.42 giây. Tại đây một số dấu thanh nhỏ bị thiếu do nét viết mờ."* |
| **2:00** | Point to AI Suggestion | *"Bước 4 là tầng AI sửa lỗi ngữ cảnh: AI nhận diện cú pháp tiếng Việt và phục hồi chính xác dấu thanh, giúp giảm lỗi từ 11.34% xuống 8.21% CER."* |
| **2:35** | Tap "Xác nhận AI" | *"Bước 5 là xác nhận con người: Giáo viên chỉ cần một chạm để duyệt hoặc sửa. Mọi thao tác đều sinh nhật ký kiểm toán lưu vào PostgreSQL làm Ground Truth."* |
| **3:05** | Switch to `/handai-analytics` | *"Bước 6 là đóng góp Big Data: Dashboard tổng hợp dữ liệu học tập theo thời gian thực, đo đạc CER/WER và đường cong hiệu chuẩn độ tin cậy 5 phân vị."* |
| **3:30** | Show Error Breakdown | *"Cuối cùng, hệ thống phân loại 4 nhóm nguyên nhân lỗi và thống kê các cặp chữ học sinh hay nhầm lẫn nhất (n/m, u/ư), cung cấp thông tin quý giá cho giáo viên giảng dạy."* |

---

## 4. DEFENSE EVALUATION SCORECARD & SAFETY GUARDRAILS

### What Impresses the Examination Committee:
1. **Never Hiding Failures**: Showing both Raw OCR (with errors) and AI Correction (repaired) side-by-side proves authenticity.
2. **Deterministic Latency**: Demonstrating $< 500\text{ms}$ local inference demonstrates production readiness.
3. **Audit Trail Traceability**: Showing the JSON log proves that HandAI is an enterprise software platform, not just a Jupyter notebook script.
4. **Data Disjointness**: Clearly distinguishing the 59,462-line training corpus from the 173-page classroom testbed.

### Disasters to Avoid During Demo:
* ❌ **Never run a live camera scan on shaky hands** under harsh auditorium fluorescent lighting $\to$ Always use the pre-calibrated benchmark sample image first.
* ❌ **Never claim "100% accuracy"** $\to$ Always state: *"Raw CER is 11.34%, reduced to 8.21% via AI"*.
* ❌ **Never open terminal or developer console** $\to$ The student-facing UI must remain clean and production-ready.
* ❌ **Never attempt to train the model live** $\to$ Run inference only from the frozen Step 16,900 checkpoint.
