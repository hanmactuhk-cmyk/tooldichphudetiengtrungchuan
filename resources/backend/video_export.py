"""Render the actual picture before padding, so normalized caption/blur coordinates stay aligned."""
import json,math,os,sys,subprocess,tempfile,uuid,hashlib
from pathlib import Path
import cv2,imageio_ffmpeg
from render_encoder import h264_args

def _opening_filters(layer,input_index,label_index,start,end,frame_width,frame_height):
 effect=(layer.get('motion') or {}).get('effect','none')
 duration=max(.08,min(float((layer.get('motion') or {}).get('duration',.5)),max(.08,(end-start)/2)))
 intensity=max(0,min(3,float((layer.get('motion') or {}).get('intensity',1))))
 chain=f'[{input_index}:v]format=rgba'
 if effect in ('fade','left','right','up','down','zoom-in','zoom-out','bounce'):
  # FFmpeg fades the alpha plane, leaving the composited video fully opaque.
  chain+=f',fade=t=in:st=0:d={duration:.6f}:alpha=1'
 if effect in ('zoom-in','zoom-out','bounce'):
  if effect=='zoom-in':factor=f'1-{.5*intensity:.6f}*pow(max(0,1-t/{duration:.6f}),3)'
  elif effect=='zoom-out':factor=f'1+{.5*intensity:.6f}*pow(max(0,1-t/{duration:.6f}),3)'
  else:factor=f'1-exp(-7*t/{duration:.6f})*cos(t/{duration:.6f}*PI*3)*{.3*intensity:.6f}'
  chain+=f",scale=w='max(2,trunc(iw*({factor})/2)*2)':h='max(2,trunc(ih*({factor})/2)*2)':eval=frame"
 chain+=f',setpts=PTS-STARTPTS+{start:.6f}/TB[visualsrc{label_index}]'
 x,y=layer['x'],layer['y'];base_w=layer.get('width',0);base_h=layer.get('height',0)
 if effect in ('left','right','up','down'):
  offset=(frame_width if effect in ('left','right') else frame_height)*.15*intensity
  remain=f'pow(max(0,1-(t-{start:.6f})/{duration:.6f}),3)'
  if effect in ('left','right'):
   x=f"'if(lt(t,{start+duration:.6f}),{x}{'-' if effect=='left' else '+'}{offset:.3f}*{remain},{x})'"
  else:
   y=f"'if(lt(t,{start+duration:.6f}),{y}{'-' if effect=='up' else '+'}{offset:.3f}*{remain},{y})'"
 elif effect in ('zoom-in','zoom-out','bounce'):
  x=f"'{x}+({base_w}-overlay_w)/2'";y=f"'{y}+({base_h}-overlay_h)/2'"
 return chain,x,y

def _render_video(source,options,cache,dubbing,progress,cancelled,visual_layers=None):
 cap=cv2.VideoCapture(str(source));w=int(cap.get(3));h=int(cap.get(4));fps=cap.get(5);frames=cap.get(7);cap.release()
 if min(w,h)<2 or not fps or not frames:raise ValueError('Không đọc được hình ảnh video.')
 duration=max(frames/fps,float(options.get('timelineDuration') or 0));dub=dubbing.resolve(options['dubAudioUrl']) if options.get('dubAudioUrl') else None
 if dub:
  import soundfile
  duration=max(duration,soundfile.info(str(dub)).duration)
 fingerprint=hashlib.sha256(('export-v611-onepass:'+json.dumps(options,sort_keys=True)).encode());
 with Path(source).open('rb') as handle:
  for chunk in iter(lambda:handle.read(8*1024*1024),b''):
   if cancelled():raise RuntimeError('Đã hủy xuất MP4.')
   fingerprint.update(chunk)
 if dub:
  stat=dub.stat();fingerprint.update(f'{dub.name}:{stat.st_size}:{stat.st_mtime_ns}'.encode())
 if options.get('visuals'):
  from visual_media import media_path
  for url in sorted({c.get('url') for c in options.get('visuals',[]) if c.get('url')}):
   asset=media_path(cache,url);stat=asset.stat();fingerprint.update(f'{asset.name}:{stat.st_size}:{stat.st_mtime_ns}'.encode())
 output=cache/('export-'+fingerprint.hexdigest()+'.mp4')
 rounded_mask=None;filters=[];label='0:v';blur=options.get('blur') or {}
 rw=int(options.get('renderWidth') or w);rh=int(options.get('renderHeight') or h)
 if not 2<=rw<=3840 or not 2<=rh<=3840 or rw%2 or rh%2:raise ValueError('Kích thước xuất không hợp lệ.')
 resized=(rw,rh)!=(w,h)
 if resized:filters.append(f'[0:v]scale={rw}:{rh}:flags=lanczos[scaled]');label='scaled';w,h=rw,rh
 # Keep fixed images/text/blur on the same FFmpeg graph as captions and audio.
 # This avoids encoding the whole video once for the scene and again for export.
 visual_input_offset=1+(1 if dub else 0)
 if visual_layers:
  for n,layer in enumerate(visual_layers):
   idx=visual_input_offset+n;start=layer['start'];end=layer['end'];length=end-start
   if layer['kind']=='image':
    out=f'visual{n}';chain,xpos,ypos=_opening_filters(layer,idx,n,start,end,w,h);repeat=1 if layer.get('motion') else 0;eof='repeat' if repeat else 'pass';filters.extend([chain,f'[{label}][visualsrc{n}]overlay=x={xpos}:y={ypos}:eof_action={eof}:repeatlast={repeat}:enable=between(t\\,{start:.6f}\\,{end:.6f})[{out}]']);label=out
   else:
    x,y,bw,bh=layer['x'],layer['y'],layer['width'],layer['height'];sigma=layer['strength'];opacity=layer['opacity'];out=f'visual{n}'
    sw,sh=max(2,bw//4),max(2,bh//4)
    filters.extend([f'[{label}]split[visualclear{n}][visualregion{n}]',f'[visualregion{n}]crop={bw}:{bh}:{x}:{y}:exact=1,scale={sw}:{sh}:flags=area,gblur=sigma={max(.25,sigma/4):.4f}:steps=2,scale={bw}:{bh}:flags=bilinear,format=rgba[visualblur{n}]',f'[{idx}:v]format=gray,setpts=PTS-STARTPTS[visualmask{n}]',f'[visualblur{n}][visualmask{n}]alphamerge,colorchannelmixer=aa={opacity:.4f}[visualmasked{n}]',f'[visualclear{n}][visualmasked{n}]overlay={x}:{y}:eof_action=pass:repeatlast=0:enable=between(t\\,{start:.6f}\\,{end:.6f})[{out}]']);label=out
 if blur.get('enabled'):
  vals=[float(blur.get(k,v)) for k,v in [('x',.1),('y',.78),('width',.8),('height',.15),('strength',16)]]
  if not all(math.isfinite(v) for v in vals):raise ValueError('Vùng mờ không hợp lệ.')
  x=max(0,min(w-2,int(vals[0]*w)));y=max(0,min(h-2,int(vals[1]*h)));bw=max(2,min(w-x,int(vals[2]*w)));bh=max(2,min(h-y,int(vals[3]*h)));radius=max(1,min(30,int(vals[4]),bw//4,bh//4))
  sw,sh=max(2,bw//4),max(2,bh//4)
  filters.extend([f'[{label}]split[base][region]',f'[region]crop={bw}:{bh}:{x}:{y}:exact=1,scale={sw}:{sh}:flags=area,boxblur=luma_radius={max(1,radius//4)}:luma_power=2:chroma_radius=0,scale={bw}:{bh}:flags=bilinear[blurred]'])
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
  if options.get('outputWidth') and options.get('outputHeight'):
   ow,oh=int(options['outputWidth']),int(options['outputHeight'])
   if not w<=ow<=3840 or not h<=oh<=3840 or ow%2 or oh%2:raise ValueError('Khung xuất không hợp lệ.')
  copy_video=not visual_layers and not resized and not ass and not blur.get('enabled') and ow==w and oh==h and duration<=frames/fps+.001
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
  for layer in visual_layers or []:
   length=max(.04,layer['end']-layer['start']);motion=layer.get('motion') or {}
   if motion.get('effect') not in (None,'none'):length=min(length,max(.08,min(float(motion.get('duration',.5)),max(.08,length/2))))
   args+=['-loop','1','-framerate',str(fps),'-t',str(length),'-i',str(layer['path'])]
  audio=None
  if original and dub:filters.extend([f'[0:a]volume={volume}[original]','[original][1:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[outa]']);audio='[outa]'
  elif original:filters.append(f'[0:a]volume={volume},apad[outa]');audio='[outa]'
  elif dub:audio='1:a:0'
  if copy_video:filters=[f for f in filters if '[outv]' not in f]
  if filters:args+=['-filter_complex',';'.join(filters)]
  args+=['-map','0:v:0' if copy_video else '[outv]']
  if audio:args+=['-map',audio,'-c:a','aac','-b:a','192k']
  else:args+=['-an']
  args+=['-c:v','copy'] if copy_video else h264_args(options.get('quality') or 'fast',render_mode=options.get('renderMode','auto'))
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


def _matches_source_video(clip,source,cache,source_duration):
 """Identify the untouched base-video timeline item without treating it as an overlay."""
 if clip.get('kind')!='video' or clip.get('trackId')!='base-video':return False
 from visual_media import media_path
 defaults={'x':0,'y':0,'width':1,'height':1,'opacity':1,'rate':1,'sourceStart':0,'startTime':0,'rotation':0}
 try:
  if any(abs(float(clip.get(key,value))-value)>.00001 for key,value in defaults.items()):return False
  if abs(float(clip['endTime'])-source_duration)>.08:return False
  if clip.get('crop') or clip.get('keyframes') or clip.get('flipX') or clip.get('flipY') or clip.get('processedUrl'):return False
  base=Path(source);media=media_path(cache,clip.get('url'))
  if base.resolve()==media.resolve():return True
  if base.stat().st_size!=media.stat().st_size:return False
  def digest(path):
   h=hashlib.sha256()
   with path.open('rb') as handle:
    for part in iter(lambda:handle.read(4*1024*1024),b''):h.update(part)
   return h.digest()
  return digest(base)==digest(media)
 except (OSError,TypeError,ValueError,KeyError):return False


def render_video(source,options,cache,dubbing,progress,cancelled):
 if not options.get('visuals') and not options.get('videoEdited'):return _render_video(source,options,cache,dubbing,progress,cancelled)
 from visual_media import compose,media_path,validate_visuals
 validate_visuals(options.get('visuals') or [],cache)
 active=[c for c in options.get('visuals',[]) if c.get('enabled',True)]
 if len(active)==1 and active[0]['kind']=='video':
  c=active[0];direct=media_path(cache,c['url']);cap=cv2.VideoCapture(str(direct));length=cap.get(7)/(cap.get(5) or 25);cap.release()
  defaults={'x':0,'y':0,'width':1,'height':1,'opacity':1,'rate':1,'sourceStart':0,'startTime':0,'rotation':0}
  if all(abs(float(c.get(k,v))-v)<.00001 for k,v in defaults.items()) and not any(c.get(k) for k in ['crop','keyframes','flipX','flipY','processedUrl']) and abs(float(c['endTime'])-length)<.06:
   clean={k:v for k,v in options.items() if k not in ['visuals','videoEdited']};clean['originalMuted']=bool(options.get('originalMuted') or c.get('audioMuted'))
   result=_render_video(direct,clean,cache,dubbing,progress,cancelled);result['directSource']=True;return result

 # The editor stores an untouched source clip on the base-video track as a visual.
 # That bookkeeping flag must not force ordinary image/blur edits through the slow
 # Python per-frame compositor. Verify the base clip is byte-identical to the input,
 # then let the one-pass FFmpeg path handle the remaining static overlays.
 from visual_media import media_path
 source_cap=cv2.VideoCapture(str(source));source_fps=source_cap.get(5) or 25;source_duration=source_cap.get(7)/source_fps;source_cap.release()
 base_clips=[c for c in active if _matches_source_video(c,source,cache,source_duration)]
 video_clips=[c for c in active if c.get('kind')=='video']
 if len(base_clips)==1 and len(video_clips)==1:
  overlays=[c for c in active if c is not base_clips[0]]
  if all(c.get('kind') in ('image','text','blur') for c in overlays):
   clean={**options,'visuals':overlays,'videoEdited':False,'originalMuted':bool(options.get('originalMuted') or base_clips[0].get('audioMuted'))}
   if not overlays:return _render_video(source,clean,cache,dubbing,progress,cancelled)
   with tempfile.TemporaryDirectory(prefix='scene-final-',dir=cache) as folder:
    from visual_media import prepare_ffmpeg_static_layers
    layers=prepare_ffmpeg_static_layers(source,overlays,clean,cache,folder)
    if layers is not None:
     result=_render_video(source,clean,cache,dubbing,progress,cancelled,visual_layers=layers)
     result['baseVideoPassthrough']=True
     return result

 # Static overlays and blur regions can be processed in the final FFmpeg pass.
 # Keep the existing scene renderer for keyframes, animated text and video layers.
 if active and all(c.get('kind') in ('image','text','blur') for c in active) and not options.get('videoEdited'):
  from visual_media import prepare_ffmpeg_static_layers
  with tempfile.TemporaryDirectory(prefix='scene-final-',dir=cache) as folder:
   layers=prepare_ffmpeg_static_layers(source,active,options,cache,folder)
   if layers is not None:
    result=_render_video(source,options,cache,dubbing,progress,cancelled,visual_layers=layers)
    return result

 fingerprint=hashlib.sha256(('scene-v610:'+json.dumps(options,sort_keys=True)).encode())
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
