"""Integration test with real Chinese speech; requires prepared separation weights."""
import argparse,json,os,subprocess,sys,tempfile
from pathlib import Path
import numpy as np,soundfile as sf,imageio_ffmpeg
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'resources/backend'))
from audio_separation import separate_audio
parser=argparse.ArgumentParser();parser.add_argument('--models',default=os.environ.get('HN_MODELS_DIR',str(ROOT/'resources/models')));parser.add_argument('--source',default=str(ROOT/'tests/fixtures/video-tieng-trung.mp4'));args=parser.parse_args()
def ffmpeg(*args):subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y',*map(str,args)],check=True)
with tempfile.TemporaryDirectory(prefix='hn-stems-test-') as directory:
 out=Path(directory);ffmpeg('-i',args.source,'-t',8,'-ar',44100,'-ac',2,out/'speech.wav');speech,sr=sf.read(out/'speech.wav',dtype='float32',always_2d=True);t=np.arange(len(speech))/sr
 music=.04*np.sin(2*np.pi*196*t)+.025*np.sin(2*np.pi*294*t);sf.write(out/'mixture.wav',speech+music[:,None],sr)
 result=separate_audio(out/'mixture.wav',Path(args.models),out,ffmpeg,lambda *_:None,lambda:False)
 ffmpeg('-i',out/'speech.wav','-ar',48000,'-ac',1,out/'reference.wav');reference,_=sf.read(out/'reference.wav');voice,rate=sf.read(out/Path(result['voiceUrl']).name);background,_=sf.read(out/Path(result['backgroundUrl']).name)
 assert rate==48000 and len(voice)==len(background) and abs(len(voice)/rate-len(speech)/sr)<.01
 n=min(len(reference),len(voice));reference=reference[:n];voice_projection=float(np.dot(voice[:n],reference)/np.dot(reference,reference));background_projection=float(np.dot(background[:n],reference)/np.dot(reference,reference))
 a=(voice+background)[::10];b=reference[::10];scores=[np.dot(a[max(0,k):min(len(a),len(b)+k)],b[max(0,-k):min(len(b),len(a)-k)]) for k in range(-50,51)];lag=(int(np.argmax(scores))-50)*10
 assert np.isfinite(voice).all() and np.isfinite(background).all() and voice_projection>.55 and voice_projection>background_projection and lag==0
 print(json.dumps({'voiceProjection':voice_projection,'backgroundProjection':background_projection,'lagSamples':lag,'duration':len(voice)/rate}))
