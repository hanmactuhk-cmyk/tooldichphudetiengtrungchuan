"""Render the actual picture before padding, so normalized caption/blur coordinates stay aligned."""
import json,math,os,sys,subprocess,tempfile,uuid,hashlib
from pathlib import Path
import cv2,imageio_ffmpeg

def _render_video(source,options,cache,dubbing,progress,cancelled):
 cap=cv2.VideoCapture(str(source));w=int(cap.get(3));h=int(cap.get(4));fps=cap.get(5);frames=cap.get(7);cap.release()
 if min(w,h)<2 or not fps or not frames:raise ValueError('Không đọc được hình ảnh video.')
 duration=max(frames/fps,float(options.get('timelineDuration') or 0));dub=dubbing.resolve(options['dubAudioUrl']) if options.get('dubAudioUrl') else None
 if dub:
  import soundfile
  duration=max(duration,soundfile.info(str(dub)).duration)
 fingerprint=hashlib.sha256(('export-v560:'+json.dumps(options,sort_keys=True)).encode());
 with Path(source).open('rb') as handle:
  for chunk in iter(lambda:handle.read(8*1024*1024),b''):
   if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   fingerprint.update(chunk)
 if dub:
  stat=dub.stat();fingerprint.update(f'{dub.name}:{stat.st_size}:{stat.st_mtime_ns}'.encode())
 output=cache/('export-'+fingerprint.hexdigest()+'.mp4')
 rounded_mask=None;filters=[];label='0:v';blur=options.get('blur') or {}
 if blur.get('enabled'):
  vals=[float(blur.get(k,v)) for k,v in [('x',.1),('y',.78),('width',.8),('height',.15),('strength',16)]]
  if not all(math.isfinite(v) for v in vals):raise ValueError('Vùng mờ không hợp lệ.')
  x=max(0,min(w-2,int(vals[0]*w)));y=max(0,min(h-2,int(vals[1]*h)));bw=max(2,min(w-x,int(vals[2]*w)));bh=max(2,min(h-y,int(vals[3]*h)));radius=max(1,min(30,int(vals[4]),bw//4,bh//4))
  filters.extend([f'[0:v]split[base][region]',f'[region]crop={bw}:{bh}:{x}:{y}:exact=1,boxblur=luma_radius={radius}:luma_power=2:chroma_radius=0[blurred]'])
  rounding=float(blur.get('radius',.22))
  if not math.isfinite(rounding):raise ValueError('Bo góc vùng mờ không hợp lệ.')
  if rounding>0:
   rounded_mask=(bw,bh,max(0,min(.5,rounding)));filters.extend(['movie=rounded-mask.png,format=gray[mask]','[blurred]format=rgba[rgba]','[rgba][mask]alphamerge[soft]']);label='soft'
  else:label='blurred'
  filters.append(f'[base][{label}]overlay={x}:{y}[masked]');label='masked'
 with tempfile.TemporaryDirectory(prefix='export-',dir=cache) as folder:
  folder=Path(folder)
  if rounded_mask:
   import numpy as np
   bw,bh,rounding=rounded_mask;scale=2;mw,mh=bw*scale,bh*scale;r=max(1,round(min(mw,mh)*rounding));mask=np.zeros((mh,mw),dtype=np.uint8)
   cv2.rectangle(mask,(r,0),(mw-r-1,mh-1),255,-1);cv2.rectangle(mask,(0,r),(mw-1,mh-r-1),255,-1)
   for cx,cy in [(r,r),(mw-r-1,r),(r,mh-r-1),(mw-r-1,mh-r-1)]:cv2.circle(mask,(cx,cy),r,255,-1,lineType=cv2.LINE_AA)
   cv2.imwrite(str(folder/'rounded-mask.png'),cv2.resize(mask,(bw,bh),interpolation=cv2.INTER_AREA))
  ass=str(options.get('ass') or '')
  if ass:
   if len(ass.encode('utf-8'))>48*1024*1024:raise ValueError('Phụ đề xuất vượt 48 MB. Hãy chia đoạn xuất.')
   (folder/'captions.ass').write_text(ass,encoding='utf-8')
  aspect=options.get('aspect','auto');ratio=16/9 if aspect=='16:9' else 9/16 if aspect=='9:16' else w/h
  ow=math.ceil(max(w,h*ratio)/2)*2;oh=math.ceil(max(h,w/ratio)/2)*2
  copy_video=not ass and not blur.get('enabled') and ow==w and oh==h and duration<=frames/fps+.001
  if output.is_file():
   progress(100,'MP4 đã sẵn sàng từ lần xuất trước.');return {'url':'/cache/'+output.name,'duration':duration,'cached':True,'width':ow,'height':oh,'videoCopied':copy_video}
  completed_output=output;output=cache/(uuid.uuid4().hex+'.mp4')
  filters.append(f'[{label}]pad={ow}:{oh}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,tpad=stop_mode=clone:stop_duration={max(0,duration-frames/fps):.3f},format=yuv420p[{'padded' if ass else 'outv'}]')
  if ass:
   fonts=str(Path(getattr(sys,'_MEIPASS',Path(__file__).resolve().parents[2]))/'dist/fonts').replace('\\','/').replace(':','\\:')
   filters.append(f"[padded]ass=captions.ass:fontsdir='{fonts}'[outv]")
  # Probe presence of original audio; a video without audio is a valid input.
  probe=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-i',str(source)],capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
  has_audio='Audio:' in probe.stderr.decode(errors='replace');original=has_audio and not options.get('originalMuted',False)
  volume=float(options.get('originalVolume',.8))
  if not math.isfinite(volume):raise ValueError('Âm lượng không hợp lệ.')
  volume=max(0,min(1,volume));args=[imageio_ffmpeg.get_ffmpeg_exe(),'-hide_banner','-loglevel','error','-y','-i',str(source)]
  if dub:args+=['-i',str(dub)]
  audio=None
  if original and dub:filters.extend([f'[0:a]volume={volume}[original]','[original][1:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[outa]']);audio='[outa]'
  elif original:filters.append(f'[0:a]volume={volume},apad[outa]');audio='[outa]'
  elif dub:audio='1:a:0'
  if copy_video:filters=[f for f in filters if '[outv]' not in f]
  if filters:args+=['-filter_complex',';'.join(filters)]
  args+=['-map','0:v:0' if copy_video else '[outv]']
  if audio:args+=['-map',audio,'-c:a','aac','-b:a','192k']
  else:args+=['-an']
  args+=['-c:v','copy'] if copy_video else ['-c:v','libx264','-preset','superfast','-crf','21']
  args+=['-t',str(duration),'-movflags','+faststart','-progress','pipe:1','-nostats',str(output)]
  progress(2,'Đang ghép MP4: vùng mờ, phụ đề và âm thanh...')
  with (folder/'ffmpeg-error.txt').open('w+',encoding='utf-8') as errors:
   process=subprocess.Popen(args,cwd=folder,stdout=subprocess.PIPE,stderr=errors,text=True,creationflags=0x08000000 if os.name=='nt' else 0)
   try:
    for line in process.stdout:
     if cancelled():process.terminate();raise RuntimeError('Đã hủy xuất MP4.')
     if line.startswith('out_time_us='):
      try:progress(min(99,int(int(line.split('=')[1])/1e6/duration*100)),'Đang mã hóa video MP4...')
      except ValueError:pass
    if process.wait()!=0:
     errors.seek(0);raise ValueError('Không xuất được MP4: '+errors.read()[-1400:])
    if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   except BaseException:
    if process.poll() is None:process.kill();process.wait()
    output.unlink(missing_ok=True);raise
 os.replace(output,completed_output);output=completed_output
 progress(100,'Đã xuất MP4.');return {'url':'/cache/'+output.name,'duration':duration,'width':ow,'height':oh,'videoCopied':copy_video}


def render_video(source,options,cache,dubbing,progress,cancelled):
 if not options.get('visuals') and not options.get('videoEdited'):return _render_video(source,options,cache,dubbing,progress,cancelled)
 from visual_media import compose,media_path,validate_visuals
 validate_visuals(options.get('visuals') or [],cache)
 fingerprint=hashlib.sha256(('scene-v570:'+json.dumps(options,sort_keys=True)).encode())
 with Path(source).open('rb') as handle:
  for chunk in iter(lambda:handle.read(8*1024*1024),b''):
   if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   fingerprint.update(chunk)
 for url in sorted({c.get('url') for c in options.get('visuals',[]) if c.get('url')}):
  p=media_path(cache,url);stat=p.stat();fingerprint.update(f'{p.name}:{stat.st_size}:{stat.st_mtime_ns}'.encode())
 if options.get('dubAudioUrl'):
  p=dubbing.resolve(options['dubAudioUrl']);stat=p.stat();fingerprint.update(f'{p.name}:{stat.st_size}:{stat.st_mtime_ns}'.encode())
 final=Path(cache)/('export-'+fingerprint.hexdigest()+'.mp4')
 if final.is_file():
  cap=cv2.VideoCapture(str(final));w,h=int(cap.get(3)),int(cap.get(4));duration=cap.get(7)/(cap.get(5) or 25);cap.release();progress(100,'MP4 đã sẵn sàng từ lần xuất trước.');return {'url':'/cache/'+final.name,'width':w,'height':h,'duration':duration,'cached':True,'videoCopied':False}
 with tempfile.TemporaryDirectory(prefix='scene-',dir=cache) as folder:
  composed=compose(source,options,cache,folder,progress,cancelled)
  clean={k:v for k,v in options.items() if k not in ['visuals','videoEdited']}
  result=_render_video(composed,clean,cache,dubbing,lambda p,t:progress(60+round(p*.4),t),cancelled)
  os.replace(Path(cache)/Path(result['url']).name,final);result['url']='/cache/'+final.name
  return result
