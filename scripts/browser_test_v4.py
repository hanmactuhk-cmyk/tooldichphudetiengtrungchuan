import os
import requests,json,time
from pathlib import Path
base=os.environ.get('HN_TEST_URL','http://127.0.0.1:8004');out=Path(os.environ.get('HN_TEST_OUT','../../outputs/v4-tests'))
out.mkdir(parents=True,exist_ok=True)
cues=[{'id':'a','startTime':0,'endTime':2,'textZh':'老婆，对不起，我今天回来晚了。','characterId':'husband'},{'id':'b','startTime':2,'endTime':4,'textZh':'没关系，你吃饭了吗？','characterId':'wife'},{'id':'c','startTime':4,'endTime':6,'textZh':'还没有，我们一起吃吧。','characterId':'husband'}]
characters=[{'id':'husband','name':'Lý Minh','relationship':'Chồng của Tiểu Mai','pronounSelf':'Anh','pronounCall':'Em'},{'id':'wife','name':'Tiểu Mai','relationship':'Vợ của Lý Minh','pronounSelf':'Em','pronounCall':'Anh'}]
for provider in ['chatgpt','gemini']:
 t=time.monotonic();r=requests.post(base+'/api/translate',json={'provider':provider,'subtitles':cues,'characters':characters},timeout=400)
 print(provider,r.status_code,r.text,flush=True)
 (out/(provider+'-test.json')).write_text(json.dumps({'status':r.status_code,'response':r.json(),'elapsed':time.monotonic()-t},ensure_ascii=False,indent=2),encoding='utf-8')
