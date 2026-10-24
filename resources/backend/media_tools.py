"""HN601 bounded media operations. Originals are never overwritten."""
import os,math,uuid,subprocess,threading
from pathlib import Path
import cv2,numpy as np,imageio_ffmpeg
_LOCK=threading.Lock();_SESSION=None

def source_path(cache,url):
 from visual_media import media_path
 return media_path(cache,url)

def foreground(image,model):
 global _SESSION
 import onnxruntime as ort
 with _LOCK:
  if _SESSION is None:
   cfg=ort.SessionOptions();cfg.intra_op_num_threads=min(4,os.cpu_count() or 2)
   _SESSION=ort.InferenceSession(str(model),sess_options=cfg,providers=['CPUExecutionProvider'])
  session=_SESSION
 rgb=cv2.cvtColor(image[:,:,:3],cv2.COLOR_BGR2RGB);small=cv2.resize(rgb,(320,320)).astype(np.float32);small/=max(float(small.max()),1)
 small=(small-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
 mask=session.run(None,{session.get_inputs()[0].name:small.transpose(2,0,1)[None]})[0][0,0]
 mask=(mask-mask.min())/max(float(mask.max()-mask.min()),1e-6)
 return cv2.resize(mask,(image.shape[1],image.shape[0]))

def cutout_frame(image,options,models):
 if options.get('mode')=='auto':mask=foreground(image,Path(models)/'background/u2netp.onnx')
 else:
  color=str(options.get('color','#00ff00'))
  if len(color)!=7 or color[0]!='#':raise ValueError('Màu key không hợp lệ.')
  rgb=np.array([int(color[i:i+2],16) for i in (1,3,5)],np.float32)
  distance=np.sqrt(((image[:,:,:3][:,:,::-1].astype(np.float32)-rgb)**2).mean(axis=2))/255
  threshold=max(0,min(1,float(options.get('threshold',.22))));soft=max(.005,min(.5,float(options.get('softness',.08))))
  mask=np.clip((distance-threshold)/soft,0,1)
 if image.shape[2]==4:mask*=image[:,:,3]/255
 return np.dstack([image[:,:,:3],np.uint8(np.clip(mask,0,1)*255)])

def cutout(source,options,cache,models,progress,cancelled):
 output=Path(cache)/(uuid.uuid4().hex+('.png' if options['kind']=='image' else '.webm'))
 if options.get('mode')=='auto' and not (Path(models)/'background/u2netp.onnx').is_file():raise ValueError('Thiếu bộ xóa nền offline của HN601.')
 if options['kind']=='image':
  im=cv2.imdecode(np.fromfile(str(source),np.uint8),cv2.IMREAD_UNCHANGED)
  if im is None:raise ValueError('Ảnh không đọc được.')
  if cancelled():raise RuntimeError('Đã dừng xóa nền.')
  result=cutout_frame(im,options,models);ok,buf=cv2.imencode('.png',result)
  if not ok:raise ValueError('Không tạo được ảnh trong suốt.')
  buf.tofile(str(output));progress(100,'Đã tạo ảnh trong suốt.');return {'url':'/cache/'+output.name}
 cap=cv2.VideoCapture(str(source));w,h=int(cap.get(3)),int(cap.get(4));fps=cap.get(5) or 25;total=int(cap.get(7))
 if min(w,h)<2 or total<1:cap.release();raise ValueError('Video không đọc được.')
 args=[imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-f','rawvideo','-pix_fmt','bgra','-s',f'{w}x{h}','-r',str(fps),'-i','pipe:0','-i',str(source),'-map','0:v','-map','1:a?','-c:v','libvpx-vp9','-pix_fmt','yuva420p','-auto-alt-ref','0','-deadline','realtime','-cpu-used','6','-crf','30','-b:v','0','-c:a','libopus','-shortest',str(output)]
 error=output.with_suffix('.log')
 try:
  with error.open('wb') as log:
   process=subprocess.Popen(args,stdin=subprocess.PIPE,stderr=log,creationflags=0x08000000 if os.name=='nt' else 0)
   try:
    for n in range(total):
     if cancelled():raise RuntimeError('Đã dừng xóa nền.')
     ok,im=cap.read()
     if not ok:break
     process.stdin.write(cutout_frame(im,options,models).tobytes())
     if n%max(1,round(fps/2))==0:progress(min(99,int((n+1)/total*100)),'Xóa nền video '+str(n+1)+'/'+str(total)+' khung hình')
    process.stdin.close()
    if process.wait()!=0:raise ValueError('Không tạo được video trong suốt: '+error.read_text(errors='replace')[-600:])
   except BaseException:
    if process.poll() is None:process.kill();process.wait()
    output.unlink(missing_ok=True);raise
 finally:cap.release();error.unlink(missing_ok=True)
 progress(100,'Đã xóa nền video.');return {'url':'/cache/'+output.name}

class AlphaCapture:
 def __init__(self,path):
  self.path=path;p=cv2.VideoCapture(str(path));self.w,self.h=int(p.get(3)),int(p.get(4));self.fps=p.get(5) or 25;self.total=p.get(7);p.release();self.pos=0;self.process=None
 def get(self,k):return self.fps if k==5 else self.pos if k==1 else self.total if k==7 else 0
 def set(self,k,n):
  if k==1:self.release();self.pos=max(0,int(n))
 def read(self):
  if self.process is None:
   self.process=subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-c:v','libvpx-vp9','-ss',str(self.pos/self.fps),'-i',str(self.path),'-an','-f','rawvideo','-pix_fmt','bgra','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,creationflags=0x08000000 if os.name=='nt' else 0)
  data=self.process.stdout.read(self.w*self.h*4)
  if len(data)!=self.w*self.h*4:return False,None
  self.pos+=1;return True,np.frombuffer(data,np.uint8).reshape(self.h,self.w,4)
 def release(self):
  if self.process:
   if self.process.poll() is None:self.process.kill()
   self.process.wait();self.process.stdout.close();self.process=None
def text_motion(m,t,a,b,count=20,words=5):
 out=dict(x=0,y=0,scale=1,opacity=1,reveal=1,glow=0)
 if not m:return out
 for phase,preset in m.items():
  if not preset or preset.get('effect')=='none':continue
  duration=max(.08,min(preset.get('duration',.5),max(.08,(b-a)/2)));loop=phase=='loop'
  p=((t-a)%max(.1,preset.get('duration',.5)))/max(.1,preset.get('duration',.5)) if loop else max(0,min(1,((b-t) if phase=='exit' else (t-a))/duration))
  linear=p
  if not loop and preset.get('effect') not in ('typewriter','words'):p=p*p if phase=='exit' else 1-(1-p)**3
  intensity=preset.get('intensity',1);effect=preset.get('effect')
  if effect=='fade':out['opacity']*=.825-.175*math.cos(p*math.pi*2) if loop else p
  if effect in ('left','right','up','down'):
   v=(math.sin(p*math.pi*2)*.04 if loop else (1-p)*.15)*intensity
   out['x' if effect in ('left','right') else 'y']+=-v if effect in ('left','up') else v
   if not loop:out['opacity']*=p
  if effect in ('zoom-in','zoom-out'):out['scale']*=1+math.sin(p*math.pi*2)*.08*intensity if loop else 1+(-1 if effect=='zoom-in' else 1)*(1-p)*.5*intensity
  if effect=='bounce':out['scale']*=1+abs(math.sin(p*math.pi*2))*.12*intensity if loop else 1-math.exp(-7*linear)*math.cos(linear*math.pi*3)*.3*intensity*(1 if linear<1 else 0)
  if not loop and effect in ('zoom-in','zoom-out','bounce'):out['opacity']*=p
  if effect in ('typewriter','words'):
   n=max(1,words if effect=='words' else count);out['reveal']*=1 if p>=1 else (math.floor(p*n)+min(1,(p*n%1)*3))/n
  if effect=='shake':out['x']+=math.sin((t-a)*30)*.01*intensity
  if effect=='blink':out['opacity']*=.45+.55*(math.sin((t-a)*10)+1)/2
  if effect=='glow':out['glow']=max(out['glow'],(.4+.6*(math.sin((t-a)*7)+1)/2)*intensity)
 out['scale']=max(.05,out['scale']);return out
