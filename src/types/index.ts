export interface BlurRegion { enabled:boolean; x:number; y:number; width:number; height:number; strength:number; }
export interface CaptionPosition { x:number; y:number; }
export interface CaptionLayout { aspect:'auto'|'16:9'|'9:16'; position:CaptionPosition; width:number; fontSize:number; }
export type TranslationProvider = 'offline' | 'gemini' | 'chatgpt';
export type SubtitleStatus =
  | 'raw'
  | 'needs_retranslation'
  | 'translated'
  | 'needs_tts'
  | 'synced'
  | 'warning_overflow';

export interface Subtitle {
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
  position?:CaptionPosition;
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

export interface ProjectData {
  id: string;
  title: string;
  videoUrl: string | null;
  videoFileName: string;
  videoWidth?:number;
  videoHeight?:number;
  captionLayout?:CaptionLayout;
  blurRegion?:BlurRegion;
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
