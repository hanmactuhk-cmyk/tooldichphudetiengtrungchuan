import sys,tempfile,hashlib
from pathlib import Path
import numpy as np,soundfile as sf
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from timeline_audio import mix_timeline
with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[2]) as d:
 cache=Path(d);sr=48000;source=cache/'source.wav';sf.write(source,np.r_[np.ones(sr)*.1,np.ones(sr)*.3,np.ones(sr)*-.2],sr);digest=hashlib.sha256(source.read_bytes()).hexdigest()
 class Dub:
  def resolve(self,url):return source
 clips=[{'id':'a','track':'voice','audioUrl':'/cache/source.wav','startTime':1,'trimStart':.5,'trimEnd':1.5,'volume':1},{'id':'b','track':'voice','audioUrl':'/cache/source.wav','startTime':3,'trimStart':2,'trimEnd':3,'volume':1}]
 r=mix_timeline(clips,5,cache,Dub());a,rate=sf.read(cache/Path(r['audioUrl']).name);assert rate==sr and len(a)==5*sr
 assert abs(a[int(.5*sr)])<.001 and abs(a[int(1.2*sr)]-.1)<.002 and abs(a[int(1.8*sr)]-.3)<.002 and abs(a[int(3.5*sr)]+.2)<.002
 try:mix_timeline([clips[0],{**clips[1],'startTime':1.5}],5,cache,Dub());raise AssertionError('overlap accepted')
 except ValueError:pass
 muted=mix_timeline([{**clips[0],'muted':True}],2,cache,Dub());b,_=sf.read(cache/Path(muted['audioUrl']).name);assert np.max(abs(b))==0
 assert hashlib.sha256(source.read_bytes()).hexdigest()==digest
 try:mix_timeline([{**clips[0],'id':'cancel'}],5,cache,Dub(),cancelled=lambda:True);raise AssertionError('cancel accepted')
 except RuntimeError:pass
 assert not list(cache.glob('*.partial.wav'))
 print('TIMELINE REAL AUDIO OFFSET / TRIM / MUTE / NO OVERLAP / CANCEL TESTS PASSED')
