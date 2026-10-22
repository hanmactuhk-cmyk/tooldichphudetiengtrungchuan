"""VieNeu synthesis, reusable cache and deterministic non-overlapping timelines."""
import hashlib
import json
import math
import os
import time
import threading
from pathlib import Path
import numpy as np
import soundfile as sf
from model_pool import POOL
from subtitle_contract import validate_cues

SAMPLE_RATE = 48000
MODEL_VERSION = 'VieNeu-v3Turbo-bd0f88eb8de7-fp32-v2'

def _number(value, low, high, label):
    value = float(value)
    if not math.isfinite(value) or not low <= value <= high:
        raise ValueError(f'{label} phải từ {low} đến {high}.')
    return value

def tempo_filters(rate):
    parts=[]
    while rate<.5:parts.append('atempo=0.5');rate/=.5
    while rate>2:parts.append('atempo=2');rate/=2
    parts.append(f'atempo={rate:.9f}')
    return ','.join(parts)

def schedule(cues, durations, max_speed=1.35, gap=.025):
    """Never truncate speech. Fit moderately, then push later cues if necessary."""
    ordered = sorted(zip(cues,durations),key=lambda item:float(item[0]['startTime']))
    result=[];cursor=0.0
    for i,(cue,duration) in enumerate(ordered):
        start=float(cue['startTime'])
        limit=float(ordered[i+1][0]['startTime']) if i+1<len(ordered) else float(cue['endTime'])
        available=max(.1,limit-start-gap)
        rate=min(max_speed,max(1.,float(duration)/available))
        actual_duration=float(duration)/rate
        at=max(start,cursor+(gap if i else 0))
        result.append({'id':cue['id'],'startTime':start,'dubStartTime':at,'dubEndTime':at+actual_duration,'fitSpeed':rate,'shift':at-start})
        cursor=at+actual_duration
    return result

class DubbingService:
    def __init__(self, models, cache, ffmpeg):
        self.models=Path(models);self.cache=Path(cache);self.ffmpeg=ffmpeg;self.synth_lock=threading.RLock();self.voice_home=Path(os.environ.get('HN_VOICES_DIR',self.cache.parent/'voices'));self.voice_home.mkdir(parents=True,exist_ok=True)
        self.voices_data=json.loads((Path(__file__).parent/'vieneu/assets/voices_v3_turbo.json').read_text(encoding='utf-8'))

    def custom_voices(self):
        result=[]
        for path in self.voice_home.glob('clone-*.json'):
            try:
                record=json.loads(path.read_text(encoding='utf-8'))
                if path.stem==record['id'] and (self.voice_home/(path.stem+'.npz')).is_file():result.append(record)
            except (ValueError,KeyError,OSError):continue
        return result

    def voices(self):
        return {'defaultVoice':self.voices_data['default_voice'],'voices':[
            {'id':name,'name':name,'gender':v.get('gender',''),'description':v.get('description',''),'region':v.get('region','')}
            for name,v in self.voices_data['presets'].items()]+self.custom_voices()}

    def clone(self,source,name,progress,cancelled):
        import uuid,tempfile
        name=str(name).strip()
        if not name or len(name)>80:raise ValueError('Tên giọng cần từ 1 đến 80 ký tự.')
        if any(v['name'].casefold()==name.casefold() for v in self.voices()['voices']):raise ValueError('Tên giọng đã có. Hãy đặt tên khác.')
        with self.synth_lock,tempfile.TemporaryDirectory(dir=self.cache,prefix='clone-') as folder:
            reference=Path(folder)/'reference.wav';self.ffmpeg('-i',source,'-t',31,'-ar',48000,'-ac',1,reference)
            info=sf.info(reference)
            if not 3<=info.duration<=30:raise ValueError('Mẫu giọng cần dài từ 3 đến 30 giây; nên dùng 6–20 giây một người nói, ít nhạc nền.')
            audio,_=sf.read(reference,dtype='float32')
            if float(np.sqrt(np.mean(audio**2)))<.002:raise ValueError('Mẫu giọng quá nhỏ hoặc không có tiếng.')
            if cancelled():raise RuntimeError('Đã dừng clone giọng.')
            progress(20,'Đang phân tích mẫu giọng…')
            with POOL.use('vieneu',self._load) as model:embedding,codes=model.encode_reference(reference,denoise=True)
            if cancelled():raise RuntimeError('Đã dừng clone giọng.')
            embedding=np.asarray(embedding,dtype=np.float32);codes=np.asarray(codes,dtype=np.int64)
            if embedding.size!=192 or not np.isfinite(embedding).all() or codes.ndim!=2 or not codes.size:raise ValueError('Không tạo được dấu giọng từ mẫu này. Hãy thử mẫu rõ hơn.')
            identifier='clone-'+uuid.uuid4().hex;record={'id':identifier,'name':name,'description':'Giọng clone riêng','region':'','gender':'','isClone':True,'referenceDuration':info.duration}
            np.savez_compressed(self.voice_home/(identifier+'.npz'),speaker_emb=embedding,codes=codes)
            temporary=self.voice_home/(identifier+'.tmp');temporary.write_text(json.dumps(record,ensure_ascii=False),encoding='utf-8');os.replace(temporary,self.voice_home/(identifier+'.json'))
            progress(100,'Đã lưu giọng '+name);return record

    def _load(self):
        from vieneu import Vieneu
        return Vieneu(backend='onnx',device='cpu',precision='fp32',
            backbone_repo=str(self.models/'vieneu'),onnx_dir=str(self.models/'vieneu/onnx_update'),
            codec_dir=str(self.models/'vieneu-codec'),threads=min(4,os.cpu_count() or 2))

    def synthesize(self, text, voice=None, speed=1, pitch=0, volume=1):
        with self.synth_lock:
            return self._synthesize(text,voice,speed,pitch,volume)

    def _synthesize(self, text, voice=None, speed=1, pitch=0, volume=1):
        text=str(text).strip()
        if not text or len(text)>5000:raise ValueError('Mỗi đoạn đọc cần từ 1 đến 5.000 ký tự.')
        voice=voice or self.voices_data['default_voice']
        voice_argument=voice
        if voice not in self.voices_data['presets']:
            if voice not in {v['id'] for v in self.custom_voices()}:raise ValueError('Giọng đọc không hợp lệ.')
            with np.load(self.voice_home/(voice+'.npz'),allow_pickle=False) as data:voice_argument={'speaker_emb':data['speaker_emb'],'codes':data['codes']}
        speed=_number(speed,.5,2,'Tốc độ');pitch=_number(pitch,-10,10,'Cao độ');volume=_number(volume,0,2,'Âm lượng')
        raw_key=hashlib.sha256(json.dumps([MODEL_VERSION,text,voice],ensure_ascii=False).encode()).hexdigest()
        raw=self.cache/(raw_key+'.raw.wav')
        key=hashlib.sha256(json.dumps([raw_key,speed,pitch,volume]).encode()).hexdigest()
        output=self.cache/(key+'.wav')
        hit=output.is_file()
        if not hit:
            if not raw.is_file():
                with POOL.use('vieneu',self._load) as model:
                    # Recheck after acquiring the single model lock.
                    if not raw.is_file():
                        audio=model.infer(text,voice=voice_argument,temperature=.65,max_chars=256,apply_watermark=False)
                        audio=np.asarray(audio,dtype=np.float32).reshape(-1)
                        if not len(audio) or not np.isfinite(audio).all():raise RuntimeError('VieNeu trả âm thanh rỗng hoặc lỗi.')
                        peak=float(np.max(np.abs(audio)))
                        if peak>.97:audio*=.97/peak
                        temporary=raw.with_suffix('.partial')
                        sf.write(str(temporary),audio,SAMPLE_RATE,subtype='PCM_16',format='WAV')
                        os.replace(temporary,raw)
            ratio=2**(pitch/12)
            temporary=output.with_suffix('.partial.wav')
            self.ffmpeg('-i',raw,'-af',f'asetrate={SAMPLE_RATE*ratio},aresample=48000,'+tempo_filters(speed/ratio)+f',volume={volume},alimiter=limit=0.97:level=false:latency=true','-ar',SAMPLE_RATE,'-ac',1,'-c:a','pcm_s16le',temporary)
            os.replace(temporary,output)
        info=sf.info(str(output))
        return {'audioUrl':'/cache/'+output.name,'duration':info.duration,'cacheHit':hit,'modelUsed':MODEL_VERSION,'voiceId':voice}

    def fit(self, clip, rate):
        if abs(rate-1)<.000001:return clip
        source=self.resolve(clip['audioUrl'])
        key=hashlib.sha256(f'{source.name}:{rate:.8f}'.encode()).hexdigest()
        output=self.cache/(key+'.wav')
        if not output.is_file():
            temporary=output.with_suffix('.partial.wav')
            self.ffmpeg('-i',source,'-af',tempo_filters(rate), '-c:a','pcm_s16le',temporary)
            os.replace(temporary,output)
        return {**clip,'audioUrl':'/cache/'+output.name,'duration':sf.info(str(output)).duration}

    def resolve(self, url):
        if not isinstance(url,str) or not url.startswith('/cache/') or Path(url[7:]).name!=url[7:] or not url.endswith('.wav'):
            raise ValueError('Đường dẫn âm thanh không hợp lệ.')
        path=self.cache/url[7:]
        if not path.is_file():raise ValueError('Âm thanh đã hết hạn. Hãy tạo lại giọng.')
        return path

    def mix(self, cues, clips, video_duration=0):
        validate_cues(cues,'textVi')
        planned=schedule(cues,[c['duration'] for c in clips])
        lookup={cue['id']:(cue,clip) for cue,clip in zip(cues,clips)}
        actual=[];cursor=0
        for entry in planned:
            cue,clip=lookup[entry['id']]
            fitted=self.fit(clip,entry['fitSpeed'])
            at=max(entry['startTime'],cursor+(.025 if actual else 0))
            row={**cue,'ttsAudioUrl':fitted['audioUrl'],'ttsDuration':fitted['duration'],
                'dubStartTime':at,'dubEndTime':at+fitted['duration'],'ttsFitSpeed':entry['fitSpeed'],
                'ttsShift':at-entry['startTime'],'cacheHit':clip.get('cacheHit',False)}
            actual.append(row);cursor=row['dubEndTime']
        key=hashlib.sha256(json.dumps([float(video_duration),[(r['id'],r['ttsAudioUrl'],r['dubStartTime']) for r in actual]]).encode()).hexdigest()
        output=self.cache/('mix-'+key+'.wav')
        if not output.is_file():
            temporary=output.with_suffix('.partial.wav')
            with sf.SoundFile(str(temporary),'w',samplerate=SAMPLE_RATE,channels=1,subtype='PCM_16',format='WAV') as out:
                frame=0
                def silence(count):
                    while count>0:
                        n=min(count,SAMPLE_RATE);out.write(np.zeros(n,dtype=np.float32));count-=n
                for row in actual:
                    wanted=round(row['dubStartTime']*SAMPLE_RATE)
                    silence(max(0,wanted-frame));frame=max(frame,wanted)
                    with sf.SoundFile(str(self.resolve(row['ttsAudioUrl']))) as clip:
                        for block in clip.blocks(blocksize=SAMPLE_RATE,dtype='float32'):
                            out.write(block);frame+=len(block)
                silence(max(0,round(float(video_duration)*SAMPLE_RATE)-frame))
            os.replace(temporary,output)
        return {'subtitles':actual,'audioUrl':'/cache/'+output.name,'duration':sf.info(str(output)).duration,
            'shiftedCues':sum(r['ttsShift']>.01 for r in actual),'maxShift':max((r['ttsShift'] for r in actual),default=0),
            'noOverlap':all(b['dubStartTime']>=a['dubEndTime'] for a,b in zip(actual,actual[1:]))}

    def render(self,cues,video_duration=0,progress=lambda *_:None,cancelled=lambda:False):
        validate_cues(cues,'textVi');clips=[]
        for i,cue in enumerate(cues):
            if cancelled():raise RuntimeError('Đã dừng tạo giọng.')
            progress(round(i/len(cues)*95),f'VieNeu: tạo giọng câu {i+1}/{len(cues)}')
            clips.append(self.synthesize(cue['textVi'],cue.get('voiceId'),cue.get('speed',1),cue.get('pitch',0),cue.get('volume',1)))
        progress(97,'Căn thời lượng và ghép giọng, tránh chồng tiếng...')
        return self.mix(cues,clips,video_duration)
