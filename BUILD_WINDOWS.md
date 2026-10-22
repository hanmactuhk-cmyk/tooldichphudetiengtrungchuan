# HN Voice Studio 5.2 — Windows Electron

Đọc lời nói hoặc chữ phụ đề tiếng Trung từ video MP4, dịch sang tiếng Việt và tạo giọng VieNeu-TTS. Giao diện mở trong cửa sổ ứng dụng Windows; không phải mở trình duyệt để dùng các chức năng offline. Gemini và ChatGPT vẫn dùng Chrome riêng để đăng nhập và dịch theo lựa chọn của người dùng.

## Tải bản chạy đầy đủ

Vào [Releases](https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases/latest). Bản 5.2 dùng lại bộ model của [bản đầy đủ 5.1](https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases/tag/v5.1.0). Tải và giải nén đầy đủ 5.1, đóng ứng dụng, sau đó giải nén `HNVoice-5.2.0-update.zip` vào cùng thư mục cha để ghi đè thư mục `HNVoice-Electron`. Các model không đổi. Với bộ đầy đủ 5.1, tải **tất cả** các phần `HNVoice-Electron-5.1.0-Windows.zip.001`, `.002`… cùng `release-parts.json`, `GIAI-NEN.ps1`, `GIAI-NEN.bat` vào cùng một thư mục. Chạy `GIAI-NEN.bat`: chương trình kiểm tra SHA256, giải nén trực tiếp các phần, không cần ghép thêm một ZIP lớn. Mở `HNVoice-Electron/HN Voice Studio.exe`. Có thể chạy `TAO-LOI-TAT.bat` bên trong để tạo lối tắt Desktop; giữ nguyên cả thư mục ứng dụng.

Bộ tải đầy đủ có Electron, Python đã đóng gói, FFmpeg, Whisper-small, RapidOCR Trung, Qwen3-4B Q4 và VieNeu v3 Turbo ONNX FP32 + codec + giọng mẫu. Người dùng bản chạy không cần cài Node, Python hay nhập API key. Cần Windows 10/11 x64, CPU x64 hỗ trợ AVX2, khuyến nghị RAM 16 GB; máy RAM 8 GB có thể phải dùng bộ nhớ ảo và chậm hơn. Gói sau giải nén khoảng 4,4 GB; cần đủ dung lượng cho cả phần tải và thư mục giải nén. Bản EXE chưa ký chứng thư thương mại.

## Sử dụng

1. Chọn video. Ở Nhận diện, chọn lời nói (Whisper), chữ in trên hình (OCR; điều chỉnh vùng phụ đề), hoặc Gemini video qua Chrome đã đăng nhập. Với Gemini, bấm “Mở Gemini / đăng nhập”, sau đó “Tải video lên Gemini → lấy SRT”. Video được gửi tới tài khoản Gemini của bạn; app yêu cầu phụ đề tiếng Trung kèm thời gian, tải SRT và đưa kết quả vào bước dịch. Có thể nhập SRT Trung/Việt trực tiếp. Video dài được chia đoạn; tốc độ và khả năng nhận diện phụ thuộc Gemini và hạn mức tài khoản.
2. Chọn dịch Offline, Gemini hoặc ChatGPT. Với dịch qua web, bấm Mở Chrome và tự đăng nhập. Công cụ gửi SRT với yêu cầu giữ mốc, sát nghĩa, ngắn gọn và đúng nhân xưng. Có thể sao chép yêu cầu và dán SRT trả về để nhập thủ công.
3. Duyệt bản dịch, gán nhân vật/quan hệ/xưng hô/giọng cho từng câu. Tạo giọng và căn timeline.
4. Chọn khung tự động theo video, 16:9 hoặc 9:16. Kéo phụ đề trong phần hình ảnh; chọn áp dụng toàn bộ hoặc riêng câu hiện tại. Chỉnh cỡ chữ/chiều rộng, bấm “Tách đôi câu” khi câu quá dài; thời gian được chia liên tiếp và cần tạo lại giọng. Dùng nút phóng to khung hình khi chỉnh video dọc; Escape để trở lại.
5. Nghe kiểm tra rồi xuất SRT gốc, SRT theo giọng đã căn, ASS giữ vị trí hoặc WAV toàn bộ. **SRT không lưu vị trí/cỡ chữ**; dùng ASS để mang bố cục sang trình hỗ trợ ASS. Xuất MP4 để ghi khung hình, vùng mờ, phụ đề và âm thanh vào video.

Giọng được tăng tốc tối đa 1,35 lần để vừa mốc, sau đó dời câu sau nếu vẫn quá dài. Không cắt mất câu và không cho hai đoạn giọng chồng nhau; có thể kết thúc muộn hơn video. Tiếng video gốc tự tắt sau khi tạo giọng; bật lại thủ công có thể nghe hai nguồn cùng lúc. Nghe thử một câu sẽ dừng nguồn đang phát. Đã có xuất MP4 lồng tiếng; chưa tự nhận diện người nói; cần gán nhân vật thủ công. Hiện chưa tự khôi phục dự án/video sau khi thoát: hãy xuất WAV/SRT trước khi đóng.

Offline dùng CPU và tải lần lượt từng loại model để tiết kiệm RAM. Model được giữ khi tiếp tục cùng loại tác vụ. Có cache giọng, OCR bỏ qua khung hình lặp và hàng đợi tác vụ để tránh sinh trùng. Thời gian phụ thuộc CPU, số câu, độ dài và lần tải model đầu. Không cam kết mọi bản dịch đều chính xác; Gemini/ChatGPT thường phù hợp hơn khi cần xử lý ngữ cảnh dài nhưng phụ thuộc tài khoản, hạn mức và giao diện dịch vụ. Công cụ kiểm tra ID/số câu/mốc SRT, không coi đó là bảo đảm đúng nghĩa.

## Xây từ mã nguồn

Cài Node.js 22+ hoặc 24, Python 3.12 x64, pnpm 11.25.0 và Git. Chạy trong PowerShell tại thư mục repository:

```powershell
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
python -m venv .venv
.\.venv\Scripts\Activate.ps1
powershell -ExecutionPolicy Bypass -File scripts/build-desktop.ps1
```

Script cài các phụ thuộc Python được khóa, lấy đủ model theo revision/SHA256 trong `models.lock.json`, xây giao diện, đóng gói worker và Electron. Bản chạy ở `release/win-unpacked/HN Voice Studio.exe`; script đặt đủ model vào `release/win-unpacked/resources/models`. Không đưa model GB vào lịch sử Git; model nằm trong bản phát hành và có script tải lại chính xác. `requirements-lock.txt` là ảnh chụp đầy đủ môi trường kiểm thử cũ; `requirements-desktop.txt` là các phụ thuộc cần cho bản CPU này, bỏ PyTorch/Piper/Transformers không dùng.

```powershell
pnpm run lint
python scripts/prepare_models.py --verify
python scripts/package-desktop.py release/win-unpacked release/download
```

`package-desktop.py` chia ZIP thành phần nhỏ hơn giới hạn asset GitHub. Nếu thiếu chỗ trống, dùng `--upload-repo OWNER/REPO --tag v5.2.0 --gh gh` để tải từng phần lên draft release bằng GitHub CLI đã đăng nhập rồi bỏ bản trung gian sau khi kiểm tra upload. Sau đó chép `scripts/GIAI-NEN.*` cạnh manifest. Không cần token trong mã nguồn.

## Kiểm thử ứng dụng thật

Có fixtures video/SRT tổng hợp trong `tests/fixtures`. Khi có Python và Playwright Node:

```powershell
$env:HN_DESKTOP_EXE=(Resolve-Path 'release/win-unpacked/HN Voice Studio.exe').Path
$env:HN_TEST_PYTHON=(Resolve-Path '.venv/Scripts/python.exe').Path
node scripts/test-desktop.cjs
```

`HN_PLAYWRIGHT` có thể trỏ tới thư mục package Playwright nếu không cài trong repository. Bài thử mở EXE Electron, kiểm tra cửa sổ đơn, sandbox, bộ xử lý thuộc đúng phiên, ASR/OCR, offline Qwen, giọng thật/cache, 500 lịch giọng, phát/đổi câu không chồng tiếng, âm thanh qua cuối video, xuất WAV/SRT, và dừng worker khi đóng ứng dụng. Các script `browser_test_v4.py`, `chrome_open_test_v4.py` giữ tên cũ nhưng kiểm tra backend dùng chung; phải có Chrome riêng đã đăng nhập và đặt `HN_TEST_URL` theo cổng worker trong nhật ký. Không đưa hồ sơ Chrome lên GitHub.

## Dữ liệu và lỗi

Ứng dụng ghi cache/nhật ký/hồ sơ Chrome tại `%APPDATA%/HN Voice Studio` (hoặc thư mục user-data khi chỉ định trong bài thử). Có thể đặt `desktop-settings.json` ở đó với `{"browserHome":"D:/duong-dan/ho-so-chrome"}` để dùng các hồ sơ riêng đã có. Không sao chép hồ sơ Chrome đang mở. Nếu thiếu model, dùng bộ phát hành đủ hoặc chạy script tải model. Nếu dịch web thay đổi giao diện, dùng chức năng nhập phản hồi SRT và cập nhật công cụ. Khi đóng ứng dụng, các tác vụ chưa hoàn thành sẽ dừng; nút Dừng tác vụ có hiệu lực giữa các câu/lần chờ, không ngắt cưỡng bức giữa suy luận.

## Nguồn và giấy phép

Phát triển từ [tooldichphudetiengviet](https://github.com/hanmactuhk-cmyk/tooldichphudetiengviet). SDK VieNeu được lấy từ mã nguồn người dùng cung cấp, giữ giấy phép Apache-2.0 tại `resources/backend/VIENEU-LICENSE`; bản vá chỉ bổ sung đường dẫn codec offline. Xem `THIRD_PARTY.md`, `models.lock.json` và các giấy phép kèm thư viện/model. Không có tài khoản, cookie, API key, bộ nhớ đệm cá nhân hoặc video cá nhân trong mã nguồn/phát hành.

Kiểm tra bố cục: `node scripts/test-layout.cjs` với `HN_TEST_URL` trỏ tới worker đang chạy. Kiểm tra chia câu/ASS: `pnpm exec tsx scripts/test-caption-layout.ts`. Kiểm tra SRT Gemini/hủy tác vụ: `python scripts/test_video_subtitles.py`. Đặt `HN_TEST_GEMINI_VIDEO=1` khi chạy bài thử Electron để kiểm tra tải video mẫu lên Gemini và dịch kết quả (cần hồ sơ Chrome đã đăng nhập).

## Xuất MP4 và che phụ đề gốc (5.2)

Bật “Làm mờ phụ đề gốc” dưới thanh bố cục. Kéo vùng xanh, kéo góc dưới phải để thay đổi kích thước; thanh Độ mờ chỉnh cường độ. Vùng mờ được tính theo phần hình ảnh thật. Vào Xuất file → Xuất video MP4; có thể bỏ chọn ghép phụ đề. MP4 có khung tự động/16:9/9:16, phụ đề Việt ở vị trí đã chọn, vùng mờ và track VieNeu. Nếu giọng dài hơn video, giữ hình cuối đến hết giọng. Tắt tiếng gốc để tránh nghe thêm lớp lời nói cũ.

Gemini tự mở Chrome và đợi kết nối; nếu trang hiện Sign in/Đăng nhập, cần đăng nhập lại. Hỗ trợ nhãn nút tải tệp tiếng Việt và tiếng Anh, thử mở menu lại khi trang chưa sẵn sàng, xác nhận thành phần video đính kèm trước khi gửi.
