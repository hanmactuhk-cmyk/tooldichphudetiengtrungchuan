"""Non-destructive timeline cuts. Only the edited ranges are read; source WAVs remain intact."""
import hashlib,json,math,os
from pathlib import Path
import numpy as np,soundfile as sf
from dubbing import SAMPLE_RATE

def mix_timeline(clips,video_duration,cache,dubbing,progress=lambda *_:None,cancelled=lambda:False):
 if not isinstance(clips,list) or len(clips)>2000:raise ValueError('Tối đa 2000 đoạn âm thanh.')
 rows=[];ids=set()
 for c in clips:
  vals=[float(c.get(k,v)) for k,v in [('startTime',0),('trimStart',0),('trimEnd',0),('volume',1)]];start,a,b,volume=vals
  if not all(math.isfinite(v) for v in vals) or min(start,a)<0 or b-a<.039 or volume<0 or volume>2 or not c.get('id') or c['id'] in ids:raise ValueError('Đoạn âm thanh có mốc hoặc âm lượng không hợp lệ.')
  ids.add(c['id']);source=dubbing.resolve(c.get('audioUrl'));info=sf.info(str(source))
  if info.samplerate!=SAMPLE_RATE or b>info.duration+.003:raise ValueError('Đoạn cắt nằm ngoài âm thanh nguồn.')
  if c.get('track') not in ('voice','audio'):raise ValueError('Hàng âm thanh không hợp lệ.')
  if not c.get('muted'):rows.append({**c,'startTime':start,'trimStart':a,'trimEnd':min(b,info.duration),'volume':volume,'source':source,'end':start+b-a})
 for track in {r.get('laneId') or r['track'] for r in rows}:
  lane=sorted([r for r in rows if (r.get('laneId') or r['track'])==track],key=lambda r:r['startTime'])
  for left,right in zip(lane,lane[1:]):
   if right['startTime']<left['end']-.00001:raise ValueError('Các đoạn âm thanh trùng nhau trên cùng hàng. Chưa áp dụng thay đổi.')
 duration=max(float(video_duration),*(r['end'] for r in rows),0)
 if not math.isfinite(duration) or duration<0 or duration>86400:raise ValueError('Độ dài timeline không hợp lệ.')
 key=hashlib.sha256(json.dumps([duration,clips],sort_keys=True).encode()).hexdigest();output=cache/('timeline-'+key+'.wav')
 if not output.is_file():
  temporary=output.with_suffix('.partial.wav')
  try:
   total=round(duration*SAMPLE_RATE)
   with sf.SoundFile(str(temporary),'w',samplerate=SAMPLE_RATE,channels=1,subtype='PCM_16',format='WAV') as target:
    for frame in range(0,total,SAMPLE_RATE):
     if cancelled():raise RuntimeError('Đã dừng ghép timeline.')
     count=min(SAMPLE_RATE,total-frame);block=np.zeros(count,dtype=np.float32)
     for r in rows:
      start=round(r['startTime']*SAMPLE_RATE);end=round(r['end']*SAMPLE_RATE);a=max(frame,start);b=min(frame+count,end)
      if b<=a:continue
      with sf.SoundFile(str(r['source'])) as source:
       source.seek(round(r['trimStart']*SAMPLE_RATE)+a-start);data=source.read(b-a,dtype='float32',always_2d=True).mean(axis=1)
      block[a-frame:a-frame+len(data)]+=data*r['volume']
     target.write(np.clip(block,-.97,.97));progress(min(99,int((frame+count)/max(1,total)*100)),'Đang cập nhật âm thanh timeline...')
   os.replace(temporary,output)
  finally:temporary.unlink(missing_ok=True)
 return {'audioUrl':'/cache/'+output.name,'duration':duration,'noOverlap':True}
