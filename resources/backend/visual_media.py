"""Keyframed scene rendering and bounded template tracking, shared normalized geometry."""
import math,os,uuid,subprocess,bisect
from functools import lru_cache
from pathlib import Path
import cv2,numpy as np,imageio_ffmpeg

def media_path(cache,url):
 name=str(url).removeprefix('/cache/')
 if not str(url).startswith('/cache/') or Path(name).name!=name or Path(name).suffix.lower() not in ['.mp4','.png','.jpg','.webp']:raise ValueError('Media không hợp lệ.')
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
  if c.get('kind') not in ['video','image','blur']:raise ValueError('Loại lớp không hợp lệ.')
  a,b=float(c['startTime']),float(c['endTime'])
  if not math.isfinite(a+b) or a<0 or b<=a or b>86400:raise ValueError('Thời gian lớp không hợp lệ.')
  if len(c.get('keyframes',[]))>20000:raise ValueError('Quá nhiều keyframe.')
  geo(c,a)
  if c['kind']!='blur':media_path(cache,c.get('url'))
  if c['kind']=='video':
   start=float(c.get('sourceStart',0));source=cv2.VideoCapture(str(media_path(cache,c['url'])))
   try:limit=source.get(7)/(source.get(5) or 25)
   finally:source.release()
   if not math.isfinite(start) or start<0 or start+b-a>limit+.05:raise ValueError('Đoạn cắt vượt thời lượng video nguồn.')
 return clips

@lru_cache(maxsize=128)
def round_mask(w,h,r):
 radius=max(0,min(min(w,h)//2,round(min(w,h)*r)));m=np.zeros((h,w),np.uint8)
 if radius<=0:m[:]=255;return m
 cv2.rectangle(m,(radius,0),(w-radius-1,h-1),255,-1);cv2.rectangle(m,(0,radius),(w-1,h-radius-1),255,-1)
 for x,y in [(radius,radius),(w-radius-1,radius),(radius,h-radius-1),(w-radius-1,h-radius-1)]:cv2.circle(m,(x,y),radius,255,-1,cv2.LINE_AA)
 return m

def paste(frame,image,g,fit):
 h,w=frame.shape[:2];x,y=round(g['x']*w),round(g['y']*h);bw,bh=max(1,round(g['width']*w)),max(1,round(g['height']*h));bw=min(w*2,bw);bh=min(h*2,bh)
 ih,iw=image.shape[:2];scale=max(bw/iw,bh/ih) if fit=='cover' else min(bw/iw,bh/ih);nw,nh=max(1,round(iw*scale)),max(1,round(ih*scale));im=cv2.resize(image,(nw,nh))
 if fit=='cover':im=im[max(0,(nh-bh)//2):max(0,(nh-bh)//2)+bh,max(0,(nw-bw)//2):max(0,(nw-bw)//2)+bw];nh,nw=im.shape[:2]
 else:x+=(bw-nw)//2;y+=(bh-nh)//2
 x0,y0=max(0,x),max(0,y);x1,y1=min(w,x+nw),min(h,y+nh)
 if x1<=x0 or y1<=y0:return
 im=im[y0-y:y1-y,x0-x:x1-x];alpha=(im[:,:,3:4]/255 if im.shape[2]==4 else np.ones((*im.shape[:2],1)))*max(0,min(1,g['opacity']));dest=frame[y0:y1,x0:x1];frame[y0:y1,x0:x1]=(dest*(1-alpha)+im[:,:,:3]*alpha).astype(np.uint8)

def compose(source,options,cache,folder,progress,cancelled):
 clips=[dict(c) for c in validate_visuals(options.get('visuals') or [],cache)]
 for c in clips:c['_keys']=sorted(c.get('keyframes') or [],key=lambda k:k['time']);c['_times']=[k['time'] for k in c['_keys']]
 cap=cv2.VideoCapture(str(source));w,h=int(cap.get(3)),int(cap.get(4));source_fps=cap.get(5) or 25;fps=min(60,source_fps);source_duration=cap.get(7)/source_fps;cap.release()
 duration=max(float(options.get('timelineDuration') or source_duration),max((c['endTime'] for c in clips),default=0));frames=math.ceil(duration*fps)
 video=[c for c in clips if c['kind']=='video'];edited=options.get('videoEdited',bool(video));caps={};images={}
 for c in clips:
  if c['kind']=='video':caps[c['id']]=cv2.VideoCapture(str(media_path(cache,c['url'])))
  elif c['kind']=='image':
   image=cv2.imdecode(np.fromfile(str(media_path(cache,c['url'])),np.uint8),cv2.IMREAD_UNCHANGED)
   if image is None:raise ValueError('Ảnh không đọc được.')
   images[c['id']]=image
 if not edited:caps['_base']=cv2.VideoCapture(str(source))
 raw=Path(folder)/'scene-silent.mp4';writer=cv2.VideoWriter(str(raw),cv2.VideoWriter_fourcc(*'mp4v'),fps,(w,h))
 if not writer.isOpened():raise ValueError('Không tạo được khung dựng video.')
 try:
  for n in range(frames):
   if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   t=n/fps;frame=np.zeros((h,w,3),np.uint8)
   if not edited:
    c=caps['_base'];target=round(min(t,max(0,source_duration-1/fps))*(c.get(5) or fps))
    if abs(c.get(cv2.CAP_PROP_POS_FRAMES)-target)>1:c.set(cv2.CAP_PROP_POS_FRAMES,target)
    ok,img=c.read()
    if ok:frame=img
   for kind in ['video','image','blur']:
    for c in clips:
     if c['kind']!=kind or not c.get('enabled',True) or not c['startTime']<=t<c['endTime']:continue
     g=geo(c,t)
     if kind=='video':
      v=caps[c['id']];target=round((float(c.get('sourceStart',0))+t-c['startTime'])*(v.get(5) or fps))
      if abs(v.get(cv2.CAP_PROP_POS_FRAMES)-target)>1:v.set(cv2.CAP_PROP_POS_FRAMES,target)
      ok,img=v.read()
      if ok:paste(frame,img,g,c.get('fit','contain'))
     elif kind=='image':paste(frame,images[c['id']],g,c.get('fit','contain'))
     else:
      x,y=max(0,min(w-1,round(g['x']*w))),max(0,min(h-1,round(g['y']*h)));bw,bh=max(1,min(w-x,round(g['width']*w))),max(1,min(h-y,round(g['height']*h)));roi=frame[y:y+bh,x:x+bw];sigma=max(1,min(40,float(c.get('strength',16))));blurred=cv2.GaussianBlur(roi,(0,0),sigma);alpha=round_mask(bw,bh,max(0,min(.5,float(c.get('radius',.22)))))[:,:,None]/255*max(0,min(1,g['opacity']));frame[y:y+bh,x:x+bw]=(roi*(1-alpha)+blurred*alpha).astype(np.uint8)
   writer.write(frame)
   if n%max(1,round(fps))==0:progress(min(59,2+int(n/max(1,frames)*57)),'Dựng video / ảnh / chuyển động…')
 finally:
  writer.release()
  for c in caps.values():c.release()
 # Reconstruct source audio according to trimmed/moved video clips.
 if video:
  args=[imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(raw)];filters=[];labels=[];idx=1
  for c in video:
   if not c.get('enabled',True):continue
   p=media_path(cache,c['url']);probe=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-i',str(p)],capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
   if b'Audio:' not in probe.stderr:continue
   args+=['-i',str(p)];filters.append(f"[{idx}:a]atrim=start={float(c.get('sourceStart',0))}:duration={c['endTime']-c['startTime']},asetpts=PTS-STARTPTS,adelay={round(c['startTime']*1000)}:all=1[a{idx}]");labels.append(f'[a{idx}]');idx+=1
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
