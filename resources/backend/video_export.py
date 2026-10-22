"""Render the actual picture before padding, so normalized caption/blur coordinates stay aligned."""
import json,math,os,subprocess,tempfile,uuid
from pathlib import Path
import cv2,imageio_ffmpeg

def render_video(source,options,cache,dubbing,progress,cancelled):
 cap=cv2.VideoCapture(str(source));w=int(cap.get(3));h=int(cap.get(4));fps=cap.get(5);frames=cap.get(7);cap.release()
 if min(w,h)<2 or not fps or not frames:raise ValueError('Không đọc được hình ảnh video.')
 duration=frames/fps;dub=dubbing.resolve(options['dubAudioUrl']) if options.get('dubAudioUrl') else None
 if dub:
  import soundfile
  duration=max(duration,soundfile.info(str(dub)).duration)
 output=cache/(uuid.uuid4().hex+'.mp4');filters=[];label='0:v';blur=options.get('blur') or {}
 if blur.get('enabled'):
  vals=[float(blur.get(k,v)) for k,v in [('x',.1),('y',.78),('width',.8),('height',.15),('strength',16)]]
  if not all(math.isfinite(v) for v in vals):raise ValueError('Vùng mờ không hợp lệ.')
  x=max(0,min(w-2,int(vals[0]*w)));y=max(0,min(h-2,int(vals[1]*h)));bw=max(2,min(w-x,int(vals[2]*w)));bh=max(2,min(h-y,int(vals[3]*h)));radius=max(1,min(30,int(vals[4]),bw//4,bh//4))
  filters.extend([f'[0:v]split[base][region]',f'[region]crop={bw}:{bh}:{x}:{y},boxblur=luma_radius={radius}:luma_power=2:chroma_radius=0[blurred]',f'[base][blurred]overlay={x}:{y}[masked]']);label='masked'
 with tempfile.TemporaryDirectory(prefix='export-',dir=cache) as folder:
  folder=Path(folder);ass=str(options.get('ass') or '')
  if ass:
   if len(ass)>4*1024*1024:raise ValueError('Phụ đề xuất quá lớn.')
   (folder/'captions.ass').write_text(ass,encoding='utf-8');filters.append(f'[{label}]ass=captions.ass[captioned]');label='captioned'
  aspect=options.get('aspect','auto');ratio=16/9 if aspect=='16:9' else 9/16 if aspect=='9:16' else w/h
  ow=math.ceil(max(w,h*ratio)/2)*2;oh=math.ceil(max(h,w/ratio)/2)*2
  filters.append(f'[{label}]pad={ow}:{oh}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,tpad=stop_mode=clone:stop_duration={max(0,duration-frames/fps):.3f},format=yuv420p[outv]')
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
  args+=['-filter_complex',';'.join(filters),'-map','[outv]']
  if audio:args+=['-map',audio,'-c:a','aac','-b:a','192k']
  else:args+=['-an']
  args+=['-c:v','libx264','-preset','veryfast','-crf','21','-t',str(duration),'-movflags','+faststart','-progress','pipe:1','-nostats',str(output)]
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
 progress(100,'Đã xuất MP4.');return {'url':'/cache/'+output.name,'duration':duration,'width':ow,'height':oh}
