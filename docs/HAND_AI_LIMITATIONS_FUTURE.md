# HandAI — System Limitations & Future Roadmap

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative Technical Limitations & Engineering Roadmap  

---

## 1. Current System Limitations

Every limitation documented below is verified directly from experimental benchmark evaluations, dataset manifests, and source code audits.

### 1.1 Non-Standard Cursive & Extreme Handwriting Diversity
- **Symptom:** Recognition accuracy declines on Grade 1–2 student notebooks where letter formations violate standard guidelines (*chữ viết chưa chuẩn*).
- **Technical Cause:** The CRNN BiLSTM model was trained primarily on standardized Vietnamese handwriting corpora. When students exhibit non-standard pencil grips, exaggerated flourishes, or overlapping multi-stroke loops, temporal feature sequences diverge from typical representations.

### 1.2 Diacritical Sensitivity to Low Illumination & Faint Contrast
- **Symptom:** Small accents (dot below / *dấu nặng*, hook above / *dấu hỏi*, or breve / *dấu á*) are omitted, classified as `VIETNAMESE_TONE_ERROR` ($\sim 35\%$ of total errors).
- **Technical Cause:** Otsu global binarization and morphological background division can inadvertently erode faint pencil strokes when smartphone photographs suffer from uneven hand shadows or poor ambient lighting.

### 1.3 General Text vs. Arithmetic Worksheet Domain Gap
- **Symptom:** High accuracy on general Vietnamese prose (94.0% Line Accuracy), but symbol confusion on certain arithmetic operators and digits in dense equations.
- **Audit Verification:** Documented in `MODEL_CARD.md` (`ARITHMETIC_SPECIFIC_EVALUATION = BLOCKED_DATASET`):
  - Pure arithmetic lines in the 500-sample validation set: **0 / 500**.
  - Pure arithmetic lines in the 59,462 training samples: **1 / 59,462**.
  - General prose contains digits (accuracy: 83.74%) and operators (accuracy: 88.41%), but the training distribution is predominantly general literature, poems, and sentences rather than structured worksheet equations.

### 1.4 Aspect Ratio Distortion from Direct Resizing
- **Symptom:** Very short lines (e.g. `"Bài 1"`, `"Đáp số"`) suffer from horizontal stretching, while long lines undergo compression.
- **Technical Cause:** The input contract enforces direct bilinear resizing to a fixed tensor shape of $H=64, W=1024$ without aspect-ratio-preserving padding. (Mitigated in proposed V2 training config via `aspect_preserving_right_pad`).

### 1.5 External Cloud Dependency for AI Post-Correction
- **Symptom:** While baseline CRNN inference is local and fast ($\sim 15\text{ms}$ warmed), the contextual correction layer requires outbound HTTPS network calls to Groq Cloud or Google Gemini APIs.
- **Impact:** System latency increases from $\sim 1.2\text{s}$ to $\sim 2.5\text{s} - 3.2\text{s}$ per document page, and post-correction is unavailable in completely offline environments.

### 1.6 Upstream Writer Disjointness Uncertainty
- **Symptom:** Cross-writer generalization cannot be mathematically proven on the historical split.
- **Technical Cause:** As recorded in `model_manifest.json`, the upstream raw dataset (`Viet-Handwriting-OCR-v2`) did not annotate unique student writer IDs. While images in the validation set are strictly disjoint from the training set, some pages might originate from the same student writer.

---

## 2. Future Improvements Roadmap

The following architectural and algorithmic enhancements are planned to advance HandAI from an academic capstone into a nationwide production platform:

### 2.1 On-Device Edge Inference (CoreML / ONNX Runtime)
- **Goal:** Enable 100% offline, zero-network handwriting recognition on mobile devices.
- **Methodology:**
  - Export PyTorch `best_cer.pth` to ONNX format:
    ```bash
    torch.onnx.export(model, dummy_input, "crnn_handai_v1.onnx", ...)
    ```
  - Quantize weights from FP32 to INT8, reducing model size from $\sim 23.8\text{MB}$ to $\sim 6.2\text{MB}$ with $< 0.3\%$ CER degradation.
  - Deploy via ONNX Runtime Mobile or Apple CoreML for on-device inference latency under $10\text{ms}$ per line.

### 2.2 Domain-Specific Arithmetic Fine-Tuning
- **Goal:** Achieve $> 98\%$ symbol accuracy on primary school arithmetic exercises ($+, -, \times, :, =, <, >$).
- **Methodology:**
  - Execute the frozen training specification in `ai/runtime/models/ocr/crnn_vi_handwriting_v2/training_config.yaml`.
  - Ingest the synthetic and collected arithmetic line dataset (`ai/training/scripts/build_arithmetic_line_dataset.py`).
  - Train with focal CTC loss to penalize premature character emissions and digit-operator confusions.

### 2.3 Aspect-Ratio Preserving Right-Padding
- **Goal:** Eliminate geometric stroke distortion on variable-length text lines.
- **Methodology:**
  - Scale image height to $64$ pixels while preserving natural aspect ratio ($W_{\text{scaled}} = W \times \frac{64}{H}$).
  - Right-pad remaining canvas up to $W=1024$ using white fill ($255$), accompanied by an attention mask to prevent the RNN from computing loss over padded zones.

### 2.4 End-to-End Vision-Language Transformer (TrOCR / Donut)
- **Goal:** Unify line segmentation and character recognition into an attention-based encoder-decoder model.
- **Methodology:**
  - Experiment with fine-tuning a pre-trained Vietnamese Vision Transformer (e.g., TrOCR-Vietnamese) using a ViT visual encoder coupled with a RoBERTa language decoder.
  - This eliminates the separate two-stage CRNN + LLM pipeline by learning visual strokes and language context end-to-end within a single neural model.

### 2.5 Real-Time Edge Viewfinder with Glare & Blur Detection
- **Goal:** Prevent low-quality captures before they reach the recognition pipeline.
- **Methodology:**
  - Implement a mobile Laplacian variance filter directly on the camera frame stream:
    $$\text{Var}(\nabla^2 I) < \text{Threshold} \implies \text{"Image Blurry — Hold Steady"}$$
  - Display animated bounding guidance on screen to ensure the document is parallel to the camera lens.
