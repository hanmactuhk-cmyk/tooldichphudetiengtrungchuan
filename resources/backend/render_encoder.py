"""Select a working hardware H.264 encoder once, with a CPU fallback."""
import functools,subprocess
import imageio_ffmpeg

@functools.lru_cache(maxsize=4)
def _hardware_encoder(preference='auto'):
 ff=imageio_ffmpeg.get_ffmpeg_exe()
 candidates=[
  ('h264_nvenc',['-preset','p2','-tune','hq','-rc','vbr','-cq','18','-b:v','0']),
  ('h264_qsv',['-preset','veryfast','-global_quality','18']),
  ('h264_amf',['-quality','speed','-rc','cqp','-qp_i','18','-qp_p','18','-qp_b','20']),
  ('h264_videotoolbox',['-allow_sw','0','-realtime','1','-prio_speed','1','-b:v','12M']),
 ]
 if preference in ('gpu','nvenc'):
  candidates.sort(key=lambda candidate: candidate[0] != 'h264_nvenc')
 elif preference == 'qsv':
  candidates.sort(key=lambda candidate: candidate[0] != 'h264_qsv')
 for name,settings in candidates:
  try:
   result=subprocess.run([ff,'-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=black:s=64x64:r=1','-frames:v','1','-c:v',name,*settings,'-f','null','-'],capture_output=True,timeout=8,creationflags=0x08000000 if __import__('os').name=='nt' else 0)
   if result.returncode==0:return name
  except (OSError,subprocess.SubprocessError):
   continue
 return None

def h264_args(quality='fast',intermediate=False,render_mode='auto'):
 preference='nvenc' if render_mode in ('gpu','nvenc') else render_mode
 hardware=_hardware_encoder(preference) or (_hardware_encoder('auto') if preference!='auto' else None)
 if hardware=='h264_nvenc':
  q='16' if intermediate else ('18' if quality=='quality' else '20')
  preset='p1' if render_mode=='gpu' and quality!='quality' else 'p2'
  return ['-c:v',hardware,'-preset',preset,'-tune','hq','-rc','vbr','-cq',q,'-b:v','0']
 if hardware=='h264_qsv':
  q='16' if intermediate else ('18' if quality=='quality' else '20')
  return ['-c:v',hardware,'-preset','veryfast','-global_quality',q]
 if hardware=='h264_amf':
  q='16' if intermediate else ('18' if quality=='quality' else '20')
  return ['-c:v',hardware,'-quality','speed','-rc','cqp','-qp_i',q,'-qp_p',q,'-qp_b',str(int(q)+2)]
 if hardware=='h264_videotoolbox':
  bitrate='20M' if quality=='quality' else '12M'
  if intermediate:bitrate='12M'
  return ['-c:v',hardware,'-allow_sw','0','-realtime','1','-prio_speed','1','-b:v',bitrate]
 if intermediate:return ['-c:v','libx264','-preset','ultrafast','-crf','12']
 return ['-c:v','libx264','-preset','veryfast' if quality=='quality' else 'ultrafast','-crf','16' if quality=='quality' else '18']
