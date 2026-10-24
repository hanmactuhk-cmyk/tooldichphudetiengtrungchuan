# HNstudio 6.0.0 — Bộ cài Windows

Đọc lời nói hoặc chữ phụ đề tiếng Trung từ video MP4, dịch sang tiếng Việt và tạo giọng VieNeu-TTS. Giao diện mở trong cửa sổ ứng dụng Windows; không phải mở trình duyệt để dùng các chức năng offline. Gemini và ChatGPT vẫn dùng Chrome riêng để đăng nhập và dịch theo lựa chọn của người dùng.

## Mới trong 6.0.0
- Nhấp đúp mọi vùng chữ trên preview để nhập trực tiếp: phụ đề Việt/Trung, tên kênh, tiêu đề, nguồn và chữ thêm. Thuộc tính tự mở đúng đối tượng; nội dung đồng bộ ngay. Enter xuống dòng, Escape hoặc Ctrl+Enter kết thúc nhập. Chữ và phím tắt không kích hoạt phát video khi đang nhập.
- Thư viện có ô Text kéo thả để tạo hàng chữ riêng. Nhấp đúp ô chữ trên timeline mở popup chỉnh màu, phông và căn trái/giữa/phải bằng biểu tượng.
- 33 bộ phông mới được đóng gói offline, đã kiểm tra đủ ký tự tiếng Việt (thêm vào các lựa chọn Windows cũ). Phông đi cùng preview và bộ dựng phụ đề MP4; không cần cài phông riêng.
- Bộ nền/tên kênh/tiêu đề/nguồn dùng một hàng timeline; chọn thành phần và bật/tắt ở Thuộc tính. Xóa mục Ngày đăng. Dự án cũ được gộp hàng khi mở, giữ các mốc và thành phần khác.
- Video chính, phụ đề và âm thanh ở vùng trên timeline; ảnh/chữ/lớp phủ ở vùng dưới. Kéo và cắt bộ khung áp dụng cùng các thành phần trong bộ.
- Các nút căn chữ dùng biểu tượng và các giá trị thiết kế dùng cần gạt. Tên kênh mặc định căn giữa cả khung chữ.
- Ba giao diện: Đơn giản (xám sáng), Hiện đại (xanh đen/ngọc), Nổi bật (trắng ngọc trai, xanh trời/ngọc), khung bo tròn và bóng mềm. Lựa chọn lưu theo hồ sơ ứng dụng, tách khỏi project.

## Có từ 5.9.1
- Mẫu Bản tin xanh theo ảnh tham khảo: nền chuyển sắc mềm, bản đồ lục địa chìm được đóng gói offline, chữ in hoa căn trái kiểu hẹp.
- Nhãn kênh độc lập có vòng ký hiệu tùy chỉnh, viền sáng, bóng mềm và bốn kiểu hiển thị. Có thể kéo/đổi cỡ/keyframe như mọi lớp chữ.
- Ngày đăng và nguồn video có lớp và công tắc riêng. Không sao chép biểu tượng phát hoặc thanh tìm kiếm của nền tảng video vào mẫu.
- Chọn 15 mẫu nền → Bản tin xanh · theo ảnh mẫu, nhập tên kênh/nội dung/ngày đăng rồi Áp dụng. Mẫu mới thay trên các hàng cũ. Dải trên/dưới vẫn dùng như 5.9.0.

## Có từ 5.9.0
- Thư viện media: nhập nhiều video/ảnh, tìm và lọc, kéo thumbnail xuống đúng hàng/mốc hoặc dùng lại tệp nhiều lần. Nhập chưa tạo ô; thư viện được sao lưu cùng project.
- Đổi mẫu thay đúng các ô/hàng của mẫu hiện tại, không thêm hàng sau mỗi lần áp dụng. Giữ thời gian, các đoạn đã cắt và keyframe. Dự án 5.8 được nhận dạng và gộp các hàng mẫu dư khi áp dụng lại.
- Bố cục Dải trên/dưới chỉ phủ hai mép; Bản tin là lựa chọn riêng có nền chuyển sắc. Tiêu đề/tên kênh và các phần nền vẫn độc lập.
- Thuộc tính có từng nhóm bo góc với menu thu gọn. Công cụ phụ đề và âm thanh gom thành menu timeline. Kéo đường ngăn để chỉnh chiều cao timeline, dành thêm diện tích preview.

## Có từ 5.8.0
- Hàng hình tích hợp cùng thước timeline. Mỗi hàng chứa nhiều ô, nhận video/ảnh/chữ/vùng mờ; hàng trên đè hàng dưới. Thêm hàng trống, kéo ô giữa các hàng, đổi tên, ẩn hoặc xóa hàng, đưa lên/xuống. Phụ đề và âm thanh vẫn độc lập như cũ.
- Video gốc tự có ô chỉnh sau khi tải xong; C cắt, Delete xóa, Ctrl+D nhân đôi; kéo cạnh để trim, bật Co giãn video hoặc giữ Alt khi kéo cạnh phải để đổi tốc độ. Lật ngang/dọc và keyframe cho lớp phủ.
- Bảng danh sách phụ đề bên phải được chuyển sang nút Danh sách phụ đề. Khu vực phải là bảng thuộc tính, có thể thả nổi hoặc ghim lại. Popup từng phụ đề/giọng cũ vẫn còn.
- Nhấp đúp hoặc chuột phải ô âm thanh để mở popup sóng âm, nghe thử, kéo tốc độ giữ cao độ và áp dụng. Đổi tốc độ chỉ tác động ô âm thanh, không đổi phụ đề. Giọng/âm thanh ở cùng hàng vẫn không được chồng nhau.
- 15 mẫu màu và hoa văn khác nhau. Mỗi mẫu tạo riêng nền trên, nền dưới, vùng mờ, tên kênh và tiêu đề. Mỗi thành phần có hàng, thời gian, màu/độ đục và vị trí riêng. Tiêu đề/tên kênh kéo trực tiếp và chỉnh phông, cỡ, màu trong bảng lớp.
- Mẫu mới tắt dải trang trí cũ để tránh chồng. Giá trị cũ vẫn được giữ ở tab Nền cũ; vùng mờ cũ có thể đưa lên một hàng mới.
- Video gốc chưa tách tiếng: tiếng đi theo tốc độ video. Âm thanh đã tách là ô độc lập, chỉnh tốc độ riêng trong popup nếu cần.

## Các chức năng đã có từ 5.7.0
- Dịch qua ChatGPT hoặc Gemini: gửi toàn bộ văn bản hoặc một tệp SRT, prompt dịch ngắn gọn theo thời lượng. Không chia lô.
- Preview có zoom riêng, vừa khung, toàn màn hình; bảng thiết kế/làm mờ/media nổi, kéo, thu gọn và đổi kích thước.
- Video / Ảnh / Keyframe: khởi tạo video gốc trên hàng hình, thêm video/ảnh, cắt tại vạch phát, kéo mép để trim, di chuyển, nhân đôi hoặc xóa từng lớp. Cắt video không tự kéo các hàng phụ đề/âm thanh khác.
- Tạo nhiều vùng mờ, chọn khoảng hiện trên timeline, bo góc, độ đục. Ảnh và vùng mờ có keyframe vị trí/kích thước/độ đục.
- Bám chữ/vật thể: đặt vùng vừa đối tượng, đặt vạch phát trong video rồi bấm Bám theo. Kết quả là keyframe có thể chỉnh tay; dừng khi mất dấu. Kiểm tra lại nếu cảnh cắt hoặc vật bị che.
- Tiếng gốc đã tách vẫn chỉnh âm lượng ở thanh preview hoặc chọn clip âm thanh trên timeline để chỉnh riêng.
- Trạng thái tròn RGB hiển thị phần trăm, công việc hiện tại và các cột sóng hoạt động.
- Lưu project giữ cả video thêm, ảnh và keyframe. MP4 dựng cùng hình học/chuyển động với preview.

## Cài đặt Windows

**Đã cài bản đầy đủ:** lưu project rồi đóng ứng dụng, tải `HNVoice-Studio-5.8.0-Update-Setup.exe` ở [bản cập nhật 5.8.0](https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases/tag/v5.8.0) rồi cài vào đúng thư mục hiện tại. Bản cập nhật giữ model đã cài; không phải tải lại model. 5.8.0 sửa đồng bộ giọng theo đúng mốc phụ đề, tự tăng tốc câu dài và giữ nguyên giờ câu sau; có logo HNstudio, hướng dẫn và giới thiệu Hoài Nguyễn Studio. Giao diện không hiện tên model hoặc các màn hình kỹ thuật.

- **Popup một câu / nhóm:** nhấp đúp hoặc chuột phải vào hàng phụ đề Việt; cũng có nút Chỉnh popup trong bảng bên phải. Chọn tất cả phụ đề Việt hoặc Ctrl+A khi timeline có tiêu điểm, rồi chuột phải để chỉnh nhóm. Popup kéo được, không che mờ hoặc khóa ứng dụng phía sau.
- Popup sửa chữ, chọn giọng, cỡ chữ, đậm/thường, nghiêng/thường, phông, màu chữ/nền, độ đục và bo góc cho các câu đã chọn. Bôi đen ký tự trong ô văn bản, chọn màu rồi bấm Tô màu. Kiểu chữ áp dụng cả nhóm; nội dung và màu riêng sửa theo câu đang chọn.
- **Tạo giọng → timeline:** tạo tiếng thật cho nhóm, thay đoạn giọng cũ của các câu đó; đặt đúng mốc bắt đầu của phụ đề Việt. Nếu lời dài hơn ô thời gian, tăng tốc để vừa; không dịch chuyển phụ đề hoặc chồng tiếng. Câu quá dài hoặc khoảng âm thanh khác đang trùng sẽ báo để chỉnh lại, không áp dụng nửa chừng.
- **Clone giọng có tên:** mở Clone giọng ở tab Giọng đọc, tải mẫu 3–30 giây (khuyến nghị 6–20 giây, rõ một người, ít nhạc). Giọng được lưu riêng trong hồ sơ ứng dụng và xuất hiện trong các ô chọn giọng. Dùng mẫu bạn có quyền sử dụng; độ giống phụ thuộc chất lượng mẫu. Giọng clone đang dùng được kèm khi lưu dự án.
- **Chữ và hình:** nền phụ đề và vùng mờ bo tròn với mức tùy chỉnh. Xuống dòng theo khoảng trắng; từ liền quá dài được thu cỡ để không cắt giữa từ. Chọn đậm/nghiêng, tô màu từng ký tự cho phụ đề, chữ thêm và tiêu đề trên/dưới. Có 20 lựa chọn phông đã kiểm tra đủ ký tự Việt trên máy thử; máy khác thiếu phông có thể chọn Arial/Tahoma. Cỡ chữ MP4 được căn theo thước đo phông của bản xem trước. Dải tiêu đề không che phụ đề tự căn.
- Timeline: hàng phụ đề gốc, phụ đề Việt, giọng và âm thanh độc lập. Chọn/xóa/cắt/kéo một ngôn ngữ không đổi ngôn ngữ khác hoặc âm thanh. Ctrl/Shift bấm để chọn nhiều, kéo vùng trống để khoanh chọn, Delete xóa, Ctrl+Z hoàn tác.
- Tách tiếng gốc: chọn Toàn bộ / Chỉ tiếng nói / Chỉ âm thanh nền. Hai stem có cùng thời lượng, xử lý trên máy; tiếng gốc trong video được tắt khi đưa stem vào timeline để tránh trùng. Có thể còn sót giọng/nhạc tùy bản thu, và tách âm cần thời gian xử lý.
- Kiểu phụ đề: phông chữ, màu chữ/nền và độ đục từ 0% trong suốt đến 100% đục. Xem trước và MP4 dùng cùng bố cục dòng/chữ/nền. Có thể thêm chữ kéo thả, bật dải nền trên/dưới với tiêu đề và màu tùy chọn.
- Tab Dịch có ô tải file SRT đã dịch bên ngoài; phải giữ số câu và thời gian của phụ đề gốc. Tab Video / SRT cũng nhận SRT Việt trực tiếp nếu không cần dịch.
- Xuất file chỉ còn MP4, SRT và Lưu/Mở dự án. MP4 hỏi nơi lưu và nhớ thư mục, dùng lại bản xuất khi nội dung không đổi. Khi ghép chữ/làm mờ/đổi khung vẫn cần mã hóa lại.
- **Lưu dự án (.hnproject)** sao chép video và các WAV cần dùng vào thư mục `.hnproject.media-...` cạnh file dự án. Giữ hai phần cùng nhau khi di chuyển/chia sẻ. **Mở dự án** phục hồi phụ đề, media, cắt ghép, font/màu/nền, chữ thêm và các dải tiêu đề. Đây là lưu thủ công; hãy lưu trước khi đóng. Không còn xuất JSON rời thiếu media.

Bản cập nhật đã kèm bộ tách âm thanh bổ sung; không cần tải thêm trong lần đầu dùng. Giữ nguyên tính năng Gemini tải nguyên video và ChatGPT gửi nguyên SRT đính kèm.

**Máy chưa cài:** vào [bộ cài đầy đủ 5.4.0](https://github.com/hanmactuhk-cmyk/tooldichphudetiengtrungchuan/releases/tag/v5.4.0), tải `HNVoice-Studio-5.4.0-Setup.exe` và **tất cả** file `HNVoice-Studio-5.4.0-Setup-*.bin` vào cùng một thư mục. Chạy Setup.exe, chọn thư mục cài, chờ hoàn tất rồi mở HN Voice Studio từ Desktop hoặc Start Menu. Không cần giải nén, cài Python/Node hay tải thêm model. Giữ nguyên tên các file tải xuống. `installer-sha256.json` chứa kích thước và SHA256 để đối chiếu.

Bản cài đầy đủ có Electron, Python đã đóng gói, FFmpeg, Whisper-small, RapidOCR Trung, Qwen3-4B Q4 và VieNeu v3 Turbo ONNX + codec + giọng mẫu. Cài cho tài khoản Windows hiện tại, không bắt buộc quyền quản trị. Có mục gỡ trong Windows Settings → Apps. Gỡ cài không xóa hồ sơ người dùng, tài khoản Chrome hay sản phẩm đã xuất. Cập nhật bằng bộ cài mới vào cùng thư mục. Đóng ứng dụng trước khi cập nhật hoặc gỡ.

Cần Windows 10 1809/11 x64, CPU hỗ trợ AVX2; khuyến nghị RAM 16 GB. Dành khoảng 5 GB cho ứng dụng/model, ngoài chỗ chứa bộ cài và các video/âm thanh tạm. Có thể chọn ổ E hoặc ổ còn trống. EXE chưa ký chứng thư thương mại. Bản cài dùng hồ sơ riêng, không ghi đè phiên portable đang mở; chọn lại video trong bản cài. Đăng nhập Gemini/ChatGPT bằng nút Mở Chrome nếu cần.

Dữ liệu bản cài nằm ở `%LOCALAPPDATA%/HN Voice Studio/UserData`. Có thể đặt `cacheHome` và `browserHome` trong `desktop-settings.json` bên trong thư mục đó (đường dẫn tuyệt đối); cache và tệp tạm của bộ xử lý cùng dùng cacheHome. Không chia sẻ file cấu hình hay hồ sơ Chrome cá nhân lên GitHub.

## Sử dụng

1. Chọn video. Ở Nhận diện, chọn lời nói (Whisper), chữ in trên hình (OCR; điều chỉnh vùng phụ đề), hoặc Gemini video qua Chrome đã đăng nhập. Với Gemini, bấm “Mở Gemini / đăng nhập”, sau đó “Tải video lên Gemini → lấy SRT”. Video được gửi tới tài khoản Gemini của bạn; app yêu cầu phụ đề tiếng Trung kèm thời gian, tải SRT và đưa kết quả vào bước dịch. Có thể nhập SRT Trung/Việt trực tiếp. Gemini nhận nguyên tệp video trong một lần tải và yêu cầu SRT cho toàn bộ thời lượng; tool không tự cắt/chia video. Nếu tệp vượt giới hạn tải hoặc Gemini không xử lý được, tool báo lỗi để kiểm tra, không tự chuyển sang gửi từng đoạn.
2. Chọn dịch Offline, Gemini hoặc ChatGPT. Với dịch qua web, bấm Mở Chrome và tự đăng nhập. Với ChatGPT, công cụ gửi toàn bộ SRT trong đúng một yêu cầu, đợi phản hồi đầy đủ rồi kiểm tra đủ số câu và đúng mốc trước khi nhập. Không tự chia 40 câu hoặc tự gửi tiếp từng phần; nếu dịch thiếu, giữ nguyên phụ đề hiện tại và báo lỗi. Công cụ yêu cầu giữ mốc, sát nghĩa, ngắn gọn và đúng nhân xưng. Có thể sao chép yêu cầu và dán SRT trả về để nhập thủ công.
3. Duyệt bản dịch, gán nhân vật/quan hệ/xưng hô/giọng cho từng câu. Tạo giọng và căn timeline.
4. Chọn khung tự động theo video, 16:9 hoặc 9:16. Kéo phụ đề trong phần hình ảnh; chọn áp dụng toàn bộ hoặc riêng câu hiện tại. Chỉnh cỡ chữ/chiều rộng, bấm “Tách đôi câu” khi câu quá dài; thời gian được chia liên tiếp và cần tạo lại giọng. Dùng nút phóng to khung hình khi chỉnh video dọc; Escape để trở lại.
5. Nghe kiểm tra rồi xuất SRT hoặc MP4. **SRT không lưu vị trí/cỡ chữ**. MP4 ghi khung hình, vùng mờ, phụ đề và âm thanh vào video. Lưu dự án để tiếp tục biên tập.

Giọng bắt đầu đúng mốc phụ đề Việt. Câu dài tự tăng tốc để kết thúc trước giờ kết thúc phụ đề và trước câu sau, không đẩy mốc hoặc cắt đuôi lời. Áp dụng đồng nhất cho tạo hàng loạt, tạo lại từng câu và popup. Nếu tỷ lệ cần thiết vượt 12 lần, ứng dụng yêu cầu rút gọn chữ hoặc kéo dài phụ đề, không áp dụng âm thanh bị lệch. Tiếng video gốc tự tắt sau khi tạo giọng; bật lại thủ công có thể nghe hai nguồn cùng lúc. Nghe thử một câu sẽ dừng nguồn đang phát. Đã có xuất MP4 lồng tiếng; chưa tự nhận diện người nói; cần gán nhân vật thủ công. Lưu dự án .hnproject để mở lại video, timeline và giọng clone; chưa có tự động lưu.

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

`package-desktop.py` chia ZIP thành phần nhỏ hơn giới hạn asset GitHub. Nếu thiếu chỗ trống, dùng `--upload-repo OWNER/REPO --tag v5.3.0 --gh gh` để tải từng phần lên draft release bằng GitHub CLI đã đăng nhập rồi bỏ bản trung gian sau khi kiểm tra upload. Sau đó chép `scripts/GIAI-NEN.*` cạnh manifest. Không cần token trong mã nguồn.

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

## Timeline kéo/cắt (5.3)

- Tạo giọng trước để có các đoạn VieNeu. Kéo giữa đoạn để di chuyển, kéo cạnh trái/phải để cắt khoảng dùng; nguồn WAV giữ nguyên. Hai hàng phụ đề Trung/Việt dùng chung mốc.
- Nút dây xích bật: kéo/cắt/xóa phụ đề cùng giọng liên quan. Tắt dây xích để chỉnh riêng. Các đoạn âm thanh trên cùng hàng không được chồng nhau; nếu trùng, app giữ bản cũ và báo để kéo vào khoảng trống.
- Chọn đoạn, đặt vạch phát bên trong, bấm kéo hoặc C / Ctrl+B để cắt. Có bỏ phần trước/sau vạch phát, nhân đôi Ctrl+D, xóa Delete, hoàn tác Ctrl+Z và làm lại Ctrl+Shift+Z / Ctrl+Y.
- Nam châm bắt dính vào vạch phát/cạnh đoạn. Có khóa hàng, tắt tiếng đoạn, âm lượng %, thanh thu/phóng, vừa toàn bộ và mở rộng timeline. Phím mũi tên tua 1/25 giây, Shift+mũi tên tua 1 giây khi timeline được chọn.
- “Tách tiếng gốc” lấy âm thanh video ra thành đoạn có thể sửa và tắt tiếng nhúng trong video để tránh phát trùng. “Thêm âm thanh” nhận WAV/MP3/M4A và đưa vào hàng âm thanh. Sóng âm tính từ WAV thật.
- WAV và MP4 dùng bản âm thanh đã ghép từ timeline. Khi sửa nội dung câu làm giọng cũ không còn phù hợp, tạo lại giọng hoặc bấm “Ghép lại âm thanh” cho những đoạn còn lại. Video gốc giữ cố định; các hàng phụ đề/âm thanh có thể chỉnh.

Kiểm thử: `pnpm exec tsx scripts/test-timeline.ts`, `python scripts/test_timeline_audio.py`, `node scripts/test-timeline-ui.cjs` và `node scripts/test-original-audio-ui.cjs` (các bài giao diện dùng HN_TEST_URL hoặc bộ xử lý thử tại cổng 8008). Đặt HN_TEST_MP4=1 cho bài thử Electron.

## Tạo bộ cài từ mã nguồn

Cài Inno Setup 6.7.3 hoặc mới hơn từ [trang chính thức](https://jrsoftware.org/isdl.php), sau đó chạy:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1
```

Script xây ứng dụng đầy đủ, xác minh SHA256 model rồi tạo Setup.exe và các phần dữ liệu dưới 1,8 GB để đăng GitHub Releases. Để dùng ứng dụng đã xây:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build-installer.ps1 -AppDirectory release/win-unpacked -OutputDirectory release/installer -InnoCompiler "C:/Program Files (x86)/Inno Setup 6/ISCC.exe"
```

Giữ toàn bộ file Setup-*.bin cạnh Setup.exe. Mã nguồn không chứa model GB, bộ cài hay thông tin đăng nhập; những file phát hành được tải ở Releases.

Tạo bộ cài cập nhật giữ model: thêm `-UpdateOnly` khi gọi `scripts/build-installer.ps1`. Bộ cập nhật từ chối thư mục thiếu bộ model của bản đầy đủ.
