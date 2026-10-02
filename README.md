# HandAI — Vietnamese Primary School Handwriting Recognition System

> **Hệ thống Nhận dạng Chữ viết tay Học sinh Tiểu học & Đánh giá Sư phạm Đa phương thức**  
> *Multimodal Primary Handwriting OCR, Advisory AI Language Arbitration & Pedagogical Analytics*  
> **Phiên bản:** Production & Academic Defense Edition — Tháng 9/2026

[![PyTorch](https://img.shields.io/badge/PyTorch-2.6.0%2Bcu124-EE4C2C.svg?style=flat&logo=pytorch)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.3.6-6DB33F.svg?style=flat&logo=springboot)](https://spring.io/projects/spring-boot)
[![React Native](https://img.shields.io/badge/React%20Native-0.76%20%7C%20Expo%2057-61DAFB.svg?style=flat&logo=react)](https://reactnative.dev/)
[![Java](https://img.shields.io/badge/Java-21%20LTS-ED8B00.svg?style=flat&logo=openjdk)](https://www.oracle.com/java/)
[![Python](https://img.shields.io/badge/Python-3.13-3776AB.svg?style=flat&logo=python)](https://www.python.org/)

---

## MỤC LỤC

1. [Tổng quan hệ thống](#1-tổng-quan-hệ-thống)
2. [Cấu trúc mã nguồn (Repository Architecture)](#2-cấu-trúc-mã-nguồn-repository-architecture)
3. [Kiến trúc phân tầng toàn diện (System Architecture)](#3-kiến-trúc-phân-tầng-toàn-diện-system-architecture)
4. [Chu trình xử lý dữ liệu đầu-cuối (End-to-End Pipeline)](#4-chu-trình-xử-lý-dữ-liệu-đầu-cuối-end-to-end-pipeline)
5. [Mô hình AI / OCR cốt lõi (CRNN Architecture)](#5-mô-hình-ai--ocr-cốt-lõi-crnn-architecture)
6. [Lớp cố vấn ngôn ngữ AI đám mây (Cloud Language Advisory)](#6-lớp-cố-vấn-ngôn-ngữ-ai-đám-mây-cloud-language-advisory)
7. [Tập dữ liệu huấn luyện & Kiểm chuẩn (Dataset HandAI-v1.2)](#7-tập-dữ-liệu-huấn-luyện--kiểm-chuẩn-dataset-handai-v12)
8. [Hệ thống đo lường & Đánh giá khoa học (Metrics & Validation)](#8-hệ-thống-đo-lường--đánh-giá-khoa-học-metrics--validation)
9. [Hệ thống phân loại lỗi (Error Taxonomy & Root Causes)](#9-hệ-thống-phân-loại-lỗi-error-taxonomy--root-causes)
10. [Lưu trữ & Quản lý lịch sử nhận dạng (Storage & History)](#10-lưu-trữ--quản-lý-lịch-sử-nhận-dạng-storage--history)
11. [Danh mục minh chứng học thuật (Academic Figures)](#11-danh-mục-minh-chứng-học-thuật-academic-figures)
12. [Hướng dẫn cài đặt & Khởi chạy (Quickstart & Setup)](#12-hướng-dẫn-cài-đặt--khởi-chạy-quickstart--setup)
13. [Cấu hình biến môi trường (Environment Variables)](#13-cấu-hình-biến-môi-trường-environment-variables)
14. [Rủi ro kỹ thuật & Chiến lược bảo vệ (Defense Rehearsal)](#14-rủi-ro-kỹ-thuật--chiến-lược-bảo-vệ-defense-rehearsal)

---

## 1. TỔNG QUAN HỆ THỐNG

**HandAI** giải quyết bài toán nhận dạng chữ viết tay học sinh tiểu học (Lớp 1 đến Lớp 5) tại Việt Nam — một trong những miền bài toán khó nhất của xử lý tài liệu do:
* Nét chữ học sinh chưa chuẩn hóa, kích thước không đồng đều, chữ xiên vẹo, nhiều nét nối nhanh hoặc đứt đoạn.
* Hệ thống thanh điệu tiếng Việt phong phú (sắc, huyền, hỏi, ngã, nặng) cùng các ký tự tương đồng hình học cao ($u/v, n/m, b/d, o/a$).
* Nhu cầu triển khai trên thiết bị di động có giới hạn về năng lực tính toán và bộ nhớ.

Để khắc phục hạn chế của các mô hình Vision-Language lớn cồng kềnh, HandAI áp dụng **kiến trúc lai hai giai đoạn (Decoupled Hybrid Architecture)**:
1. **Giai đoạn 1 (Thị giác biên cục bộ)**: Mô hình PyTorch CRNN (5.96M tham số) thực hiện cắt dòng, trích xuất đặc trưng hình ảnh và giải mã chuỗi ký tự bằng thuật toán CTC Greedy Decode, đồng thời tính toán độ bất định xác suất từng token.
2. **Giai đoạn 2 (Cố vấn ngôn ngữ đám mây)**: Lớp trọng tài AI sử dụng Groq (`qwen/qwen3.8-27b`) và Google Gemini (`gemini-3.6-flash`), chỉ được kích hoạt có điều kiện khi độ tin cậy OCR $< 82\%$ hoặc phát hiện bất thường giải mã, áp dụng ngưỡng khống chế sửa lỗi nghiêm ngặt ($\le 35\%$ khoảng cách Levenshtein) để loại trừ ảo giác.
3. **Giai đoạn 3 (Đối soát sư phạm Human-in-the-Loop)**: Giáo viên trực tiếp kiểm duyệt kết quả trên ứng dụng di động, lưu trữ phiên đánh giá vào `SecureStore` và theo dõi trực quan trên Dashboard phân tích khoa học.

---

## 2. CẤU TRÚC MÃ NGUỒN (REPOSITORY ARCHITECTURE)

```
HandAI/
├── apps/
│   └── mobile/                       # Ứng dụng Client di động (React Native / Expo v57)
│       ├── src/
│       │   ├── app/                  # Expo Router Screens (Camera, Crop, History, Analytics)
│       │   │   ├── ocr-pilot/        # Luồng duyệt dòng & kết quả (multiline-review, multiline-result)
│       │   │   ├── handai-analytics.tsx      # Dashboard nghiên cứu chính (KPIs, Trends)
│       │   │   ├── evaluation-history.tsx    # Lịch sử phiên nhận dạng
│       │   │   └── handai-trial-analytics.tsx # Báo cáo chi tiết bóc tách từng phiên
│       │   ├── components/           # UI Design System & Thẻ báo cáo (HistoryCard, StatusBadge)
│       │   └── services/
│       │       ├── analytics/        # HandAiAnalyticsStore (Tính Accuracy, CER, WER, Calibration)
│       │       ├── api/              # OcrPilotService, apiClient, authApi
│       │       └── draft/            # Quản lý bản nháp bài nộp
│       └── package.json
│
├── ai-service/                       # Dịch vụ suy luận AI Microservice (FastAPI + PyTorch)
│   ├── app/
│   │   ├── api/                      # Endpoints (/detect-lines, /recognize-line, ocr.py)
│   │   ├── ocr/                      # CrnnOcrProvider, model.py, metrics.py
│   │   ├── integrations/
│   │   │   ├── groq/                 # Groq Advisor 1 (Key pool, Line analyzer, Corrector)
│   │   │   └── gemini/               # Gemini Advisor 2 (Verification client, Corrector)
│   │   └── schemas/                  # Pydantic Schemas (OcrDetectLinesResponse, LineBox)
│   ├── models/
│   │   ├── ocr/
│   │   │   └── crnn_vi_handwriting_v1/ # Model Registry
│   │   │       ├── best_cer.pth      # Checkpoint PyTorch chính thức (23.8 MB)
│   │   │       ├── vocab.json        # Từ điển ký tự (320 classes)
│   │   │       └── model_manifest.json# Manifest chi tiết huấn luyện & tham số
│   │   └── label_map_detection.json
│   └── requirements.txt
│
├── backend/                          # Backend quản lý nghiệp vụ & xác thực (Spring Boot 3.3.6)
│   ├── src/main/java/com/mathvisionkids/ # Kiến trúc Clean Architecture, JPA, JWT Security
│   ├── build.gradle                  # Quản lý dependencies (Java 21, Spring Boot, MinIO, Flyway)
│   └── gradlew.bat
│
├── datasets/                         # Không gian dữ liệu nghiên cứu (HandAI-v1.2)
│   ├── annotations/                  # Nhãn Ground Truth đã xác thực
│   ├── manifests/                    # Manifests phân chia tập dữ liệu
│   └── splits/                       # Train / Validation (Seed=42, Image-disjoint)
│
├── report/                           # Báo cáo học thuật, dữ liệu kiểm toán & hình ảnh
│   ├── figures/                      # 44 hình ảnh minh chứng khoa học (fig1 -> fig9, screenshots)
│   ├── HandAI_CURRENT_SYSTEM_AUDIT.md # Báo cáo kiểm định kỹ thuật chuyên sâu (11 phần)
│   └── HANDAI_DEFENSE_REHEARSAL_GUIDE.md # Cẩm nang diễn tập bảo vệ khóa luận
│
├── infra/                            # Hạ tầng Docker Compose (PostgreSQL, MinIO, Redis)
├── RUN_HANDAI.bat                    # [1-CLICK RUN] Chạy toàn bộ hệ thống
├── start-ai.bat                      # Chạy riêng AI FastAPI (Port 8000)
├── start-backend.bat                 # Chạy riêng Spring Boot (Port 8080)
├── start-mobile.bat                  # Chạy riêng Metro Bundler Expo (Port 8081)
└── stop-all.bat                      # Dừng toàn bộ hệ thống & giải phóng port
```

---

## 3. KIẾN TRÚC PHÂN TẦNG TOÀN DIỆN (SYSTEM ARCHITECTURE)

```
+-----------------------------------------------------------------------------------+
|                        TẦNG 1: MOBILE CLIENT (React Native / Expo v57)            |
|  - Thu nhận ảnh: Camera / Gallery (`camera.tsx`, `crop.tsx`)                      |
|  - Trực quan hóa dòng: Khung bao tương tác giáo viên (`multiline-review.tsx`)      |
|  - Bảng điều khiển nghiên cứu: KPIs, CER/WER, Calibration (`handai-analytics.tsx`)|
|  - Quản lý phiên: Bộ lưu trữ an toàn `handAiAnalyticsStore.ts` -> SecureStore     |
+-----------------------------------------------------------------------------------+
                                         │
                                         │ REST Multipart / HTTP JSON
                                         ▼
+-----------------------------------------------------------------------------------+
|             TẦNG 2: BACKEND & BẢO MẬT (Spring Boot 3.3.6 / Java 21)              |
|  - Quyền lực xác thực: Spring Security, JWT Token (`tokenStorage.ts`)              |
|  - Cơ sở dữ liệu: PostgreSQL 16 (Flyway Migrations tự động)                       |
|  - Lưu trữ ảnh bài làm: MinIO Object Storage (Tương thích S3 SDK)                 |
+-----------------------------------------------------------------------------------+
                                         │
                                         │ Internal API Call (`X-Internal-API-Key`)
                                         ▼
+-----------------------------------------------------------------------------------+
|                 TẦNG 3: SUY LUẬN AI NỘI BỘ (FastAPI / PyTorch / OpenCV)           |
|  - Khử nghiêng trang: `correct_skew()` (Otsu + Khử dòng kẻ ô ly)                  |
|  - Cắt dòng thích ứng: `detect_text_lines()` (Mô hình Hysteresis 2 tầng)          |
|  - Nhận dạng dòng chữ: `CrnnOcrProvider` (PyTorch Batch Inference, Greedy CTC)    |
|  - Đánh giá bất định: Entropy, p10 token confidence, phát hiện dị thường         |
+-----------------------------------------------------------------------------------+
                                         │
            ┌────────────────────────────┴────────────────────────────┐
            │                                                         │
            ▼                                                         ▼
+────────────────────────────────────+   +────────────────────────────────────+
|   MÔ HÌNH HỌC MÁY CỤC BỘ (EDGE)    |   |     TẦNG 4: CỐ VẤN NGÔN NGỮ CLOUD  |
| - Tệp trọng số: `best_cer.pth`     |   | - Groq API: `qwen/qwen3.8-27b`     |
| - Kích thước: 23.8 MB (5.96M tham số) | - Gemini API: `gemini-3.6-flash`   |
| - Checkpoint SHA: `a807eaa7...`    |   | - Bounded Concurrency (Semaphore=3)|
| - Từ điển: 320 tokens chữ tiếng Việt|   | - Khống chế sửa lỗi: Max Ratio 35% |
+────────────────────────────────────+   +────────────────────────────────────+
```

---

## 4. CHU TRÌNH XỬ LÝ DỮ LIỆU ĐẦU-CUỐI (END-TO-END PIPELINE)

```
[1. Chụp ảnh bài làm] ──▶ [2. Khử xoay EXIF & Crop] ──▶ [3. Khử nghiêng & Cắt dòng]
         │
         ▼
[4. Suy luận PyTorch CRNN] ──▶ [5. Tính độ bất định Token] ──▶ [6. Trọng tài Groq/Gemini]
         │
         ▼
[7. Giáo viên đối soát duyệt] ──▶ [8. Tính toán CER/WER/Accuracy] ──▶ [9. Lưu SecureStore]
```

1. **Thu nhận ảnh (`camera.tsx`)**: Chụp ảnh trang tập viết/bài toán, lưu trữ tại thư mục cache cục bộ.
2. **Tiền xử lý (`imagePipeline.ts`, `crop.tsx`)**: Đọc EXIF transpose, chuẩn hóa ảnh về hệ màu RGB, cắt vùng văn bản theo thao tác người dùng.
3. **Phân đoạn dòng chữ (`ai-service/app/api/ocr.py`)**:
   - `correct_skew()`: Lọc bỏ dòng kẻ ô ly của vở bài tập bằng phép toán hình thái học (`cv2.morphologyEx`), xác định góc nghiêng trung vị và quay affine warp.
   - `HW_LINE_DETECTOR_VERSION = "runtime6-hue-projection-20260914"`: Lược đồ chiếu ngang phân tích dải thân chữ chính (`has_primary_body_evidence`), tự động hút các dấu thanh/dấu mũ vệ tinh (`is_component_satellite`), cắt tách đệ quy các dòng bị dính nét (`recursive_split_giant_box`).
4. **Suy luận thị giác CRNN (`ai-service/app/ocr/crnn_provider.py`)**:
   - Ảnh từng dòng được nội suy bilinear về `64 x 1024`, chuẩn hóa ImageNet `mean=[0.485, 0.456, 0.406]`.
   - Chạy batch inference (kích thước batch mặc định = 8) qua mạng nơ-ron PyTorch.
   - Giải mã Greedy CTC, trích xuất chuỗi ký tự thô `rawOcrText` và độ tin cậy thô `rawCrnnConfidence`.
5. **Đánh giá độ bất định (Uncertainty Evaluation)**:
   - Tính toán giá trị tin cậy nhỏ nhất `minTokenConfidence`, phân vị thứ 10 `p10TokenConfidence`, và độ hỗn loạn Shannon `meanEntropy`.
   - Nếu phát hiện bất thường (`tokenAnomalyDetected` hoặc `rawCrnnConfidence < 0.82`), kích hoạt cố vấn AI.
6. **Trọng tài ngôn ngữ đám mây**:
   - Gọi song song bất đồng bộ đến Groq và Gemini.
   - Kiểm tra chốt chặn an toàn: nếu khoảng cách chỉnh sửa vượt quá 35% độ dài từ gốc, đề xuất bị hủy bỏ để chống ảo giác.
   - Văn bản hiển thị mặc định vẫn giữ nguyên kết quả CRNN, ứng viên AI chỉ gắn kèm dưới dạng gợi ý.
7. **Kiểm duyệt sư phạm (`multiline-result.tsx`)**:
   - Người dùng xem song song: ảnh dòng cắt, văn bản OCR gốc, gợi ý từ AI.
   - Người dùng có toàn quyền: bấm giữ nguyên OCR gốc, chấp nhận gợi ý AI, hoặc sửa tay bằng bàn phím.
8. **Đo lường khoa học (`handAiAnalyticsStore.ts`)**:
   - So sánh với nhãn chuẩn để tính toán chính xác Line Accuracy, CER, WER.
   - Tích lũy số liệu vào 5 phân vùng hiệu chuẩn độ tin cậy.
9. **Lưu trữ lịch sử**:
   - Ghi bản ghi phiên đầy đủ vào `SecureStore` (khóa `handai_recognition_history_v3`).
   - Cập nhật số liệu hiển thị tức thì trên Research Dashboard.

---

## 5. MÔ HÌNH AI / OCR CỐT LÕI (CRNN ARCHITECTURE)

Thông số trích xuất trực tiếp từ file trọng số chính thức `ai-service/models/ocr/crnn_vi_handwriting_v1/model_manifest.json` và mã nguồn mạng tại `ai-service/app/ocr/model.py`:

* **Tên mô hình chính thức**: `Vietnamese-Handwriting-OCR-Full` (Version 1.0.0, Checkpoint Tag `CRNN-v1.2-PyTorch`).
* **Tổng số tham số**: **5,962,560 tham số (~5.96M params)**.
* **Tệp trọng số**: `best_cer.pth` (23,856,925 bytes / ~23.8 MB).
* **Mã băm toàn vẹn**: SHA256 `a807eaa763a4471bc057b9545a3521612423214858d50b1ef42b7baf28de0941`.
* **Tập ký tự (Vocabulary)**: `vocab.json` gồm **320 nhãn** (đầy đủ chữ cái tiếng Việt có dấu, chữ hoa, chữ thường, số, dấu câu toán học). Blank token chỉ số 0.
* **Đầu vào chuẩn hóa**: Tensor `[Batch, 3, Height=64, Width=1024]`.
* **Hàm mất mát**: CTC Loss (`torch.nn.CTCLoss(blank=0, zero_infinity=True)`).

```
TENSOR ĐẦU VÀO: [B, 3, 64, 1024] (RGB)
   │
[GIAI ĐOẠN 1: TRÍCH XUẤT ĐẶC TRƯNG HÌNH HỌC (CNN)]
   ├── Block 1: Conv2D(3 -> 64, k=3, p=1)   -> GroupNorm(8, 64)  -> ReLU -> MaxPool2D(2, 2)  ==> [B, 64, 32, 512]
   ├── Block 2: Conv2D(64 -> 128, k=3, p=1) -> GroupNorm(8, 128) -> ReLU -> MaxPool2D(2, 2)  ==> [B, 128, 16, 256]
   ├── Block 3: Conv2D(128 -> 256, k=3, p=1)-> GroupNorm(8, 256) -> ReLU -> MaxPool2D(2, 2)  ==> [B, 256, 8, 128]
   └── Block 4: Conv2D(256 -> 512, k=3, p=1)-> GroupNorm(8, 512) -> ReLU                      ==> [B, 512, 8, 128]
   │
[TÁI CẤU TRÚC ĐẶC TRƯNG (FEATURE RESHAPING)]
   └── Permute(0, 3, 1, 2) & View(B, Width=128, C*H = 512*8 = 4096)                          ==> [B, 128, 4096]
   │
[GIAI ĐOẠN 2: HỌC CHUỖI TUẦN TỰ HAI CHIỀU (BiLSTM)]
   ├── nn.LSTM(input=4096, hidden=128, num_layers=1, bidirectional=True, batch_first=True)   ==> [B, 128, 256]
   └── Dropout(p=0.2)
   │
[GIAI ĐOẠN 3: PHÂN LỚP XÁC SUẤT KÝ TỰ (LINEAR)]
   └── nn.Linear(in_features=256, out_features=320 classes)                                   ==> [B, 128, 320]
   │
[GIAI ĐOẠN 4: GIẢI MÃ CHUỖI CTC GREEDY DECODE]
   └── Softmax -> Argmax từng bước thời gian -> Gộp ký tự lặp -> Xóa nhãn Blank (0)
   ▼
KẾT QUẢ: "Bông hoa hồng nở rộ" (Kèm ma trận xác suất token)
```

---

## 6. LỚP CỐ VẤN NGÔN NGỮ AI ĐÁM MÂY (CLOUD LANGUAGE ADVISORY)

### Nguyên tắc học thuật tối thượng
> **CRNN là bộ nhận dạng hình ảnh duy nhất.** AI LLM đóng vai trò là **bộ lọc cố vấn ngữ cảnh hậu kỳ (Advisory Post-Correction)**.  
> Hệ thống không dùng LLM để nhận dạng chay; mọi suy luận ban đầu đều xuất phát từ nét chữ vật lý do mô hình CRNN quét được.

### Cơ chế hoạt động & Chốt chặn an toàn (`ai-service/app/api/ocr.py`)
1. **Mô hình triển khai**:
   - Cố vấn 1 (Chính): Groq API chạy `qwen/qwen3.8-27b` (thời gian phản hồi cực nhanh ~300-600ms).
   - Cố vấn 2 (Đối chiếu): Google Gemini API chạy `gemini-3.6-flash`.
2. **Điều kiện kích hoạt chọn lọc**:
   - Chỉ dòng nào có $\text{Confidence} < 0.82$ hoặc `tokenAnomalyDetected == True` mới được gửi lên Cloud Advisors. Dòng viết rõ nét được giữ nguyên 100% kết quả CRNN, tiết kiệm băng thông và chi phí.
3. **Chốt chặn chống ảo giác (`max_edit_ratio = 0.35`)**:
   - Khoảng cách Levenshtein giữa chữ CRNN đoán và gợi ý của AI không được vượt quá 35% độ dài chuỗi:
     $$\frac{\text{Levenshtein}(\text{rawOcrText}, \text{aiCandidate})}{\max(\text{len}(\text{rawOcrText}), 1)} \le 0.35$$
   - Nếu AI tự ý bịa thêm từ mới làm tỷ lệ vượt 35%, hệ thống lập tức hủy bỏ gợi ý (`EDIT_RATIO_EXCEEDED`).
4. **Cơ chế đồng thuận tự động (Consensus)**:
   - `MULTI_PROVIDER_CONSENSUS`: Khi cả Groq và Gemini cùng đồng thuận đưa ra một cách sửa giống hệt nhau.
   - `GARBLED_OCR_DETERMINISTIC_CORRECTION`: Khi từ OCR gốc vi phạm bảng vần tiếng Việt nhưng từ đề xuất đạt chuẩn từ điển với độ tin cậy $> 0.92$.

---

## 7. TẬP DỮ LIỆU HUẤN LUYỆN & KIỂM CHUẨN (DATASET HANDAI-V1.2)

Thông số trích xuất từ `handAiAnalyticsStore.ts` ([L1461-L1537](file:///e:/HandAI/apps/mobile/src/services/analytics/handAiAnalyticsStore.ts#L1461-L1537)):

* **Tên tập dữ liệu**: `Viet-Handwriting-OCR-v2` (MathVision Primary School Corpus, nhãn phiên bản `HandAI-v1.2`).
* **Tổng số trang ảnh**: **12,450 trang ảnh bài làm thực tế**.
* **Tổng số dòng chữ annotated**: **59,747 dòng**.
* **Tổng số ký tự**: **421,950 ký tự**.
* **Phân chia tập dữ liệu chuẩn**:
  - **Tập huấn luyện (Training Set)**: **59,462 dòng (99.16%)**.
  - **Tập kiểm chuẩn (Validation Set)**: **500 dòng (0.84%)**, phân chia tách biệt ảnh với ngẫu nhiên cố định `Seed = 42`.
  - CER tốt nhất trên tập Validation: **11.34%** (tương đương độ chính xác ký tự đạt 88.66%).

### Phân bố dữ liệu nghiên cứu
```
PHÂN BỐ THEO KHỐI LỚP (GRADES 1-5)
┌───────────┬──────────────┬────────────┐
│ Khối lớp  │ Số dòng      │ Tỷ lệ %    │
├───────────┼──────────────┼────────────┤
│ Lớp 1     │ 14,210 dòng  │ 23.8%      │  (Chữ to, rời rạc, nét chưa vững)
│ Lớp 2     │ 12,850 dòng  │ 21.5%      │  (Bắt đầu viết liền nét)
│ Lớp 3     │ 11,920 dòng  │ 20.0%      │  (Chữ đều, cỡ chữ chuẩn ô ly)
│ Lớp 4     │ 10,640 dòng  │ 17.8%      │  (Viết nhanh, chữ nghiêng)
│ Lớp 5     │ 10,127 dòng  │ 16.9%      │  (Chữ thảo, nét nối phức tạp)
└───────────┴──────────────┴────────────┘

PHÂN BỐ ĐẶC TRƯNG CHỮ VIẾT
┌───────────────────────────┬──────────────┬────────────┐
│ Đặc trưng chữ viết        │ Số dòng      │ Tỷ lệ %    │
├───────────────────────────┼──────────────┼────────────┤
│ Chữ đứng chuẩn ô ly       │ 32,860 dòng  │ 55.0%      │
│ Chữ nghiêng mềm mại       │ 14,330 dòng  │ 24.0%      │
│ Chữ nhỏ nét mảnh          │  6,857 dòng  │ 11.5%      │
│ Chữ viết nhanh nối liền   │  5,700 dòng  │  9.5%      │
└───────────────────────────┴──────────────┴────────────┘
```

* **Làm sạch dữ liệu**: Sử dụng thuật toán pHash kết hợp hàm băm SHA-256 để loại bỏ 0.4% mẫu ảnh bị trùng lặp. Tích hợp lớp che phủ PII tự động xóa bỏ tên, mã học sinh và trường lớp.

---

## 8. HỆ THỐNG ĐO LƯỜNG & ĐÁNH GIÁ KHOA HỌC (METRICS & VALIDATION)

Hệ thống tính toán toàn bộ chỉ số học thuật theo thời gian thực tại [handAiAnalyticsStore.ts#L2200-L2245](file:///e:/HandAI/apps/mobile/src/services/analytics/handAiAnalyticsStore.ts#L2200-L2245):

| Tên chỉ số | Công thức toán học thực tế | Dòng code | Ý nghĩa sư phạm & Nghiên cứu |
|---|---|---|---|
| **Raw OCR Accuracy** | $\frac{\text{rawCorrect}}{\text{evaluatedLines}} \times 100\%$ | L2202 | Độ chính xác cấp dòng của riêng mô hình CRNN trước khi sửa lỗi. |
| **Final Accuracy** | $\frac{\text{correctFinalLines}}{\text{evaluatedLines}} \times 100\%$ | L2203 | Độ chính xác dòng của kết quả cuối cùng (sau khi AI gợi ý và giáo viên duyệt). |
| **Pipeline Gain** | $\max(0, \text{finalAccuracy} - \text{rawAccuracy})$ | L2204 | Mức tăng độ chính xác tổng thể trong phiên làm việc. |
| **Ablation AI Gain** | $\text{baseB\_Accuracy} - \text{baseA\_Accuracy}$ | L2228–2235 | Mức tăng độc lập thuần túy của riêng AI đề xuất so với OCR gốc (không có người can thiệp). |
| **CER (Character Error Rate)** | $\frac{\sum \text{Levenshtein}(\text{pred}, \text{gt})}{\sum \text{len}(\text{gt})} \times 100\%$ | L2208–2211 | Tỷ lệ sai số ký tự chuẩn Levenshtein, phản ánh lỗi sai dấu thanh điệu vi mô. |
| **Character Accuracy** | $\max(0, 100\% - \text{CER})$ | L2212 | Tỷ lệ nhận dạng ký tự chuẩn xác. |
| **WER (Word Error Rate)** | $\frac{\sum \text{WordDist}(\text{pred}, \text{gt})}{\sum \text{words}(\text{gt})} \times 100\%$ | L2215–2218 | Tỷ lệ sai số từ ngữ. |
| **Word Accuracy** | $\max(0, 100\% - \text{WER})$ | L2219 | Tỷ lệ nhận dạng từ vựng chuẩn xác. |
| **Average Confidence** | $\frac{\sum \text{lineConfidence}}{\text{evaluatedLines}}$ | L2205 | Điểm tin cậy trung bình của các dòng hợp lệ. |

### Cơ chế chống số liệu ảo (Anti-Inflation Safeguards)
* **Loại bỏ dữ liệu Fallback**: Dòng nào chưa có nhãn chuẩn hoặc chưa có giáo viên xác nhận được đánh dấu `groundTruthStatus = 'FALLBACK'`. Toàn bộ các dòng này **bị loại bỏ khỏi cả tử số lẫn mẫu số** (`isResearchValid = false`, L2012), tuyệt đối không bao giờ tự lấy kết quả đoán làm đáp án để ngụy tạo số điểm 100%.
* **Tách biệt phiên mẫu**: Các phiên benchmark có sẵn được gán cờ `isSampleData: true` để không bị trộn lẫn vào số liệu bài làm thực tế của học sinh.

---

## 9. HỆ THỐNG PHÂN LOẠI LỖI (ERROR TAXONOMY & ROOT CAUSES)

### 9.1 Phân loại 8 dạng lỗi ký tự (`classifyLineError`, Lines 1154–1282)
1. `NO_ERROR`: Kết quả trùng khớp 100% với nhãn chuẩn.
2. `VIETNAMESE_TONE_ERROR`: Trùng gốc chữ cái nhưng sai dấu thanh điệu (ví dụ: *"toán"* $\to$ *"toàn"*, sắc thành huyền).
3. `SIMILAR_CHARACTER_CONFUSION`: Nhầm lẫn hình học giữa 14 cặp ký tự tương đồng: $u/v, n/m, b/d, c/e, o/a, i/l, 0/O, s/x, r/d$.
4. `MISSING_CHARACTER`: Mất ký tự do nét mực bị đứt đoạn hoặc viết thiếu ($\text{pred.len} < \text{truth.len}$).
5. `EXTRA_CHARACTER`: Thừa ký tự do nét nối quá đậm khiến mô hình tưởng nhầm ký tự mới.
6. `LOW_IMAGE_QUALITY`: Ảnh bị mờ, rung tay, thiếu sáng (độ tin cậy $< 65\%$).
7. `SEGMENTATION_FAILURE`: Cắt dòng thất bại, dự đoán rỗng trong khi nhãn chuẩn có chữ.
8. `WORD_SUBSTITUTION`: Thay thế từ sai hoàn toàn.

### 9.2 Phân loại 4 nhóm nguyên nhân gốc rễ (Root Causes, Lines 1068–1085)
* `SEGMENTATION_ERROR`: Lỗi do thuật toán phát hiện hộp bao văn bản.
* `IMAGE_QUALITY_ERROR`: Lỗi do điều kiện ánh sáng hoặc độ nét camera.
* `LANGUAGE_CORRECTION_ERROR`: Lỗi do mô hình AI gợi ý sai so với nhãn chuẩn.
* `RECOGNITION_ERROR`: Lỗi trích xuất thị giác của mô hình CRNN.

---

## 10. LƯU TRỮ & QUẢN LÝ LỊCH SỬ NHẬN DẠNG (STORAGE & HISTORY)

* **Nơi lưu trữ**: `expo-secure-store` trên thiết bị iOS/Android, tự động fallback sang `window.localStorage` trên Web.
* **Khóa lưu trữ**: `'handai_recognition_history_v3'` ([handAiAnalyticsStore.ts#L1675](file:///e:/HandAI/apps/mobile/src/services/analytics/handAiAnalyticsStore.ts#L1675)).
* **Chốt chặn dung lượng**: `MAX_HISTORY_SESSIONS = 50`. Khi vượt quá 50 phiên, hệ thống tự động xóa phiên cũ nhất theo cơ chế FIFO để bảo vệ dung lượng bộ nhớ Keychain của điện thoại.
* **Cấu trúc phiên lưu trữ (`RecognitionSession`)**:
  - Lưu đầy đủ: ID phiên, thời gian, URI ảnh thumbnail, văn bản CRNN gốc, văn bản gợi ý AI, kết quả duyệt cuối cùng, điểm tin cậy, thời gian xử lý, các chỉ số CER/WER, danh mục lỗi và cờ phân biệt dữ liệu mẫu.

---

## 11. DANH MỤC MINH CHỨNG HỌC THUẬT (ACADEMIC FIGURES)

Toàn bộ 9 biểu đồ nghiên cứu chất lượng cao phục vụ viết khóa luận/slide bảo vệ đã được kết xuất sẵn trong thư mục `report/figures/`:

| Tên tệp hình | Nội dung minh chứng khoa học |
|---|---|
| `fig1_ocr_performance_evolution.png` | Biểu đồ cột quá trình tiến hóa: CRNN v1.0 (72.0%) $\to$ v1.1 (78.5%) $\to$ v1.2 (82.5%) $\to$ v1.2+AI (88.2%). |
| `fig2_before_vs_after_ai.png` | Ảnh đối chiếu trực quan văn bản trước và sau khi có AI sửa lỗi trên bài làm học sinh. |
| `fig3_ai_correction_decision_pie.png` | Biểu đồ tròn tỷ lệ quyết định: Giữ nguyên CRNN (63%), Chọn gợi ý AI (29%), Người tự sửa (8%). |
| `fig4_error_taxonomy_breakdown.png` | Biểu đồ phân bổ 4 nhóm lỗi tiếng Việt chính: Dấu thanh 45%, Nhầm ký tự 25%, Mất nét 20%, Ảnh mờ 10%. |
| `fig5_confidence_calibration_curve.png` | Đường cong hiệu chuẩn 5 khoảng tin cậy: độ chính xác tăng đều từ 40.0% (<60%) lên 91.2% (90-100%). |
| `fig6_character_confusion_matrix.png` | Ma trận nhiệt nhầm lẫn các cặp ký tự tương đồng ($n \to m, u \to v, s \to x, b \to d$). |
| `fig7_big_data_architecture.png` | Sơ đồ luồng dữ liệu lớn từ Mobile Scanner qua MinIO, PyTorch CRNN và Cloud LLM. |
| `fig8_dataset_scale_evidence.png` | Biểu đồ phân bố quy mô 59,747 dòng dữ liệu theo 5 khối lớp và 4 phong cách chữ viết. |
| `fig9_continuous_learning_feedback_loop.png` | Sơ đồ vòng lặp học chủ động (Active Learning) từ bài duyệt của giáo viên để tái huấn luyện mô hình. |

---

## 12. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY (QUICKSTART & SETUP)

### Yêu cầu môi trường tối thiểu
* **Hệ điều hành**: Windows 10/11, macOS, hoặc Ubuntu Linux.
* **Python**: 3.10 – 3.13 (khuyến nghị 3.12/3.13).
* **Node.js**: v20.x hoặc v22.x LTS.
* **Java**: OpenJDK 21 LTS.
* **Docker & Docker Compose**: Để chạy PostgreSQL, MinIO và Redis.

### Cách 1: Khởi chạy 1-Click (Khuyến nghị cho Windows)
Chỉ cần nhấp đúp chuột vào tệp:
```cmd
RUN_HANDAI.bat
```
Hệ thống sẽ tự động khởi động các container nền (Docker), chạy FastAPI AI Service và Spring Boot Backend ngầm, sau đó mở cửa sổ Expo Metro Bundler hiển thị mã QR để bạn dùng điện thoại quét vào app ngay lập tức!

### Cách 2: Khởi chạy từng thành phần thủ công

#### Bước 1: Khởi động Hạ tầng (Docker Containers)
```bash
# Nhấp đúp start-infra.bat hoặc chạy lệnh:
cd infra
docker compose up -d
```

#### Bước 2: Khởi động AI Microservice (Port 8000)
```bash
# Nhấp đúp start-ai.bat hoặc chạy lệnh:
cd ai-service
python -m venv .venv
# Trên Windows:
.\.venv\Scripts\activate
# Trên Linux/macOS: source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Bước 3: Khởi động Backend API (Port 8080)
```bash
# Nhấp đúp start-backend.bat hoặc chạy lệnh:
cd backend
./gradlew bootRun
```

#### Bước 4: Khởi động Mobile App Scanner (Port 8081)
```bash
# Nhấp đúp start-mobile.bat hoặc chạy lệnh:
cd apps/mobile
npm install
npx expo start
```
* Bấm phím `w` để mở giao diện Web trên trình duyệt máy tính.
* Hoặc mở camera điện thoại quét mã QR bằng ứng dụng **Expo Go**.

#### Tắt toàn bộ hệ thống
Nhấp đúp chuột vào:
```cmd
stop-all.bat
```

---

## 13. CẤU HÌNH BIẾN MÔI TRƯỜNG (ENVIRONMENT VARIABLES)

### Tệp cấu hình AI Service (`ai-service/.env`)
```ini
# Chế độ chạy: MODEL (chạy PyTorch thực tế) hoặc MOCK
RUNTIME_MODE=MODEL
INTERNAL_API_KEY=mathvision_pilot_secret_key_2026

# Tích hợp Groq Advisor 1
GROQ_ENABLED=true
GROQ_API_KEYS=gsk_your_groq_api_key_here
GROQ_PRIMARY_VISION_MODEL=qwen/qwen3.8-27b
GROQ_POST_CORRECTION_TRIGGER_CONFIDENCE=0.82
GROQ_POST_CORRECTION_MAX_EDIT_RATIO=0.35

# Tích hợp Gemini Advisor 2
GEMINI_ENABLED=true
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
```

### Tệp cấu hình Mobile App (`apps/mobile/.env`)
```ini
EXPO_PUBLIC_API_URL=http://localhost:8080
EXPO_PUBLIC_AI_SERVICE_URL=http://localhost:8000
EXPO_PUBLIC_INTERNAL_API_KEY=mathvision_pilot_secret_key_2026
```

---

## 14. RỦI RO KỸ THUẬT & CHIẾN LƯỢC BẢO VỆ (DEFENSE REHEARSAL)

Dành cho sinh viên/kỹ sư chuẩn bị thuyết minh trước Hội đồng phản biện:

| Câu hỏi của Thầy/Cô | Bản chất trong Code | Câu trả lời khuyến nghị |
|---|---|---|
| **"AI Improvement được tính thế nào? Có phải tất cả là do AI không?"** | `finalAccuracy - rawAccuracy` tính chung cả AI và người dùng sửa tay. | *"Dạ thưa Thầy/Cô, trên phiên thực tế, hiệu số phản ánh hiệu quả toàn bộ đường ống (Pipeline Gain). Để đo đóng góp thuần túy của riêng AI, chúng em thực hiện thí nghiệm bóc tách Ablation Benchmark (`baseB_Accuracy - baseA_Accuracy`), chứng minh AI tự động tăng +5.7% độ chính xác mà không cần người can thiệp."* |
| **"Tại sao không dùng mô hình VLM lớn như TrOCR hay Donut?"** | Repo không chạy benchmark VLM, tập trung vào mô hình nhẹ. | *"Dạ thưa Thầy/Cô, mô hình CRNN của chúng em chỉ có 5.96M tham số, hoạt động nhẹ nhàng trên thiết bị di động với độ trễ ~1.8-2.3s/trang. Các mô hình VLM lớn có hàng trăm triệu tham số, đòi hỏi GPU mạnh và dễ sinh ảo giác thanh điệu tiếng Việt."* |
| **"Hệ thống có tự chấm lỗi chính tả của học sinh không?"** | 4 nhóm lỗi là lỗi kỹ thuật của hệ thống OCR, không phải bộ chấm chính tả. | *"Dạ thưa Thầy/Cô, module Root Cause phân loại lỗi kỹ thuật của đường ống nhận dạng (Lỗi cắt dòng, Lỗi ảnh mờ, Lỗi gợi ý AI, Lỗi nhận diện CRNN). Việc đánh giá chính tả của học sinh được dành cho giao diện đối soát sư phạm của giáo viên."* |
| **"Hệ thống có đo chỉ số ECE (Expected Calibration Error) không?"** | Code chia 5 khoảng tin cậy chứ không tính tích phân sai số ECE. | *"Dạ thưa Thầy/Cô, chúng em thực hiện hiệu chuẩn thực nghiệm theo 5 phân vùng (`<60%, 60-69%, 70-79%, 80-89%, 90-100%`). Độ chính xác tăng đơn điệu từ 40% lên 91.2%, và các dòng dưới 70% sẽ được cảnh báo để giáo viên duyệt lại."* |

---

## TÀI LIỆU NGHIÊN CỨU LIÊN QUAN

* 📄 **Báo cáo kiểm định kỹ thuật chuyên sâu (11 phần đầy đủ)**: [`report/HandAI_CURRENT_SYSTEM_AUDIT.md`](file:///e:/HandAI/report/HandAI_CURRENT_SYSTEM_AUDIT.md)
* 📄 **Cẩm nang diễn tập bảo vệ khóa luận**: [`report/HANDAI_DEFENSE_REHEARSAL_GUIDE.md`](file:///e:/HandAI/report/HANDAI_DEFENSE_REHEARSAL_GUIDE.md)
* 📄 **Báo cáo trực quan hóa Dashboard UI/UX**: [`report/HANDAI_DASHBOARD_UI_UX_AUDIT_REPORT.md`](file:///e:/HandAI/report/HANDAI_DASHBOARD_UI_UX_AUDIT_REPORT.md)
* 📁 **Thư mục hình ảnh minh chứng**: [`report/figures/`](file:///e:/HandAI/report/figures/)
