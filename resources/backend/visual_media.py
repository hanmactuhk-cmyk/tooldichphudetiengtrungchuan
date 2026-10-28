"""Keyframed scene rendering and bounded template tracking, shared normalized geometry."""
import math,os,uuid,subprocess,bisect
from functools import lru_cache
from pathlib import Path
import cv2,numpy as np,imageio_ffmpeg
from render_encoder import h264_args

def media_path(cache,url):
 name=str(url).removeprefix('/cache/')
 if not str(url).startswith('/cache/') or Path(name).name!=name or Path(name).suffix.lower() not in ['.mp4','.webm','.png','.jpg','.webp']:raise ValueError('Media không hợp lệ.')
 p=Path(cache)/name
 if not p.is_file():raise ValueError('Thiếu media. Hãy tải lại video hoặc ảnh.')
 return p

def geo(c,t):
 keys=c.get('_keys')
 if keys is None:keys=sorted(c.get('keyframes') or [],key=lambda k:k['time'])
 g={k:float(c.get(k,v)) for k,v in [('x',0),('y',0),('width',1),('height',1),('opacity',1)]}
 if keys:
  i=bisect.bisect_right(c.get('_times') or [k['time'] for k in keys],t);a=keys[max(0,i-1)];b=keys[min(len(keys)-1,i)];r=0 if a==b else max(0,min(1,(t-a['time'])/(b['time']-a['time'])))
  g={k:float(a[k])+(float(b[k])-float(a[k]))*r for k in g}
 if not all(math.isfinite(v) for v in g.values()):raise ValueError('Keyframe không hợp lệ.')
 return g

def validate_visuals(clips,cache):
 if len(clips)>500:raise ValueError('Tối đa 500 lớp hình ảnh.')
 for c in clips:
  if c.get('kind') not in ['video','image','blur','text']:raise ValueError('Loại lớp không hợp lệ.')
  a,b=float(c['startTime']),float(c['endTime'])
  if not math.isfinite(a+b) or a<0 or b<=a or b>86400:raise ValueError('Thời gian lớp không hợp lệ.')
  if len(c.get('keyframes',[]))>20000:raise ValueError('Quá nhiều keyframe.')
  geo(c,a)
  crop=c.get('crop')
  if crop:
   vals=[float(crop[k]) for k in ('x','y','width','height')]
   if not all(math.isfinite(v) for v in vals) or min(vals)<0 or min(vals[2:])<.05 or vals[0]+vals[2]>1.001 or vals[1]+vals[3]>1.001:raise ValueError('Khung crop không hợp lệ.')
  if c['kind']!='blur':media_path(cache,c.get('url'))
  if c['kind']=='video':
   start=float(c.get('sourceStart',0));source=cv2.VideoCapture(str(media_path(cache,c['url'])))
   try:limit=source.get(7)/(source.get(5) or 25)
   finally:source.release()
   if not math.isfinite(start) or start<0 or start+(b-a)*float(c.get('rate',1))>limit+.05 or not .1<=float(c.get('rate',1))<=8:raise ValueError('Đoạn cắt vượt thời lượng video nguồn.')
 return clips

@lru_cache(maxsize=128)
def round_mask(w,h,r):
 radius=max(0,min(min(w,h)//2,round(min(w,h)*r)));m=np.zeros((h,w),np.uint8)
 if radius<=0:m[:]=255;return m
 cv2.rectangle(m,(radius,0),(w-radius-1,h-1),255,-1);cv2.rectangle(m,(0,radius),(w-1,h-radius-1),255,-1)
 for x,y in [(radius,radius),(w-radius-1,radius),(radius,h-radius-1),(w-radius-1,h-radius-1)]:cv2.circle(m,(x,y),radius,255,-1,cv2.LINE_AA)
 return m

def flipped(image,c):
 crop=c.get('crop')
 if crop:
  h,w=image.shape[:2];x=max(0,min(w-1,round(float(crop['x'])*w)));y=max(0,min(h-1,round(float(crop['y'])*h)));cw=max(1,min(w-x,round(float(crop['width'])*w)));ch=max(1,min(h-y,round(float(crop['height'])*h)));image=image[y:y+ch,x:x+cw]
 angle=float(c.get('rotation') or 0)
 if angle:
  h,w=image.shape[:2];image=cv2.warpAffine(image,cv2.getRotationMatrix2D((w/2,h/2),-angle,1),(w,h),borderMode=cv2.BORDER_CONSTANT)
 if c.get('flipX') and c.get('flipY'):return cv2.flip(image,-1)
 if c.get('flipX'):return cv2.flip(image,1)
 if c.get('flipY'):return cv2.flip(image,0)
 return image

def prepare_paste(image,g,fit,w,h):
 x,y=round(g['x']*w),round(g['y']*h);bw,bh=max(1,round(g['width']*w)),max(1,round(g['height']*h));bw=min(w*4,bw);bh=min(h*4,bh)
 ih,iw=image.shape[:2];scale=max(bw/iw,bh/ih) if fit=='cover' else min(bw/iw,bh/ih);nw,nh=max(1,round(iw*scale)),max(1,round(ih*scale));im=cv2.resize(image,(nw,nh),interpolation=cv2.INTER_AREA if scale<1 else cv2.INTER_LANCZOS4)
 if fit=='cover':im=im[max(0,(nh-bh)//2):max(0,(nh-bh)//2)+bh,max(0,(nw-bw)//2):max(0,(nw-bw)//2)+bw];nh,nw=im.shape[:2]
 else:x+=(bw-nw)//2;y+=(bh-nh)//2
 return im,x,y

def prepare_blend(image,g,fit,w,h):
 """Resize and premultiply a still layer once, outside the frame loop."""
 image,x,y=prepare_paste(image,g,fit,w,h)
 rgb=image[:,:,:3].astype(np.float32)
 if image.shape[2]==4:alpha=image[:,:,3:4].astype(np.float32)*(max(0,min(1,g['opacity']))/255)
 else:alpha=np.full((*image.shape[:2],1),max(0,min(1,g['opacity'])),dtype=np.float32)
 return {'premultiplied':rgb*alpha,'inverse':1-alpha,'x':x,'y':y}

def paste(frame,image,g,fit,prepared=None):
 h,w=frame.shape[:2]
 if prepared is not None:
  x,y=prepared['x'],prepared['y'];im=prepared['premultiplied'];alpha=prepared['inverse']
 else:
  im,x,y=prepare_paste(image,g,fit,w,h)
  if im.shape[2]==4:alpha=(im[:,:,3:4].astype(np.float32)/255)*max(0,min(1,g['opacity']))
  else:alpha=np.full((*im.shape[:2],1),max(0,min(1,g['opacity'])),dtype=np.float32)
  im=im[:,:,:3].astype(np.float32)*alpha;alpha=1-alpha
 nh,nw=im.shape[:2]
 x0,y0=max(0,x),max(0,y);x1,y1=min(w,x+nw),min(h,y+nh)
 if x1<=x0 or y1<=y0:return
 im=im[y0-y:y1-y,x0-x:x1-x];alpha=alpha[y0-y:y1-y,x0-x:x1-x];dest=frame[y0:y1,x0:x1];frame[y0:y1,x0:x1]=(dest.astype(np.float32)*alpha+im).astype(np.uint8)

def compose_cuda(source,clips,options,cache,folder,progress,cancelled):
 """GPU composite for uncomplicated opaque still-image layers; return None when unsupported."""
 if not clips or options.get('videoEdited') or any(c.get('kind')!='image' for c in clips):return None
 active=[c for c in clips if c.get('enabled',True)]
 if not active:return None
 cap=cv2.VideoCapture(str(source));sw,sh=int(cap.get(3)),int(cap.get(4));fps=cap.get(5) or 25;source_duration=cap.get(7)/fps;cap.release()
 w,h=int(options.get('renderWidth') or sw),int(options.get('renderHeight') or sh)
 duration=max(float(options.get('timelineDuration') or source_duration),max((float(c['endTime']) for c in active),default=0))
 if not 2<=w<=3840 or not 2<=h<=3840 or w%2 or h%2:return None
 images=[]
 for c in active:
  if c.get('keyframes') or c.get('crop') or c.get('flipX') or c.get('flipY') or float(c.get('rotation') or 0) or abs(float(c.get('opacity',1))-1)>.00001 or c.get('textStyle',{}).get('motion') or c.get('fit','contain') not in ('contain','cover'):return None
  g=geo(c,float(c['startTime']));p=media_path(cache,c['url']);im=cv2.imdecode(np.fromfile(str(p),np.uint8),cv2.IMREAD_UNCHANGED)
  if im is None:return None
  if im.ndim==3 and im.shape[2]==4 and np.min(im[:,:,3])<255:return None
  prepared,x,y=prepare_paste(im,g,c.get('fit','contain'),w,h)
  if prepared.ndim==3 and prepared.shape[2]==4:prepared=prepared[:,:,:3]
  layer_path=Path(folder)/f'cuda-layer-{len(images)}.png'
  if not cv2.imwrite(str(layer_path),prepared):return None
  images.append((c,layer_path,x,y))
 render_mode=options.get('renderMode','auto');encoder_args=h264_args('fast',render_mode=render_mode)
 if not encoder_args.count('h264_nvenc'):return None
 ff=imageio_ffmpeg.get_ffmpeg_exe();args=[ff,'-hide_banner','-loglevel','error','-y','-init_hw_device','cuda=cuda:0','-i',str(source)]
 for c,p,x,y in images:
  args+=['-loop','1','-framerate',str(fps),'-t',str(max(.04,float(c['endTime'])-float(c['startTime']))),'-i',str(p)]
 scale=f',scale={w}:{h}:flags=lanczos' if (w,h)!=(sw,sh) else ''
 filters=[f'[0:v]fps={fps}{scale},format=nv12,hwupload_cuda,tpad=stop_mode=clone:stop_duration={max(0,duration-source_duration):.6f}[base0]'];base='base0'
 for index,(c,p,x,y) in enumerate(images,1):
  start=float(c['startTime']);length=float(c['endTime'])-start;layer=f'layer{index}';out=f'base{index}'
  filters.append(f'[{index}:v]trim=duration={length:.6f},setpts=PTS-STARTPTS+{start:.6f}/TB,format=nv12,hwupload_cuda[{layer}]')
  filters.append(f'[{base}][{layer}]overlay_cuda={x}:{y}:eof_action=pass:repeatlast=0[{out}]');base=out
 filters.append(f'[{base}]fps={fps}[outv]')
 target=Path(folder)/'scene-gpu.mp4';args+=['-filter_complex',';'.join(filters),'-map','[outv]','-map','0:a?','-c:a','copy',*encoder_args,'-t',str(duration),'-movflags','+faststart',str(target)]
 process=subprocess.Popen(args,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,creationflags=0x08000000 if os.name=='nt' else 0)
 try:
  while process.poll() is None:
   if cancelled():process.terminate();process.wait(timeout=5);raise RuntimeError('Đã hủy xuất MP4.')
   progress(5,'GPU NVIDIA: đang ghép ảnh và video…')
   import time;time.sleep(.25)
  error=process.stderr.read().decode(errors='replace') if process.stderr else ''
  if process.returncode or not target.is_file() or target.stat().st_size<1024:
   target.unlink(missing_ok=True);return None
 except BaseException:
  if process.poll() is None:process.kill();process.wait()
  target.unlink(missing_ok=True);raise
 return target

def compose_ffmpeg_static(source,clips,options,cache,folder,progress,cancelled):
 """Fast C/FFmpeg composition for fixed image, text and blur layers."""
 if not clips or options.get('videoEdited') or any(c.get('kind') not in ('image','text','blur') for c in clips):return None
 active=[c for c in clips if c.get('enabled',True)]
 if not active:return None
 if any(c.get('keyframes') or (c.get('kind')=='text' and c.get('textStyle',{}).get('motion')) for c in active):return None
 cap=cv2.VideoCapture(str(source));sw,sh=int(cap.get(3)),int(cap.get(4));fps=cap.get(5) or 25;source_duration=cap.get(7)/fps;cap.release()
 w,h=int(options.get('renderWidth') or sw),int(options.get('renderHeight') or sh)
 if not 2<=w<=3840 or not 2<=h<=3840 or w%2 or h%2:return None
 duration=max(float(options.get('timelineDuration') or source_duration),max(float(c['endTime']) for c in active))
 ff=imageio_ffmpeg.get_ffmpeg_exe();args=[ff,'-hide_banner','-loglevel','error','-y','-i',str(source)];filters=[]
 scale=f',scale={w}:{h}:flags=lanczos' if (w,h)!=(sw,sh) else ''
 filters.append(f'[0:v]fps={fps}{scale},setsar=1,tpad=stop_mode=clone:stop_duration={max(0,duration-source_duration):.6f}[base0]')
 base='base0';file_index=0
 for c in active:
  start=max(0,float(c['startTime']));end=float(c['endTime']);length=end-start
  if length<=0:continue
  if c['kind'] in ('image','text'):
   p=media_path(cache,c['url']);im=cv2.imdecode(np.fromfile(str(p),np.uint8),cv2.IMREAD_UNCHANGED)
   if im is None:raise ValueError('Ảnh không đọc được.')
   im=flipped(im,c);g=geo(c,start);im,x,y=prepare_paste(im,g,c.get('fit','contain'),w,h)
   if im.ndim==3 and im.shape[2]==3:im=cv2.cvtColor(im,cv2.COLOR_BGR2BGRA)
   elif im.ndim!=3 or im.shape[2]!=4:return None
   opacity=max(0,min(1,float(g['opacity'])))
   if opacity<.99999:im[:,:,3]=(im[:,:,3].astype(np.float32)*opacity).astype(np.uint8)
   ok,data=cv2.imencode('.png',im)
   if not ok:raise ValueError('Không chuẩn bị được lớp ảnh.')
   layer_path=Path(folder)/f'ffmpeg-layer-{file_index}.png';layer_path.write_bytes(data.tobytes());file_index+=1
   args+=['-loop','1','-framerate',str(fps),'-t',str(length),'-i',str(layer_path)]
   inp=file_index;out=f'base{file_index}';layer=f'layer{file_index}'
   filters.append(f'[{inp}:v]format=rgba,setpts=PTS-STARTPTS+{start:.6f}/TB[{layer}]')
   filters.append(f'[{base}][{layer}]overlay={x}:{y}:eof_action=pass:repeatlast=0:enable=between(t\\,{start:.6f}\\,{end:.6f})[{out}]');base=out
  else:
   g=geo(c,start);x=max(0,min(w-1,round(g['x']*w)));y=max(0,min(h-1,round(g['y']*h)));bw=max(1,min(w-x,round(g['width']*w)));bh=max(1,min(h-y,round(g['height']*h)))
   if bw<2 or bh<2:continue
   sigma=max(1,min(40,float(c.get('strength',16))));rounding=max(0,min(.5,float(c.get('radius',.22))))
   mask=round_mask(bw,bh,rounding);mask_path=Path(folder)/f'ffmpeg-mask-{file_index}.png';file_index+=1
   if not cv2.imwrite(str(mask_path),mask):raise ValueError('Không tạo được mặt nạ vùng mờ.')
   args+=['-loop','1','-framerate',str(fps),'-t',str(length),'-i',str(mask_path)]
   inp=file_index;filtered=f'blurred{file_index}';masked=f'masked{file_index}';out=f'base{file_index}';opacity=max(0,min(1,float(g['opacity'])))
   small_w,small_h=max(2,bw//4),max(2,bh//4)
   filters.extend([f'[{base}]split[clear{file_index}][region{file_index}]',f'[region{file_index}]crop={bw}:{bh}:{x}:{y},scale={small_w}:{small_h}:flags=area,gblur=sigma={max(.25,sigma/4):.4f}:steps=2,scale={bw}:{bh}:flags=bilinear,format=rgba[blurcolor{file_index}]',f'[{inp}:v]format=gray,setpts=PTS-STARTPTS[mask{file_index}]',f'[blurcolor{file_index}][mask{file_index}]alphamerge,colorchannelmixer=aa={opacity:.4f}[{masked}]',f'[clear{file_index}][{masked}]overlay={x}:{y}:eof_action=pass:repeatlast=0:enable=between(t\\,{start:.6f}\\,{end:.6f})[{out}]']);base=out
 target=Path(folder)/'scene-fast.mp4';filters.append(f'[{base}]fps={fps}[outv]')
 args+=['-filter_complex',';'.join(filters),'-map','[outv]','-map','0:a?','-c:a','copy',*h264_args('fast',render_mode=options.get('renderMode','auto')),'-t',str(duration),'-movflags','+faststart','-progress','pipe:1','-nostats',str(target)]
 process=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,creationflags=0x08000000 if os.name=='nt' else 0)
 try:
  for line in process.stdout:
   if cancelled():process.terminate();raise RuntimeError('Đã hủy xuất MP4.')
   if line.startswith('out_time_us='):
    try:progress(min(58,4+int(int(line.split('=')[1])/1e6/max(.1,duration)*54)),'Đang ghép ảnh và vùng mờ bằng FFmpeg…')
    except ValueError:pass
  error=process.stderr.read() if process.stderr else ''
  if process.wait() or not target.is_file() or target.stat().st_size<1024:
   target.unlink(missing_ok=True);raise ValueError('Không ghép được lớp ảnh / vùng mờ: '+error[-1200:])
 except BaseException:
  if process.poll() is None:process.kill();process.wait()
  target.unlink(missing_ok=True);raise
 return target

def prepare_ffmpeg_static_layers(source,clips,options,cache,folder):
 """Prepare fixed image/text and blur inputs for the final export filter graph."""
 if not clips or options.get('videoEdited') or any(c.get('kind') not in ('image','text','blur') for c in clips):return None
 active=sorted((c for c in clips if c.get('enabled',True)),key=lambda c:c.get('layer',{'image':1,'text':1,'blur':2}[c['kind']]))
 if not active or any(c.get('keyframes') for c in active):return None
 supported_opening={'fade','left','right','up','down','zoom-in','zoom-out','bounce'}
 for c in active:
  motion=(c.get('textStyle') or {}).get('motion') or {}
  for phase,preset in motion.items():
   effect=(preset or {}).get('effect','none')
   if effect=='none':continue
   if phase!='enter' or effect not in supported_opening:return None
 cap=cv2.VideoCapture(str(source));sw,sh=int(cap.get(3)),int(cap.get(4));cap.release()
 w,h=int(options.get('renderWidth') or sw),int(options.get('renderHeight') or sh)
 if not 2<=w<=3840 or not 2<=h<=3840 or w%2 or h%2:return None
 prepared=[]
 for index,c in enumerate(active):
  start=max(0,float(c['startTime']));end=float(c['endTime']);length=end-start
  if length<=0:continue
  g=geo(c,start)
  if c['kind'] in ('image','text'):
   image=cv2.imdecode(np.fromfile(str(media_path(cache,c['url'])),np.uint8),cv2.IMREAD_UNCHANGED)
   if image is None:raise ValueError('Ảnh không đọc được.')
   image=flipped(image,c);image,x,y=prepare_paste(image,g,c.get('fit','contain'),w,h)
   if image.ndim==3 and image.shape[2]==3:image=cv2.cvtColor(image,cv2.COLOR_BGR2BGRA)
   if image.ndim!=3 or image.shape[2]!=4:return None
   opacity=max(0,min(1,float(g['opacity'])))
   if opacity<.99999:image[:,:,3]=(image[:,:,3].astype(np.float32)*opacity).astype(np.uint8)
   path=Path(folder)/f'final-layer-{index}.png'
   if not cv2.imwrite(str(path),image):raise ValueError('Không chuẩn bị được lớp ảnh.')
   motion=(c.get('textStyle') or {}).get('motion') or {};opening=motion.get('enter') or {}
   prepared.append({'kind':'image','path':path,'x':x,'y':y,'width':image.shape[1],'height':image.shape[0],'start':start,'end':end,'motion':opening if opening.get('effect') in supported_opening else None})
  else:
   x=max(0,min(w-1,round(g['x']*w)));y=max(0,min(h-1,round(g['y']*h)));bw=max(1,min(w-x,round(g['width']*w)));bh=max(1,min(h-y,round(g['height']*h)))
   if bw<2 or bh<2:continue
   path=Path(folder)/f'final-mask-{index}.png'
   if not cv2.imwrite(str(path),round_mask(bw,bh,max(0,min(.5,float(c.get('radius',.22)))))):raise ValueError('Không tạo được mặt nạ vùng mờ.')
   prepared.append({'kind':'blur','path':path,'x':x,'y':y,'width':bw,'height':bh,'strength':max(1,min(40,float(c.get('strength',16)))),'opacity':max(0,min(1,float(g['opacity']))),'start':start,'end':end})
 return prepared

def compose(source,options,cache,folder,progress,cancelled):
 clips=[dict(c) for c in validate_visuals(options.get('visuals') or [],cache)]
 clips.sort(key=lambda c:c.get('layer',{'video':0,'image':1,'text':1,'blur':2}[c['kind']]))
 gpu_result=compose_cuda(source,clips,options,cache,folder,progress,cancelled)
 if gpu_result is not None:
  progress(59,'Đã ghép lớp bằng GPU NVIDIA.')
  return gpu_result
 fast_result=compose_ffmpeg_static(source,clips,options,cache,folder,progress,cancelled)
 if fast_result is not None:
  progress(59,'Đã ghép lớp tĩnh bằng FFmpeg.')
  return fast_result
 for c in clips:c['_keys']=sorted(c.get('keyframes') or [],key=lambda k:k['time']);c['_times']=[k['time'] for k in c['_keys']]
 cap=cv2.VideoCapture(str(source));w,h=int(cap.get(3)),int(cap.get(4));source_fps=cap.get(5) or 25;fps=min(60,source_fps);source_duration=cap.get(7)/source_fps;cap.release()
 w,h=int(options.get('renderWidth') or w),int(options.get('renderHeight') or h)
 if not 2<=w<=3840 or not 2<=h<=3840 or w%2 or h%2:raise ValueError('Kích thước xuất không hợp lệ.')
 duration=max(float(options.get('timelineDuration') or source_duration),max((c['endTime'] for c in clips),default=0));frames=math.ceil(duration*fps)
 video=[c for c in clips if c['kind']=='video'];edited=options.get('videoEdited',bool(video));caps={};images={};prepared={}
 for c in clips:
  if c['kind']=='video':
   from media_tools import AlphaCapture
   caps[c['id']]=AlphaCapture(media_path(cache,c['url'])) if str(c['url']).endswith('.webm') else cv2.VideoCapture(str(media_path(cache,c['url'])))
  elif c['kind'] in ['image','text']:
   image=cv2.imdecode(np.fromfile(str(media_path(cache,c['url'])),np.uint8),cv2.IMREAD_UNCHANGED)
   if image is None:raise ValueError('Ảnh không đọc được.')
   images[c['id']]=image
   style=c.get('textStyle') or {};motion=style.get('motion')
   if not c.get('keyframes') and not motion:
    g=geo(c,float(c['startTime']));prepared[c['id']]=prepare_blend(flipped(image,c),g,c.get('fit','contain'),w,h)
 if not edited:caps['_base']=cv2.VideoCapture(str(source))
 raw=Path(folder)/'scene-silent.mp4';writer=FrameWriter(raw,w,h,fps,options.get('renderMode','auto'))
 if not writer.isOpened():raise ValueError('Không tạo được khung dựng video.')
 try:
  for n in range(frames):
   if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   t=n/fps;frame=np.zeros((h,w,3),np.uint8)
   if not edited:
    c=caps['_base'];target=round(min(t,max(0,source_duration-1/fps))*(c.get(5) or fps))
    if abs(c.get(cv2.CAP_PROP_POS_FRAMES)-target)>1:c.set(cv2.CAP_PROP_POS_FRAMES,target)
    ok,img=c.read()
    if ok:frame=cv2.resize(img,(w,h),interpolation=cv2.INTER_LANCZOS4)
   for c in clips:
    kind=c['kind']
    if not c.get('enabled',True) or not c['startTime']<=t<c['endTime']:continue
    g=geo(c,t)
    if kind=='video':
     v=caps[c['id']];target=round((float(c.get('sourceStart',0))+(t-c['startTime'])*float(c.get('rate',1)))*(v.get(5) or fps))
     if abs(v.get(cv2.CAP_PROP_POS_FRAMES)-target)>1:v.set(cv2.CAP_PROP_POS_FRAMES,target)
     ok,img=v.read()
     if ok:paste(frame,flipped(img,c),g,c.get('fit','contain'))
    elif kind in ['image','text']:
     im=images[c['id']]
     if kind=='text' and (c.get('textStyle') or {}).get('motion'):
      from media_tools import text_motion
      m=text_motion(c['textStyle']['motion'],t,c['startTime'],c['endTime'],len(c.get('text') or ''),len((c.get('text') or '').split()))
      g={**g,'x':g['x']+m['x']+g['width']*(1-m['scale'])/2,'y':g['y']+m['y']+g['height']*(1-m['scale'])/2,'width':g['width']*m['scale'],'height':g['height']*m['scale'],'opacity':g['opacity']*m['opacity']}
      if m['reveal']<1:im=im.copy();im[:,round(im.shape[1]*m['reveal']):]=0
      if m['glow'] and im.shape[2]==4:
       glow=cv2.GaussianBlur(im,(0,0),max(.1,m['glow']*8));im=np.maximum(im,glow)
     paste(frame,im,g,c.get('fit','contain'),prepared.get(c['id']))
    else:
     x,y=max(0,min(w-1,round(g['x']*w))),max(0,min(h-1,round(g['y']*h)));bw,bh=max(1,min(w-x,round(g['width']*w))),max(1,min(h-y,round(g['height']*h)));roi=frame[y:y+bh,x:x+bw];sigma=max(1,min(40,float(c.get('strength',16))));sw,sh=max(1,(bw+3)//4),max(1,(bh+3)//4);small=cv2.resize(roi,(sw,sh),interpolation=cv2.INTER_AREA);small=cv2.GaussianBlur(small,(0,0),max(.25,sigma/4));blurred=cv2.resize(small,(bw,bh),interpolation=cv2.INTER_LINEAR);alpha=round_mask(bw,bh,max(0,min(.5,float(c.get('radius',.22)))))[:,:,None]/255*max(0,min(1,g['opacity']));frame[y:y+bh,x:x+bw]=(roi*(1-alpha)+blurred*alpha).astype(np.uint8)
   writer.write(frame)
   if n%max(1,round(fps))==0:progress(min(59,2+int(n/max(1,frames)*57)),'Dựng video / ảnh / chuyển động…')
 finally:
  writer.release()
  for c in caps.values():c.release()
 # Reconstruct source audio according to trimmed/moved video clips.
 if video:
  args=[imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(raw)];filters=[];labels=[];idx=1
  for c in video:
   if not c.get('enabled',True) or c.get('audioMuted'):continue
   p=media_path(cache,c['url']);probe=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-i',str(p)],capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
   if b'Audio:' not in probe.stderr:continue
   args+=['-i',str(p)];from dubbing import tempo_filters
   filters.append(f"[{idx}:a]atrim=start={float(c.get('sourceStart',0))}:duration={(c['endTime']-c['startTime'])*float(c.get('rate',1))},asetpts=PTS-STARTPTS,"+tempo_filters(float(c.get('rate',1)))+f",adelay={round(c['startTime']*1000)}:all=1[a{idx}]");labels.append(f'[a{idx}]');idx+=1
  if labels:
   filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=longest:normalize=0,apad[a]');target=Path(folder)/'scene.mp4';args+=['-filter_complex',';'.join(filters),'-map','0:v','-map','[a]','-c:v','copy','-c:a','aac','-t',str(duration),str(target)];r=subprocess.run(args,capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
   if r.returncode:raise ValueError('Không ghép được tiếng video đã cắt: '+r.stderr.decode(errors='replace')[-600:])
   return target
 elif not edited and not options.get('originalMuted',False):
  # Keep the unedited source audio when only images/blur are added.
  target=Path(folder)/'scene.mp4';r=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(raw),'-i',str(source),'-map','0:v','-map','1:a?','-c:v','copy','-c:a','aac','-t',str(duration),str(target)],capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
  if r.returncode==0:return target
 return raw

def track(source,start,end,region,progress,cancelled):
 cap=cv2.VideoCapture(str(source));fps=cap.get(5) or 25;w,h=int(cap.get(3)),int(cap.get(4));duration=cap.get(7)/fps;end=min(end,duration)
 if start<0 or end<=start:raise ValueError('Khoảng bám không hợp lệ.')
 if end-start>1800:raise ValueError('Mỗi lần bám tối đa 30 phút; chia vùng mờ thành các khoảng ngắn hơn.')
 scale=min(1,960/max(w,h));sw,sh=round(w*scale),round(h*scale);x,y=round(region['x']*sw),round(region['y']*sh);bw,bh=max(8,round(region['width']*sw)),max(8,round(region['height']*sh));x=max(0,min(sw-bw,x));y=max(0,min(sh-bh,y))
 cap.set(cv2.CAP_PROP_POS_MSEC,start*1000);ok,first=cap.read()
 if not ok:cap.release();raise ValueError('Không đọc được hình để bám.')
 gray=cv2.cvtColor(cv2.resize(first,(sw,sh)),cv2.COLOR_BGR2GRAY);template=gray[y:y+bh,x:x+bw].copy()
 if template.size==0 or template.std()<3:cap.release();raise ValueError('Vùng quá trống để bám. Chọn vùng có chữ hoặc chi tiết rõ hơn.')
 keys=[];lost=False;step=max(1,round(fps/8));last=(x,y)
 try:
  for n in range(round(start*fps),round(end*fps),step):
   if cancelled():raise RuntimeError('Đã dừng bám đối tượng.')
   t=n/fps;cap.set(cv2.CAP_PROP_POS_FRAMES,n);ok,frame=cap.read()
   if not ok:break
   gray=cv2.cvtColor(cv2.resize(frame,(sw,sh)),cv2.COLOR_BGR2GRAY);x,y=last;pad=max(32,round(max(bw,bh)*.6));x0,y0=max(0,x-pad),max(0,y-pad);x1,y1=min(sw,x+bw+pad),min(sh,y+bh+pad);search=gray[y0:y1,x0:x1]
   result=cv2.matchTemplate(search,template,cv2.TM_CCOEFF_NORMED);_,score,_,loc=cv2.minMaxLoc(result)
   if score<.40:lost=True;break
   x,y=x0+loc[0],y0+loc[1];last=x,y;keys.append({'time':t,'x':x/sw,'y':y/sh,'width':bw/sw,'height':bh/sh,'opacity':float(region.get('opacity',1))});progress(min(99,round((t-start)/(end-start)*100)),'Đang bám chữ / vật thể…')
 finally:cap.release()
 if not keys:raise ValueError('Không tìm được đối tượng ổn định. Hãy chọn vùng nhỏ và rõ hơn.')
 progress(100,'Đã tạo chuyển động bám đối tượng.');return {'keyframes':keys,'lost':lost}

class FrameWriter:
 def __init__(self,target,w,h,fps,render_mode='auto'):
  self.errors=open(str(target)+'.log','w+b')
  self.process=subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s',f'{w}x{h}','-r',str(fps),'-i','pipe:0','-an',*h264_args('fast',intermediate=True,render_mode=render_mode),'-pix_fmt','yuv420p',str(target)],stdin=subprocess.PIPE,stderr=self.errors,creationflags=0x08000000 if os.name=='nt' else 0)
 def isOpened(self):return self.process.poll() is None
 def write(self,frame):self.process.stdin.write(frame.tobytes())
 def release(self):
  self.process.stdin.close();code=self.process.wait();self.errors.seek(0);message=self.errors.read().decode(errors='replace');self.errors.close()
  if code:raise ValueError('Không dựng được video: '+message[-1200:])
