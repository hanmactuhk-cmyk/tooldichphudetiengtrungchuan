import type {TextMotion} from '../lib/text-motion';
export interface MotionKeyframe {time:number;x:number;y:number;width:number;height:number;opacity:number;}
export interface VisualTrack {id:string;name:string;enabled:boolean;}
export interface TextStyle {motion?:TextMotion;underline?:boolean;letterSpacing?:number;lineSpacing?:number;strokeWidth?:number;strokeColor?:string;shadow?:number;backgroundOpacity?:number;align?:"left"|"center"|"right";verticalAlign?:"top"|"middle";condensed?:boolean;uppercase?:boolean;badge?:"pill"|"glass"|"outline"|"solid";badgeMark?:string;fontFamily:string;fontSize:number;color:string;bold:boolean;italic:boolean;background:string;radius:number;autoFit:boolean;}
export type TemplateRole = "top"|"bottom"|"blur"|"channel"|"title"|"date"|"source";
export interface MediaAsset {id:string;name:string;kind:"video"|"image";url:string;width:number;height:number;duration:number;}
export interface SourceCrop {x:number;y:number;width:number;height:number;}
export interface VisualClip {crop?:SourceCrop;rotation?:number;audioMuted?:boolean;processedUrl?:string;processingEnabled?:boolean;templateGroup?:string;assetId?:string;templateRole?:TemplateRole;templateLayout?:"bands"|"news";templateBandHeight?:number;templateDesign?:string;nativeWidth?:number;nativeHeight?:number;trackId?:string;layer?:number;flipX?:boolean;flipY?:boolean;rate?:number;text?:string;textStyle?:TextStyle;template?:{pattern:string;color:string;secondary:string;fade:boolean;radius:number;surface?:"news-top"|"news-bottom";};renderKey?:string;id:string;kind:'video'|'image'|'blur'|'text';name:string;url?:string;startTime:number;endTime:number;sourceStart:number;sourceDuration:number;x:number;y:number;width:number;height:number;opacity:number;enabled:boolean;keyframes:MotionKeyframe[];strength?:number;radius?:number;fit?:'contain'|'cover';}
export interface TimelineAudioClip {laneId?:string;sourceClipId?:string; id:string; subtitleId?:string; origin?:'video'|'file'; track:'voice'|'audio'; name:string; audioUrl:string; startTime:number; trimStart:number; trimEnd:number; sourceDuration:number; volume:number; muted?:boolean; }
export interface BlurRegion { enabled:boolean; x:number; y:number; width:number; height:number; strength:number; radius?:number; }
export interface CaptionPosition { x:number; y:number; }
export type TextTarget={kind:"visual"|"caption"|"banner"|"legacy";id:string;lang?:"vi"|"zh"};
export interface CaptionLayout {motion?:TextMotion;underline?:boolean;letterSpacing?:number;lineSpacing?:number;strokeWidth?:number;strokeColor?:string;shadow?:number;align?:"left"|"center"|"right"; aspect:'auto'|'16:9'|'9:16'; position:CaptionPosition; width:number; fontSize:number; bold?:boolean; italic?:boolean; cornerRadius?:number; characterColors?:Record<number,string>; fontFamily?:string; textColor?:string; backgroundColor?:string; backgroundOpacity?:number; language?:'vi'|'zh'|'bilingual'|'off'; }
export type TranslationProvider = 'offline' | 'gemini' | 'chatgpt';
export type SubtitleStatus =
  | 'raw'
  | 'needs_retranslation'
  | 'translated'
  | 'needs_tts'
  | 'synced'
  | 'warning_overflow';

export interface Subtitle {sourceClipId?:string;
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  textZh: string;
  textVi?: string;
  suggestedViShort?: string; // Shortened version if Vietnamese is too long for dubbing
  characterId: string;
  voiceId?: string;
  speed: number;       // 0.5 - 2.0x, default 1.0
  pitch: number;       // -10 to +10, default 0
  volume: number;      // 0.0 - 2.0, default 1.0
  status: SubtitleStatus;
  captionStyle?:Partial<CaptionLayout>;
  position?:CaptionPosition;
  hiddenZh?:boolean;hiddenVi?:boolean;zhStartTime?:number;zhEndTime?:number;viStartTime?:number;viEndTime?:number;
  ttsAudioUrl?: string; // Object URL or WAV data
  dubStartTime?:number;
  dubEndTime?:number;
  ttsFitSpeed?:number;
  ttsShift?:number;
  ttsDuration?: number; // Measured duration in seconds
  modelUsedZh?: 'Gemini video CDP' | 'RapidOCR Chinese' | 'Whisper-small' | 'SenseVoice-Small' | 'Paraformer-ZH';
  modelUsedTrans?: string;
  confidence?: number;
  notes?: string;
}

export interface Character {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'child' | 'elder';
  role: string;          // e.g. "Nam chính", "Nữ chính", "Mẹ", "Sếp"
  relationship: string;  // e.g. "Vợ của Minh", "Em gái", "Cấp dưới"
  pronounSelf: string;   // Tự xưng: "Tôi", "Em", "Anh", "Con", "Tớ"
  pronounCall: string;   // Gọi đối phương: "Anh", "Em", "Mẹ", "Cậu", "Sếp"
  color: string;         // Hex tag color
  voiceId: string;       // VieNeu-TTS Voice ID
  speed: number;
  pitch: number;
}

export interface VieNeuVoice {
  id: string;
  name: string;
  gender: 'female' | 'male';
  accent: 'Bắc' | 'Nam' | 'Trung';
  tone: string;
  description: string;
  sampleText: string;
  isClone?: boolean;
  supportedExpressions: string[]; // e.g. ['[cười]', '[thở dài]', '[hắng giọng]']
}

export interface HardwareVramStatus {
  gpuName: string;
  vramTotalMb: number;
  vramUsedMb: number;
  ramTotalMb: number;
  ramUsedMb: number;
  activeModel: string | null;
  cpuFallback: boolean;
  isProcessing: boolean;
  progressPercent: number;
  currentTaskName: string;
}

export interface VideoDecoration {align?:"left"|"center"|"right";bold?:boolean;italic?:boolean;topColors?:Record<number,string>;bottomColors?:Record<number,string>;overlayColor?:string;enabled:boolean;topText:string;bottomText:string;topHeight:number;bottomHeight:number;backgroundColor:string;textColor:string;fontFamily:string;fontSize:number;overlays:{id:string;text:string;x:number;y:number;characterColors?:Record<number,string>}[];}
export interface ExportSettings {resolution:"source"|"1080p"|"1080p-portrait";quality:"fast"|"quality";}
export interface ProjectData {exportSettings?:ExportSettings;
  mediaLibrary?:MediaAsset[];visuals?:VisualClip[];visualTracks?:VisualTrack[];videoEdited?:boolean;
  decoration?:VideoDecoration;
  id: string;
  title: string;
  videoUrl: string | null;
  videoFileName: string;
  videoWidth?:number;
  videoHeight?:number;
  captionLayout?:CaptionLayout;
  blurRegion?:BlurRegion;
  audioClips?:TimelineAudioClip[];
  manualTimeline?:boolean;
  duration: number;
  originalAudioVolume: number; // 0 to 1
  originalAudioMuted: boolean;
  bgmDucking: boolean;
  subtitles: Subtitle[];
  characters: Character[];
  translationMode: TranslationProvider;
  dubAudioUrl?:string;
  dubDuration?:number;
  selectedSubtitleId: string | null;
  currentTime: number;
}
