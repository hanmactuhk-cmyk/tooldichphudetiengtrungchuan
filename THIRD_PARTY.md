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
