import {recognizeProject,recognitionParts} from './lib/recognition-source';
import type {TimelineAudioClip} from './types';
import {placeAudioEdit} from './lib/timeline-engine';
import {linkedVideoEdit} from './lib/linked-video';
import {AutoDialog} from './components/AutoDialog';
import {AutoSettings,continueAuto,AUTO_STEPS} from './lib/auto-pipeline';
import {exportProjectVideo,uploadJob} from './lib/export-project';
import {TextProperties} from './components/TextProperties';
import {TemplateParts} from './components/TemplateParts';
import {TextTarget} from './types';
import {normalizeTemplateBundle,visualSelection} from './lib/template-bundle';
import {ensureProjectFonts} from './lib/project-fonts';
import {DEFAULT_TEXT} from './lib/raster-visual';
import {TEXT_ASSET} from './components/MediaLibrary';
import {MediaLibrary} from './components/MediaLibrary';
import {insertLibraryAsset} from './lib/media-library';
import {replaceTemplate} from './lib/template-slots';
import {LegacyBlurEditor} from './components/LegacyBlurEditor';
import {InspectorDock} from './components/InspectorDock';
import {VideoDesignPanel} from './components/VideoDesignPanel';
import {TemplatePanel} from './components/TemplatePanel';
import {AudioPopup} from './components/AudioPopup';
import {FloatingPanel} from './components/FloatingPanel';
import {visualTracks,orderedVisuals} from './lib/visual-engine';
import {prepareVisuals,rasterKey} from './lib/raster-visual';
import {MediaEditor,VisualTimeline} from './components/MediaEditor';
import {VisualClip,MediaAsset} from './types';
import {captionSpeechCues} from './lib/speech-cues';
import {CaptionPopup,CaptionChange} from './components/CaptionPopup';
import {DEFAULT_DECORATION} from './lib/styled-caption';
import {rememberVideo,readVideo} from './lib/video-source';
import {deleteTimelineSelection,editTimeline,timelineSubtitles,projectClips,timelineEnd,TimelineEdit,validateTimeline} from './lib/timeline-engine';
import {DEFAULT_CAPTION_LAYOUT,splitCue,generateAss} from './lib/caption-layout';
import {apiJson,runJob} from './lib/jobs';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TranslationProvider,
  ProjectData,
  Subtitle,
  Character,
  HardwareVramStatus,
} from './types';
import { Header } from './components/Header';
import { VideoPlayer } from './components/VideoPlayer';
import { Timeline } from './components/Timeline';
import { SubtitleEditor } from './components/SubtitleEditor';
import { SidebarTabs } from './components/SidebarTabs';
import { OfflinePackagingModal } from './components/OfflinePackagingModal';
import { ModelArchitectureModal } from './components/ModelArchitectureModal';
import { DesktopModelLoaderModal } from './components/DesktopModelLoaderModal';
import { runOfflineASR } from './lib/asr-engine';
import { runQwenTranslation, retranslateSingleSentence } from './lib/translator-engine';
import { bufferToWavBlob, synthesizeVieNeuTTS, VIENEU_VOICES, loadVieNeuVoices, stopAudioPreview } from './lib/vieneu-engine';
import { generateSrt, triggerDownload } from './lib/export-engine';

export default function App() {
  const [theme,setTheme]=useState(()=>{const saved=localStorage.getItem('hnstudio-theme');return ['simple','modern','glow','glow-dark'].includes(saved||'')?saved!:'glow'});
  const [themeReady,setThemeReady]=useState(!(window as any).hnDesktop?.getTheme);
  useEffect(()=>{const api=(window as any).hnDesktop;if(api?.getTheme)api.getTheme().then((saved:string)=>{setTheme(saved);setThemeReady(true)}).catch(()=>setThemeReady(true))},[]);
  useEffect(()=>{if(themeReady){localStorage.setItem('hnstudio-theme',theme);(window as any).hnDesktop?.setTheme?.(theme).catch(console.error)}},[theme,themeReady]);
  // Main Project State
  const [project, setProject] = useState<ProjectData>(() => ({
    id: 'proj-chinese-drama-01',
    title: 'Dự án mới — chọn video để bắt đầu',
    videoUrl: null,
    videoFileName: '',
    captionLayout:{...DEFAULT_CAPTION_LAYOUT,position:{...DEFAULT_CAPTION_LAYOUT.position}},
    duration: 0,
    originalAudioVolume: 0.8,
    originalAudioMuted: false,
    bgmDucking: true,
    subtitles: [],
    characters: [{id:'speaker-1',name:'Người nói',gender:'female',role:'Chưa phân vai',relationship:'Chưa xác định',pronounSelf:'',pronounCall:'',color:'#3B82F6',voiceId:'Hải Đăng',speed:1,pitch:0}],
    translationMode: 'offline',
    selectedSubtitleId: 'sub-01',
    currentTime: 0,
  }));

  const [voices,setVoices]=useState<any[]>([]);const [captionSelection,setCaptionSelection]=useState<string[]>([]);const [linkMedia,setLinkMedia]=useState(false);
  const [jobId,setJobId]=useState<string|null>(null);
  useEffect(()=>{loadVieNeuVoices().then(data=>setVoices(data.voices)).catch(console.error);},[]);
  useEffect(()=>{const handler=(e:Event)=>setJobId((e as CustomEvent).detail);window.addEventListener('hn-job',handler);return()=>window.removeEventListener('hn-job',handler);},[]);
  const handleCancel=async()=>{if(jobId)await apiJson('/api/jobs/'+jobId+'/cancel',{method:'POST'});};
  const handleImportSrt=async(file:File,language:'zh'|'vi')=>{
    try{const data=await apiJson('/api/subtitles/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({srt:await file.text(),language})});
      pushHistory(project);setProject(p=>({...p,subtitles:data.subtitles,audioClips:p.audioClips?.filter(c=>c.track==='audio'),dubAudioUrl:undefined,dubDuration:undefined,title:file.name.replace(/\.srt$/i,''),duration:p.videoUrl?p.duration:Math.max(p.duration,...data.subtitles.map((s:Subtitle)=>s.endTime))}));setActiveSidebarTab(language==='vi'?'characters':'translation');
    }catch(e){alert(String(e));}
  };
  const handleImportTranslation=async(srt:string)=>{
    try{const data=await apiJson('/api/translation/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({srt,subtitles:project.subtitles})});
      const map=new Map<string,any>(data.translations.map((r:any)=>[r.id,r]));pushHistory(project);setProject(p=>({...p,dubAudioUrl:undefined,dubDuration:undefined,audioClips:p.audioClips?.filter(c=>c.track==='audio'),subtitles:p.subtitles.map(s=>({...s,textVi:map.get(s.id).viFull,ttsAudioUrl:undefined,ttsDuration:undefined,status:'translated'}))}));setActiveSidebarTab('characters');
    }catch(e){alert(String(e));}
  };

  const handleSplitCue=(id:string)=>{try{const cue=project.subtitles.find(s=>s.id===id);if(!cue)return;const parts=splitCue(cue);if(project.manualTimeline){handleTimelineEdit({track:'subtitle',id,kind:'split',time:parts[0].endTime,linked:true});return;}stopAudioPreview();setIsPlaying(false);pushHistory(project);setProject(p=>({...p,subtitles:p.subtitles.flatMap(s=>s.id===id?parts:[s]),dubAudioUrl:undefined,dubDuration:undefined,selectedSubtitleId:parts[0].id}));}catch(e){alert(String(e));}};
  const [lastExport,setLastExport]=useState('');
  const handleExportMp4=async(captions:boolean)=>{
    if(!project.videoUrl)return;const desktop=(window as any).hnDesktop;if(desktop&&!await desktop.chooseExport(project.title.replace(/[<>:\x22/\\|?*]/g,'_')+'_HNVoice.mp4'))return;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:0,currentTaskName:'Chuẩn bị xuất MP4...'}));
    try{await ensureProjectFonts(project);let exportProject=project;if(project.manualTimeline&&!project.dubAudioUrl){const mixed=await runJob('/api/timeline/mix',{clips:projectClips(project),duration:timelineEnd(project)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));exportProject={...project,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration};setProject(exportProject);}
      const form=new FormData();form.append('file',await readVideo(exportProject.videoUrl!),exportProject.videoFileName||'video.mp4');form.append('options',JSON.stringify({rendererRevision:'6.0.1',timelineDuration:timelineEnd(exportProject),visuals:orderedVisuals(await prepareProjectVisuals(exportProject),exportProject.visualTracks),videoEdited:exportProject.videoEdited,ass:generateAss(captions?exportProject:{...exportProject,captionLayout:{...DEFAULT_CAPTION_LAYOUT,...exportProject.captionLayout,language:'off'}}),blur:exportProject.blurRegion,aspect:exportProject.captionLayout?.aspect||'auto',dubAudioUrl:exportProject.dubAudioUrl,originalMuted:exportProject.originalAudioMuted,originalVolume:exportProject.originalAudioVolume}));
      const body=await apiJson('/api/video/export',{method:'POST',body:form});window.dispatchEvent(new CustomEvent('hn-job',{detail:body.jobId}));
      for(;;){const job=await apiJson('/api/jobs/'+body.jobId);setHardwareStatus(h=>({...h,progressPercent:job.percent,currentTaskName:job.message}));if(job.state==='done'){if(desktop){setLastExport(await desktop.saveExport(job.result.url));break;}const a=document.createElement('a');a.href=job.result.url;a.download=project.title+'_HNVoice.mp4';a.click();break;}if(['error','cancelled'].includes(job.state))throw new Error(job.message);await new Promise(r=>setTimeout(r,750));}
    }catch(e){alert(String(e));}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };
  const handleGeminiVideo=async()=>{
    if(!project.videoUrl)return;
    stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:1,currentTaskName:'Gemini: chuẩn bị tải video...'}));
    try{const selected=project.visuals?.find(c=>c.id===selectedVisual&&c.kind==='video');let input=project.videoUrl;if(selected?.url){const segment=await apiJson('/api/media/segment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:selected.url,sourceStart:selected.sourceStart,duration:selected.endTime-selected.startTime,rate:selected.rate||1})});input=segment.url;}else if(project.videoEdited){input=(await exportProjectVideo({...project,dubAudioUrl:undefined,originalAudioMuted:false},()=>{},false)).url;}const blob=await readVideo(input!);const form=new FormData();form.append('file',blob,project.videoFileName||'video.mp4');form.append('duration',String(selected?selected.endTime-selected.startTime:timelineEnd(project)));
      const body=await apiJson('/api/gemini/video-subtitles',{method:'POST',body:form});
      window.dispatchEvent(new CustomEvent('hn-job',{detail:body.jobId}));
      let result:any;
      for(;;){const job=await apiJson('/api/jobs/'+body.jobId);setHardwareStatus(h=>({...h,progressPercent:job.percent,currentTaskName:job.message}));if(job.state==='done'){result=job.result;break;}if(job.state==='error'||job.state==='cancelled')throw new Error(job.error||job.message);await new Promise(r=>setTimeout(r,750));}
      const recognized=result.subtitles.map((c:Subtitle)=>({...c,startTime:c.startTime+(selected?.startTime||0),endTime:c.endTime+(selected?.startTime||0),sourceClipId:selected?.id}));pushHistory(project);setProject(p=>({...p,subtitles:selected?[...p.subtitles.filter(c=>c.sourceClipId!==selected.id),...recognized]:recognized,audioClips:p.audioClips?.filter(c=>c.track==='audio'),dubAudioUrl:undefined,dubDuration:undefined}));triggerDownload(result.srt,project.title+'_Gemini_Trung.srt','text/plain');setActiveSidebarTab('translation');
    }catch(e){alert(String(e));}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };

  const applyTimeline=async(next:ProjectData)=>{
    if(hardwareStatus.isProcessing)return false;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:0,currentTaskName:'Cập nhật timeline...'}));
    try{validateTimeline(next);if(project.dubAudioUrl&&timelineEnd(next)===timelineEnd(project)&&JSON.stringify(projectClips(next))===JSON.stringify(projectClips(project))){pushHistory(project);setProject({...next,dubAudioUrl:project.dubAudioUrl,dubDuration:project.dubDuration});return true;}const mixed=await runJob('/api/timeline/mix',{clips:projectClips(next),duration:timelineEnd(next)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));pushHistory(project);setProject({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration});setCurrentTime(t=>Math.min(t,mixed.duration));return true;}
    catch(e){alert(String(e));return false;}finally{setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };
  const handleTimelineEdit=(edit:TimelineEdit)=>{try{applyTimeline(editTimeline(project,edit));}catch(e){alert(String(e));}};
  const handleTimelineAudio=async(file?:File,stem:'all'|'voice'|'background'='all')=>{
    if(hardwareStatus.isProcessing)return;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:0,currentTaskName:file?'Đọc tệp âm thanh...':'Tách tiếng gốc từ video...'}));
    try{const form=new FormData();if(file)form.append('file',file);else{if(!project.videoUrl)throw Error('Chưa chọn video.');form.append('file',await readVideo(project.videoUrl),project.videoFileName);}
      let result:any;if(!file&&stem!=='all'){const body=await apiJson('/api/audio/separate',{method:'POST',body:form});window.dispatchEvent(new CustomEvent('hn-job',{detail:body.jobId}));for(;;){const job=await apiJson('/api/jobs/'+body.jobId);setHardwareStatus(h=>({...h,progressPercent:job.percent,currentTaskName:job.message}));if(job.state==='done'){result={audioUrl:stem==='voice'?job.result.voiceUrl:job.result.backgroundUrl,duration:job.result.duration};break;}if(['error','cancelled'].includes(job.state))throw Error(job.message);await new Promise(r=>setTimeout(r,500));}}else result=await apiJson('/api/timeline/import-audio',{method:'POST',body:form});const clips=projectClips(project).filter(c=>file||c.origin!=='video');const at=file?Math.max(currentTime,...clips.filter(c=>c.track==='audio').map(c=>c.startTime+c.trimEnd-c.trimStart),0):0;
      const next={...project,manualTimeline:true,originalAudioMuted:file?project.originalAudioMuted:true,audioClips:[...clips,{id:crypto.randomUUID(),origin:file?'file' as const:'video' as const,track:'audio' as const,name:file?.name||(stem==='voice'?'Tiếng nói gốc · ':stem==='background'?'Âm thanh nền · ':'Toàn bộ tiếng gốc · ')+project.videoFileName,audioUrl:result.audioUrl,startTime:at,trimStart:0,trimEnd:result.duration,sourceDuration:result.duration,volume:1}]};validateTimeline(next);
      const mixed=await runJob('/api/timeline/mix',{clips:next.audioClips,duration:timelineEnd(next)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));pushHistory(project);setProject({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration});setCurrentTime(t=>Math.min(t,mixed.duration));
    }catch(e){alert(String(e));}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };
  // Undo / Redo history
  const [historyPast, setHistoryPast] = useState<ProjectData[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProjectData[]>([]);

  // Push current state to undo history
  const pushHistory = useCallback((currentProj: ProjectData) => {
    setHistoryPast((past) => [...past.slice(-20), currentProj]);
    setHistoryFuture([]);
  }, []);

  const handleUndo = () => {
    if (hardwareStatus.isProcessing||historyPast.length === 0) return;
    stopAudioPreview();setIsPlaying(false);
    const previous = historyPast[historyPast.length - 1];
    setHistoryFuture((f) => [project, ...f]);
    setHistoryPast((p) => p.slice(0, p.length - 1));
    setProject(previous);setCurrentTime(t=>Math.min(t,timelineEnd(previous)));
  };

  const handleRedo = () => {
    if (hardwareStatus.isProcessing||historyFuture.length === 0) return;
    stopAudioPreview();setIsPlaying(false);
    const next = historyFuture[0];
    setHistoryPast((p) => [...p, project]);
    setHistoryFuture((f) => f.slice(1));
    setProject(next);setCurrentTime(t=>Math.min(t,timelineEnd(next)));
  };

  // Hardware / VRAM monitor simulation (NVIDIA GTX 1050 Ti 4GB, 16GB RAM)
  const [hardwareStatus, setHardwareStatus] = useState<HardwareVramStatus>({
    gpuName: 'NVIDIA GeForce GTX 1050 Ti (4GB VRAM)',
    vramTotalMb: 4096,
    vramUsedMb: 1150,
    ramTotalMb: 16384,
    ramUsedMb: 5200,
    activeModel: null,
    cpuFallback: false,
    isProcessing: false,
    progressPercent: 0,
    currentTaskName: '',
  });

  // UI state
  const [leftPanel,setLeftPanel]=useState<'workflow'|'library'>('workflow');
  useEffect(()=>{const open=()=>setLeftPanel('library');window.addEventListener('hn-open-library',open);return()=>window.removeEventListener('hn-open-library',open)},[]);
  const [libraryBusy,setLibraryBusy]=useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'project' | 'asr' | 'translation' | 'characters' | 'export'>('project');
  const [previewExpanded,setPreviewExpanded]=useState(false);
  useEffect(()=>{const exit=(e:KeyboardEvent)=>{if(e.key==='Escape')setPreviewExpanded(false);};window.addEventListener('keydown',exit);return()=>window.removeEventListener('keydown',exit);},[]);
  const [isPackagingModalOpen, setIsPackagingModalOpen] = useState(false);
  const [isModelAnalysisOpen, setIsModelAnalysisOpen] = useState(false);
  const [isModelLoaderOpen, setIsModelLoaderOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // Animation frame / timer for video playback
  useEffect(() => {
    let interval: number;
    if (isPlaying && !project.videoUrl && !project.dubAudioUrl) {
      interval = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= project.duration) {
            setIsPlaying(false);
            return 0;
          }
          return Math.min(project.duration, prev + 0.1);
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying, project.duration, project.videoUrl, project.dubAudioUrl]);

  // Spacebar keyboard listener for Play/Pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in input or textarea
      if(e.defaultPrevented)return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement&&e.target.closest('[contenteditable=true]'))
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  // 1. Upload custom video file
  const handleUploadVideo = (file: File) => {
    pushHistory(project);
    const videoUrl = rememberVideo(file);
    const videoEl = document.createElement('video');
    videoEl.src = videoUrl;
    videoEl.onerror = () => { alert('Trình phát không đọc được video này. Hãy đổi sang MP4 H.264/AAC.'); };
    videoEl.onloadedmetadata = () => {
      const dur = videoEl.duration || 30.0;
      videoEl.onerror = null; // A detached metadata probe must never invalidate the selected video.
      setProject((p) => ({
        ...p,
        videoUrl,
        subtitles: [],
        selectedSubtitleId: null,
        dubAudioUrl:undefined,
        dubDuration:undefined,
        visualTracks:[],videoEdited:false,visuals:[],videoFileName: file.name,audioClips:undefined,manualTimeline:false,
        duration: dur,
        videoWidth:videoEl.videoWidth,videoHeight:videoEl.videoHeight,
        title: file.name.replace(/\.[^/.]+$/, ''),
      }));
      setActiveSidebarTab('asr');
      const form=new FormData();form.append('file',file,file.name);apiJson('/api/media/import',{method:'POST',body:form}).then(data=>setProject(p=>p.videoUrl!==videoUrl||p.visuals?.some(c=>c.kind==='video')?p:{...p,mediaLibrary:[...(p.mediaLibrary||[]),{id:crypto.randomUUID(),name:file.name,kind:'video',url:data.url,width:data.width,height:data.height,duration:data.duration}],videoEdited:true,visuals:[...(p.visuals||[]),{id:'base-'+p.id,trackId:'base-video',kind:'video',nativeWidth:data.width,nativeHeight:data.height,name:file.name,url:data.url,startTime:0,endTime:Math.min(dur,data.duration),sourceStart:0,sourceDuration:data.duration,x:0,y:0,width:1,height:1,opacity:1,enabled:true,keyframes:[]}],visualTracks:[{id:'base-video',name:'Video gốc',enabled:true},...(p.visualTracks||[])]})).catch(()=>{});
    };
  };

  // 2. Run Chinese ASR (SenseVoice Small / Paraformer-ZH)
  const handleRunAsr = async (model: 'SenseVoice-Small' | 'Paraformer-ZH' | 'OCR-ZH',cropTop=0.55) => {
    pushHistory(project);
    setHardwareStatus((h) => ({
      ...h,
      isProcessing: true,
      activeModel: model==='OCR-ZH'?'RapidOCR Chinese':'Whisper-small CPU INT8',
      vramUsedMb: 2350,
      currentTaskName: 'Đang nhận diện phụ đề tiếng Trung...',
    }));

    try {
      const selected=project.visuals?.find(c=>c.id===selectedVisual&&c.kind==='video');
      const recognized=await recognizeProject(project,model==='OCR-ZH'?'ocr':'speech',cropTop,(percent,stepText)=>setHardwareStatus(h=>({...h,progressPercent:percent,currentTaskName:stepText})),selected?.id);
      setProject((p) => ({
        ...p,
        subtitles: selected?[...p.subtitles.filter(c=>c.sourceClipId!==selected.id),...recognized]:recognized,
      }));

      // Automatically switch to translation tab
      setActiveSidebarTab('translation');
    } catch (err) {
      alert(String(err));
    } finally {
      // Memory cleanup for GTX 1050 Ti: unload ASR model
      setHardwareStatus((h) => ({
        ...h,
        isProcessing: false,
        activeModel: null,
        vramUsedMb: 1200,
        progressPercent: 0,
        currentTaskName: '',
      }));
    }
  };

  // 3. Run Qwen3-4B-Instruct-2507 Translation
  const handleRunTranslation = async (mode: TranslationProvider,inputMode:'text'|'srt-file'='srt-file') => {
    pushHistory(project);
    setHardwareStatus((h) => ({
      ...h,
      isProcessing: true,
      activeModel: 'Qwen3-4B (GGUF Q4_K_M)',
      vramUsedMb: 2850,
      currentTaskName: 'Đang dịch hội thoại phim sang tiếng Việt...',
    }));

    try {
      const selectedIds=new Set(captionSelection);const source=selectedIds.size?project.subtitles.filter(c=>selectedIds.has(c.id)):project.subtitles;
      const translated = await runQwenTranslation(
        source,
        project.characters,
        mode,
        (percent, log) => {
          setHardwareStatus((h) => ({
            ...h,
            progressPercent: percent,
            currentTaskName: log,
          }));
        },inputMode
      );

      setProject((p) => ({
        ...p,
        subtitles:p.subtitles.map(c=>translated.find(t=>t.id===c.id)||c),audioClips:p.audioClips?.filter(c=>!translated.some(t=>t.id===c.subtitleId)),
        translationMode: mode,
        dubAudioUrl:undefined,
        dubDuration:undefined,
      }));

      // Switch to characters/TTS tab
      setActiveSidebarTab('characters');
    } catch (err) {
      alert(String(err));
    } finally {
      // Unload Qwen model from VRAM to make room for TTS
      setHardwareStatus((h) => ({
        ...h,
        isProcessing: false,
        activeModel: null,
        vramUsedMb: 1200,
        progressPercent: 0,
        currentTaskName: '',
      }));
    }
  };

  // 4. Batch VieNeu-TTS v3 Turbo synthesis
  const [showAuto,setShowAuto]=useState(false);const autoCheckpoint=useRef<any>(null),autoStop=useRef(false);
  const runAutomatic=async(options:AutoSettings,report:(step:number,p:number,text:string)=>void)=>{
    const desktop=(window as any).hnDesktop;if(!desktop)throw Error('Auto xuất file cần ứng dụng Windows HN601.');
    const services=[...new Set([...(options.provider==='offline'?[]:[options.provider]),...(options.recognition==='gemini'?['gemini']:[])])];if(services.length){const status=await apiJson('/api/browser/status');for(const service of services)if(!status[service]?.connected||!status[service]?.serviceOpen)throw Error('Hãy mở Chrome và đăng nhập '+service+' trong popup trước khi chạy Auto.');}
    const signature=JSON.stringify({...options,file:options.file?[options.file.name,options.file.size,options.file.lastModified]:project.id});
    if(autoCheckpoint.current?.signature!==signature)autoCheckpoint.current={signature,next:0,value:{...project}};
    const state=autoCheckpoint.current;autoStop.current=false;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true}));let stage=state.next;
    const progress=(p:number,t:string)=>{report(stage,p,t);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:(stage*100+p)/5,currentTaskName:'Auto '+(stage+1)+'/5 · '+t}))};
    const commit=(p:ProjectData)=>{setProject(p);return p};
    let destination='';
    try{
      await continueAuto<ProjectData>(state,[
        async old=>{let p=old;if(options.file||!p.videoUrl?.startsWith('/cache/')){const file=options.file||await readVideo(p.videoUrl!);const form=new FormData();form.append('file',file,options.file?.name||p.videoFileName||'video.mp4');const media=await apiJson('/api/media/import',{method:'POST',body:form});const visual:VisualClip={id:crypto.randomUUID(),kind:'video',trackId:'base-video',name:options.file?.name||p.videoFileName,url:media.url,nativeWidth:media.width,nativeHeight:media.height,startTime:0,endTime:media.duration,sourceStart:0,sourceDuration:media.duration,x:0,y:0,width:1,height:1,opacity:1,enabled:true,keyframes:[]};p={...p,id:options.file?crypto.randomUUID():p.id,videoUrl:media.url,videoFileName:visual.name,videoWidth:media.width,videoHeight:media.height,duration:media.duration,...(options.file?{title:options.file.name.replace(/\.[^.]+$/,''),visuals:[visual],visualTracks:[{id:'base-video',name:'Video gốc',enabled:true}],videoEdited:true,subtitles:[],audioClips:[],dubAudioUrl:undefined}:{} )};if(!p.visuals?.some(c=>c.kind==='video'))p={...p,visuals:[visual],visualTracks:[{id:'base-video',name:'Video gốc',enabled:true}],videoEdited:true};}if(!p.videoUrl)throw Error('Chọn video MP4 trước.');progress(100,'Đã chuẩn bị video');return commit(p)},
        async p=>{let result;if(options.recognition==='gemini'){let url=p.videoUrl!;const parts=recognitionParts(p);if(parts.length!==1||parts[0].sourceStart!==0||parts[0].rate!==1||parts[0].offset!==0||Math.abs(parts[0].duration-p.duration)>.05){const rendered=await exportProjectVideo({...p,dubAudioUrl:undefined,originalAudioMuted:false},progress,false);url=rendered.url;}const form=new FormData();form.append('file',await readVideo(url),'video.mp4');form.append('duration',String(timelineEnd(p)));result=await uploadJob('/api/gemini/video-subtitles',form,progress)}else result={subtitles:await recognizeProject(p,options.recognition,.55,progress)};
          if(!result.subtitles?.length)throw Error('Không có phụ đề; Auto dừng tại nhận diện.');return commit({...p,subtitles:result.subtitles,audioClips:projectClips(p).filter(c=>c.track!=='voice'),dubAudioUrl:undefined,dubDuration:undefined,manualTimeline:true})},
        async p=>{const subtitles=await runQwenTranslation(p.subtitles,p.characters,options.provider,progress,options.inputMode);if(subtitles.some(c=>!c.textVi?.trim()))throw Error('Bản dịch chưa đầy đủ.');return commit({...p,subtitles,translationMode:options.provider})},
        async p=>{const subtitles=p.subtitles.map(c=>({...c,voiceId:options.voiceId,volume:options.volume}));const cues=captionSpeechCues(subtitles,new Set(subtitles.map(c=>c.id)),p.characters);const speech=await runJob('/api/timeline/speech',{cues},progress);if(speech.clips.length!==cues.length)throw Error('Thiếu âm thanh thuyết minh.');const updates=new Map<string,any>(speech.subtitles.map((c:any)=>[c.id,c]));const clips=[...projectClips(p).filter(c=>c.track!=='voice'),...speech.clips];let next={...p,subtitles:subtitles.map(c=>({...c,...updates.get(c.id),status:'synced' as const})),audioClips:clips,manualTimeline:true,originalAudioMuted:true};validateTimeline(next);const mixed=await runJob('/api/timeline/mix',{clips,duration:timelineEnd(next)},progress);return commit({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration})},
        async p=>{const exported=await exportProjectVideo(p,progress);if(autoStop.current)throw Error('Đã dừng Auto trước khi lưu.');destination=await desktop.saveAutoOutput({token:options.folder.token,url:exported.url,name:options.name,srt:options.saveSrt?generateSrt(p.subtitles,'vi'):undefined});if(options.saveProject)await desktop.saveProject({project:{...p,visuals:await prepareVisuals(p.visuals||[],p.videoWidth||1920,p.videoHeight||1080)},autoToken:options.folder.token});setLastExport(destination);progress(100,'Đã xuất xong MP4');return p}
      ],i=>{stage=i;report(i,0,AUTO_STEPS[i]);setActiveSidebarTab((['project','asr','translation','characters','export'] as const)[i])},()=>autoStop.current);
      return destination||lastExport;
    }finally{setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };

  const handleRunBatchTts = async () => {
    const cues=timelineSubtitles(project).filter(s=>!s.hiddenVi&&s.textVi?.trim());
    if(!cues.length){alert('Hãy nhập hoặc dịch phụ đề Việt trước.');return;}
    await generatePopupSpeech(cues.map(s=>({id:s.id,textVi:s.textVi||'',voiceId:s.voiceId||project.characters.find(c=>c.id===s.characterId)?.voiceId||'Hải Đăng',captionStyle:s.captionStyle||{}})));
  };

  // Subtitle updates (Rule compliance: Chinese edit marks needs_retranslation; Vietnamese edit marks needs_tts)
  const handleUpdateSubtitle = (id:string,updates:Partial<Subtitle>) => {
    pushHistory(project);
    if(updates.characterId){const person=project.characters.find(c=>c.id===updates.characterId);updates={...updates,voiceId:person?.voiceId};}
    const affectsAudio=['textZh','textVi','speed','pitch','volume','voiceId','characterId'].some(key=>key in updates);
    if(affectsAudio){stopAudioPreview();setIsPlaying(false);}
    setProject(p=>({...p,...(affectsAudio?{dubAudioUrl:undefined,dubDuration:undefined,audioClips:p.audioClips?.filter(c=>c.subtitleId!==id)}:{}),subtitles:p.subtitles.map(s=>s.id===id?{...s,...(affectsAudio?{ttsAudioUrl:undefined,ttsDuration:undefined}:{}),...updates}:s)}));
  };

  // Retranslate a single sentence
  const handleRetranslateSentence = async (id: string) => {
    const sub = project.subtitles.find((s) => s.id === id);
    if (!sub) return;

    setHardwareStatus((h) => ({
      ...h,
      isProcessing: true,
      activeModel: 'Qwen3-4B',
      currentTaskName: `Đang dịch lại câu ${sub.id}...`,
    }));

    try {
    const result = await retranslateSingleSentence(sub, project.translationMode);

    handleUpdateSubtitle(id, {
      textVi: result.textVi,
      suggestedViShort: result.suggestedViShort,
      status: 'needs_tts',
      notes: result.notes,
    });

    } catch(e) {alert(String(e));} finally {
    setHardwareStatus((h) => ({
      ...h,
      isProcessing: false,
      activeModel: null,
      currentTaskName: '',
    }));
      }
  };

  // Regenerate VieNeu-TTS for a single sentence
  const handleRegenerateTtsSentence = async (id: string) => {
    const sub=project.subtitles.find(s=>s.id===id);if(!sub)return;
    await generatePopupSpeech([{id,textVi:sub.textVi||'',voiceId:sub.voiceId||project.characters.find(c=>c.id===sub.characterId)?.voiceId||'Hải Đăng',captionStyle:sub.captionStyle||{}}]);
  };

  // Check single sentence with Paraformer-ZH
  const handleCheckWithParaformer = async (id: string) => {
    const sub = project.subtitles.find((s) => s.id === id);
    if (!sub) return;

    alert('Bản này dùng Whisper-small. Chưa cài Paraformer.');
  };

  // Update Character properties
  const handleAddCharacter=()=>{
    pushHistory(project);const count=project.characters.length;
    setProject(p=>({...p,characters:[...p.characters,{id:'speaker-'+Date.now(),name:'Nhân vật '+(count+1),gender:'female',role:'',relationship:'',pronounSelf:'',pronounCall:'',color:['#3B82F6','#EC4899','#F59E0B','#8B5CF6'][count%4],voiceId:'Mai Anh',speed:1,pitch:0}]}));
  };
  const handleUpdateCharacter = (id:string,updates:Partial<Character>) => {
    pushHistory(project);
    const audioChanged=['voiceId','speed','pitch'].some(k=>k in updates);
    if(audioChanged){stopAudioPreview();setIsPlaying(false);}
    setProject(p=>({...p,characters:p.characters.map(c=>c.id===id?{...c,...updates}:c),...(audioChanged?{dubAudioUrl:undefined,dubDuration:undefined,audioClips:p.audioClips?.filter(c=>!p.subtitles.some(s=>s.id===c.subtitleId&&s.characterId===id)),subtitles:p.subtitles.map(s=>s.characterId===id?{...s,...updates,ttsAudioUrl:undefined,ttsDuration:undefined,status:'needs_tts'}:s)}:{})}));
  };

  // Export functions
  const handleExportSrt = (type: 'zh' | 'vi' | 'bilingual') => {
    const srtContent = generateSrt(project.subtitles, type);
    const filename = `${project.title.replace(/\s+/g, '_')}_${type}.srt`;
    triggerDownload(srtContent, filename, 'text/plain');
  };

  const handleExportDubSrt=()=>{
    const cues=project.manualTimeline?project.subtitles:project.subtitles.filter(s=>s.ttsAudioUrl&&s.dubStartTime!==undefined).map(s=>({...s,startTime:s.dubStartTime!,endTime:s.dubEndTime!}));
    triggerDownload(generateSrt(cues,'vi'),project.title+'_theo_giong.srt','text/plain');
  };
  const handleExportWav = async () => {
    if(!project.dubAudioUrl){alert('Hãy tạo giọng đọc và ghép timeline trước khi xuất.');return;}
    const response=await fetch(project.dubAudioUrl);if(!response.ok){alert('Âm thanh không còn trong bộ nhớ. Hãy tạo lại.');return;}
    triggerDownload(await response.blob(),project.title+'_VieNeu.wav','audio/wav');
  };

  const handleExportProjectJson=async()=>{const desktop=(window as any).hnDesktop;if(!desktop){alert('Lưu dự án dùng trong ứng dụng Windows.');return;}stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,currentTaskName:'Đang lưu dự án và media…',progressPercent:1}));try{let videoPath='';if(project.videoUrl){const file=await readVideo(project.videoUrl);if(file instanceof File)videoPath=desktop.filePath(file);}const prepared={...project,visuals:await prepareProjectVisuals(project)};const saved=await desktop.saveProject({project:prepared,videoPath});if(saved)alert('Đã lưu dự án: '+saved);}catch(e){alert(String(e));}finally{setHardwareStatus(h=>({...h,isProcessing:false,currentTaskName:'',progressPercent:0}));}};
  const handleOpenProject=async()=>{const desktop=(window as any).hnDesktop;if(!desktop){alert('Mở dự án dùng trong ứng dụng Windows.');return;}stopAudioPreview();setIsPlaying(false);try{const result=await desktop.openProject();if(result){validateTimeline(result.project);pushHistory(project);setProject({...normalizeTemplateBundle(result.project),captionLayout:{...DEFAULT_CAPTION_LAYOUT,...result.project.captionLayout}});setCurrentTime(0);loadVieNeuVoices().then(data=>setVoices(data.voices));setActiveSidebarTab('export');}}catch(e){alert(String(e));}};
  const [selectedVisual,setSelectedVisual]=useState<string|null>(null);
  const [textTarget,setTextTarget]=useState<TextTarget|null>(null),[textPopup,setTextPopup]=useState(false);
  const editProject=(fn:(p:ProjectData)=>ProjectData)=>{pushHistory(project);setProject(fn)};
  const selectText=(target:TextTarget)=>{stopAudioPreview();setIsPlaying(false);pushHistory(project);setTextTarget(target);setInspectorTab('text');if(target.kind==='visual')setSelectedVisual(target.id)};
  const updateText=(target:TextTarget,text:string)=>setProject(p=>{text=text.normalize('NFC');
    if(target.kind==='visual')return {...p,visuals:p.visuals?.map(c=>c.id===target.id?{...c,text}:c)};
    if(target.kind==='caption')return {...p,subtitles:p.subtitles.map(c=>c.id===target.id?{...c,[target.lang==='zh'?'textZh':'textVi']:text,captionStyle:{...c.captionStyle,characterColors:undefined},status:target.lang==='zh'?c.status:'needs_tts'}:c)};
    const d=p.decoration||DEFAULT_DECORATION;return {...p,decoration:target.kind==='banner'?{...d,[target.id==='top'?'topText':'bottomText']:text}:{...d,overlays:d.overlays.map(c=>c.id===target.id?{...c,text}:c)}};
  });
  const [inspectorTab,setInspectorTab]=useState('media'),[audioPopup,setAudioPopup]=useState<string|null>(null),[showSubtitleList,setShowSubtitleList]=useState(false);
  const [audioLive,setAudioLive]=useState<{id:string;duration:number}|null>(null);
  const changeVisuals=(visuals:VisualClip[])=>{setIsPlaying(false);pushHistory(project);setProject(p=>{const normalized=visuals.map(c=>({...c,trackId:c.trackId||'track-'+c.id}));return {...(linkMedia?linkedVideoEdit(p,normalized):p),visuals:normalized,visualTracks:visualTracks(normalized,visualTracks(p.visuals||[],p.visualTracks||[])),videoEdited:p.videoEdited||visuals.some(c=>c.kind==='video')}});};
  const importLibrary=async(files:File[])=>{
    if(libraryBusy||hardwareStatus.isProcessing)return;setLibraryBusy(true);
    try{const imported:MediaAsset[]=[];for(const file of files){const form=new FormData();form.append('file',file,file.name);const data=await apiJson('/api/media/import',{method:'POST',body:form});imported.push({id:crypto.randomUUID(),name:file.name,kind:data.kind,url:data.url,width:data.width,height:data.height,duration:data.duration||5});}pushHistory(project);setProject(p=>({...p,mediaLibrary:[...(p.mediaLibrary||[]),...imported]}));}
    finally{setLibraryBusy(false)}
  };
  const insertAsset=(id:string,time=currentTime,trackId?:string)=>{
    if(hardwareStatus.isProcessing||libraryBusy)return;
    if(id===TEXT_ASSET){const clip:VisualClip={id:crypto.randomUUID(),kind:'text',name:'Chữ mới',text:'Viết văn bản.....',textStyle:{...DEFAULT_TEXT,fontFamily:'Be Vietnam Pro',align:'center'},trackId:trackId&&trackId!=='template-set'&&!project.visuals?.some(c=>c.trackId===trackId&&c.kind==='video')?trackId:'text-'+crypto.randomUUID(),startTime:Math.max(0,time),endTime:Math.max(0,time)+5,sourceStart:0,sourceDuration:5,x:.1,y:.35,width:.8,height:.18,opacity:1,enabled:true,keyframes:[]};changeVisuals([...(project.visuals||[]),clip]);setSelectedVisual(clip.id);setTextTarget({kind:'visual',id:clip.id});setInspectorTab('text');setCurrentTime(clip.startTime);return;}
    const asset=project.mediaLibrary?.find(a=>a.id===id);if(!asset)return;
    try{const next=insertLibraryAsset(project,asset,time,trackId);pushHistory(project);setIsPlaying(false);setProject(next.project);setSelectedVisual(next.clip.id);setInspectorTab('media');setCurrentTime(next.clip.startTime);}catch(e){alert(String(e))}
  };
  const prepareProjectVisuals=async(p:ProjectData)=>{const w=p.videoWidth||1920,h=p.videoHeight||1080,ready=await prepareVisuals(p.visuals||[],w,h);setProject(current=>({...current,visuals:current.visuals?.map(c=>{const next=ready.find(x=>x.id===c.id);return next&&rasterKey(c,w,h)===rasterKey(next,w,h)?{...c,url:next.url,renderKey:next.renderKey}:c})}));return ready;};
  const selectVisual=(id:string|null)=>{setSelectedVisual(id);if(id){const c=project.visuals?.find(c=>c.id===id);if(c?.kind==='text')selectText({kind:'visual',id});else setInspectorTab(id.startsWith('bundle:')?'templates':'media');}};
  useEffect(()=>{const f=()=>setShowSubtitleList(x=>!x);window.addEventListener('hn-subtitle-list',f);return()=>window.removeEventListener('hn-subtitle-list',f)},[]);
  const originalClips=projectClips(project).filter(c=>c.origin==='video'&&!c.sourceClipId);
  const changeOriginalVolume=(volume:number)=>{if(originalClips.length)applyTimeline({...project,manualTimeline:true,audioClips:projectClips(project).map(c=>c.origin==='video'?{...c,volume}:c)});else setProject(p=>({...p,originalAudioVolume:volume}));};
  const toggleOriginalMute=()=>{if(originalClips.length){const muted=!originalClips.every(c=>c.muted);applyTimeline({...project,manualTimeline:true,audioClips:projectClips(project).map(c=>c.origin==='video'?{...c,muted}:c)});}else setProject(p=>({...p,originalAudioMuted:!p.originalAudioMuted}));};
  const [extractId,setExtractId]=useState<string|null>(null),[extractLane,setExtractLane]=useState('new'),[extractMode,setExtractMode]=useState<'all'|'stems'>('all');
  const separateTimelineClip=async(id:string,stem:'voice'|'background'|'both')=>{
    const source=projectClips(project).find(c=>c.id===id);if(!source||hardwareStatus.isProcessing)return;
    stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,currentTaskName:'Đang tách âm thanh đã chọn…',progressPercent:1}));
    try{const result=await runJob('/api/audio/separate-clip',{audioUrl:source.audioUrl,trimStart:source.trimStart,trimEnd:source.trimEnd},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));
      const parts:TimelineAudioClip[]=(stem==='both'?['voice','background']: [stem]).map(part=>({id:crypto.randomUUID(),track:'audio',laneId:'audio-'+crypto.randomUUID(),name:(part==='voice'?'Giọng nói · ':'Nhạc nền · ')+source.name,audioUrl:part==='voice'?result.voiceUrl:result.backgroundUrl,startTime:source.startTime,trimStart:0,trimEnd:result.duration,sourceDuration:result.duration,volume:source.volume}));
      const clips=[...projectClips(project).map(c=>c.id===id?{...c,muted:true}:c),...parts],next={...project,audioClips:clips,manualTimeline:true};validateTimeline(next);
      const mixed=await runJob('/api/timeline/mix',{clips,duration:timelineEnd(next)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));pushHistory(project);setProject({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration});
    }catch(e){alert(String(e))}finally{setHardwareStatus(h=>({...h,isProcessing:false,currentTaskName:'',progressPercent:0}))}
  };
  const openVideoExtraction=(mode:'all'|'stems')=>{const c=project.visuals?.find(c=>c.id===selectedVisual&&c.kind==='video')||project.visuals?.find(c=>c.kind==='video');setExtractMode(mode);setExtractLane('new');setExtractId(c?.id||'original-video')};
  const extractClipAudio=async()=>{
    const c=project.visuals?.find(c=>c.id===extractId)|| (project.videoUrl?{id:'original-video',url:project.videoUrl,name:project.videoFileName,startTime:0,endTime:project.duration,sourceStart:0,rate:1}:null);if(!c?.url)return;
    setHardwareStatus(h=>({...h,isProcessing:true,currentTaskName:'Đang trích âm thanh clip…',progressPercent:1}));
    try{const result=await apiJson('/api/media/extract',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:c.url,sourceStart:c.sourceStart,duration:c.endTime-c.startTime,rate:c.rate||1})});
      const stems=extractMode==='stems'?await runJob('/api/audio/separate-clip',{audioUrl:result.audioUrl,trimStart:0,trimEnd:result.duration},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t}))):null;
      const parts:TimelineAudioClip[]=(stems?['voice','background']:['all']).map(part=>({id:crypto.randomUUID(),sourceClipId:c.id,origin:'video',laneId:stems||extractLane==='new'?'audio-'+crypto.randomUUID():extractLane,track:'audio',name:(part==='voice'?'Giọng nói · ':part==='background'?'Nhạc nền · ':'Âm thanh · ')+c.name,audioUrl:stems?(part==='voice'?stems.voiceUrl:stems.backgroundUrl):result.audioUrl,startTime:c.startTime,trimStart:0,trimEnd:stems?.duration||result.duration,sourceDuration:stems?.duration||result.duration,volume:1}));
      const clips=[...projectClips(project),...parts],next={...project,manualTimeline:true,audioClips:clips,originalAudioMuted:c.id==='original-video'?true:project.originalAudioMuted,visuals:project.visuals?.map(v=>v.id===c.id?{...v,audioMuted:true}:v)};validateTimeline(next);
      const mix=await runJob('/api/timeline/mix',{clips,duration:timelineEnd(next)},(p,t)=>setHardwareStatus(h=>({...h,progressPercent:p,currentTaskName:t})));pushHistory(project);setProject({...next,dubAudioUrl:mix.audioUrl,dubDuration:mix.duration});setExtractId(null)
    }catch(e){alert(String(e))}finally{setHardwareStatus(h=>({...h,isProcessing:false,currentTaskName:'',progressPercent:0}))}
  };

  const [popupIds,setPopupIds]=useState<string[]>([]);
  const applyCaptionChanges=(changes:CaptionChange[])=>{const map=new Map(changes.map(c=>[c.id,c]));pushHistory(project);setProject(p=>({...p,subtitles:p.subtitles.map(s=>map.has(s.id)?{...s,...map.get(s.id),status:'translated'}:s)}));};
  const generatePopupSpeech=async(changes:CaptionChange[])=>{
    if(hardwareStatus.isProcessing)return;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:0,currentTaskName:'Chuẩn bị tạo giọng cho phụ đề đã chọn…'}));
    try{const map=new Map(changes.map(c=>[c.id,c]));const subtitles=project.subtitles.map(s=>map.has(s.id)?{...s,...map.get(s.id)}:s);const cues=captionSpeechCues(subtitles,new Set(map.keys()),project.characters);
      const result=await runJob('/api/timeline/speech',{cues},(progressPercent,currentTaskName)=>setHardwareStatus(h=>({...h,progressPercent,currentTaskName})));
      const clips=[...projectClips(project).filter(c=>c.track!=='voice'||!c.subtitleId||!map.has(c.subtitleId)),...result.clips];const updates=new Map<string,any>(result.subtitles.map((s:any)=>[s.id,s]));const next:ProjectData={...project,manualTimeline:true,audioClips:clips,subtitles:subtitles.map(s=>updates.has(s.id)?{...s,...updates.get(s.id),status:'synced'}:s),originalAudioMuted:true};validateTimeline(next);
      const mixed=await runJob('/api/timeline/mix',{clips,duration:timelineEnd(next)},(progressPercent,currentTaskName)=>setHardwareStatus(h=>({...h,progressPercent,currentTaskName})));pushHistory(project);setProject({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration});
    }catch(e){alert(String(e));}finally{setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };
  const editorPanel=React.useMemo(()=>(
        <div className={previewExpanded?'hidden':'contents'}><SubtitleEditor
          isProcessing={hardwareStatus.isProcessing}
          subtitles={project.subtitles}
          characters={project.characters}
          selectedSubtitleId={project.selectedSubtitleId}
          onSelectSubtitle={(id) => setProject((p) => ({ ...p, selectedSubtitleId: id }))}
          onUpdateSubtitle={handleUpdateSubtitle}
          onRetranslateSentence={handleRetranslateSentence}
          onOpenCaptionPopup={id=>{stopAudioPreview();setIsPlaying(false);setPopupIds([id]);}}
          onSplitCue={handleSplitCue}
          onRegenerateTtsSentence={handleRegenerateTtsSentence}
          onCheckWithParaformer={handleCheckWithParaformer}
        /></div>
  ),[project,hardwareStatus.isProcessing,previewExpanded,voices]);
  return (
    <div data-theme={theme} className="hn-studio flex flex-col h-screen min-w-[1100px] w-full bg-[#101014] text-zinc-100 overflow-hidden font-sans select-none">
      {extractId&&<FloatingPanel title="Trích xuất âm thanh clip" onClose={()=>setExtractId(null)}><label>Kết quả<select aria-label="Kết quả trích xuất" value={extractMode} onChange={e=>setExtractMode(e.target.value as 'all'|'stems')}><option value="all">Toàn bộ âm thanh (1 hàng)</option><option value="stems">Giọng nói + Nhạc nền (2 hàng riêng)</option></select></label>{extractMode==='all'&&<label>Đưa âm thanh vào hàng<select aria-label="Hàng âm thanh trích xuất" value={extractLane} onChange={e=>setExtractLane(e.target.value)}><option value="new">＋ Hàng âm thanh mới</option><option value="audio">Âm thanh thêm / gốc</option>{[...new Set(projectClips(project).map(c=>c.laneId).filter(Boolean))].map(id=><option key={id} value={id}>{projectClips(project).find(c=>c.laneId===id)?.name}</option>)}</select></label>}<p>Mỗi hàng có thể chỉnh âm lượng riêng trong menu Âm thanh hoặc nhấp đúp vào đoạn. Giữ đúng phần đã cắt, tốc độ và vị trí timeline. Tiếng clip gốc sẽ tắt để tránh trùng.</p><button className="primary-action" disabled={hardwareStatus.isProcessing} onClick={extractClipAudio}>Trích xuất âm thanh</button></FloatingPanel>}
      {showAuto&&<AutoDialog voices={voices} videoName={project.videoFileName} defaultVoice={project.characters[0]?.voiceId||voices[0]?.id} onClose={()=>setShowAuto(false)} onRun={runAutomatic} onStop={()=>{autoStop.current=true;handleCancel()}}/>}
      {/* 1. Header Toolbar */}
      <Header theme={theme} onThemeChange={(value:string)=>{setTheme(value);setThemeReady(true)}}
        hardwareStatus={hardwareStatus}
        projectTitle={project.title}
        onOpenPackaging={() => setIsPackagingModalOpen(true)}
        onOpenModelAnalysis={() => setIsModelAnalysisOpen(true)}
        onOpenModelLoader={() => setIsModelLoaderOpen(true)}
        onCancel={jobId?handleCancel:undefined}
        onOpenExport={() => {setLeftPanel('workflow');setActiveSidebarTab('export')}}
        onSaveProject={handleExportProjectJson}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <nav className="edit-menu"><button onClick={()=>setLeftPanel('library')}>▧ Media</button><button onClick={()=>window.dispatchEvent(new Event('hn-import-audio'))}>♫ Âm thanh</button><button onClick={()=>insertAsset(TEXT_ASSET,currentTime)}>T Văn bản</button><button onClick={()=>{if(textTarget)setInspectorTab('text');else insertAsset(TEXT_ASSET,currentTime)}}>✧ Hiệu ứng chữ</button><button onClick={()=>{setLeftPanel('workflow');setActiveSidebarTab('asr')}}>▤ Phụ đề / Auto</button><button onClick={()=>setInspectorTab('templates')}>▨ Nền / Mẫu</button></nav>
      {/* 2. Middle Workspace: Left Sidebar + Center Video + Right Subtitle Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Steps / Controls */}
        <div className={previewExpanded?'hidden':'workspace-left'}><nav className="workspace-menu"><button aria-pressed={leftPanel==='library'} onClick={()=>setLeftPanel('library')}>▧ Thư viện</button><button aria-pressed={leftPanel==='workflow'} onClick={()=>setLeftPanel('workflow')}>☷ Quy trình</button></nav>{leftPanel==='library'?<MediaLibrary items={project.mediaLibrary||[]} busy={libraryBusy||hardwareStatus.isProcessing} onImport={importLibrary} onInsert={insertAsset} onRemove={id=>{pushHistory(project);setProject(p=>({...p,mediaLibrary:p.mediaLibrary?.filter(a=>a.id!==id)}))}}/>:<SidebarTabs
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
          project={project}
          hardwareStatus={hardwareStatus}
          onOpenAuto={()=>setShowAuto(true)} onUploadVideo={handleUploadVideo}
          onImportSrt={handleImportSrt}
          onImportTranslation={handleImportTranslation}
          onCloneProcessing={(isProcessing,progressPercent,currentTaskName)=>setHardwareStatus(h=>({...h,isProcessing,progressPercent,currentTaskName}))}
          onVoicesChanged={()=>loadVieNeuVoices().then(data=>setVoices(data.voices))}
          voices={voices}
          onRunAsr={handleRunAsr}
          onOpenProject={handleOpenProject}
          onExportMp4={handleExportMp4}
          onGeminiVideo={handleGeminiVideo}
          onExportAss={()=>triggerDownload(generateAss(project),project.title+'.ass','text/plain')}
          onRunTranslation={handleRunTranslation}
          onRunBatchTts={handleRunBatchTts}
          onExportSrt={handleExportSrt}
          onExportWav={handleExportWav}
          onExportDubSrt={handleExportDubSrt}
          onExportProjectJson={handleExportProjectJson}
          onUpdateCharacter={handleUpdateCharacter}
          onAddCharacter={handleAddCharacter}
        />}</div>

        {/* Center: Video Player Preview */}
        <VideoPlayer
          textEditor={textTarget?<TextProperties selectedIds={captionSelection} project={project} target={textTarget} onText={updateText} onProject={editProject}/>:null} onEditText={selectText} onTextChange={updateText} externalInspector={!previewExpanded} videoEdited={project.videoEdited} visuals={orderedVisuals(project.visuals||[],project.visualTracks)} selectedVisual={selectedVisual} onSelectVisual={selectVisual} onVisualChange={changeVisuals} baseWidth={project.videoWidth} baseHeight={project.videoHeight}
          mediaEditor={<MediaEditor project={project} time={currentTime} selected={selectedVisual} onSelect={setSelectedVisual} onChange={changeVisuals} onProcess={(isProcessing,progressPercent,currentTaskName)=>setHardwareStatus(h=>({...h,isProcessing,progressPercent,currentTaskName}))}/>}
          originalDetachedMuted={originalClips.length>0&&originalClips.every(c=>c.muted)}
          manualTimeline={project.manualTimeline} originalDetached={projectClips(project).some(c=>c.origin==='video')}
          blur={project.blurRegion||{enabled:false,x:.1,y:.78,width:.8,height:.15,strength:16}} onBlurChange={b=>setProject(p=>({...p,blurRegion:b}))}
          expanded={previewExpanded} onToggleExpanded={()=>setPreviewExpanded(v=>!v)}
          layout={project.captionLayout||DEFAULT_CAPTION_LAYOUT}
          onLayoutChange={layout=>setProject(p=>({...p,captionLayout:layout,subtitles:layout.position!==(p.captionLayout||DEFAULT_CAPTION_LAYOUT).position?p.subtitles.map(s=>({...s,position:undefined})):p.subtitles}))}
          onCuePositionChange={(id,position)=>setProject(p=>({...p,subtitles:p.subtitles.map(s=>s.id===id?{...s,position}:s)}))}
          videoUrl={project.videoUrl}
          dubAudioUrl={project.dubAudioUrl}
          dubDuration={project.dubDuration}
          subtitles={project.subtitles}
          characters={project.characters}
          currentTime={currentTime}
          duration={timelineEnd(project)}
          isPlaying={isPlaying}
          originalAudioVolume={originalClips[0]?.volume??project.originalAudioVolume}
          originalAudioMuted={project.originalAudioMuted}
          bgmDucking={project.bgmDucking}
          decoration={project.decoration||DEFAULT_DECORATION} onDecorationChange={decoration=>setProject(p=>({...p,decoration}))}
          onTimeUpdate={(t) => setCurrentTime(t)}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onChangeOriginalVolume={changeOriginalVolume}
          onToggleOriginalMute={toggleOriginalMute}
          onToggleDucking={() => setProject((p) => ({ ...p, bgmDucking: !p.bgmDucking }))}
        />

        {/* Right: Subtitle & Dubbing Editor */}
        {!previewExpanded&&<InspectorDock tab={inspectorTab} onTab={setInspectorTab}>{inspectorTab==='text'&&textTarget?<TextProperties selectedIds={captionSelection} project={project} target={textTarget} onText={updateText} onProject={editProject} onAdvanced={()=>setInspectorTab('media')}/>:inspectorTab==='design'?<><VideoDesignPanel layout={project.captionLayout||DEFAULT_CAPTION_LAYOUT} onLayoutChange={captionLayout=>setProject(p=>({...p,captionLayout}))} decoration={project.decoration||DEFAULT_DECORATION} onDecorationChange={decoration=>setProject(p=>({...p,decoration}))}/><LegacyBlurEditor value={project.blurRegion||{enabled:false,x:.1,y:.78,width:.8,height:.15,strength:16}} onChange={blurRegion=>setProject(p=>({...p,blurRegion}))} onConvert={()=>{const blur=project.blurRegion!;const id=crypto.randomUUID();changeVisuals([...(project.visuals||[]),{...blur,id,kind:'blur',name:'Vùng mờ từ dự án',startTime:0,endTime:project.duration,sourceStart:0,sourceDuration:project.duration,opacity:1,keyframes:[]}]);setProject(p=>({...p,blurRegion:{...p.blurRegion!,enabled:false}}));selectVisual(id);}}/></>:inspectorTab==='templates'?<><TemplateParts project={project} onProject={editProject} onSelect={(id,isText)=>{setSelectedVisual(id);if(isText)selectText({kind:'visual',id});else setInspectorTab('media')}}/><TemplatePanel project={project} onApply={clips=>{pushHistory(project);setIsPlaying(false);setProject(p=>normalizeTemplateBundle(replaceTemplate(p,clips)));}}/></>:<MediaEditor project={project} time={currentTime} selected={selectedVisual} onSelect={selectVisual} onChange={changeVisuals} onProcess={(isProcessing,progressPercent,currentTaskName)=>setHardwareStatus(h=>({...h,isProcessing,progressPercent,currentTaskName}))}/>}</InspectorDock>}


      </div>

      {lastExport&&<div className="px-3 py-2 text-xs bg-emerald-950 text-emerald-100 flex gap-3 items-center"><span>Đã lưu MP4: {lastExport}</span><button className="underline" onClick={()=>(window as any).hnDesktop?.revealExport()}>Mở thư mục chứa video</button></div>}
      {popupIds.length>0&&project.subtitles.some(s=>popupIds.includes(s.id))&&<CaptionPopup key={popupIds.join(',')} cues={timelineSubtitles(project).filter(s=>popupIds.includes(s.id)).map(s=>({...s,voiceId:s.voiceId||project.characters.find(c=>c.id===s.characterId)?.voiceId}))} layout={project.captionLayout||DEFAULT_CAPTION_LAYOUT} voices={voices} busy={hardwareStatus.isProcessing} onClose={()=>{stopAudioPreview();setPopupIds([]);}} onApply={applyCaptionChanges} onGenerate={generatePopupSpeech} onEditAudio={id=>{const clip=projectClips(project).find(c=>c.subtitleId===id);if(clip){stopAudioPreview();setPopupIds([]);setAudioPopup(clip.id)}}}/>}
      {showSubtitleList&&<FloatingPanel title="Danh sách phụ đề" width={500} onClose={()=>setShowSubtitleList(false)}><div className="floating-subtitle-list">{editorPanel}</div></FloatingPanel>}
      {textPopup&&textTarget&&<FloatingPanel title="Chỉnh chữ" onClose={()=>setTextPopup(false)}><TextProperties selectedIds={captionSelection} project={project} target={textTarget} onText={updateText} onProject={editProject}/></FloatingPanel>}
      {audioPopup&&projectClips(project).some(c=>c.id===audioPopup)&&<AudioPopup key={audioPopup} clip={projectClips(project).find(c=>c.id===audioPopup)!} onClose={()=>setAudioPopup(null)} onLiveChange={setAudioLive} onSeek={setCurrentTime} onApply={async clip=>{if(!await applyTimeline({...project,manualTimeline:true,audioClips:placeAudioEdit(projectClips(project),clip)}))throw Error("Chưa áp dụng được thay đổi âm thanh.");}}/>}

      {/* 3. Bottom: CapCut-Style Multi-Track Timeline */}
      <div className={previewExpanded?'hidden':'contents'}><Timeline
        onExtractVideo={openVideoExtraction} audioLive={audioLive} onAudioStem={separateTimelineClip} linkedMedia={linkMedia} onLinkedMedia={setLinkMedia} onExtractClip={id=>{setExtractMode('all');setExtractLane('new');setExtractId(id)}} onVisualLayoutChange={(visuals,visualTracks)=>{pushHistory(project);setIsPlaying(false);setProject(p=>({...((linkMedia?linkedVideoEdit(p,visuals):p)),visuals,visualTracks,videoEdited:true}))}} onVisualPopup={id=>{const c=project.visuals?.find(c=>c.id===id);if(c?.kind==='text'){selectText({kind:'visual',id});setTextPopup(true)}else if(id.startsWith('bundle:')){setInspectorTab('templates')}}} onDropAsset={insertAsset} selectedVisual={selectedVisual} onVisualSelect={selectVisual} onVisualsChange={changeVisuals} onVisualTracksChange={tracks=>{pushHistory(project);const removed=visualTracks(project.visuals||[],project.visualTracks).filter(t=>!tracks.some(x=>x.id===t.id)).map(t=>t.id);setProject(p=>({...p,visualTracks:tracks,visuals:p.visuals?.filter(c=>!removed.includes(c.trackId||'track-'+c.id))}))}} onAudioPopup={id=>{setIsPlaying(false);stopAudioPreview();setAudioPopup(id)}}
        project={project} currentTime={currentTime} busy={hardwareStatus.isProcessing}
        canUndo={historyPast.length>0} canRedo={historyFuture.length>0} onUndo={handleUndo} onRedo={handleRedo}
        onSeek={setCurrentTime} onPause={()=>{stopAudioPreview();setIsPlaying(false);}}
        onCaptionSelection={setCaptionSelection} onSelectSubtitle={(id,lang)=>{setProject(p=>({...p,selectedSubtitleId:id}));if(id)selectText({kind:'caption',id,lang:lang||'vi'})}}
        onCaptionPopup={ids=>{stopAudioPreview();setIsPlaying(false);setPopupIds(ids);}}
        onDeleteMany={(items,linked)=>{try{applyTimeline(deleteTimelineSelection(project,items,linked));}catch(e){alert(String(e));}}} onRemix={()=>applyTimeline({...project,manualTimeline:true})} onEdit={handleTimelineEdit} onImportAudio={file=>handleTimelineAudio(file)} onExtractOriginal={mode=>handleTimelineAudio(undefined,mode)}
      /></div>

    </div>
  );
}
