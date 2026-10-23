"""Real speech timing regression: duration fit, fixed starts, gaps, overlap, cache."""
import os,sys,time,json,random
from pathlib import Path
import requests,soundfile as sf,numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from dubbing import schedule
base=os.environ.get('HN_TEST_URL','http://127.0.0.1:8012')
out=Path(os.environ.get('HN_TEST_OUT','../../outputs/v561-tests'));out.mkdir(parents=True,exist_ok=True)
for n in range(500):
 cues=[{'id':str(i),'startTime':i*2,'endTime':i*2+1.1} for i in range(100)]
 plan=schedule(cues,[random.uniform(.1,8) for _ in cues])
 assert all(r['dubStartTime']==c['startTime'] and r['shift']==0 and r['dubEndTime']<=c['endTime']+1e-9 for c,r in zip(cues,plan))
text='Xin chào, hôm nay chúng ta cùng kiểm tra âm thanh có khớp với phụ đề hay không.'
cues=[{'id':'long','startTime':.3,'endTime':1.8,'textVi':text,'voiceId':'Hải Đăng'}, {'id':'next','startTime':2.3,'endTime':4.1,'textVi':'Câu thứ hai bắt đầu đúng giờ.','voiceId':'Hải Đăng'}]
def job(route,body):
 r=requests.post(base+route,json=body,timeout=30);r.raise_for_status();key=r.json()['jobId'];until=time.monotonic()+300
 while time.monotonic()<until:
  r=requests.get(base+'/api/jobs/'+key,timeout=30);r.raise_for_status();data=r.json()
  if data['state']=='done':return data['result']
  if data['state'] in ['error','cancelled']:raise RuntimeError(data)
  time.sleep(.3)
 raise TimeoutError(route)
def check(result):
 for c,r in zip(cues,result['subtitles']):
  assert abs(r['dubStartTime']-c['startTime'])<1e-9
  assert r['dubEndTime']<=c['endTime']+1e-9,(c,r)
  wav=out/(r['id']+'.wav');wav.write_bytes(requests.get(base+r['ttsAudioUrl']).content)
  assert sf.info(wav).duration<=c['endTime']-c['startTime']+1e-9
 assert result['subtitles'][0]['ttsFitSpeed']>1.35
batch=job('/api/dub',{'subtitles':cues,'videoDuration':5});check(batch);assert batch['maxShift']==0 and batch['noOverlap']
raw=out/'mix.wav';raw.write_bytes(requests.get(base+batch['audioUrl']).content);audio,sr=sf.read(raw)
assert np.max(np.abs(audio[round(1.81*sr):round(2.29*sr)]))==0
popup=job('/api/timeline/speech',{'cues':cues});check(popup)
assert [c['startTime'] for c in popup['clips']]==[.3,2.3]
assert all(c['trimEnd']==c['sourceDuration'] for c in popup['clips']) # no clipping words
cached=job('/api/dub',{'subtitles':cues,'videoDuration':5});check(cached);assert all(r['cacheHit'] for r in cached['subtitles'])
(out/'timing-report.json').write_text(json.dumps({'batch':batch,'popup':popup,'randomSchedules':500,'silenceInGap':True,'cache':True},ensure_ascii=False,indent=2),encoding='utf-8')
print('REAL TTS: FIXED START / AUTO SPEED >1.35 / END WITHIN CAPTION / SILENT GAP / NO TRUNCATION / CACHE PASSED')
