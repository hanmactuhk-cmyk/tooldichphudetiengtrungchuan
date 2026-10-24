import {motionCss} from '../lib/text-motion';
import {InlineText} from './InlineText';
import {textLayout} from '../lib/raster-visual';
import {TextTarget} from '../types';
import {RasterVisual} from '../lib/raster-visual';
import {LayerVideo} from './LayerVideo';
import {FloatingPanel} from './FloatingPanel';
import {geometry} from '../lib/visual-engine';
import {VisualClip} from '../types';
import {captionBox,coloredCharacters,placeCaptions,visibleCue,rgba,FONTS,DEFAULT_DECORATION} from '../lib/styled-caption';
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

interface VideoPlayerProps {onEditText:(t:TextTarget)=>void;onTextChange:(t:TextTarget,text:string)=>void;textEditor?:React.ReactNode;
  videoUrl: string | null;
  externalInspector?:boolean;videoEdited?:boolean;visuals:VisualClip[];selectedVisual:string|null;onSelectVisual:(id:string)=>void;onVisualChange:(v:VisualClip[])=>void;mediaEditor:React.ReactNode;baseWidth?:number;baseHeight?:number;
  decoration:VideoDecoration;onDecorationChange:(d:VideoDecoration)=>void;
  blur:BlurRegion;onBlurChange:(b:BlurRegion)=>void;
  expanded:boolean;onToggleExpanded:()=>void;
  layout:CaptionLayout;
  onLayoutChange:(v:CaptionLayout)=>void;
  onCuePositionChange:(id:string,p:CaptionPosition)=>void;
  originalDetached?:boolean;originalDetachedMuted?:boolean;
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
  onEditText,onTextChange,textEditor,videoUrl,externalInspector,videoEdited,visuals,selectedVisual,onSelectVisual,onVisualChange,mediaEditor,baseWidth,baseHeight,decoration,onDecorationChange,blur,onBlurChange,layout,onLayoutChange,onCuePositionChange,expanded,onToggleExpanded,
  dubAudioUrl,manualTimeline,originalDetached,originalDetachedMuted,
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
  const [editing,setEditing]=useState<TextTarget|null>(null);
  const beginText=(t:TextTarget)=>{visualDrag.current=null;drag.current=null;setEditing(t);onEditText(t);if(full||!externalInspector)setTool('text')};
  const openTool=(tool:'design'|'blur'|'media')=>{if(externalInspector&&!full)window.dispatchEvent(new CustomEvent('hn-inspector-tab',{detail:tool}));else setTool(tool)};
  const rootRef=useRef<HTMLDivElement>(null);const [tool,setTool]=useState<'design'|'blur'|'media'|'text'|null>(null),[zoom,setZoom]=useState(1),[full,setFull]=useState(false);
  useEffect(()=>{const open=()=>setTool('media');window.addEventListener('hn-open-media',open);return()=>window.removeEventListener('hn-open-media',open)},[]);
  useEffect(()=>{if(externalInspector&&!full)setTool(null)},[externalInspector,full]);
  const maxVisualLayer=Math.max(1,...visuals.map(c=>(c.layer||0)+1));
  const visualDrag=useRef<any>(null);const hasVideoLayers=videoEdited||visuals.some(c=>c.kind==='video');const activeVideo=[...visuals].reverse().find(c=>c.kind==='video'&&c.enabled&&currentTime>=c.startTime&&currentTime<c.endTime);const resolvedUrl=hasVideoLayers?activeVideo?.url||null:videoUrl;const sourceOffset=activeVideo?activeVideo.sourceStart-activeVideo.startTime*(activeVideo.rate||1):0;const sourceRate=activeVideo?.rate||1;
  const sourceAt=(t:number)=>Math.max(0,t*sourceRate+sourceOffset);const shown=visuals.filter(c=>c.enabled&&currentTime>=c.startTime&&currentTime<c.endTime);
  useEffect(()=>{const f=()=>setFull(!!document.fullscreenElement);document.addEventListener('fullscreenchange',f);return()=>document.removeEventListener('fullscreenchange',f)},[]);
  const changeGeometry=(c:VisualClip,updates:Partial<VisualClip>)=>{const g=geometry(c,currentTime),time=Math.max(c.startTime,Math.min(c.endTime,currentTime));const next={...c,...updates};if(c.keyframes.length)next.keyframes=[...c.keyframes.filter(k=>Math.abs(k.time-time)>.001),{time,x:g.x,y:g.y,width:g.width,height:g.height,opacity:g.opacity,...updates}].sort((a,b)=>a.time-b.time);onVisualChange(visuals.map(v=>v.id===c.id?next:v));};
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
    video.playbackRate=playbackSpeed*sourceRate;
    video.volume=Math.min(1,Math.max(0,originalAudioVolume*(bgmDucking&&subtitles.some(s=>s.ttsAudioUrl&&currentTime>=s.startTime&&currentTime<s.endTime)?0.25:1)));
    if(Math.abs(video.currentTime-Math.min(video.duration||sourceAt(currentTime),sourceAt(currentTime)))>(isPlaying?.6:.005))video.currentTime=Math.min(video.duration||sourceAt(currentTime),sourceAt(currentTime));
    if(isPlaying&&(!Number.isFinite(video.duration)||sourceAt(currentTime)<video.duration-.05))video.play().catch(()=>{});else video.pause();
  },[resolvedUrl,isPlaying,currentTime,playbackSpeed,originalAudioVolume,bgmDucking,subtitles,sourceOffset,sourceRate]);

  // Find currently active subtitle
  const activeCaptions=useMemo(()=>{const langs:('vi'|'zh')[]=subtitleMode==='off'?[]:subtitleMode==='bilingual'?['vi','zh']:[subtitleMode];return langs.flatMap(lang=>{const cue=subtitles.find(c=>{const v=visibleCue(c,lang,!!dubAudioUrl&&!manualTimeline);return (v.text||(editing?.kind==='caption'&&editing.id===c.id&&editing.lang===lang))&&currentTime>=v.start&&currentTime<v.end});return cue?[{cue,lang,text:visibleCue(cue,lang,!!dubAudioUrl&&!manualTimeline).text}]:[];});},[subtitles,currentTime,dubAudioUrl,manualTimeline,subtitleMode,editing]);
  const activeSub=activeCaptions[0]?.cue;

  // Find character speaking
  const activeChar = useMemo(() => {
    if (!activeSub) return null;
    return characters.find((c) => c.id === activeSub.characterId);
  }, [activeSub, characters]);

  useEffect(()=>{
    if(!dubAudioUrl)return;
    const audio=new Audio(dubAudioUrl);dubRef.current=audio;

    return()=>{audio.pause();audio.src='';dubRef.current=null;};
  },[dubAudioUrl]);
  useEffect(()=>{
    const audio=dubRef.current;if(!audio)return;
    audio.playbackRate=playbackSpeed;
    if(Math.abs(audio.currentTime-currentTime)>(isPlaying?.35:.005))audio.currentTime=currentTime;
    if(isPlaying){stopAudioPreview();audio.play().catch(()=>{});}else audio.pause();
  },[isPlaying,currentTime,playbackSpeed,dubAudioUrl]);
  useEffect(()=>{const pauseForPreview=()=>{dubRef.current?.pause();videoRef.current?.pause();if(isPlaying)onTogglePlay();};window.addEventListener('hnvoice-preview',pauseForPreview);return()=>window.removeEventListener('hnvoice-preview',pauseForPreview);},[isPlaying,onTogglePlay]);
  const timeRef=useRef(currentTime);timeRef.current=currentTime;const tickCallback=useRef(onTimeUpdate);tickCallback.current=onTimeUpdate;const endCallback=useRef(onTogglePlay);endCallback.current=onTogglePlay;
  useEffect(()=>{if(!isPlaying)return;const start=performance.now(),at=timeRef.current;let frame=0,last=0;const tick=(now:number)=>{const t=Math.min(duration,at+(now-start)/1000*playbackSpeed);tickCallback.current(t);if(t>=duration){endCallback.current();return;}frame=requestAnimationFrame(tick)};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[isPlaying,playbackSpeed,duration]);

  const position=(scope==='cue'&&activeSub?.position)||activeSub?.position||layout.position;
  const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
  const cx=clamp(position.x,Math.min(.5,(captionSize.width/2+3)/pw),Math.max(.5,1-(captionSize.width/2+3)/pw));
  const cy=clamp(position.y,Math.min(.5,(captionSize.height/2+3)/ph),Math.max(.5,1-(captionSize.height/2+3)/ph));
  const commit=(next:CaptionPosition)=>{next={x:clamp(next.x,Math.min(.5,(captionSize.width/2+3)/pw),Math.max(.5,1-(captionSize.width/2+3)/pw)),y:clamp(next.y,Math.min(.5,(captionSize.height/2+3)/ph),Math.max(.5,1-(captionSize.height/2+3)/ph))};if(scope==='cue'&&activeSub)onCuePositionChange(activeSub.id,next);else onLayoutChange({...layout,position:next});};
  const move=(e:React.PointerEvent)=>{if(!drag.current||e.pointerId!==drag.current.pointer)return;const b=e.currentTarget.parentElement!.getBoundingClientRect();commit({x:clamp((e.clientX-b.left-drag.current.dx)/b.width,0,1),y:clamp((e.clientY-b.top-drag.current.dy)/b.height,0,1)});};
  const formatTime=(sec:number)=>`${Math.floor(sec/60).toString().padStart(2,'0')}:${Math.floor(sec%60).toString().padStart(2,'0')}.${Math.floor(sec%1*10)}`;
  return (<div ref={rootRef} className="preview-shell flex-1 min-w-0 min-h-0 flex flex-col bg-[#161e2d] border border-slate-600 rounded-xl m-2 shadow-xl overflow-hidden select-none">
    <div className="preview-toolbar shrink-0 flex flex-wrap gap-2 items-center p-2 text-xs bg-zinc-900 border-b border-zinc-800">
<button className="bg-rose-700 rounded p-1" onClick={onToggleExpanded}>{expanded?'Hiện bảng biên tập':'Phóng to khung hình'}</button>
      <button onClick={()=>openTool('design')}>✦ Phụ đề / Nền</button><button onClick={()=>openTool('media')}>◉ Làm mờ</button><button onClick={()=>openTool('media')}>🎬 Video / Ảnh / Keyframe</button><button aria-label="Preview toàn màn hình" onClick={()=>{if(document.fullscreenElement)document.exitFullscreen();else rootRef.current?.requestFullscreen();}}>⛶ Toàn màn hình</button><button aria-label="Thu nhỏ preview" onClick={()=>setZoom(z=>Math.max(.25,z-.25))}>−</button><input aria-label="Thu phóng preview" type="range" min=".25" max="3" step=".05" value={zoom} onChange={e=>setZoom(+e.target.value)} className="w-16"/><button aria-label="Phóng to preview" onClick={()=>setZoom(z=>Math.min(3,z+.25))}>＋</button><button onClick={()=>setZoom(1)}>{Math.round(zoom*100)}% · Vừa</button>
      <button onClick={()=>window.dispatchEvent(new Event('hn-subtitle-list'))}>Danh sách phụ đề</button><label>Khung hình <select aria-label="Tỷ lệ khung hình" value={layout.aspect} onChange={e=>onLayoutChange({...layout,aspect:e.target.value as CaptionLayout['aspect']})} className="bg-zinc-800 rounded p-1"><option value="auto">Theo video</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label>
      <select aria-label="Hiển thị phụ đề" value={subtitleMode} onChange={e=>setSubtitleMode(e.target.value as typeof subtitleMode)} className="bg-zinc-800 rounded p-1"><option value="bilingual">Song ngữ</option><option value="vi">Tiếng Việt</option><option value="zh">Tiếng Trung</option><option value="off">Tắt phụ đề</option></select>
      <select aria-label="Phạm vi kéo phụ đề" value={scope} onChange={e=>setScope(e.target.value as 'all'|'cue')} className="bg-zinc-800 rounded p-1"><option value="all">Vị trí toàn bộ</option><option value="cue">Vị trí câu đang hiện</option></select>
      <button className="bg-zinc-800 p-1 rounded" onClick={()=>commit({x:.5,y:.86})}>Đưa phụ đề xuống dưới</button>
      <label>Cỡ chữ <input aria-label="Cỡ chữ phụ đề" type="range" min=".5" max="15" step=".25" value={layout.fontSize} onChange={e=>onLayoutChange({...layout,fontSize:Number(e.target.value)})} className="w-16 align-middle"/></label>
      <label>Độ rộng <input aria-label="Độ rộng phụ đề" type="range" min="40" max="96" value={layout.width} onChange={e=>onLayoutChange({...layout,width:Number(e.target.value)})} className="w-16 align-middle"/></label>
    </div>
    {tool==='design'&&<FloatingPanel title="Thiết kế phụ đề và nền" onClose={()=>setTool(null)}>    <VideoDesignPanel layout={layout} onLayoutChange={onLayoutChange} decoration={decoration} onDecorationChange={onDecorationChange}/>
</FloatingPanel>}
    {tool==='blur'&&<FloatingPanel title="Làm mờ" onClose={()=>setTool(null)}>    <div className="shrink-0 flex flex-wrap gap-3 items-center px-2 py-1 text-xs bg-zinc-900"><label><input aria-label="Làm mờ phụ đề gốc" type="checkbox" checked={blur.enabled} onChange={e=>onBlurChange({...blur,enabled:e.target.checked})}/> Làm mờ phụ đề gốc</label>{blur.enabled&&<><label>Bo góc vùng mờ <input aria-label="Bo góc vùng mờ" type="range" min="0" max=".5" step=".025" value={blur.radius??.22} onChange={e=>onBlurChange({...blur,radius:Number(e.target.value)})}/></label><span>Kéo vùng mờ; kéo góc dưới phải để đổi kích thước</span><label>Độ mờ <input aria-label="Độ mờ" type="range" min="2" max="30" value={blur.strength} onChange={e=>onBlurChange({...blur,strength:Number(e.target.value)})}/></label></>}</div>
<p className="p-3 text-xs text-slate-300">Để tạo nhiều vùng mờ theo thời gian, mở Video / Ảnh / Keyframe → ＋ Vùng mờ.</p><button onClick={()=>setTool('media')}>Mở vùng mờ trên timeline</button></FloatingPanel>}
    {tool==='text'&&<FloatingPanel title="Thuộc tính chữ" onClose={()=>setTool(null)}>{textEditor}</FloatingPanel>}
    {tool==='media'&&<FloatingPanel title="Video · Ảnh · Chuyển động" onClose={()=>setTool(null)}>{mediaEditor}</FloatingPanel>}
    <div ref={containerRef} className="relative flex-1 min-h-0 min-w-0 bg-zinc-950 flex items-center justify-center overflow-auto">
      <div data-testid="video-frame" className="relative bg-black shrink-0 overflow-hidden ring-2 ring-slate-500 shadow-2xl" style={{width:fw,height:fh,transform:`scale(${zoom})`,transformOrigin:'center'}}>
        <div data-testid="video-picture" className="absolute overflow-hidden" style={{width:pw,height:ph,left:(fw-pw)/2,top:(fh-ph)/2}}>
          {visuals.filter(c=>c.kind==='video'&&c.enabled&&currentTime>=c.startTime&&currentTime<c.endTime&&c.id!==activeVideo?.id).map(c=><LayerVideo key={c.id} z={10+(c.layer||0)*2} canvasWidth={pw} canvasHeight={ph} clip={c} time={currentTime} playing={isPlaying} speed={playbackSpeed} muted={originalAudioMuted||!!originalDetached} volume={originalAudioVolume}/>)}
          {activeVideo?<LayerVideo clip={activeVideo} videoRef={videoRef} canvasWidth={pw} canvasHeight={ph} time={currentTime} playing={isPlaying} speed={playbackSpeed} muted={originalAudioMuted||!!originalDetached} volume={originalAudioVolume} z={10+(activeVideo.layer||0)*2} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setNativeRatio(baseWidth&&baseHeight?baseWidth/baseHeight:v.videoWidth/v.videoHeight)}}/>:resolvedUrl?<video ref={videoRef} src={resolvedUrl} className="absolute inset-0 w-full h-full" muted={originalAudioMuted||originalDetached} onLoadedMetadata={e=>{const v=e.currentTarget;if(v.videoWidth&&v.videoHeight)setNativeRatio(baseWidth&&baseHeight?baseWidth/baseHeight:v.videoWidth/v.videoHeight)}}/>:<div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">Chọn video hoặc nhập SRT</div>}
          {videoUrl&&blur.enabled&&<div data-testid="blur-region" aria-label="Kéo vùng làm mờ" className="absolute z-[5] border border-cyan-300/70 cursor-move touch-none" style={{zIndex:maxVisualLayer*2+15,left:blur.x*100+'%',top:blur.y*100+'%',width:blur.width*100+'%',height:blur.height*100+'%',borderRadius:Math.min(blur.width*pw,blur.height*ph)*(blur.radius??.22),overflow:'hidden',backdropFilter:`blur(${blur.strength*pw/Math.max(1,videoRef.current?.videoWidth||pw)}px)`}} onPointerDown={e=>{if(e.button!==0)return;blurDrag.current={x:e.clientX,y:e.clientY,region:{...blur},resize:(e.target as HTMLElement).dataset.resize==='yes'};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={blurMove} onPointerUp={()=>{blurDrag.current=null;}} onPointerCancel={()=>{blurDrag.current=null;}}><span data-resize="yes" aria-label="Đổi kích thước vùng mờ" className="absolute right-0 bottom-0 w-5 h-5 bg-cyan-400 cursor-se-resize"/></div>}
          {shown.map(c=>{const g=geometry(c,currentTime);return <div key={c.id} data-testid={'visual-'+c.kind} data-visual-id={c.id} data-text-role={c.templateRole} onDoubleClick={e=>{if(c.kind==='text'){e.stopPropagation();beginText({kind:'visual',id:c.id})}}} onPointerDown={e=>{if(e.button!==0)return;if((e.target as HTMLElement).closest('[contenteditable=true]'))return;onSelectVisual(c.id);if(!externalInspector||full)setTool('media');const r=e.currentTarget.parentElement!.getBoundingClientRect();visualDrag.current={id:c.id,x:e.clientX,y:e.clientY,w:r.width,h:r.height,g,resize:(e.target as HTMLElement).dataset.resize==='yes'};e.currentTarget.setPointerCapture(e.pointerId)}} onPointerMove={e=>{const d=visualDrag.current;if(d?.id!==c.id)return;const dx=(e.clientX-d.x)/d.w,dy=(e.clientY-d.y)/d.h;if(c.kind==='video'){if(d.resize){const factor=Math.abs(dx/d.g.width)>Math.abs(dy/d.g.height)?1+dx/d.g.width:1+dy/d.g.height;const f=Math.max(.05/Math.min(d.g.width,d.g.height),Math.min(4/Math.max(d.g.width,d.g.height),factor));changeGeometry(c,{width:d.g.width*f,height:d.g.height*f})}else changeGeometry(c,{x:Math.max(-4,Math.min(4,d.g.x+dx)),y:Math.max(-4,Math.min(4,d.g.y+dy))})}else changeGeometry(c,d.resize?{width:Math.max(.01,Math.min(1-d.g.x,d.g.width+dx)),height:Math.max(.01,Math.min(1-d.g.y,d.g.height+dy))}:{x:Math.max(0,Math.min(1-d.g.width,d.g.x+dx)),y:Math.max(0,Math.min(1-d.g.height,d.g.y+dy))})}} onPointerUp={()=>{visualDrag.current=null}} onPointerCancel={()=>{visualDrag.current=null}} className="absolute cursor-move touch-none" style={{left:g.x*100+'%',top:g.y*100+'%',width:g.width*100+'%',height:g.height*100+'%',opacity:g.opacity,zIndex:11+(c.layer||0)*2,outline:selectedVisual===c.id?'1px solid #67e8f9':undefined,borderRadius:c.kind==='blur'?Math.min(g.width*pw,g.height*ph)*(c.radius??.22):0,overflow:c.kind==='text'&&c.textStyle?.motion?'visible':'hidden',backdropFilter:c.kind==='blur'?`blur(${(c.strength||16)*pw/Math.max(1,baseWidth||1920)}px)`:undefined}}>{(c.kind==='text'||c.template)?<div className="w-full h-full" style={{...motionCss(c.textStyle?.motion,currentTime,c.startTime,c.endTime,pw,ph,c.text?.length||1,c.text?.split(/\s+/).length||1),transform:`${motionCss(c.textStyle?.motion,currentTime,c.startTime,c.endTime,pw,ph,c.text?.length||1,c.text?.split(/\s+/).length||1).transform} rotate(${c.rotation||0}deg) scale(${c.flipX?-1:1},${c.flipY?-1:1})`}}><RasterVisual clip={editing?.kind==='visual'&&editing.id===c.id?{...c,text:''}:c} w={baseWidth||1920} h={baseHeight||1080}/></div>:c.kind==='image'&&<img draggable={false} src={c.url} alt={c.name} className="w-full h-full pointer-events-none" style={{objectFit:c.fit||'contain',transform:`rotate(${c.rotation||0}deg) scale(${c.flipX?-1:1},${c.flipY?-1:1})`}}/>}{editing?.kind==='visual'&&editing.id===c.id&&(()=>{const l=textLayout(c,baseWidth||1920,baseHeight||1080),scale=pw/(baseWidth||1920);return <InlineText value={c.text||''} onChange={text=>onTextChange({kind:'visual',id:c.id},text)} onFinish={()=>setEditing(null)} style={{left:l.left*scale,top:l.y*scale,width:l.available*scale,minHeight:l.size*l.lineSpace*scale,fontSize:l.size*scale,lineHeight:l.size*l.lineSpace*scale+'px',fontFamily:c.textStyle?.fontFamily||'Arial',fontWeight:c.textStyle?.bold===false?400:700,fontStyle:c.textStyle?.italic?'italic':'normal',color:c.textStyle?.color||'#fff',textAlign:c.textStyle?.align||'center',transform:`scaleX(${l.sx})`,transformOrigin:'left top',textTransform:c.textStyle?.uppercase?'uppercase':'none'}}/>})()}{selectedVisual===c.id&&<span data-resize="yes" aria-label="Đổi kích thước lớp" className="absolute right-0 bottom-0 w-4 h-4 bg-cyan-300 cursor-se-resize"/>}</div>})}
          {placeCaptions(activeCaptions,baseWidth||videoRef.current?.videoWidth||1920,baseHeight||videoRef.current?.videoHeight||1080,layout,decoration.enabled?{top:Math.max(0,(decoration.topHeight*fh-(fh-ph)/2)/ph*(baseHeight||videoRef.current?.videoHeight||1080)),bottom:Math.min(baseHeight||videoRef.current?.videoHeight||1080,((1-decoration.bottomHeight)*fh-(fh-ph)/2)/ph*(baseHeight||videoRef.current?.videoHeight||1080))}:undefined).map(({cue,lang,style,box:m,x,y},index)=>{const motion=motionCss(style.motion,currentTime,lang==='zh'?cue.zhStartTime??cue.startTime:cue.viStartTime??cue.startTime,lang==='zh'?cue.zhEndTime??cue.endTime:cue.viEndTime??cue.endTime,pw,ph,(lang==='zh'?cue.textZh:cue.textVi||'').length,(lang==='zh'?cue.textZh:cue.textVi||'').split(/\s+/).length);const scale=pw/(baseWidth||videoRef.current?.videoWidth||1920),pos={x:x/(baseWidth||videoRef.current?.videoWidth||1920),y:y/(baseHeight||videoRef.current?.videoHeight||1080)};return <div key={lang+cue.id} ref={index===0?captionRef:undefined} data-testid="subtitle-overlay" role="group" aria-label="Kéo vị trí phụ đề" onDoubleClick={e=>{e.stopPropagation();beginText({kind:'caption',id:cue.id,lang})}} className="absolute z-10 cursor-move touch-none text-center" style={{zIndex:maxVisualLayer*2+20,left:pos.x*100+'%',top:pos.y*100+'%',...motion,transform:`translate(-50%,-50%) ${motion.transform}`,letterSpacing:(style.letterSpacing||0)*scale*(baseWidth||1920)/1920,textDecoration:style.underline?'underline':undefined,WebkitTextStroke:style.strokeWidth?`${style.strokeWidth*scale}px ${style.strokeColor||'#000000'}`:undefined,textShadow:style.shadow?`0 ${style.shadow*scale}px ${style.shadow*scale}px #000`:undefined,width:editing?.kind==='caption'&&editing.id===cue.id?Math.max(100,m.width*scale):m.width*scale,height:m.height*scale,padding:m.pad*scale,background:rgba(style.backgroundColor||'#000000',style.backgroundOpacity??.75),borderRadius:Math.min(m.width,m.height)*(style.cornerRadius??.2)*scale,color:style.textColor||'#ffffff',fontFamily:style.fontFamily||'Arial',fontWeight:style.bold===false?400:700,fontStyle:style.italic?'italic':'normal',textAlign:style.align||'center',fontSize:m.size*scale,lineHeight:m.lineHeight*scale+'px'}} onPointerDown={e=>{if(e.button!==0||(e.target as HTMLElement).closest('[contenteditable=true]'))return;const b=e.currentTarget.parentElement!.getBoundingClientRect();drag.current={pointer:e.pointerId,dx:e.clientX-b.left-pos.x*b.width,dy:e.clientY-b.top-pos.y*b.height};e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={move} onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}}>{editing?.kind==='caption'&&editing.id===cue.id&&editing.lang===lang?<InlineText value={lang==='zh'?cue.textZh:cue.textVi||''} onChange={text=>onTextChange({kind:'caption',id:cue.id,lang},text)} onFinish={()=>setEditing(null)} style={{position:'relative',width:'100%',minHeight:m.height*scale-2*m.pad*scale,font:'inherit',color:'inherit',lineHeight:'inherit',textAlign:style.align||'center'}}/>:m.lines.map((line,i)=><div key={i} style={{whiteSpace:'pre',height:m.lineHeight*scale}}>{line?coloredCharacters(line,m.lineStarts[i],style.characterColors).map(c=><span key={c.index} style={{color:c.color}}>{c.text}</span>):'\u00a0'}</div>)}</div>;})}
        </div>
        {decoration.enabled&&([['top',decoration.topText,decoration.topHeight,0],['bottom',decoration.bottomText,decoration.bottomHeight,1-decoration.bottomHeight]] as const).map(([id,text,height,y])=>{const m=captionBox(text,fw,{...layout,width:98,fontSize:decoration.fontSize,fontFamily:decoration.fontFamily,bold:decoration.bold!==false,italic:decoration.italic});return <div key={id} data-testid={'banner-'+id} onDoubleClick={()=>beginText({kind:'banner',id})} className="absolute left-0 w-full flex items-center justify-center text-center cursor-text z-20" style={{zIndex:maxVisualLayer*2+30,top:y*100+'%',height:height*100+'%',background:decoration.backgroundColor,color:decoration.textColor,fontFamily:decoration.fontFamily,fontSize:m.size,fontWeight:decoration.bold===false?400:700,fontStyle:decoration.italic?'italic':'normal',lineHeight:1.28,textAlign:decoration.align||'center'}}>{editing?.kind==='banner'&&editing.id===id?<InlineText value={text} onChange={value=>onTextChange({kind:'banner',id},value)} onFinish={()=>setEditing(null)} style={{position:'relative',width:'96%',font:'inherit',lineHeight:'inherit',textAlign:decoration.align||'center'}}/>:<div>{m.lines.map((line,i)=><div key={i} style={{whiteSpace:'pre',lineHeight:'1.28',height:m.lineHeight}}>{coloredCharacters(line,m.lineStarts[i],id==='top'?decoration.topColors:decoration.bottomColors).map(c=><span key={c.index} style={{color:c.color}}>{c.text}</span>)}</div>)}</div>}</div>;})}
        {decoration.overlays.map(t=>{const m=captionBox(t.text,fw,{...layout,fontSize:decoration.fontSize,fontFamily:decoration.fontFamily,bold:decoration.bold!==false,italic:decoration.italic});return <div key={t.id} data-testid="custom-video-text" onDoubleClick={()=>beginText({kind:'legacy',id:t.id})} className="absolute z-30 cursor-move text-center touch-none" style={{zIndex:maxVisualLayer*2+40,left:t.x*100+'%',top:t.y*100+'%',transform:'translate(-50%,-50%)',width:m.width,padding:m.pad,background:rgba(layout.backgroundColor||'#000000',layout.backgroundOpacity??.75),color:decoration.overlayColor||'#ffffff',fontFamily:decoration.fontFamily,fontSize:m.size,fontWeight:decoration.bold===false?400:700,fontStyle:decoration.italic?'italic':'normal',textAlign:decoration.align||'center',lineHeight:1.28}} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);e.preventDefault();}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId)){const r=e.currentTarget.parentElement!.getBoundingClientRect();onDecorationChange({...decoration,overlays:decoration.overlays.map(o=>o.id===t.id?{...o,x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}:o)});}}} onPointerUp={e=>e.currentTarget.releasePointerCapture(e.pointerId)}>{editing?.kind==='legacy'&&editing.id===t.id?<InlineText value={t.text} onChange={value=>onTextChange({kind:'legacy',id:t.id},value)} onFinish={()=>setEditing(null)} style={{position:'relative',width:'100%',font:'inherit',lineHeight:'inherit',textAlign:decoration.align||'center'}}/>:m.lines.map((line,i)=><div key={i} style={{whiteSpace:'pre',height:m.lineHeight}}>{coloredCharacters(line,m.lineStarts[i],t.characterColors).map(c=><span key={c.index} style={{color:c.color}}>{c.text}</span>)}</div>)}</div>;})}

      </div>
    </div>
    <p className="shrink-0 text-[10px] text-zinc-500 px-2">Kéo phụ đề ngay trong hình. Câu dài tự xuống dòng; dùng “Tách đôi câu” để chia mốc. MP4 giữ kiểu chữ, màu và nền đang xem; SRT chỉ chứa chữ và thời gian.</p>
      {/* Video Playback Control Bar */}
      <div className="preview-controls min-h-12 shrink-0 bg-[#141418] border-t border-[#27272a] flex flex-wrap gap-2 items-center justify-between px-2 py-1 text-xs">
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
              onClick={onToggleOriginalMute}
              className={`p-1 rounded ${
                (originalDetached?originalDetachedMuted:originalAudioMuted) ? 'text-red-400' : 'text-zinc-400 hover:text-white'
              }`}
              title={originalDetached?'Tiếng gốc đã tách: chỉnh ở timeline':originalAudioMuted ? 'Bật tiếng gốc' : 'Tắt tiếng gốc'}
            >
              {(originalDetached?originalDetachedMuted:originalAudioMuted) ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[11px] text-zinc-400">{originalDetached?'Tiếng gốc ở timeline':'Âm thanh gốc:'}</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              key={'original-volume-'+originalAudioVolume} defaultValue={originalDetached?originalAudioVolume:originalAudioMuted?0:originalAudioVolume}
              onChange={e=>{if(!originalDetached)onChangeOriginalVolume(+e.target.value)}} onPointerUp={e=>{if(originalDetached)onChangeOriginalVolume(+e.currentTarget.value)}} onKeyUp={e=>{if(originalDetached)onChangeOriginalVolume(+e.currentTarget.value)}} onBlur={e=>{if(originalDetached&&+e.target.value!==originalAudioVolume)onChangeOriginalVolume(+e.target.value)}} aria-label="Âm lượng tiếng gốc"
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
          <label className="preview-speed">Xem {playbackSpeed.toFixed(2)}×<input aria-label="Tốc độ phát xem trước" type="range" min=".5" max="2" step=".05" value={playbackSpeed} onChange={e=>setPlaybackSpeed(+e.target.value)}/></label>
        </div>
      </div>
    </div>
  );
};
