"""Bounded-memory local stereo MDX inference; both stems share the original clock."""
import hashlib,json,math,os,tempfile
from pathlib import Path
import numpy as np
import soundfile as sf

def separate_audio(source,models,cache,ffmpeg,progress,cancelled):
 from model_pool import POOL
 model=models/'separation'/'separator.onnx'
 if not model.is_file() or not (model.parent/'config.json').is_file():raise ValueError('Thiếu bộ tách âm thanh. Hãy cài đủ bản cập nhật HNstudio 5.5.0.')
 config=json.loads((model.parent/'config.json').read_text(encoding='utf-8'))
 digest=hashlib.sha256(b'separation-v2')
 with Path(source).open('rb') as f:
  for data in iter(lambda:f.read(8*1024*1024),b''):
   if cancelled():raise RuntimeError('Đã dừng tách âm thanh.')
   digest.update(data)
 key=digest.hexdigest();vocal=cache/('vocals-'+key+'.wav');background=cache/('background-'+key+'.wav')
 if vocal.exists() and background.exists():return {'voiceUrl':'/cache/'+vocal.name,'backgroundUrl':'/cache/'+background.name,'duration':sf.info(vocal).duration}
 def load():
  import onnxruntime as ort
  options=ort.SessionOptions();options.intra_op_num_threads=min(4,os.cpu_count() or 2)
  return ort.InferenceSession(str(model),sess_options=options,providers=['CPUExecutionProvider'])
 with tempfile.TemporaryDirectory(dir=cache,prefix='stems-') as temp,POOL.use('separation',load) as session:
  temp=Path(temp)
  pcm=temp/'source.wav';ffmpeg('-i',source,'-vn','-ar',44100,'-ac',2,pcm)
  nfft=int(config['mdx_n_fft_scale_set']);bins=int(config['mdx_dim_f_set']);frames=2**int(config['mdx_dim_t_set']);hop=1024
  length=hop*(frames-1);trim=nfft//2;usable=length-2*trim;step=usable//2
  window=np.hanning(nfft+1)[:-1].astype('float32');weight=np.maximum(1e-4,np.hanning(usable)).astype('float32')
  carry=np.zeros((2,usable),dtype='float32');weights=np.zeros(usable,dtype='float32')
  with sf.SoundFile(pcm) as reader,sf.SoundFile(temp/'primary.wav','w',samplerate=44100,channels=2,subtype='FLOAT') as writer:
   total=len(reader)
   # Start a half window before zero so the first real samples have full overlap.
   for start in range(-step,total,step):
    if cancelled():raise RuntimeError('Đã dừng tách âm thanh.')
    wave=np.zeros((2,length),dtype='float32');left=max(0,start-trim);right=min(total,start+usable+trim)
    if right>left:
     reader.seek(left);data=reader.read(right-left,dtype='float32',always_2d=True).T;offset=left-(start-trim);wave[:,offset:offset+data.shape[1]]=data
    padded=np.pad(wave,((0,0),(trim,trim)),mode='reflect')
    windows=np.lib.stride_tricks.sliding_window_view(padded,nfft,axis=-1)[:,::hop,:]
    spectrum=np.fft.rfft(windows*window,axis=-1).astype('complex64').transpose(0,2,1)
    packed=np.stack((spectrum.real,spectrum.imag),axis=1).reshape(1,4,nfft//2+1,frames)[:,:,:bins].copy();packed[:,:,:3]=0
    pred=session.run(None,{session.get_inputs()[0].name:packed})[0]
    full=np.pad(pred,((0,0),(0,0),(0,nfft//2+1-bins),(0,0))).reshape(2,2,nfft//2+1,frames)
    inverse=np.fft.irfft((full[:,0]+1j*full[:,1]).transpose(0,2,1),n=nfft,axis=-1).astype('float32')
    reconstructed=np.zeros((2,length+2*trim),dtype='float32');normalization=np.zeros(length+2*trim,dtype='float32')
    for i in range(frames):
     offset=i*hop;reconstructed[:,offset:offset+nfft]+=inverse[:,i]*window;normalization[offset:offset+nfft]+=window*window
    reconstructed/=np.maximum(normalization,1e-8)
    audio=reconstructed[:,trim*2:trim*2+usable]*float(config['compensate'])
    carry+=audio*weight;weights+=weight
    if start>=0:
     count=min(step,total-start);writer.write((carry[:,:count]/np.maximum(weights[:count],1e-6)).T)
    carry[:,:-step]=carry[:,step:];carry[:,-step:]=0;weights[:-step]=weights[step:];weights[-step:]=0
    progress(min(95,int(max(0,start+step)/max(1,total)*95)),'Đang tách tiếng nói và âm thanh nền…')
  primary_is_background=config['primary_stem']=='Instrumental'
  with sf.SoundFile(pcm) as original,sf.SoundFile(temp/'primary.wav') as primary,sf.SoundFile(temp/'other.wav','w',samplerate=44100,channels=2,subtype='FLOAT') as other:
   while len(block:=primary.read(44100,dtype='float32',always_2d=True)):
    if cancelled():raise RuntimeError('Đã dừng tách âm thanh.')
    other.write(original.read(len(block),dtype='float32',always_2d=True)-block)
  targets=[(temp/'other.wav' if primary_is_background else temp/'primary.wav',vocal),(temp/'primary.wav' if primary_is_background else temp/'other.wav',background)]
  try:
   for src,dest in targets:ffmpeg('-i',src,'-ar',48000,'-ac',1,'-af','alimiter=limit=0.97:level=false',dest)
   if cancelled():raise RuntimeError('Đã dừng tách âm thanh.')
  except BaseException:
   vocal.unlink(missing_ok=True);background.unlink(missing_ok=True);raise
 progress(100,'Đã tách tiếng nói và âm thanh nền.')
 return {'voiceUrl':'/cache/'+vocal.name,'backgroundUrl':'/cache/'+background.name,'duration':sf.info(vocal).duration}
