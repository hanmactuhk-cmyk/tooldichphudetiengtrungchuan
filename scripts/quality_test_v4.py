import os
import requests,time,json
from pathlib import Path
out=Path(os.environ.get('HN_TEST_OUT','../../outputs/v4-tests'));out.mkdir(exist_ok=True)
base=os.environ.get('HN_TEST_URL','http://127.0.0.1:8004')
out.mkdir(parents=True,exist_ok=True)
cues=[{'id':'a','startTime':0,'endTime':2,'textZh':'老婆，对不起，我今天回来晚了。','characterId':'husband'},{'id':'b','startTime':2,'endTime':4,'textZh':'没关系，你吃饭了吗？','characterId':'wife'},{'id':'c','startTime':4,'endTime':6,'textZh':'还没有，我们一起吃吧。','characterId':'husband'}]
characters=[{'id':'husband','name':'Lý Minh','relationship':'Chồng của Tiểu Mai','pronounSelf':'Anh','pronounCall':'Em'},{'id':'wife','name':'Tiểu Mai','relationship':'Vợ của Lý Minh','pronounSelf':'Em','pronounCall':'Anh'}]
t=time.monotonic();r=requests.post(base+'/api/translate',json={'subtitles':cues,'characters':characters},timeout=600);print(r.status_code,r.text,flush=True);r.raise_for_status();result=r.json();result['elapsed']=time.monotonic()-t;(out/'qwen-translation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
r=requests.post(base+'/api/tts',json={'text':'Xin chào, đây là giọng đọc VieNeu được tích hợp vào công cụ dịch video.','voice_id':'Hải Đăng'},timeout=300);print('TTS',r.status_code,r.text,flush=True);r.raise_for_status();data=r.json();(out/'vieneu.wav').write_bytes(requests.get(base+data['audioUrl']).content)
t=time.monotonic();r=requests.post(base+'/api/tts',json={'text':'Xin chào, đây là giọng đọc VieNeu được tích hợp vào công cụ dịch video.','voice_id':'Hải Đăng'},timeout=60);print('CACHE',time.monotonic()-t,r.text,flush=True)
