# HandAI — Model Documentation

> **Model Identifier:** `Vietnamese-Handwriting-OCR-Full`  
> **Production Code:** `CRNN-v1.2-PyTorch`  
> **Model ID:** `ocr_handwriting_full`  
> **Repository:** `MathVisionKid`  
> **Status:** Official Handoff Candidate / Production Release  
> **Document Type:** Machine Learning Model Card & Deep Architecture Specification  

---

## 1. Model Overview & Metadata

| Specification | Value / Technical Detail |
|---|---|
| **Model Name** | `Vietnamese-Handwriting-OCR-Full` |
| **Model Version** | `1.0.0` (Internal platform tracking: `CRNN-v1.2-PyTorch`) |
| **Experiment ID** | `exp_crnn_v1_2` |
| **Framework** | PyTorch `2.6.0+cu124` (also verified on PyTorch `2.3.0`) |
| **Model Task** | Offline Line-Level Handwritten Vietnamese Text Recognition (HTR) |
| **Input Shape** | Single Line Crop Tensor: $[B, 3, 64, 1024]$ (Channels, Height, Width) |
| **Output Shape** | Sequence Logits Tensor: $[B, 128, 320]$ (128 Timesteps, 320 Character Classes) |
| **Parameter Count** | **5,962,560** parameters (~5.96 Million parameters) |
| **Checkpoint File** | `best_cer.pth` (Size: 23,856,925 bytes / ~23.86 MB) |
| **Checkpoint SHA256** | `a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941` |
| **Vocabulary File** | `vocab.json` (320 classes, SHA256: `6af4062e92e22cc91ece5198638e29a6ceec6cb92e3b12bd71deb4b874ac9e0d`) |
| **CTC Blank Index** | `0` |
| **Unknown Token Index** | `236` |
| **Training Steps** | Best Checkpoint: Step `16,900` | Early Stopping: Step `18,901` |
| **Loss at Best Step** | `0.4518` |
| **Validation CER** | **0.1133876** (11.34% across 500-sample validation split) |
| **Comparable Gap** | Train CER @ 16,900: `8.66%`, Val CER @ 16,900: `11.20%`, Generalization Gap: `2.54%` |

---

## 2. Neural Network Architecture Specification

The model implements a classic, battle-tested **Convolutional Recurrent Neural Network (CRNN)** tailored for sequence-to-sequence visual transcription without requiring prior character segmentation.

```
Input Line Image [B, 3, 64, 1024]
               │
               ▼
┌─────────────────────────────────────────┐
│     CNN Feature Extractor (4 Blocks)    │
│  Block 1: Conv2D(3->64) + GN + MaxPool  │ ──► [B, 64, 32, 512]
│  Block 2: Conv2D(64->128)+ GN + MaxPool │ ──► [B, 128, 16, 256]
│  Block 3: Conv2D(128->256)+GN + MaxPool │ ──► [B, 256, 8, 128]
│  Block 4: Conv2D(256->512)+GN + ReLU    │ ──► [B, 512, 8, 128]
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          Reshape & Permute              │
│    [B, 512, 8, 128] ──► [B, 128, 4096]  │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Bidirectional LSTM Sequence Layer   │
│   input_size=4096, hidden_size=128      │ ──► [B, 128, 256]
│   num_layers=1, bidirectional=True      │
│   dropout=0.2                           │
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│     Linear Projection (FC Layer)        │
│   Linear(in_features=256, out=320)      │ ──► [B, 128, 320]
└─────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│          CTC Decoding Layer             │
│   Greedy Argmax / Beam Search           │ ──► Final UTF-8 String
└─────────────────────────────────────────┘
```

### 2.1 Exact PyTorch Implementation Source Code
Verified directly from `ai/handoff/staging/ocr_engine_handoff_final/ocr_engine/model.py`:

```python
import torch
import torch.nn as nn

class CRNN(nn.Module):
    def __init__(self, num_classes, dropout=0.2):
        super().__init__()
        self.cnn = nn.Sequential(
            nn.Conv2d(3, 64, 3, padding=1), nn.GroupNorm(8, 64), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(64, 128, 3, padding=1), nn.GroupNorm(8, 128), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(128, 256, 3, padding=1), nn.GroupNorm(8, 256), nn.ReLU(), nn.MaxPool2d(2, 2),
            nn.Conv2d(256, 512, 3, padding=1), nn.GroupNorm(8, 512), nn.ReLU(),
        )
        self.rnn = nn.LSTM(4096, 128, 1, bidirectional=True, batch_first=True)
        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(256, num_classes)

    def forward(self, x):
        feat = self.cnn(x)
        B, C, H, W = feat.size()
        feat = feat.permute(0, 3, 1, 2).contiguous().view(B, W, C * H)
        rnn_out, _ = self.rnn(feat)
        rnn_out = self.dropout(rnn_out)
        return self.fc(rnn_out)
```

### 2.2 Deep Architectural Details

1. **Convolutional Backbone (CNN):**
   - 4 convolutional stages extract dense visual features from the handwriting slice.
   - **Group Normalization:** Uses `nn.GroupNorm(8, C)` instead of `BatchNorm2d`. This guarantees consistent normalization dynamics during micro-batching ($N \in \{1, 4\}$) without degradation caused by small batch statistics.
   - **Receptive Field:** First three blocks use $2 \times 2$ Max Pooling, downsampling the spatial height from $64 \rightarrow 32 \rightarrow 16 \rightarrow 8$ and width from $1024 \rightarrow 512 \rightarrow 256 \rightarrow 128$. The final block preserves height at 8 and width at 128.

2. **Feature Map Reshaping:**
   - The tensor $[B, 512, 8, 128]$ is permuted along dimensions $(0, 3, 1, 2)$ to $[B, 128, 512, 8]$.
   - It is flattened into a sequential format of $[B, 128, 4096]$, where $T = 128$ represents temporal time frames from left to right along the handwriting line, and each frame has a feature vector of length $512 \times 8 = 4096$.

3. **Recurrent Modeling (BiLSTM):**
   - A single-layer Bidirectional Long Short-Term Memory (`nn.LSTM`) with $H_{\text{hidden}} = 128$.
   - The forward LSTM reads left-to-right; the backward LSTM reads right-to-left.
   - The concatenated hidden states yield an output dimension of $128 \times 2 = 256$ per timestep.
   - This captures bidirectional context, allowing the network to use upcoming cursive strokes to disambiguate preceding characters.

4. **Linear Projection & Dropout:**
   - A dropout layer ($p=0.2$) prevents co-adaptation of recurrent features.
   - An affine linear layer (`nn.Linear(256, 320)`) maps each timestep into logits for the 320 vocabulary classes.

---

## 3. Connectionist Temporal Classification (CTC) Decoding

Because characters in cursive handwriting have variable widths and unaligned boundaries, CTC loss and decoding allow alignment-free sequence transcription without explicit character segmentations.

### 3.1 Greedy CTC Decoding Algorithm
Greedy decoding selects the highest-probability class token at each of the 128 timesteps, collapses consecutive identical tokens, and removes the special blank token ($\epsilon = 0$):

$$\hat{\pi}_t = \arg\max_{c \in \{0, \dots, 319\}} P(c \mid x, t), \quad t \in \{1, \dots, 128\}$$
$$\text{Output String} = \mathcal{B}(\hat{\pi}_1, \dots, \hat{\pi}_{128})$$

Where mapping $\mathcal{B}$ executes:
1. If $\hat{\pi}_t == \hat{\pi}_{t-1}$, duplicate token is collapsed to a single token.
2. If token is the blank index ($0$), it is omitted.
3. Remaining indices are mapped to characters via `inv_vocab`.

### 3.2 CTC Beam Search Decoding
To preserve top-$K$ candidate hypotheses and candidate margins for uncertainty estimation, `CrnnOcrProvider` implements CTC prefix beam search (default beam width $W=15$, top candidates $K=5$):
- Maintains distinct blank probabilities $P_b(\ell)$ and non-blank probabilities $P_{nb}(\ell)$ for prefix sequences.
- Computes length-normalized sequence log-probability:
  $$\text{Score}(\ell) = \exp\left(\frac{\ln P(\ell)}{\max(1, |\ell|)}\right)$$
- Measures the **Candidate Margin** between top-1 and top-2 candidate sequences:
  $$\Delta_{\text{margin}} = P(\ell_1) - P(\ell_2)$$

---

## 4. Inference Pipeline & Memory-Safe Micro-Batching

To avoid Out-Of-Memory (OOM) crashes on resource-constrained servers or mobile runtimes when batch-evaluating 10 to 30 worksheet lines, the inference pipeline (`predict_batch`) enforces **memory-safe micro-batching**:

```python
# Processes inputs in memory-safe chunks of 4 (configurable)
results = predict_batch(image_paths, batch_size=4)
```

### 4.1 Benchmarked Latency Characteristics
Evaluated on Windows 11 AMD64 (PyTorch CPU / CUDA):
- **Single Line Inference (Batch = 1):** $\sim 0.58\text{s}$ (cold startup) / $\sim 0.015\text{s}$ (warmed up).
- **Document Batch (5 lines):** $\sim 0.06\text{s}$.
- **Full Page Batch (10 lines):** $\sim 0.11\text{s}$.
- **Large Page Batch (30 lines):** $\sim 0.31\text{s}$.

---

## 5. Role of AI Post-Correction (Large Language Models)

The deep neural CRNN model functions purely as an **acoustic/visual transducer**: it transcribes raw visual stroke patterns without external grammatical or semantic dictionaries. 

The **AI Post-Correction Layer** (Groq and Gemini) fulfills an indispensable complementary role:
1. **Visual Ambiguity Disambiguation:** Children's handwriting frequently confounds lookalike character pairs with nearly identical cursive strokes (e.g. `u` vs `v`, `n` vs `m`, `b` vs `d`). An LLM resolves these ambiguities by assessing grammatical plausibility in Vietnamese.
2. **Diacritical Restoration:** When faint pencil pressure or low camera contrast causes the CRNN to miss a subtle dot (*dấu nặng*) or hook (*dấu hỏi*), the LLM restores the required diacritic based on sentence context.
3. **Strict Non-Hallucination Boundaries:**
   - AI is bound by strict prompt rules (`prompts.py`): never solve a math problem, never alter numeric values, never rewrite sentences for literary style.
   - Corrections are constrained by an edit ratio threshold ($\le 35\%$). Suggestions exceeding this threshold are rejected to prevent generative hallucination.
