import sys,json,subprocess
from pathlib import Path
import cv2,numpy as np,soundfile as sf
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from video_export import render_video
import imageio_ffmpeg
root=Path(__file__).resolve().parents[3];out=root/'outputs/v52-tests/render';out.mkdir(parents=True,exist_ok=True)
w,h=320,180;raw=out/'pattern.mp4';writer=cv2.VideoWriter(str(raw),cv2.VideoWriter_fourcc(*'mp4v'),25,(w,h))
y,x=np.indices((h,w));image=np.repeat((((x//3+y//3)%2)*255).astype('uint8')[:,:,None],3,2)
for _ in range(50):writer.write(image)
writer.release();sf.write(out/'original.wav',np.sin(np.arange(48000*2)*2*np.pi*440/48000)*.2,48000);sf.write(out/'voice.wav',np.sin(np.arange(48000*3)*2*np.pi*660/48000)*.2,48000)
source=out/'source.mp4';subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(raw),'-i',str(out/'original.wav'),'-c:v','copy','-c:a','aac',str(source)],check=True)
class Dub:
 def resolve(self,url):return out/'voice.wav'
def run(opts):return render_video(source.resolve(),opts,out.resolve(),Dub(),lambda *_:None,lambda:False)
base=run({'originalMuted':True});blur=run({'originalMuted':True,'blur':{'enabled':True,'x':.1,'y':.65,'width':.8,'height':.25,'strength':16}})
def frame(r):
 c=cv2.VideoCapture(str(out/Path(r['url']).name));ok,f=c.read();c.release();assert ok;return f
b=frame(base);m=frame(blur);assert m[120:150,50:270].std()<b[120:150,50:270].std()*.25
ass='[Script Info]\nScriptType: v4.00+\nPlayResX: 320\nPlayResY: 180\n[V4+ Styles]\nFormat: Name,Fontname,Fontsize,PrimaryColour,Alignment\nStyle: Default,Arial,24,&H00FFFFFF,5\n[Events]\nFormat: Layer,Start,End,Style,Text\nDialogue: 0,0:00:00.00,0:00:03.00,Default,{\\pos(160,80)}Xin chào Việt Nam'
r=run({'originalMuted':True,'dubAudioUrl':'/cache/voice.wav','aspect':'9:16','ass':ass,'blur':{'enabled':True,'x':.1,'y':.65,'width':.8,'height':.25,'strength':16}});assert r['height']>r['width'] and r['duration']==3
f=out/Path(r['url']).name;audio=out/'decoded.wav';subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(f),str(audio)],check=True);a,sr=sf.read(audio);a=a.mean(axis=1) if a.ndim>1 else a;peak=np.fft.rfftfreq(len(a),1/sr)[np.abs(np.fft.rfft(a)).argmax()];assert abs(peak-660)<2
report={'blurVarianceReduced':True,'portrait':r,'originalMutedDubFrequency':peak};(out/'report.json').write_text(json.dumps(report,indent=2));print('MP4 BLUR / ASS / PORTRAIT / DUB TAIL / AUDIO TESTS PASSED')
