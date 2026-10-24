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
app = FastAPI(title='HN Voice Studio', version='6.0.7')
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
    return {'status':'ok','device':'cpu','models':{n:(MODELS/n).is_dir() for n in ['whisper-small','qwen3','vieneu','ocr-zh']},'modelDirectory':str(MODELS),'version':'6.0.7','instanceId':os.environ.get('HN_INSTANCE_ID'),'activeModel':POOL.name,'modelLoads':POOL.loads}
_ASR_CONTEXT=threading.local()
def asr_progress(percent,message):
    if getattr(_ASR_CONTEXT,'cancelled',lambda:False)():raise RuntimeError('Đã dừng nhận diện.')
    getattr(_ASR_CONTEXT,'progress',lambda *_:None)(percent,message)

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
        asr_progress(10,'Đang đọc âm thanh nguồn…')
        ffmpeg('-i',source,'-vn','-ac',1,'-ar',16000,pcm)
        asr_progress(20,'Đang nạp Whisper Small và nhận diện lời nói…')
        with POOL.use('whisper',lambda:WhisperModel(str(directory),device='cpu',compute_type='int8',cpu_threads=min(4,os.cpu_count() or 2),local_files_only=True)) as model:
            try:
                import soundfile as sf
                samples,_=sf.read(str(pcm),dtype='float32')
                segments,info=model.transcribe(samples,language='zh',beam_size=5,vad_filter=True,word_timestamps=True,condition_on_previous_text=False)
                subtitles=[]
                for i,segment in enumerate(segments):
                    asr_progress(min(96,20+int(segment.end/max(.01,len(samples)/16000)*76)),f'Đã nghe đến {segment.end:.1f}s')
                    if segment.text.strip():subtitles.append({'id':f'sub-{i+1:04}','startTime':segment.start,'endTime':segment.end,'textZh':segment.text.strip(),'characterId':'speaker-1','speed':1,'pitch':0,'volume':1,'status':'raw','modelUsedZh':'Whisper-small'})
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
        asr_progress(15,'Đang nạp bộ quét chữ OCR…')
        with POOL.use('ocr',lambda:RapidOCR(det_model_path=str(directory/'ch_PP-OCRv4_det_infer.onnx'),rec_model_path=str(directory/'ch_PP-OCRv4_rec_infer.onnx'),cls_model_path=str(directory/'ch_ppocr_mobile_v2.0_cls_infer.onnx'),intra_op_num_threads=2,inter_op_num_threads=1)) as engine:
            try:
                t=0.0;last_gray=None;last_result=None;ocr_calls=0
                while t<duration:
                    asr_progress(min(96,20+int(t/max(.01,duration)*76)),f'Quét chữ {t:.1f}/{duration:.1f}s')
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

@app.post('/api/audio/separate')
def separate_original(file:UploadFile=File(...)):
    from audio_separation import separate_audio
    source=CACHE/(uuid.uuid4().hex+'.source')
    try:
        with source.open('wb') as handle:
            while chunk:=file.file.read(8*1024*1024):
                handle.write(chunk)
                if handle.tell()>2*1024**3:raise ValueError('Video vượt 2 GB.')
        return JOBS.submit('separate-audio',{'source':source.name},lambda progress,cancelled:separate_audio(source,MODELS,CACHE,ffmpeg,progress,cancelled),cleanup=lambda:source.unlink(missing_ok=True))
    except Exception as exc:
        source.unlink(missing_ok=True);raise HTTPException(422,str(exc))

@app.post('/api/video/export')
def export_video(file:UploadFile=File(...),options:str=Form('{}'),options_data:UploadFile|None=File(default=None)):
    import json
    from video_export import render_video
    source=CACHE/(uuid.uuid4().hex+'.mp4')
    try:
        if options_data is not None:
            payload=options_data.file.read(64*1024*1024+1)
            if len(payload)>64*1024*1024:raise ValueError('Cấu hình xuất vượt 64 MB. Hãy giảm số hiệu ứng hoặc chia đoạn xuất.')
            options=payload.decode('utf-8')
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
    inputMode:Literal['text','srt-file']='srt-file'

def run_translation(req,progress=lambda *_:None,cancelled=lambda:False):
    if req.provider=='offline':return TRANSLATOR.translate(req.subtitles,req.characters,progress,cancelled)
    return BROWSERS.translate(req.provider,req.subtitles,req.characters,progress,cancelled,input_mode=req.inputMode)

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
@app.post('/api/voices/clone')
def clone_voice(file:UploadFile=File(...),name:str=Form(...)):
    source=CACHE/(uuid.uuid4().hex+'.voice-source')
    try:
        with source.open('wb') as handle:
            while chunk:=file.file.read(1024*1024):
                handle.write(chunk)
                if handle.tell()>50*1024**2:raise ValueError('Mẫu giọng tối đa 50 MB.')
        return JOBS.submit('clone-voice',{'source':source.name,'name':name},lambda progress,cancelled:DUBBING.clone(source,name,progress,cancelled),cleanup=lambda:source.unlink(missing_ok=True))
    except Exception as exc:
        source.unlink(missing_ok=True);raise HTTPException(422,str(exc))

class TimelineSpeechRequest(BaseModel):
    cues:list[dict]
@app.post('/api/audio/retime')
def retime_audio(body:dict):
    import math,hashlib,soundfile
    from dubbing import tempo_filters
    try:
        source=DUBBING.resolve(body['audioUrl']);a=float(body.get('trimStart',0));b=float(body['trimEnd']);speed=float(body.get('speed',1));shift_pitch=body.get('shiftPitch') is True;info=soundfile.info(str(source));duration=info.duration
        if not all(math.isfinite(x) for x in [a,b,speed]) or a<0 or b>a+86400 or b<=a or b>duration+.003 or not .25<=speed<=4:raise ValueError('Mốc cắt hoặc tốc độ không hợp lệ.')
    except (ValueError,KeyError) as exc:raise HTTPException(422,str(exc))
    def render(progress,cancelled):
        output=CACHE/('retime-'+hashlib.sha256(f'{source.name}:{a:.9f}:{b:.9f}:{speed:.9f}:{shift_pitch}'.encode()).hexdigest()+'.wav')
        if not output.is_file():
            temporary=output.with_suffix('.partial.wav');progress(10,'Đang đổi tốc độ âm thanh…')
            try:
                ffmpeg('-i',source,'-af',f'atrim=start={a}:end={b},asetpts=PTS-STARTPTS,'+(f'asetrate={info.samplerate*speed},aresample=48000' if shift_pitch else tempo_filters(speed)),'-ar',48000,'-ac',1,'-c:a','pcm_s16le',temporary)
                if cancelled():raise RuntimeError('Đã dừng chỉnh tốc độ.')
                os.replace(temporary,output)
            finally:temporary.unlink(missing_ok=True)
        progress(100,'Đã tạo âm thanh theo tốc độ.');return {'audioUrl':'/cache/'+output.name,'duration':soundfile.info(str(output)).duration}
    return JOBS.submit('audio-retime',body,render)

@app.post('/api/audio/separate-clip')
def separate_audio_clip(body:dict):
    import soundfile,math
    from audio_separation import separate_audio
    try:
        source=DUBBING.resolve(body['audioUrl']);a=float(body.get('trimStart',0));b=float(body['trimEnd']);info=soundfile.info(str(source))
        if not all(math.isfinite(x) for x in (a,b)) or a<0 or b-a<.039 or b>info.duration+.003:raise ValueError('Mốc cắt âm thanh không hợp lệ.')
    except (ValueError,KeyError) as exc:raise HTTPException(422,str(exc))
    def render(progress,cancelled):
        import tempfile
        with tempfile.TemporaryDirectory(dir=CACHE,prefix='clip-stems-') as temp:
            trimmed=Path(temp)/'selected.wav'
            ffmpeg('-i',source,'-af',f'atrim=start={a}:end={b},asetpts=PTS-STARTPTS','-ar',48000,'-ac',2,trimmed)
            if cancelled():raise RuntimeError('Đã dừng tách âm thanh.')
            return separate_audio(trimmed,MODELS,CACHE,ffmpeg,progress,cancelled)
    return JOBS.submit('separate-clip',body,render)

@app.post('/api/media/import')
def import_media(file:UploadFile=File(...)):
    import cv2,numpy as np
    name=file.filename or 'media';image=Path(name).suffix.lower() in ['.png','.jpg','.jpeg','.webp']
    target=CACHE/('media-'+uuid.uuid4().hex+('.png' if image else '.mp4'))
    try:
        with target.open('wb') as handle:
            while chunk:=file.file.read(1024*1024):
                handle.write(chunk)
                if handle.tell()>(40*1024**2 if image else 2*1024**3):raise ValueError('Ảnh tối đa 40 MB, video tối đa 2 GB.')
        if image:
            im=cv2.imdecode(np.fromfile(str(target),np.uint8),cv2.IMREAD_UNCHANGED)
            if im is None or im.shape[0]*im.shape[1]>40_000_000:raise ValueError('Ảnh không hợp lệ hoặc quá lớn.')
            ok,data=cv2.imencode('.png',im)
            if not ok:raise ValueError('Không đọc được ảnh.')
            data.tofile(str(target));return {'url':'/cache/'+target.name,'kind':'image','width':im.shape[1],'height':im.shape[0],'duration':5}
        probe=subprocess.run([__import__('imageio_ffmpeg').get_ffmpeg_exe(),'-hide_banner','-i',str(target)],capture_output=True,creationflags=0x08000000 if os.name=='nt' else 0)
        if b'Video: h264' not in probe.stderr:
            converted=target.with_name(target.stem+'-web.mp4')
            try:
                ffmpeg('-i',target,'-c:v','libx264','-preset','veryfast','-crf','20','-c:a','aac','-movflags','+faststart',converted)
                os.replace(converted,target)
            finally:converted.unlink(missing_ok=True)
        cap=cv2.VideoCapture(str(target))
        try:
            fps=cap.get(5);frames=cap.get(7)
            if fps<=0 or frames<=0:raise ValueError('Không đọc được video. Chọn MP4 H.264/AAC.')
            return {'url':'/cache/'+target.name,'kind':'video','width':int(cap.get(3)),'height':int(cap.get(4)),'duration':frames/fps}
        finally:cap.release()
    except Exception as exc:
        target.unlink(missing_ok=True);raise HTTPException(422,str(exc))

@app.post('/api/media/track')
def track_media(body:dict):
    from visual_media import track,media_path
    try:
        source=media_path(CACHE,body['url']);start=float(body['start']);end=float(body['end']);region=body['region']
        if not __import__('math').isfinite(start+end):raise ValueError('Thời gian không hợp lệ.')
    except (ValueError,KeyError) as exc:raise HTTPException(422,str(exc))
    return JOBS.submit('track-media',body,lambda progress,cancelled:track(source,start,end,region,progress,cancelled))

@app.post('/api/timeline/speech')
def timeline_speech(req:TimelineSpeechRequest):
    try:
        validate_cues(req.cues,'textVi')
        if len(req.cues)>2000:raise ValueError('Tối đa 2000 câu mỗi lần.')
    except ValueError as exc:raise HTTPException(422,str(exc))
    def render(progress,cancelled):
        clips=[];subtitles=[]
        from smart_speech import measured_speech
        measured=measured_speech(req.cues,DUBBING,progress,cancelled)
        for cue,fitted in measured:
            duration=fitted['duration'];rate=fitted['fitSpeed']
            clips.append({'id':uuid.uuid4().hex,'subtitleId':cue['id'],'track':'voice','name':cue['textVi'],'audioUrl':fitted['audioUrl'],'startTime':float(cue['startTime']),'trimStart':0,'trimEnd':duration,'sourceDuration':duration,'volume':1})
            row={'id':cue['id'],'ttsAudioUrl':fitted['audioUrl'],'ttsDuration':duration,'ttsFitSpeed':rate,'dubStartTime':float(cue['startTime']),'dubEndTime':float(cue['startTime'])+duration,'ttsShift':0}
            if cue.get('smartGroupId'):row.update({'startTime':cue['startTime'],'endTime':cue['endTime'],'viStartTime':cue['startTime'],'viEndTime':cue['endTime'],'smartWarnings':[]})
            subtitles.append(row)
        return {'clips':clips,'subtitles':subtitles}
    return JOBS.submit('timeline-speech',req.model_dump(),render)

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
    if Path(filename).name!=filename or not filename.endswith(('.wav','.mp4','.webm','.png','.jpg','.webp')): raise HTTPException(404)
    path=CACHE/filename
    if not path.is_file(): raise HTTPException(404)
    return FileResponse(path,media_type='video/webm' if filename.endswith('.webm') else 'video/mp4' if filename.endswith('.mp4') else 'audio/wav' if filename.endswith('.wav') else 'image/png')
@app.post('/api/media/cutout')
def media_cutout(body:dict):
    from media_tools import cutout,source_path
    if body.get('kind') not in ('video','image') or body.get('mode') not in ('auto','chroma'):raise HTTPException(422,'Tùy chọn xóa nền không hợp lệ.')
    source=source_path(CACHE,body.get('url'))
    return JOBS.submit('cutout',body,lambda progress,cancelled:cutout(source,body,CACHE,MODELS,progress,cancelled))

@app.post('/api/media/extract')
def extract_clip(body:dict):
    from media_tools import source_path
    from dubbing import tempo_filters
    import soundfile,math
    source=source_path(CACHE,body.get('url'));a=float(body.get('sourceStart',0));duration=float(body.get('duration',0));rate=float(body.get('rate',1))
    if not all(math.isfinite(v) for v in (a,duration,rate)) or a<0 or not .04<=duration<=86400 or not .1<=rate<=8:raise HTTPException(422,'Khoảng trích không hợp lệ.')
    target=CACHE/(uuid.uuid4().hex+'.wav')
    ffmpeg('-ss',a,'-t',duration*rate,'-i',source,'-vn','-af',tempo_filters(rate),'-ar','48000','-ac','1','-c:a','pcm_s16le',target)
    return {'audioUrl':'/cache/'+target.name,'duration':soundfile.info(str(target)).duration}

@app.post('/api/asr-job')
def asr_cached(body:dict):
    from media_tools import source_path
    source=source_path(CACHE,body.get('url'))
    def run(progress,cancelled):
        import math,tempfile,cv2
        from dubbing import tempo_filters
        a=float(body.get('sourceStart',0));rate=float(body.get('rate',1));duration=body.get('duration');mode=body.get('mode','speech')
        if not math.isfinite(a+rate) or a<0 or not .1<=rate<=8 or mode not in ('speech','ocr'):raise ValueError('Khoảng nhận diện không hợp lệ.')
        _ASR_CONTEXT.progress=progress;_ASR_CONTEXT.cancelled=cancelled
        try:
            with tempfile.TemporaryDirectory(dir=CACHE,prefix='recognition-') as temp:
                input=source
                cap=cv2.VideoCapture(str(source));fps=cap.get(5) or 25;source_duration=cap.get(7)/fps;cap.release()
                duration=float(duration) if duration is not None else source_duration/rate
                if not math.isfinite(duration) or not .04<=duration<=86400 or a>=source_duration:raise ValueError('Đoạn video nhận diện không hợp lệ.')
                if a>.001 or abs(rate-1)>.001 or duration<source_duration-.05:
                    asr_progress(3,'Đang lấy đúng phần video đã cắt…')
                    input=Path(temp)/('selected.mp4' if mode=='ocr' else 'selected.wav')
                    if mode=='ocr':ffmpeg('-ss',a,'-t',duration*rate,'-i',source,'-an','-vf',f'setpts=PTS/{rate}','-r',min(10,fps/rate),'-c:v','libx264','-preset','ultrafast','-crf',20,'-t',duration,input)
                    else:ffmpeg('-ss',a,'-t',duration*rate,'-i',source,'-vn','-af',tempo_filters(rate),'-ar',16000,'-ac',1,'-t',duration,input)
                asr_progress(5,'Đang đọc trực tiếp video nguồn…')
                with input.open('rb') as handle:
                    upload=UploadFile(file=handle,filename=input.name)
                    result=ocr_video(upload,crop_top=float(body.get('cropTop',.55)),sample_interval=.5) if mode=='ocr' else transcribe(upload)
                if not result.get('subtitles') and not body.get('allowEmpty'):raise ValueError('Không nhận diện được phụ đề. Hãy đổi cách nhận diện hoặc kiểm tra video.')
                progress(100,'Đã nhận diện xong đoạn video.');return result
        finally:
            _ASR_CONTEXT.__dict__.clear()
    return JOBS.submit('asr',body,run)


@app.post('/api/media/segment')
def media_segment(body:dict):
    from media_tools import source_path
    from dubbing import tempo_filters
    import math
    source=source_path(CACHE,body.get('url'));a=float(body.get('sourceStart',0));duration=float(body.get('duration',0));rate=float(body.get('rate',1))
    if not all(math.isfinite(v) for v in (a,duration,rate)) or a<0 or not .04<=duration<=86400 or not .1<=rate<=8:raise HTTPException(422,'Khoảng nhận diện không hợp lệ.')
    target=CACHE/(uuid.uuid4().hex+'.mp4');ffmpeg('-ss',a,'-t',duration*rate,'-i',source,'-vf',f'setpts=PTS/{rate}','-af',tempo_filters(rate),'-c:v','libx264','-preset','superfast','-crf','20','-c:a','aac','-t',duration,target)
    return {'url':'/cache/'+target.name}

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
