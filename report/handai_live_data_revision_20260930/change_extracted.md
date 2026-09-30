# Inspection Report: Bao_cao_cap_nhat_du_lieu_thuc_HandAI.docx

## Metadata
- **Author**: python-docx
- **Created**: 2013-12-23 23:15:00+00:00
- **Modified**: 2013-12-23 23:15:00+00:00
- **Revision**: 1

## Document Content


# Báo cáo cập nhật dữ liệu thật cho HandAI

Bản cập nhật ngày 30/09/2026 sửa cả mã dashboard và báo cáo Word. Dashboard nghiên cứu hiện lấy dữ liệu từ lịch sử nhận dạng thực trên thiết bị, loại bản ghi mẫu và không hiển thị các phần trăm dự phòng khi chưa có dòng được xác minh.


# Thay đổi trong mã ứng dụng

* Thêm handAiDashboardMetrics.ts để tạo một nguồn tính duy nhất cho dashboard từ các phiên COMPLETED và isSampleData khác true.
* Dòng được tính accuracy, CER và WER phải có evaluationStatus EVALUATED, groundTruthStatus EXPLICIT hoặc USER_CONFIRMED, và ground truth không rỗng.
* CER và WER được tính theo tổng edit distance chia tổng ký tự hoặc token tham chiếu trên toàn bộ dòng hợp lệ; không lấy trung bình đơn giản giữa các phiên.
* Các thẻ accuracy, confidence, latency, lịch sử và phân tích lỗi dùng bản ghi thật. Khi chưa đủ dữ liệu, giao diện hiển thị dấu gạch ngang hoặc trạng thái chờ dữ liệu xác minh.
* Chênh lệch raw-to-final được ghi là Assisted Workflow Improvement theo điểm phần trăm vì kết quả cuối có thể gồm cả gợi ý AI và chỉnh tay.
* Các phiên mẫu dựng sẵn không còn xuất hiện trong dashboard nghiên cứu và lịch sử của màn hình này.

# Nguồn và phạm vi số liệu


**[Table]**
| Phạm vi | Dữ liệu sử dụng | Khi thiếu dữ liệu |
| --- | --- | --- |
| Phiên | Phiên hoàn thành, không phải dữ liệu mẫu | Hiển thị 0 phiên |
| Accuracy dòng | So khớp chính xác OCR thô và kết quả cuối với reference | Hiển thị — |
| CER và WER | Tổng edit distance trên tổng đơn vị reference | Hiển thị — |
| Confidence và lỗi | Các dòng đã xác minh trong phiên thật | Hiển thị trạng thái chờ |
| Latency | processingTimeSeconds của phiên hoàn thành | Hiển thị — |


# Thay đổi trong báo cáo Word

* Bỏ ba ảnh dashboard chứa số cố định cũ và bỏ toàn bộ diễn giải coi các số đó là giao diện hiện hành.
* Giữ ảnh tiến trình xử lý do chủ dự án cung cấp vì ảnh này vẫn mô tả đúng năm bước của app.
* Thay phần dashboard bằng sơ đồ luồng dữ liệu, quy tắc chọn dòng và logic hiển thị được dựng trực tiếp từ mã mới.
* Cập nhật kiến trúc, mục 6.1, 6.3, mục theo dõi thí nghiệm và danh mục nguồn để phản ánh bộ tổng hợp dashboard mới.
* Giữ CER 11,3388% trong model manifest như bằng chứng bàn giao mô hình; không trộn số này với dashboard phiên trực tiếp.

# Kiểm chứng

TypeScript hoàn tất không lỗi. Hai bộ kiểm thử dashboard có 17/17 ca đạt; hai bộ kiểm thử luồng HandAI liên quan có 82/82 ca đạt. Các ca mới kiểm tra việc loại dữ liệu mẫu, tính số từ dòng xác minh và không dựng phần trăm khi thiếu reference. Không huấn luyện mô hình và không commit hoặc push trong lần cập nhật này.

USER_CONFIRMED hỗ trợ giám sát vận hành nhưng không mặc nhiên là ground truth độc lập, vì người dùng có thể xác nhận chính kết quả đang xem. Một benchmark nghiên cứu vẫn cần reference đóng băng từ trước và xuất kết quả theo từng dòng để so sánh raw OCR, AI-only và kết quả cuối trên cùng mẫu.


# Skills Applied

vercel-react-best-practices
SKILL.md: .agents/skills/react-best-practices/SKILL.md
Why selected: cập nhật React Native dashboard và luồng tải dữ liệu.
Applied to: memoization, callback tải dữ liệu, trạng thái rỗng và kiểm thử màn hình.

docx
SKILL.md: .agents/skills/docx/SKILL.md
Why selected: chỉnh tài liệu Word hiện hữu mà vẫn giữ cấu trúc học thuật.
Applied to: nội dung, bảng, hình và chú thích.

documents
SKILL.md: C:/Users/Admin/.codex/plugins/cache/openai-primary-runtime/documents/26.909.12148/skills/documents/SKILL.md
Why selected: yêu cầu render và kiểm tra trực quan trước khi bàn giao.
Applied to: xuất DOCX, render từng trang và kiểm tra bố cục.
