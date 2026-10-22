# Kiểm thử Windows — Electron 5.2.0

Ngày 22/10/2026, trên máy Windows của người dùng. Bản EXE đóng gói, CPU và model offline đã có.

| Hạng mục | Kết quả |
|---|---|
| Nhận diện lời nói/ OCR | Bài hồi quy với video mẫu đạt |
| Dịch offline Qwen3 | Bài kiểm tra chất lượng/ID/mốc đạt |
| VieNeu-TTS | Hai giọng thật, cache, 500 lịch giọng không chồng câu đạt |
| Phát trong Electron | Mỗi lần chỉ một track giọng, phát qua cuối video, xuất WAV/SRT đạt |
| An toàn renderer và vòng đời | Sandbox, context isolation, một cửa sổ, worker dừng khi đóng đạt |
| Khung hình | Tự động, 16:9, 9:16, video dọc thật, đổi kích thước cửa sổ đạt |
| Phụ đề | Kéo trong phần hình ảnh; toàn bộ/riêng câu; tách câu; xuất ASS đạt |
| Chia câu và ASS | 148 trường hợp chia câu, thời gian liên tiếp, bỏ giọng cũ, tọa độ và mốc ASS đạt |
| Gemini trong Electron | Video tổng hợp → SRT Trung → dịch Việt thành công; không thay phụ đề khi phản hồi lỗi |
| Bộ model | SHA256 của 26 artifact đều đúng |
| Parser SRT web | Loại dấu đóng khối mã và phần giao diện đính kèm; bài hồi quy đạt |

SRT không lưu tọa độ; chọn ASS để lưu vị trí. Khung xem trước chưa phải chức năng xuất MP4 đổi tỉ lệ. Gemini có thể từ chối hoặc trả sai định dạng/ý nghĩa tùy lượt và hạn mức; ứng dụng kiểm tra số câu/mốc nhưng vẫn cần duyệt nội dung. Chia đoạn video dài có kiểm tra mốc và khử câu trùng vùng giao; chất lượng nhận diện không được bảo đảm chỉ từ việc kiểm tra định dạng.

Ảnh kiểm tra: [khung ngang](layout-landscape.png), [khung dọc phóng to](layout-portrait.png), [Gemini trong Electron](gemini-video-native.png).

## Bổ sung bản 5.2

- Xuất MP4 thực tế: ghép ASS, vùng mờ, khung dọc, giữ hình cuối khi giọng dài hơn video.
- Đo vùng mẫu: độ biến thiên ảnh trong vùng mờ giảm; giọng 660 Hz được giữ, tiếng gốc 440 Hz bị tắt đúng thiết lập.
- Giao diện: bật/tắt vùng mờ, kéo, kéo góc thay kích thước, tải MP4 đều đạt.
- Gemini: hồ sơ hết đăng nhập được nhận diện; hỗ trợ nhãn nút tiếng Việt/Anh; đợi CDP, thử lại menu chưa sẵn sàng, xác nhận thành phần tệp đính kèm dù nút xóa chỉ hiện khi rê chuột.
- Prompt mới: “Lấy phụ đề này giúp tôi, phụ đề khớp thời gian trên video.” kèm định dạng SRT; video mẫu trả SRT hợp lệ. Có một lượt yêu cầu lại tự động khi Gemini trả khác định dạng.
