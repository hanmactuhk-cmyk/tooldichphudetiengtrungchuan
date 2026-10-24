# Thành phần bên thứ ba

- VieNeu SDK: nguồn ZIP người dùng cung cấp, commit `bd0f88eb8de7d560753a6172ba9c868f309a101c`, Apache-2.0. Giữ nguyên giấy phép tại resources/backend/VIENEU-LICENSE. Model: https://huggingface.co/pnnbao-ump/VieNeu-TTS-v3-Turbo
- MOSS Audio Tokenizer Nano ONNX: https://huggingface.co/OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX ; revision trong models.lock.json.
- Whisper / faster-whisper: https://github.com/SYSTRAN/faster-whisper ; model https://huggingface.co/Systran/faster-whisper-small
- RapidOCR: https://github.com/RapidAI/RapidOCR ; trọng số OCR đi kèm rapidocr-onnxruntime 1.4.4.
- Qwen3-4B-Instruct-2507: https://huggingface.co/Qwen/Qwen3-4B-Instruct-2507 ; bản GGUF https://huggingface.co/unsloth/Qwen3-4B-Instruct-2507-GGUF
- llama.cpp / llama-cpp-python: https://github.com/abetlen/llama-cpp-python
- Electron: https://www.electronjs.org ; giấy phép Electron/Chromium trong LICENSE.electron.txt và LICENSES.chromium.html của bản chạy.
- FFmpeg qua imageio-ffmpeg: https://github.com/imageio/imageio-ffmpeg ; xem giấy phép của binary FFmpeg đi kèm trước khi phân phối/sửa binary.
- React, Vite, Tailwind, Lucide, FastAPI, ONNX Runtime, Playwright và các phụ thuộc khác giữ giấy phép riêng. pnpm-lock.yaml khóa phụ thuộc JS; requirements-desktop.txt khóa các phụ thuộc Python trực tiếp; requirements-lock.txt lưu môi trường kiểm thử.

Các dịch vụ Gemini và ChatGPT không được nhúng vào bản offline. Người dùng tự đăng nhập tài khoản của mình và tuân theo điều khoản/hạn mức của dịch vụ. Không phát hành credential, hồ sơ đăng nhập hay model lấy từ nguồn không ghi nhận.

- Tách giọng/nền: MDX-Net UVR-MDX-NET-Inst_HQ_2 từ https://github.com/TRvlvr/model_repo và cấu hình https://github.com/TRvlvr/application_data; mã suy luận cục bộ độc lập dùng ONNX Runtime và NumPy STFT, xử lý stereo theo cửa sổ có chồng lấn. Nguồn và SHA256 khóa trong models.lock.json. Tham khảo triển khai/giấy phép UVR tại https://github.com/Anjok07/ultimatevocalremovergui.
- Phông chữ được đọc từ Windows đã cài; không phân phối lại các file phông của Microsoft.


## Natural Earth land outlines
The decorative world map uses Natural Earth 1:110m land outlines (public domain), simplified to normalized coordinates in src/lib/world-land.json. Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson . Terms: https://www.naturalearthdata.com/about/terms-of-use/ . No map data is loaded from the network at runtime.


## Vietnamese caption font pack
33 families sourced from Google Fonts, distributed under the SIL Open Font License. Each family license and the exact file hashes are included in public/fonts/ (manifest.json and *-OFL.txt). Regular/bold/italic static instances are generated from the upstream fonts where supported. scripts/fetch-caption-fonts.py records upstream locations; scripts/test-font-pack.py checks Vietnamese coverage, hashes and licenses. Fonts load locally without network access and are also passed to the MP4 subtitle renderer.

## Background removal in HN601

U-2-Net (U2NetP), Apache-2.0: https://github.com/xuebinqin/U-2-Net . ONNX weights distributed through https://github.com/danielgatis/rembg/releases/tag/v0.0.0 . Model and original license are bundled in resources/models/background; hashes are in models.lock.json.
