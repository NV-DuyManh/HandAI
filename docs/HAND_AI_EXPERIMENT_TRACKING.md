# HandAI — Machine Learning Experiment Tracking & Provenance

> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Component:** Experiment Tracker & Dataset Registry (`handAiAnalyticsStore.ts`, `handai-analytics.tsx`)  
> **Document Status:** Authoritative Experiment Tracking Specification  

---

## 1. Bidirectional Provenance Chain Architecture

HandAI enforces a strict 5-stage bidirectional provenance chain. Every individual recognized line, trial evaluation, and exported metric can be traced backwards to its exact model weights, training date, hyperparameters, and dataset partition:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        1. Dataset Version                              │
│         (e.g., HandAI-v1.2 — 59,747 samples, Grades 1-5, seed=42)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Used for training / benchmark
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        2. Model Experiment                             │
│     (e.g., CRNN-v1.2-PyTorch — 5.96M params, PyTorch 2.6.0+cu124)      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Weight Checkpoint: best_cer.pth (SHA256)
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        3. Experiment ID                                │
│           (e.g., exp_crnn_v1_2 — Trained on 2026-07-05)                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Deployed to production inference
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     4. Recognition Trial Session                       │
│        (e.g., session_17901... — Mobile capture, image resolution)     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ Line predictions vs. Ground Truth
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      5. Evaluation Result                              │
│       (Line Accuracy: 94.0%, CER: 5.0%, WER: 8.0%, Error Taxonomy)     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Metadata Data Models

### 2.1 Dataset Version Model (`DatasetVersion`)
Defined in `handAiAnalyticsStore.ts`:
```typescript
export interface DatasetVersion {
  datasetId: string;
  datasetName: string;
  version: string;
  description: string;
  sampleCount: number;
  characterCount: number;
  imageCount: number;
  language: string;
  gradeLevel: string;
  createdDate: string;
  annotationStatus: 'Verified' | 'In Progress' | 'Raw' | string;
  averageImageResolution?: string;
  annotationCoverage?: number;
  duplicateRate?: number;
  duplicateChecking?: string;
  privacyHandling?: string;
  validationStatus?: string;
  dataSplit?: {
    train: string;
    validation: string;
    test: string;
    summary: string;
  };
}
```

### 2.2 Model Experiment Model (`ModelExperiment`)
Defined in `handAiAnalyticsStore.ts`:
```typescript
export interface ModelExperiment {
  experimentId: string;
  modelVersion: string;
  modelName: string;
  datasetVersion: string;
  trainingDate: string;
  framework: string;
  parameters: string;
  architecture?: string;
  checkpointSha256?: string;
  metrics: {
    lineAccuracy: number;
    characterAccuracy: number;
    cer: number;
    wer: number;
    latency: number;
  };
  status: 'ACTIVE' | 'BASELINE' | 'EXPERIMENTAL';
}
```

### 2.3 Session Provenance Model (`RecognitionSession`)
Every evaluation session captures:
```typescript
export interface RecognitionSession {
  sessionId: string;           // Mandatory unique session ID
  datasetVersion: string;      // Linked dataset (e.g. 'HandAI-v1.2')
  modelVersion: string;        // Active model (e.g. 'CRNN-v1.2-PyTorch')
  experimentId: string;        // Mandatory experiment run (e.g. 'exp_crnn_v1_2')
  trainingDate: string;        // Model training timestamp ('2026-07-05')
  cer?: number;                // Computed session CER %
  characterAccuracy?: number;  // Computed session Character Accuracy %
  wer?: number;                // Computed session WER %
  wordAccuracy?: number;       // Computed session Word Accuracy %
  lineAccuracy?: number;       // Exact line match %
}
```

---

## 3. Registered Model Experiment Benchmark (7-Column Table)

The HandAI experiment tracker compares historical and active model architectures across standardized dimensions. Rendered in `handai-analytics.tsx`:

| Model Version | Dataset Version | Line Accuracy | CER (%) | WER (%) | Latency | System Status |
|---|---|:---:|:---:|:---:|:---:|---|
| **CRNN-v1.0-Baseline** | Dataset-v1.0 (15,420 samples) | 82.0% | 12.0% | 20.0% | 1.8s | `BASELINE` |
| **CRNN-v1.1-ResNet** | Dataset-v1.1 (34,100 samples) | 90.0% | 8.0% | 15.0% | 2.1s | `EXPERIMENTAL` |
| **CRNN-v1.2-PyTorch** ★ | Dataset-v1.2 (59,747 samples) | **94.0%** | **5.0%** | **8.0%** | **2.3s** | **`ACTIVE MODEL`** |
| **CRNN-v1.2 + Gemini-4B** ★ | Dataset-v1.2 (59,747 samples) | **96.4%** | **2.1%** | **4.5%** | **3.2s** | **`ACTIVE MODEL`** |

### Historical Trajectory & Optimization Gains:
- **CER Improvement:** $12.0\% \rightarrow 5.0\%$ (**$-58.3\%$ relative error reduction**).
- **WER Improvement:** $20.0\% \rightarrow 8.0\%$ (**$-60.0\%$ relative error reduction**).
- **Absolute Accuracy Improvement:** $82.0\% \rightarrow 94.0\%$ (**$+12.0\%$ absolute gain**).
- **LLM Augmented Performance:** Reaches **96.4% Line Accuracy** and **2.1% CER** when paired with Gemini-4B contextual arbitration.

---

## 4. Research Data Export Specifications

HandAI allows researchers to export complete evaluation trials into machine-readable JSON and tabular CSV formats.

### 4.1 JSON Research Export Schema
```json
{
  "sessionId": "session_export_research_303",
  "timestamp": 1790156000000,
  "formattedDate": "2026-09-23 16:30:00",
  "datasetVersion": "HandAI-v1.2",
  "modelVersion": "CRNN-v1.2-PyTorch",
  "experimentId": "exp_crnn_v1_2",
  "trainingDate": "2026-07-05",
  "imageInfo": {
    "resolution": "1920x1080",
    "device": "Android",
    "latency": 2.3
  },
  "metrics": {
    "CER": 5.0,
    "WER": 8.0,
    "Accuracy": 94.0,
    "rawAccuracy": 88.0,
    "finalAccuracy": 94.0,
    "confidence": 91.5
  },
  "errorSummary": {
    "totalErrors": 1,
    "mainError": "Vietnamese Tone Error",
    "recommendation": "Improve handwriting tone recognition."
  },
  "lines": [
    {
      "lineIndex": 1,
      "sessionId": "session_export_research_303",
      "datasetVersion": "HandAI-v1.2",
      "modelVersion": "CRNN-v1.2-PyTorch",
      "experimentId": "exp_crnn_v1_2",
      "trainingDate": "2026-07-05",
      "modelOutput": "Em yêu mùa hè",
      "groundTruth": "Em yêu mùa hè",
      "cer": 0,
      "wer": 0,
      "wordAccuracy": 100,
      "isCorrect": true,
      "errorType": "NO_ERROR",
      "severity": "LOW"
    }
  ]
}
```

### 4.2 CSV Research Export Schema
Standardized header row:
```csv
Line Index,Model Output (OCR),AI Suggestion,Final Text,Confidence,Source,Correction Type,Is Correct,Ground Truth,Evaluation Status,CER (%),Character Accuracy (%),WER (%),Word Accuracy (%),Error Type,Severity,Wrong Character,Correct Character,Dataset Version,Model Version,Experiment ID,Training Date,Session ID
```

Sample CSV data row:
```csv
1,"Em yêu mùa hè","Em yêu mùa hè","Em yêu mùa hè",95,CRNN,OCR_CORRECT,true,"Em yêu mùa hè",EVALUATED,0,100,0,100,NO_ERROR,LOW,"","","HandAI-v1.2","CRNN-v1.2-PyTorch","exp_crnn_v1_2","2026-07-05",session_export_research_303
```
