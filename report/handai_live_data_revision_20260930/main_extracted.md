# Inspection Report: HandAI_Final_Live_Data.docx

## Metadata
- **Title**: HandAI — Final Capstone Report
- **Author**: Nguyễn Văn Duy Mạnh;Trần Hoài Nam
- **Created**: 2013-12-23 23:15:00+00:00
- **Modified**: 2026-09-30 14:15:00+00:00
- **Revision**: 11

## Document Content

Big Data Course

Capstone Project
Final Report

For students (instructor review required)

ⓒ2023 SAMSUNG. All rights reserved.

Samsung Electronics Corporate Citizenship Office holds the copyright of this document.

This document is a literary property protected by copyright law so reprint and reproduction without permission are prohibited.

To use this document other than the curriculum of Samsung Innovation Campus, you must receive written consent from copyright holder.


**[Table]**
| HandAI - VIETNAMESE PRIMARY SCHOOL HANDWRITING RECOGNITION SYSTEM |
| --- |

PROJECT TEAM

Nguyen Van Duy Manh
Tran Hoai Nam


# 1. Introduction


**[Table]**
| IMAGE | → | PREPROCESS | → | LINE DETECTION | → | CRNN | → | AI CORRECTION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

Figure 1. HandAI home screen and available workflow entry points. Dataset labels describe the UI; they do not verify grade coverage.


## 1.1 Background and motivation

Vietnamese handwriting recognition must preserve tone marks and vowel modifiers that may be faint, detached or merged with notebook ruling. Variation in stroke formation, spacing, slant and character connectivity motivates line-level recognition with explicit human review. Primary-school use is the application target; grade-specific recognition quality still requires a separately verified benchmark.


## 1.2 Problem statement

The core problem is to transform photographs of handwritten Vietnamese notebook pages into reliable line-level text while preserving diacritics and remaining robust to ruled paper, camera skew, uneven illumination and early-grade handwriting variation. The system must also expose enough evidence to explain errors and trace results back to the model and dataset version used.


## 1.3 Objectives

* Build line-level Vietnamese handwriting recognition using CRNN + CTC.
* Preserve Vietnamese accents through preprocessing and line-detection design.
* Use guarded contextual AI correction without replacing the CRNN as the core recognizer.
* Provide CER, WER and exact-line match metrics, while keeping model confidence separate from correctness.
* Record dataset, model, experiment and trial provenance to support reproducible evaluation.

## 1.4 Scope


**[Table]**
| In scope | Out of scope |
| --- | --- |
| Mobile capture/upload, crop, preprocessing and line review | Math problem solving |
| CRNN handwriting recognition and CTC decoding | Automated teacher grading |
| AI correction, human arbitration and analytics | Student learning-management workflow |
| Dataset/model versioning and experiment tracking | Generalized accuracy or learning gains without independent evaluation |


## 1.5 Research questions and contribution

The study asks whether line segmentation can preserve detached Vietnamese marks, how well the packaged CRNN transfers to photographed notebook lines, and when contextual correction helps or harms transcription. These questions require matched predictions and independent references, rather than a comparison of dashboard percentages.

The implemented contribution is an integrated recognition-and-review prototype with traceable model artifacts. CRNN combines convolutional features, recurrent sequence modeling and CTC [8]. HandAI adapts this approach to its Vietnamese line workflow; it does not claim a new recognition architecture or demonstrated superiority over transformer HTR such as TrOCR [9].


# 2. System Workflow & Architecture


## 2.1 User workflow


**[Table]**
| CAPTURE / UPLOAD | → | CROP | → | REVIEW LINES | → | RUN OCR | → | VERIFY RESULT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |

The mobile workflow takes a camera or gallery image through cropping, line-box review, recognition and transcription review. Users can move, resize, add or delete detected line boxes before submission. Each result preserves the raw OCR text, advisor suggestions and the selected transcription. [10]


**[Table]**
| Figure 2. User-selected notebook crop. | Figure 3. Detected lines available for review. |
| --- | --- |


### 2.1.1 Processing and live analytics interface

The processing screen exposes five stages: image preparation, line detection, OCR, AI verification and completion. Its 35% indicator represents workflow progress rather than recognition quality. The live analytics dashboard now reads completed device sessions, excludes bundled sample records and calculates values only where usable reference text exists. [4, 10]


**[Table]**
| (a) Processing status | (b) Live metric data path |
| --- | --- |

Figure 4. User-provided processing screen and code-derived live analytics data path. The progress indicator describes workflow state; the dashboard path shows how runtime evidence replaces fixed presentation values. [4, 7, 10]


## 2.2 Recognition result and verification

* The result screen shows the raw transcription, confidence, advisor suggestions and the current selection. Users can retain the OCR result, choose a suggestion, edit the text or skip a line; the backend records the corresponding verdict and verified text. [5, 10]
* Advisor responses may arrive after the first OCR result. While an advisor is pending, the result screen polls for updates and merges them with the current review state. A provider label identifies a response field; the actual provider/model and fallback status still determine its provenance. [3, 5, 10]

**[Table]**
| Figure 5. Recognition and transcription review. | Figure 6. Raw output, suggestion and user choice. |
| --- | --- |


## 2.3 Major system components


**[Table]**
| Component | Technology | Role |
| --- | --- | --- |
| Mobile application | React Native 0.86.3 / Expo ~57.0.19 | Capture, crop, line review, result verification and analytics UI |
| Backend gateway | Java 21 / Spring Boot 3.3.6 | Image ingestion, audit flow, storage coordination and AI-service relay |
| AI runtime | Python / FastAPI; package validated on Python 3.13.9 | Computer-vision preprocessing and model inference |
| Image processing | OpenCV | Illumination normalization, thresholding, ruling suppression and deskew |
| Recognition | PyTorch CRNN + CTC | Line-level Vietnamese handwriting recognition |
| Storage | PostgreSQL + MinIO | Structured provenance/audit data and object storage |
| AI correction | Groq + Google Gemini | Cloud advisors with a local fallback path |


## 2.4 System architecture

HandAI separates the mobile client, Java backend, Python AI service, persistence and client analytics. CRNN inference runs in the AI service. PostgreSQL holds trials and line records; MinIO holds page images and line crops. The research dashboard loads the client history store, filters completed non-sample sessions and aggregates verified line records. [2–5, 10]


### 2.4.1 High-level architecture

Figure 7. Current implementation architecture with background AI advice and a live dashboard aggregation layer. Sources: model code, OCR API, multiline service and mobile analytics. [1–5, 10]


### 2.4.2 End-to-end data flow


**[Table]**
| IMAGE | → | PREPROCESS | → | SEGMENT | → | CRNN + CTC |  | → | AI / HUMAN | → | METRICS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

A cropped page is sent through the backend for line detection. The user adjusts the returned boxes and submits them to create a multiline trial. The service stores the page and line crops, reuses submitted text when available or calls line recognition, then returns the trial. Background advisor results can update the saved trial and are retrieved by the result screen. [3, 5, 10]


### 2.4.3 Runtime boundaries and access control

The OCR provider defaults to CPU unless OCR_DEVICE selects another device. OcrMultilineService processes up to 30 confirmed lines, saves image objects and line records, and launches runBackgroundAdvisors asynchronously. The mobile result screen polls at one-second intervals for up to eight checks while advice is pending. These are implementation limits, not measured latency or throughput. [2, 5, 10]

HandAI has a guest demonstration route: /api/v1/handai/** is public, while /api/v1/ocr/** requires the student role. The multiline controller defaults privacy confirmation to true. Line feedback checks verdict, consent, domain, test status, verified text and stored-image integrity before setting training eligibility. Eligibility records do not trigger model training, and deployment needs explicit consent and access controls. [5]


# 3. AI Recognition Pipeline


## 3.1 Image acquisition

The application accepts camera or gallery input. EXIF orientation is handled before downstream coordinate mapping so crop and line positions refer to the correctly oriented image.


## 3.2 Preprocessing

The documented OpenCV pipeline applies Gaussian blur, illumination/background normalization using a 35×35 background estimate, Otsu inverted thresholding, horizontal ruling suppression and deskew within approximately ±10°.


## 3.3 Line detection

User crop coordinates are mapped to image pixels to remove irrelevant margins. The line detector uses body/satellite clustering so detached Vietnamese diacritics can remain associated with the correct text line instead of being discarded as noise.


## 3.4 Recognition and decoding

On the CRNN inference path, line images are resized to RGB [3, 64, 1024] and standardized using ImageNet channel statistics. Four convolutional blocks produce 128 sequence steps; one bidirectional LSTM and a linear classifier produce 320-class logits. Greedy CTC is the checkpoint decoder; beam search provides alternatives. Detection and trial creation also contain canonical/reused-text paths, so a displayed line is not necessarily a fresh CRNN prediction. [1–3, 5]


## 3.5 Verification

The AI service can request Groq and Gemini advice for a document batch. Its background path can apply matching suggestions or selected deterministic corrections, then fall back to Local-Advisor if neither cloud advisor returns a usable suggestion. Local-Advisor may populate both provider fields from one canonical source; this is not independent cloud agreement. Human review follows the returned suggestions. [3]


**[Table]**
| ACQUIRE | → | NORMALIZE | → | DETECT LINES | → | CRNN | → | CTC | → | AI CORRECT | → | EVALUATE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |


# 4. Dataset & CRNN Model


## 4.1 Dataset overview

The model manifest records 59,462 training samples and 500 validation samples from Viet-Handwriting-OCR-v2, totaling 59,962. These are handoff metadata, not a recount of the full upstream corpus. HandAI-v1.2 is a dashboard registry label; its grade distribution and dataset totals are not independently established by that label. [1, 4]


**[Table]**
| Property | Evidence-supported description |
| --- | --- |
| Declared split total | 59,962 samples = 59,462 + 500 [1] |
| Grade coverage | Primary-school target; grade distribution unverified |
| Training split | 59,462 samples, as declared in the manifest |
| Validation split | 500 samples, as declared in the manifest |
| Split seed | 42; random split in the manifest |


## 4.2 Data governance

* Source manifests, hashes and trial records support traceability. Full-corpus image/character counts, annotation coverage and duplicate rates still require the upstream manifests and an independent audit.
* SHA-256 supports file identity and duplicate checks. A perceptual-hash deduplication pipeline and its corpus-wide results have not been demonstrated.
* The handoff manifest states image-disjoint PASS. This is a recorded assertion; the complete training and validation manifests are needed to reproduce the overlap check.
* The manifest marks writer-disjointness UNKNOWN; generalization to unseen writers is therefore not established.
* Privacy must be assessed per endpoint and dataset. Pilot feedback has privacy and eligibility checks, but public HandAI routes and permissive consent defaults remain. Cropping alone does not demonstrate PII removal. [5]

## 4.3 CRNN model


### 4.3.1 Packaged recognition model

The checkpoint manifest identifies Vietnamese-Handwriting-OCR-Full version 1.0.0, with 5,962,560 parameters and artifact best_cer.pth. CRNN-v1.2-PyTorch is a client registry label and should not replace the artifact identity. The checkpoint SHA-256 was verified against the manifest. [1, 4]


**[Table]**
| IMAGE 3×64×1024 | → | CNN FEATURES | → | SEQUENCE 128 STEPS | → | BiLSTM 256-D | → | LINEAR 320 | → | CTC TEXT |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |


### 4.3.2 Architecture


**[Table]**
| Stage | Specification | Purpose |
| --- | --- | --- |
| Input | [B, 3, 64, 1024] | Standardized RGB handwriting-line batch |
| CNN | 4 Conv2d + GroupNorm(8, C) + ReLU; 3 pooling stages | Extract visual stroke and diacritic features |
| CNN output | [B, 512, 8, 128] | Spatial feature map |
| Sequence reshape | 128 time steps × 4096 | Convert 2D features into left-to-right sequence |
| BiLSTM | 1 layer; hidden=128 per direction; dropout 0.2 after LSTM | Model preceding and following sequence context |
| Linear | 256 → 320 classes | Character-class logits |
| CTC | blank index 0 | Alignment-free sequence decoding |
| Beam search | width 15; top-k 5 | Candidate generation; not a measured gain over greedy |


### 4.3.3 Training evidence

* Manifest: best checkpoint at step 16,900; official validation CER 11.3388% on the declared 500-sample validation set.
* Manifest: early stopping at step 18,901; this is a different step from the selected checkpoint.
* Manifest: loss at the best step 0.4518. Training was not rerun for this report. [1]

### 4.3.4 Interpreting training and validation evidence

Figure 8. Comparable training-subset/validation CER recorded for the same checkpoint [1]. The official best validation CER remains 11.3388%; it is a separate recorded measurement.

The training-subset/validation CER gap is approximately 2.54 percentage points. The manifest does not state the training-subset size. The official best CER and early-stop training CER are different measurements and must not be subtracted to claim negligible overfitting. The five smoke samples are not an independent test set. Arithmetic evaluation is marked BLOCKED_DATASET: the manifest records no standalone arithmetic expressions in validation. [1]


## 4.4 Local collection and data preparation

The owner_173 quarantine collection is separate from the declared training corpus. A direct count of source_manifest.csv gives 173 source records: 169 marked usable and 4 rejected, across 72 source_group values. These groups are not verified writer or student identities. The manifest records file hashes, image dimensions, blur, brightness and quality labels. [6]

Figure 9. Directly counted distribution of the local candidate collection [6]. Provisional categories do not establish ground truth or class-specific accuracy.

All 510 line candidates have review_status=PENDING and empty verified_text. Their category labels are preliminary, not human-verified ground truth. The next data step is annotation and quality review, followed by deduplication and split assignment; these records must not be counted as a validated benchmark or training gain. [6]

The Big Data aspect is the linked lifecycle of image objects, metadata, line crops, labels, model artifacts and evaluation records. Current evidence demonstrates a prototype data pipeline. It does not establish distributed processing scale, production throughput or completed automated retraining.


# 5. AI Correction & Human Verification

The recognition workflow keeps raw OCR, advisor suggestions and the reviewed transcription as distinct fields. Background advice supports cloud Groq/Gemini responses and a local fallback. The result screen provides explicit choices, while the backend persists CORRECT, CORRECTED or SKIPPED verdicts. A confirmed line can become eligible for a future curated dataset after consent and integrity checks. No automatic retraining is established. [3, 5, 10]


**[Table]**
| Control | Purpose |
| --- | --- |
| Provider provenance | Distinguish two actual cloud responses from one local suggestion copied into two fields. |
| Consensus and evidence rules | Apply the rules implemented by the selected execution path; agreement alone is not ground truth. |
| Configured edit ratio 0.35 | A post-corrector setting, not proof that every endpoint and fallback enforces the same limit. |
| Visible decision source | Retain raw text, advisor suggestion and human-selected text as separate stages. |
| Fallback behavior | Cloud failure may trigger Local-Advisor. Label the fallback and preserve the raw CRNN output. |


# 6. Evaluation & Error Analysis


## 6.1 Analytics scopes


**[Table]**
| Scope | Purpose |
| --- | --- |
| Trial Analytics | Inspect one trial and its line records, references, edits and decision sources. |
| Global Analytics | Legacy cross-session summary; retained for existing exports and trial views. |
| Research Analytics | Filter completed non-sample sessions and compute verified line metrics from the local history store. |

The dedicated dashboard aggregator filters completed non-sample sessions before display. It computes corpus CER and WER from total edit counts divided by total reference units, counts exact raw and final line matches, and derives confidence, latency and error items from the same live records. The legacy global analytics method remains separate and is not used for the research dashboard. [4, 10]


## 6.2 Core metrics


**[Table]**
| Metric | Definition |
| --- | --- |
| CER | Character-level Levenshtein substitutions + deletions + insertions divided by reference character count. |
| Complement of CER | 100 − CER% is a display score, not exact character accuracy; edit distance can exceed reference length. |
| WER | Token-level edits divided by reference token count. State tokenization; Vietnamese whitespace units are not always linguistic words. |
| Complement of WER | 100 − WER% is not exact word-match accuracy. A display clamp must not hide the original WER. |
| Line Accuracy | Full-line reference match under stated normalization; the current app lowercases text and collapses whitespace. |
| Confidence | Model certainty indicator; interpreted separately from true correctness. |


## 6.3 Evidence-supported performance reporting

The primary recorded model result remains validation CER 11.3388% at checkpoint step 16,900 on the declared 500-sample validation split. This model-handoff measurement remains separate from device-session analytics, whose values vary with the completed live records stored on the device. [1, 4, 10]

The research screen no longer supplies headline accuracy, dataset totals, comparison gains, latency or confidence through fallback constants. When no verified live lines exist, metric cards show an em dash or an explanatory empty state. When verified lines exist, every displayed value is derived from the filtered session and line records. [4, 10]


**[Table]**
| Evidence | Value or scope | Interpretation |
| --- | --- | --- |
| Checkpoint manifest | Validation CER 11.3388% | Existing model-handoff evidence |
| Live completed sessions | Non-sample records on the current device | Session count, processed lines, latency and history |
| Verified line records | Explicit or user-confirmed reference | Raw/final line accuracy, corpus CER/WER, confidence and errors |
| No usable reference | Value unavailable | Em dash or explanatory empty state; no fallback score |

The dashboard reports the change from raw exact-line accuracy to the selected final result in percentage points. Because the final selection can reflect both an AI suggestion and manual review, the interface labels this value as assisted workflow improvement rather than attributing the entire change to AI alone. [4, 10]

Live analytics calculation and display states


**[Table]**
| (a) Metric inclusion rules | (b) Dashboard display logic |
| --- | --- |

Figure 10. Metric inclusion rules and dashboard display logic derived from the current implementation. Verified values use completed non-sample sessions; unavailable evidence produces an explicit empty state. [4, 10]

These diagrams document the operational dashboard calculation. A user-confirmed reference is suitable for workflow monitoring but may not be independent of the selected output; the matched research comparison in Section 6.6 still requires frozen external references and exported line-level results.


## 6.4 Error analysis

Trial analytics associate line-level differences with a diagnostic error taxonomy. This supports inspection of missing characters, Vietnamese marks, substitutions and image or segmentation failures. Aggregate frequencies require independently labeled references and validated category assignments. [4]


**[Table]**
| Category | Interpretation |
| --- | --- |
| NO_ERROR | Prediction matches the verified reference. |
| LOW_IMAGE_QUALITY | Blur, weak contrast, glare or capture quality dominates. |
| SEGMENTATION_FAILURE | Detected line/crop does not isolate the intended handwriting. |
| VIETNAMESE_TONE_ERROR | Difference in tone or diacritic marks; distinguish tone marks from vowel-shape modifiers. |
| SIMILAR_CHARACTER_CONFUSION | Potential confusion between visually similar characters or strings; examples are illustrative. |
| MISSING_CHARACTER | Character deletion. |
| EXTRA_CHARACTER | Character insertion. |
| WORD_SUBSTITUTION | Predicted lexical unit differs from the reference word. |

Unicode decomposition helps separate tone and vowel-mark differences. The analytics store also contains default error distributions and inferred allocations when detailed records are absent. Consequently, this report uses the taxonomy to describe error analysis rather than presenting fallback percentages as observed error frequencies. [4]


## 6.5 Post-recognition evaluation

The app distinguishes EXPLICIT, USER_CONFIRMED, FALLBACK and MISSING reference states. User confirmation supports transcription review, but it is not automatically an independent reference: the implementation can use the selected text as ground truth when explicit text is absent. Scientific evaluation therefore retains a frozen external reference and scores raw OCR, AI-only output and the final human result separately. [4]


**[Table]**
| Research contribution HandAI integrates line segmentation, a Vietnamese CRNN recognizer, contextual suggestions and human review. The contribution is the observable workflow and its evaluation design; superiority over other recognizers or a measured AI gain remains to be established. |
| --- |


## 6.6 Protocol for a reproducible comparison

Freeze a test manifest with image and line hashes, independent reference text and writer/group identifiers where available. Record Unicode normalization, whitespace/tokenization rules and exclusions before scoring. Keep this set separate from training, model selection, canonical fixtures and prompt examples. The local pending collection is not eligible until its references are reviewed.


**[Table]**
| Stage | Output evaluated | Purpose |
| --- | --- | --- |
| A — raw CRNN | Text before any advisor or human edit | Recognition baseline |
| B — AI-only | Suggestion selected before human editing | Incremental correction effect |
| C — final human | Text after user review | End-to-end workflow result |

Score A, B and C against the same reference. Compute corpus CER/WER from total edit counts and total reference units; report exact-line matches with numerator and denominator. Report newly corrected and newly damaged lines, provider/fallback counts and paired uncertainty intervals. Express the raw-to-final difference in percentage points and report relative change only when its denominator and interpretation are explicit.

Latency evaluation must state hardware, device, image/line size, warm-up, batch size and whether network, preprocessing and cloud calls are included. Report median and p95 over repeated requests. Confidence requires calibration against correctness before it can be used as a reliability threshold. These are evaluation requirements, not completed experiments.


# 7. Experiment Tracking & Reproducibility

The client maintains dataset/model registrations, trial analytics, history and exports; the backend persists multiline trials, line crops and feedback. Completed sessions enter the local history, capped at 50 sessions. Native storage uses SecureStore and web storage uses localStorage, with an in-memory fallback. The research dashboard excludes sessions marked as sample data and displays only values derived from the remaining records. [4, 5, 10]


**[Table]**
| Tracked evidence | Examples |
| --- | --- |
| Dataset | Dataset ID plus immutable split manifests; dashboard labels alone are insufficient |
| Model | Manifest model/version + checkpoint and vocabulary hashes |
| Experiment | Registry entry plus actual run configuration, timestamps and outputs |
| Checkpoint integrity | best_cer.pth SHA-256 verified against the manifest [1] |
| Trial metadata | Image/line IDs, dimensions, preprocessing and execution-path metadata |
| Evaluation | Independent reference, stage-specific outputs, counts and inclusion rules |


## 7.1 Reproducibility record

This report describes the HandAI working tree inspected on 30 September 2026 at HEAD abf6ffbb7b2a5c2f3423a19006d82c409c0ca06f, including its local changes. The reproducibility record retains source-file hashes, checkpoint identity and data-count inputs. The reported checkpoint metrics are existing handoff records; no new training or full benchmark is claimed.

Verified checkpoint SHA-256: a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941. Reproduction also requires the vocabulary, runtime dependencies, preprocessing/decoding settings, immutable split files and per-sample outputs. The legacy evaluation/run_evaluation.py targets an arithmetic pipeline and is not evidence of a completed HandAI 500-line experiment.


## 7.2 Evidence sources and references

[1] ai-service/models/ocr/crnn_vi_handwriting_v1/model_manifest.json and best_cer.pth. Model identity, split counts, handoff metrics and artifact hash.

[2] ai-service/app/ocr/model.py and crnn_provider.py. CNN/BiLSTM architecture, preprocessing, decoding and execution device.

[3] ai-service/app/api/ocr.py. Line detection, advisor orchestration, canonical fixtures and Local-Advisor behavior.

[4] apps/mobile/src/services/analytics/handAiAnalyticsStore.ts and handAiDashboardMetrics.ts. Trial scoring, reference-status rules, persistence, live-session filtering and corpus metric aggregation.

[5] backend/src/main/java/com/mathvisionkids/api/: config/SecurityConfig.java; ocr/multiline/HandAiOcrController.java and OcrMultilineService.java. Guest routing, image storage, trial creation, background advice, feedback and training eligibility.

[6] datasets/quarantine/owner_173/hwtext_v1/source_manifest.csv and line_candidates.csv. Direct counts of local source images, candidate categories and review status.

[7] User-supplied app screenshots: capture/crop/review/result screens from the source document and the current processing screen. These document UI behavior; the analytics diagrams were generated from the inspected source code.

[8] Shi, B., Bai, X. and Yao, C. (2015). An End-to-End Trainable Neural Network for Image-based Sequence Recognition and Its Application to Scene Text Recognition. https://arxiv.org/abs/1507.05717

[9] Li, M. et al. (2021). TrOCR: Transformer-based Optical Character Recognition with Pre-trained Models. https://arxiv.org/abs/2109.10282

[10] apps/mobile/src/app/handai-analytics.tsx, (tabs)/index.tsx, crop.tsx, ocr-pilot/multiline-review.tsx and multiline-result.tsx; services/api/ocrPilotService.ts; services/analytics/handAiDashboardMetrics.ts; components/ocr/OCRProgressLoader.tsx. Current routing, line editing, polling, progress and live dashboard states.


# 8. Limitations & Future Work


## 8.1 Current limitations

* Generalization to primary-school grades and difficult handwriting is not established by a dedicated independent benchmark. The current evidence does not support a general 90%+ accuracy claim.
* Faint Vietnamese diacritics can be lost under poor illumination or weak stroke contrast.
* Arithmetic-specific evaluation is underrepresented / blocked by insufficient arithmetic lines in the current corpus.
* Direct resizing to 64×1024 can distort handwriting lines with extreme aspect ratios.
* Cloud post-correction depends on provider availability; local fallback suggestions must not be reported as independent cloud consensus.
* Writer-disjoint evaluation is unresolved, and screenshot scores do not establish reproducible experiment results.

## 8.2 Future roadmap


**[Table]**
| Direction | Expected improvement |
| --- | --- |
| ONNX Runtime / CoreML | Future work: evaluate device inference and latency; currently CRNN runs in the AI service. |
| Arithmetic-specific fine-tuning | Future work: obtain consented, verified arithmetic data before any training. |
| Aspect-ratio-preserving right padding | Future work: compare padding against fixed resizing with matching evaluation conditions. |
| Stronger sequence architectures | Future work: compare transformer HTR with the same data, decoding policy and compute budget. |
| Expanded evaluation corpus | Future work: independent references, writer-aware splits and difficult-handwriting subsets. |

Figure 11. Human review and the proposed feedback-to-training cycle. Solid stages reflect the implemented workflow; dashed stages are future work, not evidence of automated retraining. [3, 5]


## 8.3 Conclusion

HandAI delivers an integrated Vietnamese handwriting workflow: image acquisition, editable line segmentation, CRNN recognition, asynchronous language advice and human review. Stored trials, crop hashes and versioned model artifacts support traceability. The current contribution is the working integration and evaluation design; independently verified benchmarks are the next step toward quantifying AI benefit and generalization.


# 9. Team Member Review and Comment


**[Table]**
|  |  |
| --- | --- |
| Nguyen Van Duy Manh |  |
| Tran Hoai Nam |  |


# 10. Instructor Review and Comment


**[Table]**
|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |
| RESULT |  |  |
| PROJECT MANAGEMENT | __/10 |  |
|  |  |  |
|  |  |  |
