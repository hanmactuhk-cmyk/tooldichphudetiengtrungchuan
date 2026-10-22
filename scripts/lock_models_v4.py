from pathlib import Path
import hashlib,json
root=Path('resources/models');old=json.loads(Path('../tool/models.lock.json').read_text(encoding='utf-8'))
models={k:v for k,v in old['models'].items() if k in ['whisper-small','ocr-zh']}
models.update({'qwen3':{'repo':'unsloth/Qwen3-4B-Instruct-2507-GGUF','revision':'a06e946bb6b655725eafa393f4a9745d460374c9'},'vieneu':{'repo':'pnnbao-ump/VieNeu-TTS-v3-Turbo','revision':'61b85e3d937fbbacb387714180e8182823512523','sdkSource':'user provided HnVoice-Ma-Nguon-GitHub.zip','sdkCommit':'bd0f88eb8de7d560753a6172ba9c868f309a101c'},'vieneu-codec':{'repo':'OpenMOSS-Team/MOSS-Audio-Tokenizer-Nano-ONNX','revision':'ceff0d0749bfb3fa2d61149794ec6feef0d1e1ae'}})
files=[]
for name in models:
 for p in sorted((root/name).rglob('*')):
  if not p.is_file() or '.cache' in p.parts:continue
  h=hashlib.sha256()
  with p.open('rb') as f:
   while b:=f.read(8*1024*1024):h.update(b)
  files.append({'path':p.relative_to(root).as_posix(),'size':p.stat().st_size,'sha256':h.hexdigest()})
data=json.dumps({'version':4,'models':models,'files':files},indent=2)
(root/'manifest.json').write_text(data,encoding='utf-8');Path('models.lock.json').write_text(data,encoding='utf-8')
print('Manifest:',len(files),'files; total GB',sum(f['size'] for f in files)/1e9,flush=True)
