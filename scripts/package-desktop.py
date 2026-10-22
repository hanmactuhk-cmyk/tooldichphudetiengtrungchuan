"""Stream a full portable app into GitHub-sized ZIP parts, never storing a second full ZIP."""
import argparse,hashlib,json,zipfile,io,subprocess
from pathlib import Path
class Volumes(io.RawIOBase):
 def __init__(self,folder,limit,on_part=None):self.folder=folder;self.limit=limit;self.offset=0;self.part=None;self.parts=[];self.used=0;self.on_part=on_part
 def writable(self):return True
 def seekable(self):return False
 def tell(self):return self.offset
 def write(self,data):
  length=len(data);view=memoryview(data)
  while view:
   if self.part is None or self.used==self.limit:
    if self.part:
     self.part.close()
     if self.on_part:self.on_part(self.parts[-1])
    p=self.folder/f'HNVoice-Electron-5.0.0-Windows.zip.{len(self.parts)+1:03d}';self.part=p.open('wb');self.parts.append(p);self.used=0
   count=min(len(view),self.limit-self.used);self.part.write(view[:count]);self.used+=count;self.offset+=count;view=view[count:]
  return length
 def finish(self):
  if self.part:self.part.close();self.part=None
class Joined(io.RawIOBase):
 def __init__(self,parts):self.parts=parts;self.sizes=[p.stat().st_size for p in parts];self.pos=0
 def readable(self):return True
 def seekable(self):return True
 def tell(self):return self.pos
 def seek(self,offset,whence=0):
  self.pos=offset if whence==0 else self.pos+offset if whence==1 else sum(self.sizes)+offset
  if self.pos<0:raise ValueError('Negative seek')
  return self.pos
 def read(self,size=-1):
  size=sum(self.sizes)-self.pos if size<0 else min(size,sum(self.sizes)-self.pos);chunks=[];base=0
  for path,length in zip(self.parts,self.sizes):
   if size and base+length>self.pos:
    start=max(0,self.pos-base);take=min(size,length-start)
    with path.open('rb') as f:f.seek(start);chunks.append(f.read(take))
    self.pos+=take;size-=take
   base+=length
  return b''.join(chunks)
def main():
 p=argparse.ArgumentParser();p.add_argument('app',type=Path);p.add_argument('out',type=Path);p.add_argument('--upload-repo');p.add_argument('--tag',default='v5.0.0');p.add_argument('--gh',default='gh');args=p.parse_args();args.out.mkdir(parents=True,exist_ok=True)
 manifest={'version':'5.0.0','archive':'HNVoice-Electron-5.0.0-Windows.zip','parts':[]}
 def upload(file,remove=True):
  with file.open('rb') as handle:digest=hashlib.file_digest(handle,'sha256').hexdigest()
  record={'name':file.name,'size':file.stat().st_size,'sha256':digest}
  print('Uploading '+file.name,flush=True)
  subprocess.run([args.gh,'release','upload',args.tag,str(file),'--repo',args.upload_repo],check=True)
  release=json.loads(subprocess.check_output([args.gh,'api','repos/'+args.upload_repo+'/releases/tags/'+args.tag],text=True,encoding='utf-8'))
  asset=next(a for a in release['assets'] if a['name']==file.name)
  assert asset['size']==record['size']
  assert asset.get('digest')=='sha256:'+digest, 'GitHub asset SHA256 mismatch or missing digest'
  record['githubDigestVerified']=True;manifest['parts'].append(record)
  (args.out/'release-parts.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
  if remove:file.unlink()
  print('Verified '+file.name+' on GitHub.',flush=True)
 sink=Volumes(args.out,1000*1024**2 if args.upload_repo else 1400*1024**2,upload if args.upload_repo else None)
 with zipfile.ZipFile(sink,'w',zipfile.ZIP_DEFLATED,compresslevel=1,allowZip64=True) as z:
  for file in sorted(args.app.rglob('*')):
   if file.is_file():
    rel=file.relative_to(args.app)
    if any(n in ('data','cache','chrome-profiles') for n in rel.parts) or file.name in ('local-settings.json','desktop-settings.json') or file.suffix=='.log':continue
    z.write(file,(Path('HNVoice-Electron')/rel).as_posix())
 sink.finish()
 if args.upload_repo:
  # The last part contains the central directory; validate every entry against the writer metadata.
  with zipfile.ZipFile(sink.parts[-1]) as check:
   assert [(i.filename,i.CRC,i.file_size) for i in check.infolist()]==[(i.filename,i.CRC,i.file_size) for i in z.infolist()]
  upload(sink.parts[-1],remove=True)
  manifest['centralDirectoryVerified']=True
  (args.out/'release-parts.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
  print('Every part SHA256 verified on GitHub; central directory verified.',flush=True)
  return
 print('ZIP parts written, verifying all compressed files...',flush=True)
 with zipfile.ZipFile(Joined(sink.parts)) as z:
  assert z.testzip() is None
  assert 'HNVoice-Electron/HN Voice Studio.exe' in z.namelist()
  assert 'HNVoice-Electron/resources/models/manifest.json' in z.namelist()
 manifest={'version':'5.0.0','archive':'HNVoice-Electron-5.0.0-Windows.zip','crcVerified':True,'parts':[]}
 for f in sink.parts:
  with f.open('rb') as handle:digest=hashlib.file_digest(handle,'sha256').hexdigest()
  manifest['parts'].append({'name':f.name,'size':f.stat().st_size,'sha256':digest})
 (args.out/'release-parts.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8');print('All ZIP entries and part checksums verified.',flush=True)
if __name__=='__main__':main()
