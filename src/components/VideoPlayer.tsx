import {captionBox,placeCaptions,visibleCue,rgba,FONTS,DEFAULT_DECORATION} from '../lib/styled-caption';
import {VideoDesignPanel} from './VideoDesignPanel';
import {stopAudioPreview} from '../lib/vieneu-engine';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Subtitle, Character, CaptionLayout, CaptionPosition, BlurRegion,VideoDecoration } from '../types';

interface VideoPlayerProps {
  videoUrl: string | null;
  decoration:VideoDecoration;onDecorationChange:(d:VideoDecoration)=>void;
  blur:BlurRegion;onBlurChange:(b:BlurRegion)=>void;
  expanded:boolean;onToggleExpanded:()=>void;
  layout:CaptionLayout;
  onLayoutChange:(v:CaptionLayout)=>void;
  onCuePositionChange:(id:string,p:CaptionPosition)=>void;
  originalDetached?:boolean;
  manualTimeline?:boolean;
  dubAudioUrl?:string;
  dubDuration?:number;
  subtitles: Subtitle[];
  characters: Character[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  originalAudioVolume: number;
  originalAudioMuted: boolean;
  bgmDucking: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  onChangeOriginalVolume: (vol: number) => void;
  onToggleOriginalMute: () => void;
  onToggleDucking: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,decoration,onDecorationChange,blur,onBlurChange,layout,onLayoutChange,onCuePositionChange,expanded,onToggleExpanded,
  dubAudioUrl,manualTimeline,originalDetached,
  dubDuration,
  subtitles,
  characters,
  currentTime,
  duration,
  isPlaying,
  originalAudioVolume,
  originalAudioMuted,
  bgmDucking,
  onTimeUpdate,
  onTogglePlay,
  onChangeOriginalVolume,
  onToggleOriginalMute,
  onToggleDucking,
}) => {
  const containerRef=useRef<HTMLDivElement|null>(null),captionRef=useRef<HTMLDivElement|null>(null);
  const [viewport,setViewport]=useState({width:600,height:400}),[nativeRatio,setNativeRatio]=useState(16/9);
  const [scope,setScope]=useState<'all'|'cue'>('all'),[captionSize,setCaptionSize]=useState({width:0,height:0});
  const blurDrag=useRef<{x:number;y:number;region:BlurRegion;resize:boolean}|null>(null);
  const blurMove=(e:React.PointerEvent<HTMLDivElement>)=>{const d=blurDrag.current;if(!d)return;const dx=(e.clientX-d.x)/pw,dy=(e.clientY-d.y)/ph;onBlurChange(d.resize?{...d.region,width:Math.max(.03,Math.min(1-d.region.x,d.region.width+dx)),height:Math.max(.02,Math.min(1-d.region.y,d.region.height+dy))}:{...d.region,x:Math.max(0,Math.min(1-d.region.width,d.region.x+dx)),y:Math.max(0,Math.min(1-d.region.height,d.region.y+dy))});};
  const drag=useRef<{pointer:number;dx:number;dy:number}|null>(null);
  const ratio=layout.aspect==='auto'?nativeRatio:layout.aspect==='16:9'?16/9:9/16;
  const fw=Math.min(viewport.width,viewport.height*ratio),fh=fw/ratio,pw=Math.min(fw,fh*nativeRatio),ph=pw/nativeRatio;
  useEffect(()=>{const el=containerRef.current;if(!el)return;const obs=new ResizeObserver(([entry])=>setViewport({width:Math.max(1,entry.contentRect.width-16),height:Math.max(1,entry.contentRect.height-16)}));obs.observe(el);return()=>obs.disconnect();},[]);
  useEffect(()=>{setNativeRatio(16/9);},[videoUrl]);
  useEffect(()=>{const el=captionRef.current;if(!el)return;const obs=new ResizeObserver(()=>setCaptionSize({width:el.offsetWidth,height:el.offsetHeight}));obs.observe(el);return()=>obs.disconnect();},[subtitles,layout]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const subtitleMode=layout.language||'vi';const setSubtitleMode=(language:'bilingual'|'vi'|'zh'|'off')=>onLayoutChange({...layout,language});
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const dubRef=useRef<HTMLAudioElement|null>(null);

  useEffect(()=>{
    const video=videoRef.current;if(!video)return;
    video.playbackRate=playbackSpeed;
    video.volume=Math.min(1,Math.max(0,originalAudioVolume*(bgmDucking&&subtitles.some(s=>s.ttsAudioUrl&&currentTime>=s.startTime&&currentTime<s.endTime)?0.25:1)));
    if(Math.abs(video.currentTime-Math.min(video.duration||currentTime,currentTime))>(isPlaying?.6:.005))video.currentTime=Math.min(video.duration||currentTime,currentTime);
    if(isPlaying&&(!Number.isFinite(video.duration)||currentTime<video.duration-.05))video.play().catch(()=>{});else video.pause();
  },[videoUrl,isPlaying,currentTime,playbackSpeed,originalAudioVolume,bgmDucking,subtitles]);

  // Find currently active subtitle
  const activeCaptions=useMemo(()=>{const langs:('vi'|'zh')[]=subtitleMode==='off'?[]:subtitleMode==='bilingual'?['vi','zh']:[subtitleMode];return langs.flatMap(lang=>{const cue=subtitles.find(c=>{const v=visibleCue(c,lang,!!dubAudioUrl&&!manualTimeline);return v.text&&currentTime>=v.start&&currentTime<v.end});return cue?[{cue,lang,text:visibleCue(cue,lang,!!dubAudioUrl&&!manualTimeline).text}]:[];});},[subtitles,currentTime,dubAudioUrl,manualTimeline,subtitleMode]);
  const activeSub=activeCaptions[0]?.cue;

  // Find character speaking
  const activeChar = useMemo(() => {
    if (!activeSub) return null;
    return characters.find((c) => c.id === activeSub.characterId);
  }, [activeSub, characters]);

  useEffect(()=>{
    if(!dubAudioUrl)return;
    const audio=new Audio(dubAudioUrl);dubRef.current=audio;
    audio.ontimeupdate=()=>{if(audio.paused)return;if(!videoRef.current||videoRef.current.ended||audio.currentTime>=(videoRef.current.duration||Infinity)-.05)onTimeUpdate(audio.currentTime);};
    return()=>{audio.pause();audio.src='';dubRef.current=null;};
  },[dubAudioUrl]);
  useEffect(()=>{
    const audio=dubRef.current;if(!audio)return;
    audio.playbackRate=playbackSpeed;
    if(Math.abs(audio.currentTime-currentTime)>(isPlaying?.35:.005))audio.currentTime=currentTime;
    if(isPlaying){stopAudioPreview();audio.play().catch(()=>{});}else audio.pause();
  },[isPlaying,currentTime,playbackSpeed,dubAudioUrl]);
  useEffect(()=>{const pauseForPreview=()=>{dubRef.current?.pause();videoRef.current?.pause();if(isPlaying)onTogglePlay();};window.addEventListener('hnvoice-preview',pauseForPreview);return()=>window.removeEventListener('hnvoice-preview',pauseForPreview);},[isPlaying,onTogglePlay]);
  useEffect(()=>{const audio=dubRef.current;if(!audio)return;audio.onended=()=>{if(isPlaying)onTogglePlay();};},[isPlaying,dubAudioUrl,onTogglePlay]);

  const position=(scope==='cue'&&activeSub?.position)||activeSub?.position||layout.position;
  const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  const cx=clamp(position.x,Math.min(.5,(captionSize.width/2+3)/pw),Math.max(.5,1-(captionSize.width/2+3)/pw));
  const cy=clamp(position.y,Math.min(.5,(captionSize.height/2+3)/ph),Math.max(.5,1-(captionSize.height/2+3)/ph));
  const commit=(next:CaptionPosition)=>{next={x:clamp(next.x,Math.min(.5,(captionSize.width/2+3)/pw),Math.max(.5,1-(captionSize.width/2+3)/pw)),y:clamp(next.y,Math.min(.5,(captionSize.height/2+3)/ph),Math.max(.5,1-(captionSize.height/2+3)/ph))};if(scope==='cue'&&activeSub)onCuePositionChange(activeSub.id,next);else onLayoutChange({...layout,position:next});};
  const move=(e:React.PointerEvent)=>{if(!drag.current||e.pointerId!==drag.current.pointer)return;const b=e.currentTarget.parentElement!.getBoundingClientRect();commit({x:clamp((e.clientX-b.left-drag.current.dx)/b.width,0,1),y:clamp((e.clientY-b.top-drag.current.dy)/b.height,0,1)});};
  const formatTime=(sec:number)=>`${Math.floor(sec/60).toString().padStart(2,'0')}:${Math.floor(sec%60).toString().padStart(2,'0')}.${Math.floor(sec%1*10)}`;
  return (<div className="flex-1 min-w-0 min-h-0 flex flex-col bg-[#161e2d] border border-slate-600 rounded-xl m-2 shadow-xl overflow-hidden select-none">
    <div className="shrink-0 flex flex-wrap gap-2 items-center p-2 text-xs bg-zinc-900 border-b border-zinc-800">
<button className="bg-rose-700 rounded p-1" onClick={onToggleExpanded}>{expanded?'Hiện bảng biên tập':'Phóng to khung hình'}</button>
      <label>Khung hình <select aria-label="Tỷ lệ khung hình" value={layout.aspect} onChange={e=>onLayoutChange({...layout,aspect:e.target.value as CaptionLayout['aspect']})} className="bg-zinc-800 rounded p-1"><option value="auto">Theo video</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label>
      <select aria-label="Hiển thị phụ đề" value={subtitleMode} onChange={e=>setSubtitleMode(e.target.value as typeof subtitleMode)} className="bg-zinc-800 rounded p-1"><option value="bilingual">Song ngữ</option><option value="vi">Tiếng Việt</option><option value="zh">Tiếng Trung</option><option value="off">Tắt phụ đề</option></select>
      <select aria-label="Phạm vi kéo phụ đề" value={scope} onChange={e=>setScope(e.target.value as 'all'|'cue')} className="bg-zinc-800 rounded p-1"><option value="all">Vị trí toàn bộ</option><option value="cue">Vị trí câu đang hiện</option></select>
      <button className="bg-zinc-800 p-1 rounded" onClick={()=>commit({x:.5,y:.86})}>Đưa phụ đề xuống dưới</button>
      <label>Cỡ chữ <input aria-label="Cỡ chữ phụ đề" type="range" min="2" max="7" step=".25" value={layout.fontSize} onChange={e=>onLayoutChange({...layout,fontSize:Number(e.target.value)})} className="w-16 align-middle"/></label>
      <label>Độ rộng <input aria-label="Độ rộng phụ đề" type="range" min="40" max="96" value={layout.width} onChange={e=>onLayoutChange({...layout,width:Number(e.target.value)})} className="w-16 align-middle"/></label>
    </div>
    <VideoDesignPanel layout={layout} onLayoutChange={onLayoutChange} decoration={decoration} onDecorationChange={onDecorationChange}/>
    <div className="shrink-0 flex flex-wrap gap-3 items-center px-2 py-1 text-xs bg-zinc-900"><label><input aria-label="Làm mờ phụ đề gốc" type="checkbox" checked={blur.enabled} onChange={e=>onBlurChange({...blur,enabled:e.target.checked})}/> Làm mờ phụ đề gốc</label>{blur.enabled&&<><span>Kéo vùng mờ; kéo góc dưới phải để đổi kích thước</span><label>Độ mờ <input aria-label="Độ mờ" type="range" min="2" max="30" value={blur.strength} onChange={e=>onBlurChange({...blur,strength:Number(e.target.value)})}/></label></>}</div>
    <div ref={containerRef} className="relative flex-1 min-h-0 min-w-0 bg-zinc-950 flex items-center justify-center overflow-hidden">
      <div data-testid="video-frame" className="relative bg-black shrink-0 overflow-hidden ring-2 ring-slate-500 shadow-2xl" style={{width:fw,height:fh}}>
        <div data-testid="video-picture" className="absolute overflow-hidden" style={{width:pw,height:ph,left:(fw-pw)/2,top:(fh-ph)/2}}>
          {videoUrl?<video ref={videoRef} src={videoUrl} className="absolute inset-0 w-full h-full" muted={originalAudioMuted}
            onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setNativeRatio(v.videoWidth/v.videoHeight);}}
            onTimeUpdate={e=>{if(!e.currentTarget.paused&&currentTime<=e.currentTarget.duration+.05)onTimeUpdate(e.currentTarget.currentTime);}}
            onEnded={()=>{if(isPlaying&&(!dubAudioUrl||(dubDuration||0)<=(videoRef.current?.duration||0)+.05))onTogglePlay();}}/>:
            <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">Chọn video hoặc nhập SRT</div>}
          {videoUrl&&blur.enabled&&<div data-testid="blur-region" aria-label="Kéo vùng làm mờ" className="absolute z-[5] border border-cyan-300/70 cursor-move touch-none" style={{left:blur.x*100+'%',top:blur.y*100+'%',width:blur.width*100+'%',height:blur.height*100+'%',backdropFilter:`blur(${blur.strength*pw/Math.max(1,videoRef.current?.videoWidth||pw)}px)`}} onPointerDown={e=>{if(e.button!==0)return;blurDrag.current={x:e.clientX,y:e.clientY,region:{...blur},resize:(e.target as HTMLElement).dataset.resize==='yes'};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={blurMove} onPointerUp={()=>{blurDrag.current=null;}} onPointerCancel={()=>{blurDrag.current=null;}}><span data-resize="yes" aria-label="Đổi kích thước vùng mờ" className="absolute right-0 bottom-0 w-5 h-5 bg-cyan-400 cursor-se-resize"/></div>}
          {placeCaptions(activeCaptions,videoRef.current?.videoWidth||1920,videoRef.current?.videoHeight||1080,layout).map(({cue,lang,box:m,x,y},index)=>{const scale=pw/(videoRef.current?.videoWidth||1920),pos={x:x/(videoRef.current?.videoWidth||1920),y:y/(videoRef.current?.videoHeight||1080)};return <div key={lang+cue.id} ref={index===0?captionRef:undefined} data-testid="subtitle-overlay" role="group" aria-label="Kéo vị trí phụ đề" className="absolute z-10 cursor-move touch-none text-center" style={{left:pos.x*100+'%',top:pos.y*100+'%',transform:'translate(-50%,-50%)',width:m.width*scale,height:m.height*scale,padding:m.pad*scale,background:rgba(layout.backgroundColor||'#000000',layout.backgroundOpacity??.75),color:layout.textColor||'#ffffff',fontFamily:layout.fontFamily||'Arial',fontWeight:700,fontSize:m.size*scale,lineHeight:m.lineHeight*scale+'px'}} onPointerDown={e=>{if(e.button!==0)return;const b=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={pointer:e.pointerId,dx:e.clientX-b.left-pos.x*b.width,dy:e.clientY-b.top-pos.y*b.height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>{m.lines.map((line,i)=><div key={i} style={{whiteSpace:'pre',height:m.lineHeight*scale}}>{line||'\u00a0'}</div>)}</div>;})}
        </div>
        {decoration.enabled&&([['top',decoration.topText,decoration.topHeight,0],['bottom',decoration.bottomText,decoration.bottomHeight,1-decoration.bottomHeight]] as const).map(([id,text,height,y])=>{const m=captionBox(text,fw,{...layout,width:98,fontSize:decoration.fontSize,fontFamily:decoration.fontFamily});return <div key={id} data-testid={'banner-'+id} className="absolute left-0 w-full flex items-center justify-center text-center pointer-events-none z-20" style={{top:y*100+'%',height:height*100+'%',background:decoration.backgroundColor,color:decoration.textColor,fontFamily:decoration.fontFamily,fontSize:m.size,fontWeight:700,lineHeight:1.28}}>{m.lines.map((line,i)=><React.Fragment key={i}>{line}{i<m.lines.length-1&&<br/>}</React.Fragment>)}</div>;})}
        {decoration.overlays.map(t=>{const m=captionBox(t.text,fw,{...layout,fontSize:decoration.fontSize,fontFamily:decoration.fontFamily});return <div key={t.id} data-testid="custom-video-text" className="absolute z-30 cursor-move text-center touch-none" style={{left:t.x*100+'%',top:t.y*100+'%',transform:'translate(-50%,-50%)',width:m.width,padding:m.pad,background:rgba(layout.backgroundColor||'#000000',layout.backgroundOpacity??.75),color:decoration.overlayColor||'#ffffff',fontFamily:decoration.fontFamily,fontSize:m.size,fontWeight:700,lineHeight:1.28}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const r=e.currentTarget.parentElement!.getBoundingClientRect();onDecorationChange({...decoration,overlays:decoration.overlays.map(o=>o.id===t.id?{...o,x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}:o)});}}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}>{m.lines.map((line,i)=><div key={i}>{line}</div>)}</div>;})}

      </div>
    </div>
    <p className="shrink-0 text-[10px] text-zinc-500 px-2">Kéo phụ đề ngay trong hình. Câu dài tự xuống dòng; dùng “Tách đôi câu” để chia mốc. MP4 giữ kiểu chữ, màu và nền đang xem; SRT chỉ chứa chữ và thời gian.</p>
      {/* Video Playback Control Bar */}
      <div className="min-h-12 shrink-0 bg-[#141418] border-t border-[#27272a] flex flex-wrap gap-2 items-center justify-between px-2 py-1 text-xs">
        {/* Play/Pause & Time */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow transition-transform active:scale-95"
            title="Phát / Tạm dừng (Phím Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <button
            onClick={() => onTimeUpdate(0)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Quay lại đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="font-mono text-zinc-300 font-medium">
            <span data-testid="playback-time" className="text-white font-semibold">{formatTime(currentTime)}</span>
            <span className="text-zinc-500 mx-1">/</span>
            <span className="text-zinc-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Audio Mixing & Ducking Controls */}
        <div className="flex items-center space-x-4">
          {/* Original Audio controls */}
          <div className="flex items-center space-x-2 bg-[#1b1b20] px-2.5 py-1 rounded-md border border-zinc-800">
            <button
              disabled={originalDetached} onClick={onToggleOriginalMute}
              className={`p-1 rounded ${
                originalAudioMuted ? 'text-red-400' : 'text-zinc-400 hover:text-white'
              }`}
              title={originalDetached?'Tiếng gốc đã tách: chỉnh ở timeline':originalAudioMuted ? 'Bật tiếng gốc' : 'Tắt tiếng gốc'}
            >
              {originalAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[11px] text-zinc-400">{originalDetached?'Tiếng gốc ở timeline':'Âm thanh gốc:'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              disabled={originalDetached} value={originalAudioMuted ? 0 : originalAudioVolume}
              onChange={(e) => onChangeOriginalVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          {/* Background Audio Ducking Toggle */}
          <button
            onClick={onToggleDucking}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1.5 border transition-colors ${
              bgmDucking
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title="Tự động giảm âm lượng nhạc nền khi nhân vật đang nói tiếng Việt"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Ducking nhạc nền</span>
          </button>

          {/* Speed Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-[#1b1b20] border border-zinc-800 rounded px-2 py-1 text-zinc-300 text-[11px] focus:outline-none"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </div>
      </div>
    </div>
  );
};
