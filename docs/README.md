# HandAI — Technical Documentation Package Index

> **Directory:** `report/doc/`  
> **System:** HandAI (Vietnamese Primary School Handwriting Recognition System)  
> **Repository:** `MathVisionKid`  
> **Status:** Complete Technical Documentation Package  

---

## Documentation Deliverables

| File Name | Description |
|---|---|
| 1. [HAND_AI_PROJECT_OVERVIEW.md](file:///e:/MathVisionKid/report/doc/HAND_AI_PROJECT_OVERVIEW.md) | System purpose, primary school handwriting challenges, scope, features, and MathVision relationship. |
| 2. [HAND_AI_REPOSITORY_MAP.md](file:///e:/MathVisionKid/report/doc/HAND_AI_REPOSITORY_MAP.md) | Exact codebase directory map, file roles, and component ownership. |
| 3. [HAND_AI_SYSTEM_ARCHITECTURE.md](file:///e:/MathVisionKid/report/doc/HAND_AI_SYSTEM_ARCHITECTURE.md) | End-to-end 8-layer architecture: Mobile $\rightarrow$ Backend $\rightarrow$ CV $\rightarrow$ Line OCR $\rightarrow$ CRNN $\rightarrow$ AI Correction $\rightarrow$ Analytics $\rightarrow$ Export. |
| 4. [HAND_AI_AI_PIPELINE.md](file:///e:/MathVisionKid/report/doc/HAND_AI_AI_PIPELINE.md) | 7-stage processing pipeline specification with exact I/O contracts, math, and technologies. |
| 5. [HAND_AI_MODEL_DOCUMENTATION.md](file:///e:/MathVisionKid/report/doc/HAND_AI_MODEL_DOCUMENTATION.md) | `Vietnamese-Handwriting-OCR-Full` (`CRNN-v1.2-PyTorch`) PyTorch implementation source, 5.96M params, CTC decoding, and weights. |
| 6. [HAND_AI_DATASET_DOCUMENTATION.md](file:///e:/MathVisionKid/report/doc/HAND_AI_DATASET_DOCUMENTATION.md) | `HandAI-v1.2` corpus (59,747 lines, Grades 1–5), disjoint splits (`seed=42`), annotation loop, and privacy policy. |
| 7. [HAND_AI_ANALYTICS_BIGDATA.md](file:///e:/MathVisionKid/report/doc/HAND_AI_ANALYTICS_BIGDATA.md) | Trial/Global analytics, CER (5.0%) / WER (8.0%) formulas, 3-variant ablation benchmarks, and numerical guards. |
| 8. [HAND_AI_ERROR_ANALYSIS.md](file:///e:/MathVisionKid/report/doc/HAND_AI_ERROR_ANALYSIS.md) | 8-Class Error Taxonomy (`NO_ERROR`, `VIETNAMESE_TONE_ERROR`, `SIMILAR_CONFUSION`, etc.), Unicode NFD detection, and root causes. |
| 9. [HAND_AI_EXPERIMENT_TRACKING.md](file:///e:/MathVisionKid/report/doc/HAND_AI_EXPERIMENT_TRACKING.md) | 5-stage bidirectional provenance chain: Dataset $\rightarrow$ Model $\rightarrow$ Run $\rightarrow$ Trial $\rightarrow$ Data, 7-column table, export schemas. |
| 10. [HAND_AI_TECH_STACK.md](file:///e:/MathVisionKid/report/doc/HAND_AI_TECH_STACK.md) | Complete technology matrix across React Native (Expo 57), Java 21 / Spring Boot, Python 3.13 / FastAPI, PyTorch, and MinIO. |
| 11. [HAND_AI_RUNNING_GUIDE.md](file:///e:/MathVisionKid/report/doc/HAND_AI_RUNNING_GUIDE.md) | Deployment manual: environment variables, launch commands, health checks, and troubleshooting. |
| 12. [HAND_AI_LIMITATIONS_FUTURE.md](file:///e:/MathVisionKid/report/doc/HAND_AI_LIMITATIONS_FUTURE.md) | Verified empirical limitations and the future engineering roadmap (CoreML/ONNX edge, TrOCR, arithmetic fine-tuning). |
| 13. [HAND_AI_COMPLETE_TECHNICAL_SUMMARY.md](file:///e:/MathVisionKid/report/doc/HAND_AI_COMPLETE_TECHNICAL_SUMMARY.md) | Master synthesis and concrete 5-phase blueprint to decouple HandAI into an independent standalone repository. |
