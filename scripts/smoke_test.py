"""End-to-end regression check against an already running local worker."""
import argparse,io,json,time,wave
from pathlib import Path
import requests
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--url',default='http://127.0.0.1:8001');parser.add_argument('--fixtures',required=True);parser.add_argument('--out',required=True);args=parser.parse_args()
url=args.url;fixtures=Path(args.fixtures);out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
def post(route,**kwargs):
    started=time.monotonic();r=requests.post(url+route,timeout=600,**kwargs)
    print(route,r.status_code,round(time.monotonic()-started,2),'seconds',flush=True)
    if not r.ok:raise RuntimeError(r.text)
    return r.json()
report={'health':requests.get(url+'/api/health',timeout=10).json()}
for route,video,key in [('/api/transcribe','video-tieng-trung.mp4','asr'),('/api/ocr','video-phu-de-chu-trung.mp4','ocr')]:
    with (fixtures/video).open('rb') as f:report[key]=post(route,files={'file':(video,f,'video/mp4')})
    assert report[key]['subtitles'],key
    if key=='ocr':
        assert len(report[key]['subtitles'])==3,report[key]
        for expected,sub in zip(['今天天气很好','我们一起去公园散步吧','请记得带上雨伞'],report[key]['subtitles']):assert expected in sub['textZh'],sub
    translated=post('/api/translate',json={'subtitles':report[key]['subtitles']})
    assert [t['id'] for t in translated['translations']]==[s['id'] for s in report[key]['subtitles']]
    report[key+'_translation']=translated
text=' '.join(t['viFull'] for t in report['ocr_translation']['translations'])
report['tts']=post('/api/tts',json={'text':text,'voice_id':'piper-vi','speed':1.0})
audio=requests.get(url+report['tts']['audioUrl'],timeout=60);audio.raise_for_status();(out/'giong-viet-ocr.wav').write_bytes(audio.content)
with wave.open(io.BytesIO(audio.content)) as wav:
    assert wav.getframerate()==48000 and wav.getsampwidth()==2 and wav.getnchannels()==1
    samples=np.frombuffer(wav.readframes(wav.getnframes()),dtype=np.int16);assert np.max(np.abs(samples.astype(np.int32)))>100
    report['wav']={'sampleRate':48000,'channels':1,'sampleWidth':2,'duration':len(samples)/48000,'peak':int(np.max(np.abs(samples.astype(np.int32))))}
assert requests.post(url+'/api/tts',json={'text':'Xin chào','speed':0},timeout=20).status_code==422
assert requests.post(url+'/api/translate',json={'subtitles':[]},timeout=20).status_code==422
assert requests.post(url+'/api/ocr',files={'file':('bad.mp4',b'not video','video/mp4')},timeout=30).status_code==422
assert requests.get(url+'/cache/missing.wav',timeout=10).status_code==404
report['negativeChecks']={'invalidSpeed':422,'emptySubtitles':422,'invalidVideo':422,'missingAudio':404}
(out/'packaged-test-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('ALL END-TO-END CHECKS PASSED',flush=True)
