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
├── RUN_HANDAI.bat           # [NÚT CHẠY 1-CLICK] Chạy toàn bộ hệ thống (Chuẩn MathVision Kids)
├── start-ai.bat             # Nút chạy riêng AI Microservice (Port 8000, nếu muốn test lẻ)
├── start-backend.bat        # Nút chạy riêng Backend API (Port 8080, nếu muốn test lẻ)
├── start-mobile.bat         # Nút chạy riêng Mobile App (Expo Metro, nếu muốn test lẻ)
├── start-infra.bat          # Nút bật Docker Containers
└── stop-all.bat             # Nút dừng toàn bộ dịch vụ (Giải phóng port & hạ container)
```

---

## 2. Hướng dẫn chạy nhanh ("Nút bấm chạy nhanh")

### Cách 1: Chạy toàn bộ hệ thống bằng 1 click (Chuẩn kiến trúc MathVision Kids)
Nhấp đúp chuột vào file:
```cmd
RUN_HANDAI.bat
```
Hệ thống sẽ chạy với **đúng 2 cửa sổ terminal**:
1. **Cửa sổ 1 (Cửa sổ quản lý hệ thống):** Khởi động Docker (Postgres, MinIO, Redis), chạy ngầm **FastAPI AI Microservice** và **Spring Boot Backend**, tự động kiểm tra cổng và báo trạng thái `[OK]` khi sẵn sàng.
2. **Cửa sổ 2 (Mobile Scanner UI):** Cửa sổ Expo Metro Bundler duy nhất, hiển thị **mã QR to rõ ràng** để bạn mở app Expo Go trên điện thoại quét vào ngay!

### Cách 2: Chạy riêng lẻ từng thành phần
- **Chạy lẻ AI Service:** Nhấp đúp `start-ai.bat`
- **Chạy lẻ Backend:** Nhấp đúp `start-backend.bat`
- **Chạy lẻ Mobile Scanner:** Nhấp đúp `start-mobile.bat`
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
