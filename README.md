# HandAI — Vietnamese Primary School Handwriting Recognition System

> **Standalone Research & Production Repository**  
> Chuyên biệt nhận diện chữ viết tay học sinh tiểu học (Lớp 1-5) với kiến trúc CRNN + CTC, LLM hậu kiểm (Groq/Gemini), và hệ thống đo lường CER/WER.

---

## 1. Cấu trúc thư mục (Repository Structure)

```
HandAI/
├── apps/
│   └── mobile/              # Ứng dụng Mobile Scanner (React Native / Expo 57)
├── backend/                 # Backend Business API (Spring Boot 3.3.4, Java 21)
├── ai-service/              # AI Microservice (FastAPI Python 3.13 + PyTorch CRNN)
├── datasets/                # Dữ liệu mẫu, splits, manifests (HandAI-v1.2)
├── docs/                    # 13 tài liệu kỹ thuật & kiến trúc chi tiết
├── infra/                   # Docker Compose (PostgreSQL, MinIO, Redis)
│
├── RUN_HANDAI.bat           # [NÚT CHẠY 1-CLICK] Chạy toàn bộ hệ thống
├── start-ai.bat             # Nút chạy riêng AI Microservice (Port 8000)
├── start-backend.bat        # Nút chạy riêng Backend API (Port 8080)
├── start-mobile.bat         # Nút chạy riêng Mobile App (Expo Metro)
├── start-infra.bat          # Nút bật Docker Containers
└── stop-all.bat             # Nút dừng toàn bộ dịch vụ
```

---

## 2. Hướng dẫn chạy nhanh ("Nút bấm chạy nhanh")

### Cách 1: Chạy toàn bộ hệ thống bằng 1 click
Nhấp đúp chuột vào file:
```cmd
RUN_HANDAI.bat
```
Script sẽ tự động:
1. Khởi động Docker containers: PostgreSQL (5432), MinIO (9000), Redis (6379).
2. Tạo bucket `ocr-trials` trên MinIO.
3. Mở cửa sổ chạy **FastAPI AI Microservice** (`http://127.0.0.1:8000`).
4. Mở cửa sổ chạy **Spring Boot Backend** (`http://127.0.0.1:8080`).
5. Mở cửa sổ chạy **Expo Metro Bundler** cho ứng dụng Mobile.

### Cách 2: Chạy riêng lẻ từng thành phần
- **Chạy AI Service:** Nhấp đúp `start-ai.bat`
- **Chạy Backend:** Nhấp đúp `start-backend.bat`
- **Chạy Mobile Scanner:** Nhấp đúp `start-mobile.bat`
- **Tắt toàn bộ:** Nhấp đúp `stop-all.bat`

---

## 3. Cài đặt môi trường ban đầu (Nếu chạy lần đầu)

### A. AI Service (`ai-service`):
```cmd
cd ai-service
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### B. Mobile App (`apps/mobile`):
```cmd
cd apps/mobile
npm install
```

### C. Backend (`backend`):
Đã có sẵn `gradlew.bat`. Khi chạy lần đầu, Gradle sẽ tự động tải các dependencies cần thiết.

---

## 4. Tài liệu kỹ thuật chi tiết
Toàn bộ 13 tài liệu nghiên cứu, kiến trúc, phân tích lỗi CER/WER và hướng dẫn vận hành nằm trong thư mục `docs/`.
# HandAI
