import {MediaEditor,VisualTimeline} from './components/MediaEditor';
import {VisualClip} from './types';
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

  const [voices,setVoices]=useState<any[]>([]);
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
    try{await document.fonts.ready;let exportProject=project;if(project.manualTimeline&&!project.dubAudioUrl){const mixed=await runJob('/api/timeline/mix',{clips:projectClips(project),duration:timelineEnd(project)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));exportProject={...project,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration};setProject(exportProject);}
      const form=new FormData();form.append('file',await readVideo(exportProject.videoUrl!),exportProject.videoFileName||'video.mp4');form.append('options',JSON.stringify({timelineDuration:timelineEnd(exportProject),visuals:exportProject.visuals,videoEdited:exportProject.videoEdited,ass:generateAss(captions?exportProject:{...exportProject,captionLayout:{...DEFAULT_CAPTION_LAYOUT,...exportProject.captionLayout,language:'off'}}),blur:exportProject.blurRegion,aspect:exportProject.captionLayout?.aspect||'auto',dubAudioUrl:exportProject.dubAudioUrl,originalMuted:exportProject.originalAudioMuted,originalVolume:exportProject.originalAudioVolume}));
      const body=await apiJson('/api/video/export',{method:'POST',body:form});window.dispatchEvent(new CustomEvent('hn-job',{detail:body.jobId}));
      for(;;){const job=await apiJson('/api/jobs/'+body.jobId);setHardwareStatus(h=>({...h,progressPercent:job.percent,currentTaskName:job.message}));if(job.state==='done'){if(desktop){setLastExport(await desktop.saveExport(job.result.url));break;}const a=document.createElement('a');a.href=job.result.url;a.download=project.title+'_HNVoice.mp4';a.click();break;}if(['error','cancelled'].includes(job.state))throw new Error(job.message);await new Promise(r=>setTimeout(r,750));}
    }catch(e){alert(String(e));}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };
  const handleGeminiVideo=async()=>{
    if(!project.videoUrl)return;
    stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:1,currentTaskName:'Gemini: chuẩn bị tải video...'}));
    try{const blob=await readVideo(project.videoUrl);const form=new FormData();form.append('file',blob,project.videoFileName||'video.mp4');form.append('duration',String(project.duration));
      const body=await apiJson('/api/gemini/video-subtitles',{method:'POST',body:form});
      window.dispatchEvent(new CustomEvent('hn-job',{detail:body.jobId}));
      let result:any;
      for(;;){const job=await apiJson('/api/jobs/'+body.jobId);setHardwareStatus(h=>({...h,progressPercent:job.percent,currentTaskName:job.message}));if(job.state==='done'){result=job.result;break;}if(job.state==='error'||job.state==='cancelled')throw new Error(job.error||job.message);await new Promise(r=>setTimeout(r,750));}
      pushHistory(project);setProject(p=>({...p,subtitles:result.subtitles,audioClips:p.audioClips?.filter(c=>c.track==='audio'),dubAudioUrl:undefined,dubDuration:undefined}));triggerDownload(result.srt,project.title+'_Gemini_Trung.srt','text/plain');setActiveSidebarTab('translation');
    }catch(e){alert(String(e));}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}));setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
  };

  const applyTimeline=async(next:ProjectData)=>{
    if(hardwareStatus.isProcessing)return;stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,progressPercent:0,currentTaskName:'Cập nhật timeline...'}));
    try{validateTimeline(next);if(project.dubAudioUrl&&timelineEnd(next)===timelineEnd(project)&&JSON.stringify(projectClips(next))===JSON.stringify(projectClips(project))){pushHistory(project);setProject({...next,dubAudioUrl:project.dubAudioUrl,dubDuration:project.dubDuration});return;}const mixed=await runJob('/api/timeline/mix',{clips:projectClips(next),duration:timelineEnd(next)},(v,t)=>setHardwareStatus(h=>({...h,progressPercent:v,currentTaskName:t})));pushHistory(project);setProject({...next,dubAudioUrl:mixed.audioUrl,dubDuration:mixed.duration});setCurrentTime(t=>Math.min(t,mixed.duration));}
    catch(e){alert(String(e));}finally{setHardwareStatus(h=>({...h,isProcessing:false,progressPercent:0,currentTaskName:''}));}
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
        e.target instanceof HTMLSelectElement
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
        videoEdited:false,visuals:[],videoFileName: file.name,audioClips:undefined,manualTimeline:false,
        duration: dur,
        videoWidth:videoEl.videoWidth,videoHeight:videoEl.videoHeight,
        title: file.name.replace(/\.[^/.]+$/, ''),
      }));
      setActiveSidebarTab('asr');
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
      const recognized = await runOfflineASR(
        project.videoUrl || '',
        {
          model,
          cropTop,
          useVad: true,
          usePunc: true,
          confidenceThreshold: 0.9,
        },
        (percent, stepText) => {
          setHardwareStatus((h) => ({
            ...h,
            progressPercent: percent,
            currentTaskName: stepText,
          }));
        }
      );

      setProject((p) => ({
        ...p,
        subtitles: recognized,
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
      const translated = await runQwenTranslation(
        project.subtitles,
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
        subtitles: translated,audioClips:p.audioClips?.filter(c=>c.track==='audio'),
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

  const handleExportProjectJson=async()=>{const desktop=(window as any).hnDesktop;if(!desktop){alert('Lưu dự án dùng trong ứng dụng Windows.');return;}stopAudioPreview();setIsPlaying(false);setHardwareStatus(h=>({...h,isProcessing:true,currentTaskName:'Đang lưu dự án và media…',progressPercent:1}));try{let videoPath='';if(project.videoUrl){const file=await readVideo(project.videoUrl);if(file instanceof File)videoPath=desktop.filePath(file);}const saved=await desktop.saveProject({project,videoPath});if(saved)alert('Đã lưu dự án: '+saved);}catch(e){alert(String(e));}finally{setHardwareStatus(h=>({...h,isProcessing:false,currentTaskName:'',progressPercent:0}));}};
  const handleOpenProject=async()=>{const desktop=(window as any).hnDesktop;if(!desktop){alert('Mở dự án dùng trong ứng dụng Windows.');return;}stopAudioPreview();setIsPlaying(false);try{const result=await desktop.openProject();if(result){validateTimeline(result.project);pushHistory(project);setProject({...result.project,captionLayout:{...DEFAULT_CAPTION_LAYOUT,...result.project.captionLayout}});setCurrentTime(0);loadVieNeuVoices().then(data=>setVoices(data.voices));setActiveSidebarTab('export');}}catch(e){alert(String(e));}};
  const [selectedVisual,setSelectedVisual]=useState<string|null>(null);
  const changeVisuals=(visuals:VisualClip[])=>{setIsPlaying(false);pushHistory(project);setProject(p=>({...p,visuals,videoEdited:p.videoEdited||visuals.some(c=>c.kind==='video')}));};
  const originalClips=projectClips(project).filter(c=>c.origin==='video');
  const changeOriginalVolume=(volume:number)=>{if(originalClips.length)applyTimeline({...project,manualTimeline:true,audioClips:projectClips(project).map(c=>c.origin==='video'?{...c,volume}:c)});else setProject(p=>({...p,originalAudioVolume:volume}));};
  const toggleOriginalMute=()=>{if(originalClips.length){const muted=!originalClips.every(c=>c.muted);applyTimeline({...project,manualTimeline:true,audioClips:projectClips(project).map(c=>c.origin==='video'?{...c,muted}:c)});}else setProject(p=>({...p,originalAudioMuted:!p.originalAudioMuted}));};
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
    <div className="flex flex-col h-screen min-w-[1100px] w-full bg-[#101014] text-zinc-100 overflow-hidden font-sans select-none">
      {/* 1. Header Toolbar */}
      <Header
        hardwareStatus={hardwareStatus}
        projectTitle={project.title}
        onOpenPackaging={() => setIsPackagingModalOpen(true)}
        onOpenModelAnalysis={() => setIsModelAnalysisOpen(true)}
        onOpenModelLoader={() => setIsModelLoaderOpen(true)}
        onCancel={jobId?handleCancel:undefined}
        onOpenExport={() => setActiveSidebarTab('export')}
        onSaveProject={handleExportProjectJson}
        canUndo={historyPast.length > 0}
        canRedo={historyFuture.length > 0}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* 2. Middle Workspace: Left Sidebar + Center Video + Right Subtitle Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar Steps / Controls */}
        <div className={previewExpanded?'hidden':'contents'}><SidebarTabs
          activeTab={activeSidebarTab}
          setActiveTab={setActiveSidebarTab}
          project={project}
          hardwareStatus={hardwareStatus}
          onUploadVideo={handleUploadVideo}
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
        /></div>

        {/* Center: Video Player Preview */}
        <VideoPlayer
          videoEdited={project.videoEdited} visuals={project.visuals||[]} selectedVisual={selectedVisual} onSelectVisual={setSelectedVisual} onVisualChange={changeVisuals} baseWidth={project.videoWidth} baseHeight={project.videoHeight}
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
        {editorPanel}

      </div>

      {lastExport&&<div className="px-3 py-2 text-xs bg-emerald-950 text-emerald-100 flex gap-3 items-center"><span>Đã lưu MP4: {lastExport}</span><button className="underline" onClick={()=>(window as any).hnDesktop?.revealExport()}>Mở thư mục chứa video</button></div>}
      {popupIds.length>0&&project.subtitles.some(s=>popupIds.includes(s.id))&&<CaptionPopup key={popupIds.join(',')} cues={timelineSubtitles(project).filter(s=>popupIds.includes(s.id)).map(s=>({...s,voiceId:s.voiceId||project.characters.find(c=>c.id===s.characterId)?.voiceId}))} layout={project.captionLayout||DEFAULT_CAPTION_LAYOUT} voices={voices} busy={hardwareStatus.isProcessing} onClose={()=>{stopAudioPreview();setPopupIds([]);}} onApply={applyCaptionChanges} onGenerate={generatePopupSpeech}/>}
      {!previewExpanded&&!!project.visuals?.length&&<VisualTimeline clips={project.visuals} time={currentTime} selected={selectedVisual} onSelect={id=>{setSelectedVisual(id);window.dispatchEvent(new Event('hn-open-media'));}} onSeek={t=>{setIsPlaying(false);setCurrentTime(t)}} onChange={changeVisuals}/>}
      {/* 3. Bottom: CapCut-Style Multi-Track Timeline */}
      <div className={previewExpanded?'hidden':'contents'}><Timeline
        project={project} currentTime={currentTime} busy={hardwareStatus.isProcessing}
        canUndo={historyPast.length>0} canRedo={historyFuture.length>0} onUndo={handleUndo} onRedo={handleRedo}
        onSeek={setCurrentTime} onPause={()=>{stopAudioPreview();setIsPlaying(false);}}
        onSelectSubtitle={id=>setProject(p=>({...p,selectedSubtitleId:id}))}
        onCaptionPopup={ids=>{stopAudioPreview();setIsPlaying(false);setPopupIds(ids);}}
        onDeleteMany={(items,linked)=>{try{applyTimeline(deleteTimelineSelection(project,items,linked));}catch(e){alert(String(e));}}} onRemix={()=>applyTimeline({...project,manualTimeline:true})} onEdit={handleTimelineEdit} onImportAudio={file=>handleTimelineAudio(file)} onExtractOriginal={mode=>handleTimelineAudio(undefined,mode)}
      /></div>

    </div>
  );
}
