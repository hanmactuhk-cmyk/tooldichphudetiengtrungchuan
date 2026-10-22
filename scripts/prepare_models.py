"""Prepare exact pinned artifacts; refuse altered files rather than changing the lock."""
import argparse,hashlib,json,os,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];TARGET=ROOT/'resources/models'
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  while b:=f.read(8*1024*1024):h.update(b)
 return h.hexdigest()
def prepare(verify_only=False):
 manifest=json.loads((ROOT/'models.lock.json').read_text(encoding='utf-8'))
 os.environ['HF_HUB_DISABLE_XET']='1'
 for item in manifest['files']:
  relative=Path(item['path']);path=TARGET/relative
  if not path.is_file():
   if verify_only:raise RuntimeError('Missing '+str(path))
   name=relative.parts[0];source=manifest['models'][name];path.parent.mkdir(parents=True,exist_ok=True)
   if name=='ocr-zh':
    import rapidocr_onnxruntime
    shutil.copy2(Path(rapidocr_onnxruntime.__file__).parent/'models'/relative.name,path)
   elif relative.name=='SOURCE.txt':path.write_text(source['repo']+'\n'+source['revision'])
   else:
    from huggingface_hub import hf_hub_download
    filename=Path(*relative.parts[1:]).as_posix()
    hf_hub_download(source['repo'],filename,revision=source['revision'],local_dir=TARGET/name)
  if path.stat().st_size!=item['size'] or sha(path)!=item['sha256']:raise RuntimeError('Checksum mismatch: '+str(path))
 (TARGET/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
 print('Verified',len(manifest['files']),'model artifacts.')
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--verify',action='store_true');args=parser.parse_args();prepare(args.verify)
