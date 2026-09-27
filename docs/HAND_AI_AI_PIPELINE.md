# HandAI — AI Pipeline Specification

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Document Status:** Authoritative AI Pipeline Engineering Specification  
> **Focus:** 7-Stage End-to-End Processing Pipeline  

---

## 1. End-to-End Pipeline Summary

The HandAI AI Pipeline consists of 7 sequential stages. Each stage has strict mathematical input/output contracts, specific underlying technologies, and verifiable validation criteria:

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Stage 1    │     │   Stage 2    │     │   Stage 3    │     │   Stage 4    │
│ Image Input  │ ──► │Normalization │ ──► │  Page Crop   │ ──► │Line Detection│
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                                                                       │
                                                                       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Stage 7    │     │   Stage 6    │     │   Stage 5    │     │  Extracted   │
│  Evaluation  │ ◄── │AI Correction │ ◄── │CRNN Sequence │ ◄── │ Text Lines   │
│  & Taxonomy  │     │ Arbitration  │     │ Recognition  │     │    Crops     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

---

## 2. Detailed Pipeline Stages

### Stage 1: Image Input & Acquisition

- **Input:**
  - Physical notebook page or assignment sheet captured via mobile device camera sensor or retrieved from device photo library.
  - Typical format: JPEG, PNG, or raw uncompressed bitmap.
  - Typical resolution: Between $1280 \times 720$ and $4032 \times 3024$ pixels.
- **Output:**
  - Standardized RGB image binary byte stream with resolved EXIF orientation metadata.
  - Cleaned local file URI on client (`file:///path/to/image.jpg`).
- **Technology:**
  - Native Mobile OS Camera API (`expo-camera` / React Native CameraKit).
  - Native Image Picker (`expo-image-picker`).
  - EXIF orientation transposition (`PIL.ImageOps.exif_transpose`).
  - Network transport: Native `XMLHttpRequest` avoiding Expo Winter fetch `FormData` binary conversion issues.
- **Purpose:**
  - Capture high-resolution primary student handwriting while preserving fine diacritical ink marks and stroke pressure variations.
  - Ensure correct image orientation prior to any geometric transformations.

---

### Stage 2: Normalization & Preprocessing

- **Input:**
  - Raw decoded BGR image array ($H \times W \times 3$) from Stage 1.
- **Output:**
  - Deskewed BGR image array.
  - Binarized ink mask array ($H \times W$, values in $\{0, 255\}$) with horizontal ruling lines suppressed.
- **Technology:**
  - OpenCV (`cv2`), NumPy.
  - Gaussian blur filter ($5 \times 5$, $\sigma = 0$).
  - Morphological background dilation ($35 \times 35$ rectangular kernel) and illumination division.
  - Otsu automated global thresholding (`cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU`).
  - Morphological opening with wide horizontal structuring element ($\max(50, 0.20 \times W) \times 1$) for ruling line suppression.
  - Affine rotation deskewing (`cv2.getRotationMatrix2D` + `cv2.warpAffine`).
- **Purpose:**
  - Correct camera tilt and paper skew (up to $\pm 10^\circ$).
  - Neutralize non-uniform lighting gradients, shadow occlusions, and yellow page tint.
  - Remove interfering notebook quadrille lines (*vở ô ly*) so they are not recognized as hyphens, minus signs, or connected character strokes.

---

### Stage 3: Region Isolation (Crop)

- **Input:**
  - Full-page normalized image array and normalized viewport coordinates from user selection.
- **Output:**
  - Focused rectangular region containing only the student's handwritten exercise lines.
- **Technology:**
  - React Native touch canvas coordinate transformation (`apps/student-mobile/src/app/crop.tsx`).
  - Image geometry matrix mapping normalized touch coordinates $[x_1, y_1, x_2, y_2] \in [0, 1]^4$ to physical pixel coordinates $[X_1, Y_1, X_2, Y_2]$.
- **Purpose:**
  - Eliminate irrelevant desktop background, notebook margins, student personal information (PII) headers, and printed teacher instructions.
  - Constrain the line segmentation engine strictly to the student's active handwriting area.

---

### Stage 4: Text-Line Detection & Segmentation

- **Input:**
  - Cropped handwriting region image and corresponding binary mask.
- **Output:**
  - Ordered list of line bounding boxes: `LineBox[] = [{line_id, x, y, width, height, order}]`.
  - Individual line image slices extracted from the original high-resolution RGB image.
- **Technology:**
  - Horizontal projection profile analysis:
    $$\text{Ink}(y) = \sum_{x=0}^{W-1} B(x, y)$$
  - Two-level body & satellite clustering (`has_primary_body_evidence`, `is_component_satellite`).
  - Projection valley recursive splitting for multi-line overlaps (`recursive_split_giant_box`).
  - Hysteresis line consolidation (`consolidate_line_boxes`): collinear word merging, vertical touch stitching, and satellite attachment.
- **Purpose:**
  - Segment continuous cursive and print text lines into isolated horizontal rows.
  - Prevent floating Vietnamese tone marks (*sắc, huyền, hỏi, ngã, nặng*) and vowel diacritics (*mũ, râu*) from being separated into phantom lines.
  - Attach descenders (`g, y, p, q`) and ascenders (`b, d, h, k, l`) to their true text row.

---

### Stage 5: CRNN Sequence Recognition

- **Input:**
  - Single text-line RGB image crop of variable dimensions $[H_{\text{line}}, W_{\text{line}}, 3]$.
- **Output:**
  - Raw transcribed text string (`rawOcrText`).
  - Sequence-level confidence score ($\in [0.0, 1.0]$).
  - Character-level emission timeline, alternative candidates, and token margins.
  - Uncertainty features: minimum token confidence, blank ratio, and Shannon entropy.
- **Technology:**
  - Bilinear interpolation resize to fixed tensor shape $[3, 64, 1024]$.
  - Standard ImageNet normalization ($\mu = [0.485, 0.456, 0.406], \sigma = [0.229, 0.224, 0.225]$).
  - PyTorch 2.6 / 2.3 Deep Neural Network:
    - 4-block Conv2D backbone with GroupNorm(8, C) and ReLU.
    - Bidirectional LSTM with 128 hidden units (output dimension 256).
    - Fully connected linear layer projecting to 320 vocabulary classes.
  - Connectionist Temporal Classification (**CTC**) greedy decoding and CTC Beam Search.
- **Purpose:**
  - Transcribe visual handwriting strokes into uncorrected UTF-8 Vietnamese character strings.
  - Provide mathematically grounded uncertainty signals for downstream post-correction arbitration.

---

### Stage 6: AI Post-Correction & Safe Arbitration

- **Input:**
  - Full document context: list of raw CRNN lines, sequence confidence scores, bounding boxes, and document page preview.
- **Output:**
  - Disambiguated suggested text (`aiCandidate`).
  - Decision source attribution: `CRNN_RAW`, `AI_CORRECTION`, or `MANUAL_EDIT`.
  - Action status: `Accepted`, `Corrected`, or `Manual`.
- **Technology:**
  - Multi-agent LLM reasoning layer:
    - **Primary Advisor:** Groq Cloud API executing Qwen-3.8-27b or LLaMA-based vision-language models.
    - **Secondary Advisor:** Google Gemini API executing Gemini 3.6 Flash.
  - Multi-key rotation pool with rate-limit cooldown management.
  - Strict Safe Arbitration Rules:
    - Consensus verification ($S_{\text{Groq}} == S_{\text{Gemini}}$).
    - Trailing stroke deduplication evidence (e.g. `tímm` $\rightarrow$ `tím`).
    - Maximum edit distance threshold ($\le 35\%$ edit ratio).
    - Non-hallucination guardrail: AI is strictly prohibited from recalculating numbers or altering mathematically intended answers.
- **Purpose:**
  - Correct visually ambiguous character confusions (`u` vs `v`, `n` vs `m`) and missing diacritics using Vietnamese linguistic context.
  - Preserve student handwriting fidelity without over-correcting genuine errors.

---

### Stage 7: Ground Truth Evaluation & Error Taxonomy

- **Input:**
  - Final transcribed lines, raw CRNN outputs, AI suggestions, and verified Ground Truth strings.
- **Output:**
  - Line Accuracy percentage ($0\% - 100\%$).
  - Character Error Rate (**CER**) and Character Accuracy ($100 - \text{CER}$).
  - Word Error Rate (**WER**) and Word Accuracy ($100 - \text{WER}$).
  - Component Improvement Deltas ($\Delta_{\text{AI}}, \Delta_{\text{Human}}$).
  - 8-Class Error Taxonomy assignment per line.
  - 4-Class Root Cause assignment (`RECOGNITION_ERROR`, `LANGUAGE_CORRECTION_ERROR`, `SEGMENTATION_ERROR`, `IMAGE_QUALITY_ERROR`).
- **Technology:**
  - Dynamic programming Levenshtein edit distance at character level:
    $$\text{Levenshtein}(P, R)$$
  - Tokenized Levenshtein edit distance at word level:
    $$\text{WordLevenshtein}(P_{\text{words}}, R_{\text{words}})$$
  - Unicode Normalization Form D (NFD) diacritic stripping for tone error classification.
  - Homologous glyph confusion dictionary matching.
  - TypeScript Evaluation Engine (`apps/student-mobile/src/services/analytics/handAiAnalyticsStore.ts`).
- **Purpose:**
  - Objectively benchmark recognition quality against verified ground truth corpora.
  - Provide research-grade diagnostic attribution explaining exact failure modes in children's handwriting.
