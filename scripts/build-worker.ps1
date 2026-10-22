$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $root
python -m pip install -r requirements-desktop.txt
if($LASTEXITCODE){throw 'Install failed'}
python scripts/prepare_models.py
if($LASTEXITCODE){throw 'Model verification failed'}
$env:PYTHONPATH=Join-Path $root 'resources/backend'
$dist=(Resolve-Path dist).Path
python -m PyInstaller --noconfirm --onedir --name hn-worker --distpath resources/runtime --workpath build/worker --specpath scripts --paths resources/backend --add-data "$dist;dist" --collect-all vieneu --collect-all vieneu_utils --collect-all sea_g2p --collect-all soxr --collect-all kaldi_native_fbank --collect-all llama_cpp --collect-all playwright --collect-all faster_whisper --collect-all ctranslate2 --collect-all imageio_ffmpeg --collect-all rapidocr_onnxruntime --collect-all cv2 --exclude-module torch --exclude-module torchaudio --exclude-module transformers --exclude-module gradio --exclude-module piper --exclude-module librosa --exclude-module numba --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.protocols.websockets.auto --hidden-import uvicorn.lifespan.on resources/backend/worker_server.py
if($LASTEXITCODE){throw 'Build failed'}

