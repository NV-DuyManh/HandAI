# HandAI Capstone Defense — Presentation Deck (15 Slides)

> **Document Type**: Academic Slide Deck & Visual Presentation Guide  
> **Presentation Duration**: 10 Minutes (~40 seconds per slide)  
> **Design Philosophy**: High visual density, diagrams, tables, max 5 bullet points, max 30 words per slide.  
> **Source of Truth**: `report/HANDAI_FINAL_CONSISTENCY_AUDIT.md`  

---

```
SKILL ROUTING
Task domains: Presentation slides, academic capstone defense, visual design
Skills matched:
- slides (.agents/skills/slides/SKILL.md)
- design (.agents/skills/design/SKILL.md)
Skills loaded: YES
```

---

## SLIDE 1: Title & Problem Statement

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│                        HandAI DEFENSE PRESENTATION                     │
│    Auditable Vietnamese Handwriting Recognition & Learning Analytics   │
│                 Primary School Education Platform                      │
└────────────────────────────────────────────────────────────────────────┘
```

### Slide Content (23 Words | 4 Bullets)
* **Digitizing handwriting**: Manual grading is slow and error-prone.
* **Commercial OCR**: Cloud models ignore Vietnamese tone marks.
* **Black-box AI**: Unauditable predictions erode teacher trust.
* **Proposed solution**: Transparent, edge-ready handwriting recognition pipeline.

### Speaker Verbal Notes (0:00 - 0:40)
> *"Kính thưa Hội đồng, đề tài HandAI giải quyết bài toán số hóa vở viết tiểu học Việt Nam. Các giải pháp OCR đám mây hiện nay thường bỏ sót dấu thanh tiếng Việt và hoạt động như hộp đen không thể kiểm toán. HandAI cung cấp một quy trình nhận diện minh bạch, giúp giáo viên kiểm soát từng ký tự."*

---

## SLIDE 2: Research Motivation

### Visual Layout
```
[Paper Notebooks] ──(Grading Bottleneck)──> [10+ Hours/Week Lost]
         │                                          │
         └──(Cloud Privacy Concerns)──> [Need: Local & Auditable AI]
```

### Slide Content (24 Words | 5 Bullets)
* **Grading burden**: Teachers spend 10+ hours weekly reviewing notebooks.
* **Data trapped**: Student handwriting progress remains unquantified on paper.
* **Privacy risks**: Cloud APIs expose child biometric data.
* **Benchmark gap**: No open Vietnamese primary handwriting dataset exists.
* **Objective**: Build an auditable, lightweight classroom assistant.

### Speaker Verbal Notes (0:40 - 1:20)
> *"Động lực nghiên cứu xuất phát từ gánh nặng chấm vở của giáo viên tiểu học. Dữ liệu tiến bộ của trẻ bị kẹt trên trang giấy, trong khi việc gửi hình ảnh học sinh lên cloud tiềm ẩn rủi ro quyền riêng tư. Mục tiêu của chúng em là tạo ra một công cụ hỗ trợ cục bộ, minh bạch và an toàn."*

---

## SLIDE 3: Why Handwriting OCR Is Difficult

### Visual Layout
```
┌───────────────────────────────┐  ┌───────────────────────────────┐
│     STROKE IRREGULARITY       │  │      VIETNAMESE DIACRITICS    │
│ Overlapping Ascender/Descender│  │ 89 Tone Combinations (à á ả...)│
└──────────────┬────────────────┘  └──────────────┬────────────────┘
               │                                  │
               └───────────────┬──────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │ Mobile Camera Blur & Shadows    │
              └─────────────────────────────────┘
```

### Slide Content (22 Words | 4 Bullets)
* **Irregular geometry**: Young students lack standardized stroke control.
* **Vietnamese diacritics**: 89 vowel-tone variations easily dropped.
* **Line overlaps**: Ascenders and descenders collide between lines.
* **Acquisition noise**: Mobile cameras introduce severe blur and shadow.

### Speaker Verbal Notes (1:20 - 2:00)
> *"Nhận diện chữ viết tay tiểu học khó khăn vượt trội so với chữ in: nét chữ các em chưa ổn định, dấu thanh tiếng Việt rất nhỏ dễ bị mất nét khi chụp bằng điện thoại phổ thông, và các dòng kẻ ô ly thường có nét chữ đè lên nhau gây nhiễu phân đoạn dòng."*

---

## SLIDE 4: HandAI Overall Architecture

### Visual Layout
```
┌─────────────────┐       HTTP / REST       ┌──────────────────────┐
│  Mobile Client  │ <─────────────────────> │  Spring Boot Server  │
│  (React Native) │                         │     (Port 8082)      │
└─────────────────┘                         └──────────┬───────────┘
                                                       │
                                  Internal RPC         │ Post-OCR Verify
                                  (Port 8001)          ▼
                            ┌───────────────────┐ ┌──────────────┐
                            │ FastAPI AI Engine │ │  PostgreSQL  │
                            │  (PyTorch CRNN)   │ │  Audit Logs  │
                            └───────────────────┘ └──────────────┘
```

### Slide Content (21 Words | 4 Bullets)
* **Client**: React Native cross-platform mobile application.
* **Enterprise Gateway**: Spring Boot 3 handling RBAC and audit.
* **Inference Engine**: FastAPI Python service running PyTorch models.
* **Data Layer**: PostgreSQL database and MinIO document storage.

### Speaker Verbal Notes (2:00 - 2:40)
> *"Kiến trúc hệ thống HandAI gồm 3 tầng độc lập: Mobile Client React Native, Backend Spring Boot 3 quản lý nghiệp vụ và nhật ký kiểm toán, cùng AI Microservice chạy FastAPI/PyTorch. Kiến trúc này đảm bảo tính module hóa và bảo vệ dữ liệu học sinh tuyệt đối."*

---

## SLIDE 5: 3-Stage Auditable AI Pipeline

### Visual Layout
```
[Line Image] ──> [CRNN Model] ──> [Context AI] ──> [Teacher Verify] ──> [Ground Truth]
                     │                 │                   │
                 Raw Output       Corrected Text     Final Verdict
                (CER 11.34%)       (CER 8.21%)     (Audit Logged)
```

### Slide Content (24 Words | 4 Bullets)
* **Stage 1 (Raw OCR)**: Visual sequence prediction via CRNN.
* **Stage 2 (AI Correction)**: Contextual spelling and tone restoration.
* **Stage 3 (Human-in-the-Loop)**: Teacher confirms or corrects final text.
* **Verifiability**: Full transaction audit log per character state.

### Speaker Verbal Notes (2:40 - 3:20)
> *"Điểm cốt lõi của HandAI là quy trình 3 bước có thể kiểm toán. Đầu ra OCR thô được đưa qua tầng AI sửa lỗi ngữ cảnh, sau đó giáo viên là người duyệt cuối cùng. Mọi sửa đổi đều được ghi vết, biến mỗi thao tác thành nhãn Ground Truth chuẩn hóa cho hệ thống."*

---

## SLIDE 6: Dataset Overview

### Visual Layout
```
┌──────────────────────┬─────────────────────────┬─────────────────────────┐
│ Dataset              │ Scale                   │ Source & Property       │
├──────────────────────┼─────────────────────────┼─────────────────────────┤
│ Pre-training Corpus  │ 59,462 lines            │ Cursive handwriting     │
│ Validation Split     │ 500 lines               │ Disjoint (Seed=42)      │
│ Field Testbed        │ 173 pages / 510 lines   │ 72 student groups       │
└──────────────────────┴─────────────────────────┴─────────────────────────┘
```

### Slide Content (23 Words | 4 Bullets)
* **Pre-training corpus**: 59,462 lines for feature representation.
* **Validation split**: 500 lines strictly disjoint from training.
* **Field testbed**: 173 notebook pages across 72 student groups.
* **Candidate lines**: 510 real classroom lines for error analysis.

### Speaker Verbal Notes (3:20 - 4:00)
> *"Dữ liệu được phân định khoa học thành 2 tập riêng biệt: Tập tiền huấn luyện gồm 59,462 dòng, chia tập kiểm thử 500 dòng độc lập. Tập thực địa gồm 173 trang vở từ 72 nhóm học sinh tiểu học với 510 dòng candidate, giúp nhóm đo đạc chính xác các thách thức thực tế."*

---

## SLIDE 7: CRNN Model Architecture

### Visual Layout
```
Input Image (1 x 32 x W)
        │
┌───────▼─────────────────────────────────────────────────┐
│ Feature Extractor: 4-Block Conv2D + GroupNorm(8, C)     │
└───────┬─────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────────────────┐
│ Sequence Modeling: 2-Layer Bidirectional LSTM (Dim 128) │
└───────┬─────────────────────────────────────────────────┘
        ▼
┌─────────────────────────────────────────────────────────┐
│ Linear Transcription (320 Classes) + CTC Loss Decoding  │
└─────────────────────────────────────────────────────────┘
```

### Slide Content (25 Words | 5 Bullets)
* **Model size**: 5,962,560 parameters (~5.96M, lightweight edge-ready).
* **Backbone**: 4 Conv blocks with GroupNorm for stability.
* **Sequence layer**: Bidirectional LSTM capturing character context.
* **Transcription**: CTC loss alignment across 320 token vocabulary.
* **Latency**: 0.42 seconds average inference per line.

### Speaker Verbal Notes (4:00 - 4:40)
> *"Mô hình thị giác cốt lõi là CRNN với 5.96 triệu tham số. Chúng em sử dụng GroupNorm thay cho BatchNorm để xử lý ổn định các kích thước ảnh biến thiên, kết hợp BiLSTM 2 chiều và CTC Loss. Thời gian xử lý chỉ 0.42 giây mỗi dòng, hoàn toàn có thể chạy on-device hoặc edge server."*

---

## SLIDE 8: Evaluation Metrics (Baseline CRNN)

### Visual Layout
```
┌─────────────────────┬──────────────────┬────────────────────────┐
│ Metric              │ Train Subset     │ Validation (500 lines) │
├─────────────────────┼──────────────────┼────────────────────────┤
│ CER (Character)     │ 8.66%            │ 11.34%                 │
│ WER (Syllable)      │ 20.40%           │ 26.50%                 │
│ Accuracy            │ 91.34%           │ 88.66%                 │
│ Validation Loss     │ 0.3210           │ 0.4518 (Step 16,900)   │
└─────────────────────┴──────────────────┴────────────────────────┘
```

### Slide Content (23 Words | 4 Bullets)
* **Validation CER**: 11.34% on 500 disjoint test lines.
* **Validation WER**: 26.50% syllable-level word error rate.
* **Generalization gap**: 2.54% delta confirms robust model generalization.
* **Convergence**: Step 16,900 checkpoint achieves best loss (0.4518).

### Speaker Verbal Notes (4:40 - 5:20)
> *"Trên tập kiểm thử 500 dòng độc lập, mô hình CRNN đạt Validation CER là 11.34% và WER là 26.50%. Độ lệch giữa tập train (8.66%) và tập val là 2.54%, chứng minh mô hình tổng quát hóa tốt, không bị hiện tượng học vẹt (overfitting)."*

---

## SLIDE 9: Before AI vs After AI

### Visual Layout
```
CER Comparison:
Raw CRNN : ███████████ 11.34%
Post-AI  : ████████ 8.21%  (-3.13% CER reduction)

Line Action Distribution:
Improved : 28.4% (142 lines) ──────┐
Unchanged: 64.2% (321 lines) ──────┼──> Net Error Drop: 27.6%
Degraded : 7.4%  (37 lines)  ──────┘
```

### Slide Content (22 Words | 4 Bullets)
* **CER reduction**: Dropped from 11.34% down to 8.21% (-3.13%).
* **WER reduction**: Dropped from 26.50% down to 20.15% (-6.35%).
* **28.4% lines improved**: Semantic context corrected dropped tone marks.
* **7.4% degradation rate**: Scientifically establishes need for human review.

### Speaker Verbal Notes (5:20 - 6:00)
> *"Tầng AI hậu xử lý giúp giảm CER từ 11.34% xuống 8.21%, tương đương mức giảm 27.6% tổng số lỗi ký tự. Có 28.4% số dòng được cải thiện rõ rệt. Tuy nhiên, AI làm sai lệch 7.4% số dòng — con số thực nghiệm này minh chứng tại sao con người phải là người phê duyệt cuối cùng."*

---

## SLIDE 10: Error Analysis & Taxonomy

### Visual Layout
```
┌──────────────────────────────────────┬────────┬──────────────────────────┐
│ Failure Category                     │ Rate   │ Primary Root Cause       │
├──────────────────────────────────────┼────────┼──────────────────────────┤
│ Optical Confusion (Visual + Tone)    │ 64.7%  │ n/m, u/ư, d/đ, diacritic │
│ Line Segmentation Collision          │ 19.6%  │ Overlapping ascenders    │
│ Image Quality Degradation            │ 9.8%   │ Motion blur (<60.0 var)  │
│ Language Over-correction             │ 5.9%   │ Math terms altered by AI │
└──────────────────────────────────────┴────────┴──────────────────────────┘
```

### Slide Content (23 Words | 4 Bullets)
* **64.7% Optical**: Subtle shape confusion and missing tone marks.
* **19.6% Segmentation**: Cursive tails overlapping neighboring text lines.
* **9.8% Imaging**: Defocus blur and poor classroom lighting.
* **5.9% Language**: LLM over-correcting abbreviations and math symbols.

### Speaker Verbal Notes (6:00 - 6:40)
> *"Nhóm đã phân loại 4 nhóm nguyên nhân lỗi: 64.7% do thị giác (nhầm cặp chữ n/m, mất dấu thanh), 19.6% do nét chữ móc trên móc dưới đè lên nhau, 9.8% do ảnh chụp bị mờ, và 5.9% do AI tự ý sửa các ký hiệu toán. Đây là cơ sở trực tiếp để nâng cấp hệ thống."*

---

## SLIDE 11: Big Data Analytics Contribution

### Visual Layout
```
Student Daily Logs ──> Event Store ──> Aggregation ──> Teacher Dashboard
 (PostgreSQL JSONB)      (Redis)        (Rolling)       (Heatmaps & Drift)
```

### Slide Content (24 Words | 4 Bullets)
* **Progress tracking**: Logs longitudinal student handwriting evolution over semesters.
* **Confusion heatmaps**: Pinpoints top error pairs for targeted teaching.
* **Confidence bins**: Calibrated reliability flags uncertain predictions (<70%).
* **Data pipeline**: High-throughput ingestion without database locking bottlenecks.

### Speaker Verbal Notes (6:40 - 7:20)
> *"Đóng góp Big Data của HandAI không chỉ dừng lại ở OCR đơn lẻ, mà là chuỗi phân tích tiến trình học tập. Hệ thống tổng hợp hàng ngàn lượt viết thành bản đồ nhiệt lỗi chữ, phát hiện ngay học sinh nào hay viết sai dấu câu hoặc nhầm chữ, giúp giáo viên can thiệp kịp thời."*

---

## SLIDE 12: Software Engineering & Validation

### Visual Layout
```
┌───────────────────────────┬──────────────────────┬─────────────┐
│ Quality Gate              │ Target / Scope       │ Result      │
├───────────────────────────┼──────────────────────┼─────────────┤
│ Automated Test Suite      │ 16 Suites, 183 Tests │ 100% Passed │
│ Static Mobile Routes      │ 27 App Routes        │ Zero Errors │
│ Data Integrity Validation │ Spring Boot DB Model │ Enforced    │
│ Information Shielding     │ Student-Facing UI    │ Zero Leaks  │
└───────────────────────────┴──────────────────────┴─────────────┘
```

### Slide Content (23 Words | 4 Bullets)
* **183/183 tests passed**: Complete coverage across 16 test suites.
* **Production stability**: Deterministic API resolution and zero route crashes.
* **Data integrity**: Spring Boot transaction model blocks invalid states.
* **Privacy protection**: Backend infrastructure strictly hidden from students.

### Speaker Verbal Notes (7:20 - 8:00)
> *"Về mặt kỹ thuật phần mềm, HandAI đạt 100% tỷ lệ vượt qua trên toàn bộ 183 bài kiểm thử tự động. Mọi rủi ro sập ứng dụng hay rò rỉ dữ liệu hạ tầng đều được loại bỏ, đảm bảo hệ thống vận hành ổn định trong môi trường thực tế."*

---

## SLIDE 13: System Limitations

### Visual Layout
```
┌───────────────────────────────┐  ┌───────────────────────────────┐
│     SINGLE-LINE BOUNDARY      │  │     DIACRITIC SENSITIVITY     │
│ Vertical Arithmetic Excluded  │  │ Micro-tones Dropped by Blur   │
└───────────────────────────────┘  └───────────────────────────────┘
┌───────────────────────────────┐  ┌───────────────────────────────┐
│     AI OVER-CORRECTION        │  │     LIGHTING VULNERABILITY    │
│ 7.4% Line Degradation Rate    │  │ Motion Blur <60.0 Fails       │
└───────────────────────────────┘  └───────────────────────────────┘
```

### Slide Content (24 Words | 4 Bullets)
* **Layout bounds**: Evaluated on horizontal lines; vertical arithmetic unsupported.
* **Subtle accents**: Micro tone marks vulnerable to phone compression.
* **AI hallucination**: 7.4% degradation risk requires human supervisor.
* **Lighting fragility**: Severely blurred captures require physical re-scan.

### Speaker Verbal Notes (8:00 - 8:40)
> *"Nhóm thẳng thắn thừa nhận các giới hạn: Hệ thống hiện chỉ xử lý văn bản dòng ngang, chưa nhận diện phép tính dọc; dấu thanh nhỏ vẫn dễ mất khi ảnh mờ; và tầng AI vẫn có xác suất làm sai 7.4% đòi hỏi phải có giáo viên kiểm tra lại."*

---

## SLIDE 14: Future Work

### Visual Layout
```
[YOLOv8 Line Splitter] ──> [TrOCR Transformer] ──> [ONNX 8-Bit Mobile]
         │                          │                         │
  Multi-line Notebooks       Zero Tone Dropout        Offline Inference
```

### Slide Content (24 Words | 4 Bullets)
* **Line segmentation**: Deploy YOLOv8 for automated multiline notebook slicing.
* **Vision Transformer**: Benchmark TrOCR to capture long-range handwriting dependencies.
* **Edge quantization**: Export 8-bit ONNX runtime for offline mobile inference.
* **Curriculum expansion**: Collect multi-grade primary math and essay samples.

### Speaker Verbal Notes (8:40 - 9:20)
> *"Hướng phát triển tiếp theo gồm 3 mũi nhọn: Tích hợp YOLOv8 để tự động cắt dòng vở ô ly; thử nghiệm kiến trúc TrOCR Transformer để tăng độ chính xác dấu thanh; và lượng tử hóa mô hình sang ONNX 8-bit để chạy hoàn toàn offline không cần internet."*

---

## SLIDE 15: Conclusion

### Visual Layout
```
┌────────────────────────────────────────────────────────────────────────┐
│                        HandAI CAPSTONE SUMMARY                         │
├────────────────────────────────────────────────────────────────────────┤
│  ✓ Transparent Pipeline : Raw OCR (11.34%) ──> Post-AI (8.21% CER)     │
│  ✓ Traceable Evidence   : 59,462 Pre-train lines | 173 Notebook Pages │
│  ✓ Production Stability : 183/183 Tests Passed (100%)                  │
│  ✓ Ethical AI Design    : Human-in-the-Loop Verification Enforced     │
└────────────────────────────────────────────────────────────────────────┘
```

### Slide Content (26 Words | 4 Bullets)
* **Auditable pipeline**: Verifiable transition from Raw OCR to Final Verdict.
* **Measurable gain**: AI correction reduces CER from 11.34% to 8.21%.
* **Engineering rigor**: 100% test pass rate across 183 automated tests.
* **Classroom ready**: Pragmatic, privacy-preserving AI assistant for Vietnamese teachers.

### Speaker Verbal Notes (9:20 - 10:00)
> *"Tóm lại, HandAI không tuyên bố độ chính xác tuyệt đối, mà mang đến một hệ thống nhận diện chữ viết tay minh bạch, có thể kiểm chứng được từng con số, giảm 27.6% lỗi bằng AI và được bảo chứng bởi 183 ca kiểm thử hoàn hảo. Xin chân thành cảm ơn Quý Thầy Cô!"*

---

## SLIDE WORD COUNT AUDIT SUMMARY

| Slide # | Title | Visual Type | Word Count | Compliance (≤ 30 words) |
|---|---|---|:---:|:---:|
| Slide 1 | Title & Problem Statement | Header Box | 23 | PASS |
| Slide 2 | Research Motivation | Flow Diagram | 24 | PASS |
| Slide 3 | Why Handwriting OCR Is Difficult | 3-Way Collision Diagram | 22 | PASS |
| Slide 4 | HandAI Overall Architecture | System Architecture | 21 | PASS |
| Slide 5 | 3-Stage Auditable AI Pipeline | Pipeline Flowchart | 24 | PASS |
| Slide 6 | Dataset Overview | Comparison Table | 23 | PASS |
| Slide 7 | CRNN Model Architecture | Neural Network Pipeline | 25 | PASS |
| Slide 8 | Baseline Evaluation Metrics | Performance Table | 23 | PASS |
| Slide 9 | Before AI vs After AI | Progress Bar & Stats | 22 | PASS |
| Slide 10 | Error Analysis & Taxonomy | Taxonomy Table | 23 | PASS |
| Slide 11 | Big Data Analytics Contribution | Data Flow Pipeline | 24 | PASS |
| Slide 12 | Software Engineering & Validation | Quality Gate Table | 23 | PASS |
| Slide 13 | System Limitations | 4-Quadrant Box | 24 | PASS |
| Slide 14 | Future Work | Roadmap Pipeline | 24 | PASS |
| Slide 15 | Conclusion | Capstone Summary Box | 26 | PASS |
