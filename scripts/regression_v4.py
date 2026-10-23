"""Checks speech completeness, non-overlap, caching and unchanged video readers."""
import json,time,requests,random,sys,os
from pathlib import Path
sys.path.insert(0,str(Path('resources/backend').resolve()))
from dubbing import schedule
out=Path(os.environ.get('HN_TEST_OUT','../../outputs/v4-tests'));out.mkdir(parents=True,exist_ok=True);base=os.environ.get('HN_TEST_URL','http://127.0.0.1:8004')
report={}
for _ in range(500):
 cues=[{'id':str(i),'startTime':i*.5,'endTime':i*.5+.5} for i in range(10)]
 plan=schedule(cues,[random.uniform(.1,6) for c in cues])
 assert all(b['dubStartTime']>=a['dubEndTime'] for a,b in zip(plan,plan[1:]))
report['scheduleCases']=500
cues=[{'id':'v1','startTime':0,'endTime':1,'textZh':'','textVi':'Em à, anh xin lỗi, hôm nay anh về muộn.','voiceId':'Hải Đăng','speed':1,'pitch':0,'volume':1}, {'id':'v2','startTime':.6,'endTime':1.3,'textZh':'','textVi':'Không sao đâu, anh đã ăn cơm chưa?','voiceId':'Mai Anh','speed':1,'pitch':0,'volume':1}, {'id':'v3','startTime':1.1,'endTime':2,'textZh':'','textVi':'Anh chưa ăn, chúng mình cùng ăn nhé.','voiceId':'Hải Đăng','speed':1,'pitch':0,'volume':1}]
def dub():
 r=requests.post(base+'/api/dub',json={'subtitles':cues,'videoDuration':2},timeout=30);r.raise_for_status();identifier=r.json()['jobId']
 while True:
  job=requests.get(base+'/api/jobs/'+identifier,timeout=10).json()
  if job['state']=='done':return job['result']
  if job['state']=='error':raise RuntimeError(job)
  time.sleep(.5)
t=time.monotonic();report['firstDub']=dub();report['firstSeconds']=time.monotonic()-t
r=report['firstDub'];assert r['noOverlap'];assert all(b['dubStartTime']>=a['dubEndTime'] for a,b in zip(r['subtitles'],r['subtitles'][1:]));assert r['shiftedCues']==0
(out/'vieneu-no-overlap.wav').write_bytes(requests.get(base+r['audioUrl']).content)
t=time.monotonic();report['secondDub']=dub();report['cachedSeconds']=time.monotonic()-t;assert all(s['cacheHit'] for s in report['secondDub']['subtitles'])
for route,file,key in [('/api/transcribe','video-tieng-trung.mp4','asr'),('/api/ocr','video-phu-de-chu-trung.mp4','ocr')]:
 with (Path('tests/fixtures')/file).open('rb') as f:
  t=time.monotonic();r=requests.post(base+route,files={'file':(file,f,'video/mp4')},timeout=300);r.raise_for_status();report[key]=r.json();report[key+'Seconds']=time.monotonic()-t
 assert report[key]['subtitles']
 if key=='ocr':assert len(report[key]['subtitles'])==3
bad='1\n00:00:00,000 --> 00:00:01,000\nXin chào\n';r=requests.post(base+'/api/translation/import',json={'subtitles':[{'id':'a','startTime':0,'endTime':2,'textZh':'你好'}],'srt':bad});assert r.status_code==422
report['rejectChangedTiming']=True
report['health']=requests.get(base+'/api/health').json()
(out/'regression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print('REGRESSION PASSED',report['firstSeconds'],report['cachedSeconds'],report['ocr'].get('ocrCalls'),flush=True)
