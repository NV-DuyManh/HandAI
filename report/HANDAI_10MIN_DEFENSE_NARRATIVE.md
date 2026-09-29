# KỊCH BẢN THUYẾT TRÌNH BẢO VỆ ĐỒ ÁN CAPSTONE (10-MINUTE DEFENSE NARRATIVE)
**Đề tài**: HandAI — Nền tảng Nhận diện Chữ viết tay Học sinh Tiểu học & Đánh giá Dữ liệu Lớn Minh bạch  
**Thời lượng**: 10 phút thuyết trình + 15 phút vấn đáp  
**Thông điệp chủ đạo (Core Thesis)**:  
> *"Chúng em không tuyên bố tạo ra một mô hình có độ chính xác 100% hoàn hảo, mà chúng em đã xây dựng một **đường ống nhận diện chữ viết tay có thể kiểm toán minh bạch (Auditable Pipeline)**, đo lường chính xác từng nguyên nhân gây lỗi và xác định các cơ hội cải tiến có thể định lượng được."*

---

## BẢNG PHÂN BỔ THỜI GIAN THUYẾT TRÌNH (TIMELINE OVERVIEW)

| Phần | Nội dung chính | Thời lượng | Cột mốc thời gian |
|---|---|:---:|:---:|
| **1. Đặt vấn đề (Problem)** | Nỗi đau thực tế trong đánh giá bài tập viết tay tiểu học | 1.0 phút | 0:00 – 1:00 |
| **2. Tại sao OCR hiện tại thất bại** | Rào cản đặc thù của chữ viết học sinh và vở ô ly | 1.5 phút | 1:00 – 2:30 |
| **3. Giải pháp HandAI** | Đường ống 3 giai đoạn: Thị giác $\to$ AI Ngữ cảnh $\to$ Con người | 2.0 phút | 2:30 – 4:30 |
| **4. Đóng góp kỹ thuật** | Tối ưu hóa CRNN, bộ phân loại lỗi 4 nguyên nhân & Big Data pipeline | 1.5 phút | 4:30 – 6:00 |
| **5. Bằng chứng thực nghiệm** | Minh chứng số liệu từ 59,462 dòng pre-train và 173 trang vở thực địa | 2.0 phút | 6:00 – 8:00 |
| **6. Hạn chế còn tồn tại** | Trung thực chỉ ra 7.4% lỗi do AI và lỗi dính dòng | 1.0 phút | 8:00 – 9:00 |
| **7. Hướng phát triển & Kết luận** | Lộ trình nâng cấp và khẳng định giá trị học thuật | 1.0 phút | 9:00 – 10:00 |

---

# CHI TIẾT KỊCH BẢN THUYẾT TRÌNH TỪNG PHÚT (SPEAKING SCRIPT)

---

### PHẦN 1: ĐẶT VẤN ĐỀ (PROBLEM) — [0:00 – 1:00]
*Slide 1: Tiêu đề đề tài & Thành viên nhóm*  
*Slide 2: Bối cảnh giáo dục tiểu học tại Việt Nam*

**Lời thuyết trình (Speaking Script)**:
> *"Kính thưa Thầy Chủ tịch Hội đồng, quý Thầy Cô trong Hội đồng phản biện và toàn thể các bạn sinh viên.
> 
> Tại bậc Tiểu học ở Việt Nam, việc luyện chữ viết và chấm bài tập viết tay trên vở ô ly là hoạt động diễn ra hàng ngày của hơn **8.7 triệu học sinh**. Mỗi ngày, các thầy cô giáo phải chấm hàng trăm trang vở bài tập hoàn toàn bằng mắt thường. Đây là một công việc lặp đi lặp lại, tốn nhiều thời gian và không thể số hóa để theo dõi sự tiến bộ của học sinh theo thời gian.
> 
> Tuy nhiên, trong kỷ nguyên chuyển đổi số giáo dục, câu hỏi đặt ra là: **Tại sao chúng ta đã có rất nhiều giải pháp OCR tiên tiến nhưng vẫn chưa thể tự động hóa việc đọc và đánh giá vở viết tay của học sinh tiểu học?** Đồ án HandAI của chúng em ra đời để giải quyết trực diện bài toán này."*

---

### PHẦN 2: TẠI SAO CÁC MÔ HÌNH OCR HIỆN TẠI LÀ CHƯA ĐỦ (WHY EXISTING OCR IS INSUFFICIENT) — [1:00 – 2:30]
*Slide 3: Các thách thức đặc thù của chữ viết tay học sinh tiểu học*  
*Slide 4: Thất bại của các mô hình OCR thương mại / in ấn*

**Lời thuyết trình (Speaking Script)**:
> *"Thưa Thầy Cô, các mô hình OCR thương mại hiện nay thường quảng bá độ chính xác lên tới 98% hay 99%. Nhưng trên thực tế nghiên cứu, các con số đó chỉ đạt được trên tài liệu in ấn văn phòng hoặc chữ viết tay nắn nót của người lớn. Khi đưa vào môi trường vở ô ly tiểu học, các mô hình truyền thống gặp phải 3 rào cản chí mạng:
> 
> 1. **Độ biến thiên nét chữ cực lớn**: Học sinh từ Lớp 1 đến Lớp 3 chưa hoàn thiện kỹ năng vận động tinh (fine motor control). Nét chữ có độ nghiêng thất thường, khoảng cách chữ không đều, và các nét nhô cao (ascender như h, k, l) hoặc nét kéo dài xuống (descender như g, y) lấn sâu vào dòng kẻ lân cận.
> 2. **Hệ thống dấu thanh tiếng Việt phức tạp**: Chữ viết tay tiếng Việt có 5 dấu thanh và 7 nguyên âm có dấu phụ (mũ, móc, trăng). Học sinh thường viết dấu lệch khỏi nguyên âm hoặc dấu bị dính đè lên các đường kẻ ngang của vở ô ly, khiến mô hình thị giác bị mất dấu hoặc nhầm lẫn.
> 3. **Bản chất hộp đen và thiếu khả năng kiểm toán**: Các giải pháp hiện nay chỉ trả về một chuỗi văn bản duy nhất mà không cho người dùng biết lỗi xảy ra ở khâu nào: do ảnh mờ, do cắt sai dòng hay do mô hình đọc sai chữ?
> 
> Do đó, mục tiêu của chúng em không phải là cố gắng tạo ra một con số chính xác ảo, mà là xây dựng một hệ thống có thể **bóc tách, định lượng và kiểm soát từng mắt xích sai số**."*

---

### PHẦN 3: GIẢI PHÁP TIẾP CẬN CỦA HANDAI (HANDAI APPROACH) — [2:30 – 4:30]
*Slide 5: Kiến trúc đường ống 3 giai đoạn (Perception $\to$ Cognition $\to$ Human)*  
*Slide 6: Phân tách minh bạch 3 trạng thái đầu ra*

**Lời thuyết trình (Speaking Script)**:
> *"Để giải quyết rào cản trên, HandAI xây dựng đường ống nhận diện và đánh giá minh bạch 3 giai đoạn:
> 
> - **Giai đoạn 1 — Tầng Thị giác Quang học (Perception Layer)**: Ảnh chụp trang vở được tiền xử lý chất lượng ảnh, cắt phân đoạn từng dòng chữ và đưa qua mạng nơ-ron **CRNN** để trích xuất ra **Trạng thái 1: Raw OCR Output**. Tầng này trung thực tuyệt đối với tín hiệu nét vẽ quang học, không đoán mò từ ngữ.
> - **Giai đoạn 2 — Tầng AI Ngữ cảnh (Cognitive Layer)**: Chuỗi ký tự thô cùng điểm số tin cậy được đưa vào mô hình ngôn ngữ ngữ cảnh. Dựa trên từ điển chương trình Tiếng Việt bậc tiểu học của Bộ GD&ĐT, AI phân tích cú pháp để đưa ra **Trạng thái 2: AI Corrected Output**, tập trung giải cứu các lỗi mất dấu thanh và nhầm lẫn ký tự tương đồng.
> - **Giai đoạn 3 — Tầng Giám sát Con người (Human-in-the-loop Verification)**: Toàn bộ kết quả được hiển thị đối chiếu trực tiếp trên ứng dụng di động để giáo viên hoặc học sinh xác nhận, tạo ra **Trạng thái 3: Final Verified Output**.
> 
> Điểm cốt lõi là: **Văn bản xác nhận cuối cùng này trở thành nhãn chuẩn Ground Truth tức thời**, tự động kích hoạt bộ tính toán Levenshtein trên thiết bị để đo lường tỷ lệ lỗi ký tự CER và tỷ lệ lỗi từ WER cho từng dòng bài tập."*

---

### PHẦN 4: ĐÓNG GÓP KỸ THUẬT CỦA ĐỒ ÁN (TECHNICAL CONTRIBUTION) — [4:30 – 6:00]
*Slide 7: Kiến trúc mô hình CRNN tối ưu hóa*  
*Slide 8: Cây phân loại lỗi 4 nguyên nhân gốc rễ (Root Cause Taxonomy)*  
*Slide 9: Kiến trúc hệ thống phân tán phục vụ Big Data*

**Lời thuyết trình (Speaking Script)**:
> *"Về mặt kỹ thuật phần mềm và AI, đồ án đóng góp 3 giá trị trọng tâm:
> 
> 1. **Kiến trúc mô hình CRNN gọn nhẹ, tối ưu hóa cho môi trường thực tế**: Mạng gồm 4 khối Conv2D kết hợp **GroupNorm(8, C)** thay vì BatchNorm để đảm bảo gradient ổn định khi xử lý kích thước ảnh biến thiên, đi qua 2 tầng **BiLSTM (128 hidden units)** và hàm mất mát **CTC Loss**. Toàn bộ mô hình chỉ có **5.96 triệu tham số (~24MB)**, độ trễ suy luận chỉ **0.42s/dòng**, hoàn toàn khả thi để triển khai trên các thiết bị máy chủ trường học phổ thông.
> 2. **Cây phân loại 4 nguyên nhân gốc rễ (Diagnostic Error Taxonomy)**: Thay vì chỉ báo cáo tỉ lệ chính xác chung chung, HandAI tự động phân loại sai số thành 4 nhóm nguyên nhân:
>    - *Recognition Error (41.2%)*: Nhầm lẫn tự dạng trực quan (ví dụ n $\to$ m, u $\to$ ư, d $\to$ đ).
>    - *Vietnamese Tone Error (23.5%)*: Lỗi nhận diện dấu thanh tiếng Việt.
>    - *Segmentation Error (19.6%)*: Lỗi cắt đứt nét chữ nhô cao/kéo dài đè dòng.
>    - *Image Quality Error (9.8%)*: Lỗi do ảnh chụp mờ rung, thiếu sáng.
>    - *Language Correction Error (5.9%)*: Lỗi do AI sửa quá đà.
> 3. **Kiến trúc Microservices phân tách hoàn toàn**: Backend Spring Boot 3.4 quản lý bảo mật RBAC, giao dịch ACID và lưu trữ PostgreSQL; AI Service FastAPI chuyên biệt xử lý tensor PyTorch; MinIO lưu trữ đối tượng ảnh; và Redis cache phiên làm việc, đảm bảo khả năng chịu tải khi hàng ngàn lớp học cùng gửi bài tập."*

---

### PHẦN 5: BẰNG CHỨNG THỰC NGHIỆM ĐÃ KIỂM ĐỊNH (EXPERIMENTAL EVIDENCE) — [6:00 – 8:00]
*Slide 10: Bảng số liệu thực nghiệm Before AI vs After AI*  
*Slide 11: Đường cong hiệu chuẩn độ tin cậy (Confidence Calibration Curve)*  
*Slide 12: Bằng chứng kiểm thử phần mềm tự động (183/183 Tests Passed)*

**Lời thuyết trình (Speaking Script)**:
> *"Kính thưa Hội đồng, toàn bộ các số liệu chúng em báo cáo hôm nay đều được kiểm chứng trực tiếp từ mã nguồn và dữ liệu thực nghiệm:
> 
> - **Hiệu năng của mô hình nền tảng**: Trên tập kiểm thử validation độc lập gồm 500 dòng văn bản, checkpoint tốt nhất `best_cer.pth` (Step 16,900) đạt:
>   - **Validation CER**: **11.34%**, **Train CER**: **8.66%**, **Generalization Gap chỉ 2.54%** và Validation Loss đạt **0.4518**. Khoảng cách 2.54% chứng minh mô hình không bị hiện tượng học vẹt (overfitting).
> - **Đóng góp có thể định lượng được của tầng AI**:
>   - CER trước AI là **11.34%**, sau khi qua tầng AI giảm xuống còn **8.21%** — tức giảm được **-3.13% CER**, đồng nghĩa với việc **triệt tiêu 27.6% tổng số lỗi ký tự**.
>   - WER giảm từ **26.50% xuống 20.15%** (giảm -6.35% lỗi cấp độ từ).
>   - Trên tập kiểm thử, AI sửa đúng **28.4%** số dòng, giữ nguyên **64.2%** số dòng đã đúng, và làm sai lệch **7.4%** số dòng.
> - **Kiểm soát hiện tượng CTC Blank Collapse bằng Đường cong hiệu chuẩn 5 phân vị**:
>   - Khi độ tin cậy ở khoảng **90–100%**, độ chính xác thực tế đạt **91.2%**.
>   - Khi độ tin cậy rơi xuống **dưới 60%**, độ chính xác thực tế sụt giảm còn **40.0%**. Điều này cung cấp căn cứ toán học vững chắc để hệ thống đặt ngưỡng cảnh báo an toàn cho giáo viên.
> - **Về mặt kỹ thuật phần mềm**: Toàn bộ hệ thống mobile đã vượt qua **16 test suites với 183/183 ca kiểm thử tự động đạt 100%**, đóng gói thành công **27 static routes** bằng Expo Router mà không phát sinh bất kỳ lỗi bundle nào."*

---

### PHẦN 6: HẠN CHẾ CÒN TỒN TẠI (LIMITATIONS) — [8:00 – 9:00]
*Slide 13: Minh bạch các hạn chế kỹ thuật thực tế*

**Lời thuyết trình (Speaking Script)**:
> *"Với tinh thần trung thực khoa học, chúng em xin phép báo cáo rõ ràng 3 hạn chế mà hệ thống hiện tại chưa giải quyết trọn vẹn:
> 
> 1. **Vấn đề nét chữ lấn dòng trong cắt phân đoạn**: Thuật toán cắt dòng hiện tại sử dụng hình thái học biểu đồ chiếu ngang (horizontal projection profile). Khi gặp các chữ viết tay của học sinh lớp 1 có nét móc kéo quá dài đè sâu vào dòng dưới, thuật toán vẫn có 19.6% nguy cơ cắt phạm vào nét chữ hoặc gộp nhầm dòng.
> 2. **Hiện tượng AI sửa quá đà (Language Over-correction 7.4%)**: Khi học sinh viết các biểu thức toán học đặc thù (như chữ cái x trong tìm x), hoặc viết tên riêng không phổ biến, mô hình ngôn ngữ có xu hướng tự động 'sửa' thành từ vựng thông dụng trong từ điển. Đây chính là lý do chúng em bắt buộc phải duy trì bước xác nhận của con người.
> 3. **Tính chất người viết độc lập (Writer-disjoint)**: Tập dữ liệu pre-train 59,462 dòng đảm bảo độc lập về mặt hình ảnh (Image-disjoint: Pass), nhưng chưa thể khẳng định 100% tính độc lập về người viết do tập nguồn mở không lưu mã định danh học sinh."*

---

### PHẦN 7: HƯỚNG PHÁT TRIỂN & KẾT LUẬN (FUTURE IMPROVEMENTS & CONCLUSION) — [9:00 – 10:00]
*Slide 14: Lộ trình phát triển tiếp theo*  
*Slide 15: Lời cảm ơn & Sẵn sàng vấn đáp*

**Lời thuyết trình (Speaking Script)**:
> *"Từ những hạn chế được định lượng rõ ràng trên, lộ trình nâng cấp tiếp theo của HandAI bao gồm:
> 
> 1. **Nâng cấp tầng cắt dòng lên Deep Learning 2D**: Thay thế biểu đồ chiếu ngang bằng mô hình phân đoạn đường cong linh hoạt như **DBNet** hoặc **CRAFT** để bao trọn các nét chữ móc ngoằn ngoèo bằng đa giác linh hoạt.
> 2. **Mở rộng mô hình toán học chuyên biệt**: Xây dựng bộ giải mã nhánh riêng cho các bài toán đặt tính theo cột và phân số dọc.
> 3. **Tích hợp Active Learning**: Tận dụng chính các dòng chữ được giáo viên sửa đúng hàng ngày trên ứng dụng để tự động làm giàu tập dữ liệu huấn luyện (Human-in-the-loop Retraining).
> 
> **KẾT LUẬN**:  
> Đồ án HandAI đã chứng minh rằng: Thay vì che giấu khuyết điểm bằng những con số 99% viển vông, việc xây dựng một **đường ống nhận diện minh bạch, có khả năng tự kiểm toán sai số và đo lường được đóng góp thực sự của AI** là hướng tiếp cận bền vững và có giá trị khoa học thực tiễn cao nhất cho giáo dục tiểu học Việt Nam.
> 
> Chúng em xin chân thành cảm ơn quý Thầy Cô trong Hội đồng đã chú ý lắng nghe và chúng em rất mong nhận được những câu hỏi đóng góp quý báu từ Thầy Cô. Em xin trân trọng cảm ơn!"*

---

## 3. CHECKLIST DÀNH CHO DIỄN GIẢ TRƯỚC KHI LÊN SÂN KHẤU

- [ ] **Mở sẵn 3 màn hình trình chiếu**:
  1. Slide thuyết trình (PowerPoint / PDF).
  2. Màn hình Dashboard phân tích thực tế: [`handai-analytics.tsx`](file:///e:/HandAI/apps/mobile/src/app/handai-analytics.tsx).
  3. Terminal hiển thị kết quả kiểm thử tự động `npm test` (**183 passed**).
- [ ] **Khẩu quyết cần nhớ**:
  - *Không bao giờ nói*: "Mô hình nhận diện chính xác tuyệt đối".
  - *Luôn luôn nói*: "Raw CER đạt 11.34%, AI giúp giảm 3.13% CER xuống còn 8.21%, và hệ thống có chốt chặn giáo viên xác nhận".
  - Khi Thầy Cô hỏi xoáy vào điểm yếu: Bình tĩnh mở ngay file [`HANDAI_CAPSTONE_DEFENSE_QA_PLAYBOOK.md`](file:///e:/HandAI/report/HANDAI_CAPSTONE_DEFENSE_QA_PLAYBOOK.md) để trả lời bằng số liệu thực tế.
