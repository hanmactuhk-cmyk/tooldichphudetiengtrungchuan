"""Offline inference server. Never returns simulated results."""
import gc, os, sys, uuid, wave, threading, subprocess
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
os.environ.setdefault('HF_HUB_OFFLINE', '1')
os.environ.setdefault('TRANSFORMERS_OFFLINE', '1')
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[2]))
APP_DIR=Path(sys.executable).resolve().parent if getattr(sys,'frozen',False) else ROOT
_model_candidates=[APP_DIR/'resources/models',APP_DIR/'models',APP_DIR.parents[1]/'models',ROOT/'resources/models']
DEFAULT_MODELS=next((p for p in _model_candidates if p.is_dir()),ROOT/'resources/models')
MODELS = Path(os.environ.get('HN_MODELS_DIR', DEFAULT_MODELS))
CACHE = Path(os.environ.get('HN_CACHE_DIR', APP_DIR/'data/cache'))
CACHE.mkdir(parents=True, exist_ok=True)
LOCK = threading.Lock()
from model_pool import POOL
from dubbing import DubbingService
from translation import OfflineTranslator
from browser_translation import BrowserTranslator
from subtitle_contract import validate_cues,from_srt,parse_srt
from jobs import JOBS
app = FastAPI(title='HN Voice Studio', version='5.3.0')
DUBBING=DubbingService(MODELS,CACHE,lambda *args:ffmpeg(*args))
TRANSLATOR=OfflineTranslator(MODELS)
BROWSER_HOME=Path(os.environ.get('HN_BROWSER_HOME',APP_DIR/'data/chrome-profiles'))
if 'HN_BROWSER_HOME' not in os.environ and (APP_DIR/'local-settings.json').is_file():
    import json
    _profile=json.loads((APP_DIR/'local-settings.json').read_text(encoding='utf-8')).get('browserHome')
    if _profile and Path(_profile).is_dir():BROWSER_HOME=Path(_profile)
BROWSERS=BrowserTranslator(BROWSER_HOME)

@app.exception_handler(Exception)
async def inference_error(request,exc):
    import logging
    logging.exception('Local processing failed',exc_info=exc)
    return JSONResponse(status_code=500,content={'detail':'Xử lý thất bại: '+str(exc)[:500]})

def require_model(name):
    target = MODELS / name
    if not target.is_dir():
        raise HTTPException(503, f'Thiếu model {name}. Hãy tải model trước khi sử dụng.')
    return target
def ffmpeg(*args):
    import imageio_ffmpeg
    r = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-hide_banner', '-loglevel', 'error', '-y', *map(str,args)], capture_output=True, timeout=600, creationflags=0x08000000 if os.name=='nt' else 0)
    if r.returncode:
        raise HTTPException(422, 'Lỗi đọc video/âm thanh: '+r.stderr.decode(errors='replace')[-1000:])
@app.get('/health')
@app.get('/api/health')
def health():
    return {'status':'ok','device':'cpu','models':{n:(MODELS/n).is_dir() for n in ['whisper-small','qwen3','vieneu','ocr-zh']},'modelDirectory':str(MODELS),'version':'5.3.0','instanceId':os.environ.get('HN_INSTANCE_ID'),'activeModel':POOL.name,'modelLoads':POOL.loads}
@app.post('/api/transcribe')
def transcribe(file: UploadFile=File(...)):
    from faster_whisper import WhisperModel
    directory = require_model('whisper-small')
    source = CACHE/(uuid.uuid4().hex+Path(file.filename or 'audio.wav').suffix)
    pcm = source.with_suffix('.pcm.wav')
    try:
        with source.open('wb') as out:
            while chunk:=file.file.read(1024*1024):
                out.write(chunk)
                if out.tell()>2*1024**3: raise HTTPException(413,'Video vượt quá 2 GB. Hãy cắt thành đoạn nhỏ.')
        ffmpeg('-i',source,'-vn','-ac',1,'-ar',16000,pcm)
        with POOL.use('whisper',lambda:WhisperModel(str(directory),device='cpu',compute_type='int8',cpu_threads=min(4,os.cpu_count() or 2),local_files_only=True)) as model:
            try:
                import soundfile as sf
                samples,_=sf.read(str(pcm),dtype='float32')
                segments,info=model.transcribe(samples,language='zh',beam_size=5,vad_filter=True,word_timestamps=True,condition_on_previous_text=False)
                subtitles=[{'id':f'sub-{i+1:04}','startTime':s.start,'endTime':s.end,'textZh':s.text.strip(),'characterId':'speaker-1','speed':1,'pitch':0,'volume':1,'status':'raw','modelUsedZh':'Whisper-small'} for i,s in enumerate(segments) if s.text.strip()]
            finally:
                pass
        return {'status':'success','modelUsed':'Whisper-small CPU INT8','subtitles':subtitles}
    finally:
        source.unlink(missing_ok=True)
        pcm.unlink(missing_ok=True)
@app.post('/api/ocr')
def ocr_video(file:UploadFile=File(...),crop_top:float=Form(default=0.55,ge=0,lt=0.95),sample_interval:float=Form(default=0.5,ge=0.2,le=2)):
    import cv2,re
    from difflib import SequenceMatcher
    from rapidocr_onnxruntime import RapidOCR
    directory=require_model('ocr-zh')
    source=CACHE/(uuid.uuid4().hex+Path(file.filename or 'video.mp4').suffix)
    cap=None
    try:
        with source.open('wb') as out:
            while chunk:=file.file.read(1024*1024):
                out.write(chunk)
                if out.tell()>2*1024**3:raise HTTPException(413,'Video vượt quá 2 GB.')
        cap=cv2.VideoCapture(str(source))
        fps=cap.get(cv2.CAP_PROP_FPS);count=cap.get(cv2.CAP_PROP_FRAME_COUNT)
        if not cap.isOpened() or fps<=0 or count<=0:raise HTTPException(422,'Không đọc được video để OCR. Hãy đổi sang MP4 H.264.')
        duration=count/fps;subtitles=[]
        with POOL.use('ocr',lambda:RapidOCR(det_model_path=str(directory/'ch_PP-OCRv4_det_infer.onnx'),rec_model_path=str(directory/'ch_PP-OCRv4_rec_infer.onnx'),cls_model_path=str(directory/'ch_ppocr_mobile_v2.0_cls_infer.onnx'),intra_op_num_threads=2,inter_op_num_threads=1)) as engine:
            try:
                t=0.0;last_gray=None;last_result=None;ocr_calls=0
                while t<duration:
                    cap.set(cv2.CAP_PROP_POS_MSEC,t*1000)
                    ok,frame=cap.read()
                    if not ok:break
                    height,width=frame.shape[:2]
                    crop=frame[int(height*crop_top):,:]
                    if width>1280:crop=cv2.resize(crop,(1280,max(32,int(crop.shape[0]*1280/width))))
                    import numpy as np
                    gray=cv2.resize(cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY),(640,96))
                    same=last_gray is not None and float(np.mean(np.abs(gray.astype(np.int16)-last_gray.astype(np.int16))>20))<0.001
                    if same:result=last_result
                    else:
                        result,_=engine(crop);last_gray=gray;last_result=result;ocr_calls+=1
                    lines=sorted([r for r in result or [] if float(r[2])>=0.6 and re.search(r'[\u4e00-\u9fff]',r[1])],key=lambda r:(round(sum(p[1] for p in r[0])/4/20),min(p[0] for p in r[0])))
                    text=' '.join(r[1] for r in lines).strip()
                    if text:
                        confidence=sum(float(r[2]) for r in lines)/len(lines)
                        clean=lambda x:re.sub(r'\W','',x)
                        previous=subtitles[-1] if subtitles else None
                        if previous and t-previous['endTime']<=sample_interval*0.5 and SequenceMatcher(None,clean(previous['textZh']),clean(text)).ratio()>=0.85:
                            previous['endTime']=min(duration,t+sample_interval)
                            if confidence>previous['confidence']:previous.update(textZh=text,confidence=confidence)
                        else:
                            subtitles.append({'id':f'ocr-{len(subtitles)+1:04}','startTime':t,'endTime':min(duration,t+sample_interval),'textZh':text,'characterId':'speaker-1','speed':1,'pitch':0,'volume':1,'status':'raw','modelUsedZh':'RapidOCR Chinese','confidence':confidence,'notes':f'OCR, sai số thời gian khoảng {sample_interval}s. Kiểm tra lại chữ nhận dạng.'})
                    t+=sample_interval
            finally:
                pass
        return {'status':'success','modelUsed':'RapidOCR Chinese offline','subtitles':subtitles,'sampleInterval':sample_interval,'ocrCalls':ocr_calls}
    finally:
        if cap is not None:cap.release()
        source.unlink(missing_ok=True)

class TimelineMixRequest(BaseModel):
    clips:list[dict]
    duration:float=Field(default=0,ge=0,le=86400)
@app.post('/api/timeline/mix')
def timeline_mix(req:TimelineMixRequest):
    from timeline_audio import mix_timeline
    return JOBS.submit('timeline-mix',req.model_dump(),lambda progress,cancelled:mix_timeline(req.clips,req.duration,CACHE,DUBBING,progress,cancelled))

@app.post('/api/timeline/import-audio')
def timeline_import_audio(file:UploadFile=File(...)):
    import soundfile
    source=CACHE/(uuid.uuid4().hex+Path(file.filename or 'audio.mp4').suffix)
    target=CACHE/(uuid.uuid4().hex+'.wav')
    try:
        with source.open('wb') as handle:
            while chunk:=file.file.read(8*1024*1024):
                handle.write(chunk)
                if handle.tell()>2*1024**3:raise ValueError('Tệp vượt 2 GB.')
        ffmpeg('-i',source,'-vn','-ar','48000','-ac','1','-c:a','pcm_s16le',target)
        return {'audioUrl':'/cache/'+target.name,'duration':soundfile.info(str(target)).duration}
    except Exception as exc:
        target.unlink(missing_ok=True);raise HTTPException(422,'Không lấy được âm thanh: '+str(exc))
    finally:source.unlink(missing_ok=True)

@app.post('/api/video/export')
def export_video(file:UploadFile=File(...),options:str=Form(...)):
    import json
    from video_export import render_video
    source=CACHE/(uuid.uuid4().hex+'.mp4')
    try:
        config=json.loads(options)
        if not isinstance(config,dict):raise ValueError('Tùy chọn xuất không hợp lệ.')
        with source.open('wb') as handle:
            while chunk:=file.file.read(8*1024*1024):
                handle.write(chunk)
                if handle.tell()>2*1024**3:raise ValueError('Video vượt 2 GB.')
        return JOBS.submit('export-video',{'upload':source.name,'options':config},lambda progress,cancelled:render_video(source,config,CACHE,DUBBING,progress,cancelled),cleanup=lambda:source.unlink(missing_ok=True))
    except Exception as exc:
        source.unlink(missing_ok=True);raise HTTPException(422,str(exc))

@app.post('/api/gemini/video-subtitles')
def gemini_video_subtitles(file:UploadFile=File(...),duration:float=Form(...)):
    import hashlib,math
    from video_subtitles import extract_with_gemini
    if not math.isfinite(duration) or duration<=0:raise HTTPException(422,'Không đọc được độ dài video.')
    suffix=Path(file.filename or 'video.mp4').suffix.lower()
    if suffix not in ('.mp4','.mov','.mkv','.webm','.avi','.m4v'):raise HTTPException(422,'Hãy chọn tệp video MP4/MOV/MKV/WebM/AVI.')
    source=CACHE/(uuid.uuid4().hex+suffix);digest=hashlib.sha256()
    try:
        with source.open('wb') as handle:
            while chunk:=file.file.read(1024*1024):
                digest.update(chunk);handle.write(chunk)
                if handle.tell()>2*1024**3:raise HTTPException(413,'Video vượt giới hạn tải 2 GB của tool. Hãy chọn một tệp video dung lượng nhỏ hơn; tool không tự chia video.')
        import cv2
        cap=cv2.VideoCapture(str(source))
        try:
            fps=cap.get(cv2.CAP_PROP_FPS);frames=cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if not cap.isOpened() or fps<=0 or frames<=0:raise HTTPException(422,'Không đọc được video. Hãy đổi sang MP4 H.264/AAC.')
            duration=frames/fps
        finally:cap.release()
        job=JOBS.submit('gemini-video',{'sha256':digest.hexdigest(),'duration':duration},lambda progress,cancelled:extract_with_gemini(BROWSERS,source,duration,ffmpeg,progress,cancelled),cleanup=lambda:source.unlink(missing_ok=True))
        if job.get('reused'):source.unlink(missing_ok=True)
        return job
    except Exception:
        source.unlink(missing_ok=True);raise

from typing import Literal
class TranslateRequest(BaseModel):
    subtitles:list[dict]
    characters:list[dict]=[]
    provider:Literal['offline','gemini','chatgpt']='offline'
    mode:str='fast'

def run_translation(req,progress=lambda *_:None,cancelled=lambda:False):
    if req.provider=='offline':return TRANSLATOR.translate(req.subtitles,req.characters,progress,cancelled)
    return BROWSERS.translate(req.provider,req.subtitles,req.characters,progress,cancelled)

@app.post('/api/translate')
def translate(req:TranslateRequest):
    try:return run_translation(req)
    except ValueError as exc:raise HTTPException(422,str(exc))

@app.post('/api/translate-job')
def translate_job(req:TranslateRequest):
    try:validate_cues(req.subtitles)
    except ValueError as exc:raise HTTPException(422,str(exc))
    return JOBS.submit('translate',req.model_dump(),lambda progress,cancelled:run_translation(req,progress,cancelled))

class BrowserRequest(BaseModel):
    provider:Literal['gemini','chatgpt']
@app.post('/api/browser/open')
def browser_open(req:BrowserRequest):
    try:return BROWSERS.open(req.provider)
    except ValueError as exc:raise HTTPException(422,str(exc))
@app.get('/api/browser/status')
def browser_status():return {provider:BROWSERS.status(provider) for provider in ['gemini','chatgpt']}

class ImportTranslation(BaseModel):
    srt:str
    subtitles:list[dict]
@app.post('/api/translation/import')
def import_translation(req:ImportTranslation):
    try:return {'translations':from_srt(req.srt,req.subtitles),'modelUsed':'SRT đã duyệt'}
    except ValueError as exc:raise HTTPException(422,str(exc))

@app.post('/api/subtitles/import')
def import_subtitles(body:dict):
    rows=parse_srt(str(body.get('srt','')))
    if not rows or len(rows)!=str(body.get('srt','')).count('-->'):raise HTTPException(422,'SRT có câu không đúng định dạng; chưa nhập để tránh mất câu.')
    field='textVi' if body.get('language')=='vi' else 'textZh'
    result=[{'id':f'srt-{i:04}','startTime':r['startTime'],'endTime':r['endTime'],field:r['textVi'],'textZh':'' if field=='textVi' else r['textVi'],'characterId':'speaker-1','speed':1,'pitch':0,'volume':1,'status':'translated' if field=='textVi' else 'raw'} for i,r in enumerate(rows,1)]
    return {'subtitles':result}

class TtsRequest(BaseModel):
    text:str=Field(min_length=1,max_length=5000)
    voice_id:str|None=None
    speed:float=Field(default=1,ge=0.5,le=2)
    pitch:float=Field(default=0,ge=-10,le=10)
    volume:float=Field(default=1,ge=0,le=2)
@app.get('/api/voices')
def voices():return DUBBING.voices()
@app.post('/api/tts')
def tts(req:TtsRequest):
    try:return DUBBING.synthesize(req.text,req.voice_id,req.speed,req.pitch,req.volume)
    except ValueError as exc:raise HTTPException(422,str(exc))

class DubRequest(BaseModel):
    subtitles:list[dict]
    videoDuration:float=Field(default=0,ge=0,le=86400)
@app.post('/api/dub')
def dub(req:DubRequest):
    try:validate_cues(req.subtitles,'textVi')
    except ValueError as exc:raise HTTPException(422,str(exc))
    return JOBS.submit('dub',req.model_dump(),lambda progress,cancelled:DUBBING.render(req.subtitles,req.videoDuration,progress,cancelled))
@app.post('/api/mix')
def mix(req:DubRequest):
    try:
        clips=[{'audioUrl':c['ttsAudioUrl'],'duration':__import__('soundfile').info(str(DUBBING.resolve(c['ttsAudioUrl']))).duration} for c in req.subtitles]
        return DUBBING.mix(req.subtitles,clips,req.videoDuration)
    except (ValueError,KeyError) as exc:raise HTTPException(422,str(exc))
@app.get('/api/jobs/{identifier}')
def job(identifier:str):
    try:return JOBS.get(identifier)
    except KeyError:raise HTTPException(404,'Tác vụ không tồn tại.')
@app.post('/api/jobs/{identifier}/cancel')
def cancel_job(identifier:str):
    try:JOBS.cancel(identifier);return {'status':'cancelling'}
    except KeyError:raise HTTPException(404,'Tác vụ không tồn tại.')

@app.get('/api/audio/peaks/{filename}')
def audio_peaks(filename:str):
    import soundfile,numpy as np,math
    try:
        path=DUBBING.resolve('/cache/'+filename)
        with soundfile.SoundFile(str(path)) as audio:
            step=max(1,math.ceil(audio.frames/512));peaks=[]
            for block in audio.blocks(blocksize=step,dtype='float32',always_2d=True):peaks.append(round(float(np.abs(block).max()),4))
        return {'peaks':peaks}
    except ValueError as exc:raise HTTPException(422,str(exc))

@app.get('/cache/{filename}')
def audio(filename:str):
    if Path(filename).name!=filename or not filename.endswith(('.wav','.mp4')): raise HTTPException(404)
    path=CACHE/filename
    if not path.is_file(): raise HTTPException(404)
    return FileResponse(path,media_type='video/mp4' if filename.endswith('.mp4') else 'audio/wav')
if (ROOT/'dist').is_dir(): app.mount('/',StaticFiles(directory=ROOT/'dist',html=True),name='frontend')
if __name__=='__main__':
    import uvicorn
    if '--verify-models' in sys.argv:
        import hashlib,json
        manifest=json.loads((MODELS/'manifest.json').read_text(encoding='utf-8'))
        for item in manifest['files']:
            path=MODELS/item['path']; h=hashlib.sha256()
            with path.open('rb') as f:
                while chunk:=f.read(8*1024*1024):h.update(chunk)
            if h.hexdigest()!=item['sha256']:raise RuntimeError('Checksum mismatch: '+str(path))
        print('ALL MODEL CHECKSUMS OK');sys.exit(0)
    if '--open' in sys.argv:
        import webbrowser
        threading.Timer(2,lambda:webbrowser.open('http://127.0.0.1:'+os.environ.get('HN_PORT','8001'))).start()
    uvicorn.run(app,host='127.0.0.1',port=int(os.environ.get('HN_PORT','8001')))
