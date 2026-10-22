import {runJob} from './jobs';
import { Subtitle, Character, SubtitleStatus, TranslationProvider } from '../types';

export interface TranslationDictionary {
  [zhSentence: string]: {
    viFull: string;
    viShort: string;
    relationshipContext: string;
  };
}

// Check if Vietnamese sentence speaking duration exceeds subtitle time slot
export function evaluateDubbingPacing(
  textVi: string,
  startTime: number,
  endTime: number,
  speed: number = 1.0
): {
  isOverflow: boolean;
  estDuration: number;
  availableDuration: number;
  wordCount: number;
  suggestedSpeed: number;
} {
  const availableDuration = endTime - startTime;
  const words = textVi.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  // Average natural Vietnamese dubbing pace is ~3.5 words/sec (0.285s/word) + 0.3s breath buffer
  const estDuration = (wordCount * 0.285) / Math.max(0.6, speed) + 0.2;
  const isOverflow = estDuration > availableDuration + 0.25; // 250ms tolerance
  const suggestedSpeed = Math.min(1.4, Math.max(1.0, Number((estDuration / availableDuration).toFixed(2))));

  return {
    isOverflow,
    estDuration: Number(estDuration.toFixed(2)),
    availableDuration: Number(availableDuration.toFixed(2)),
    wordCount,
    suggestedSpeed,
  };
}

export async function runQwenTranslation(subtitles: Subtitle[], characters: Character[], mode: TranslationProvider, onProgress:(p:number,t:string)=>void): Promise<Subtitle[]> {
  onProgress(1,'Đang chuẩn bị dịch có ngữ cảnh...');
  const data=await runJob('/api/translate-job',{subtitles,characters,provider:mode},onProgress);
  if(!Array.isArray(data.translations) || data.translations.length!==subtitles.length) throw new Error('Thiếu bản dịch.');
  const map=new Map<string,any>(data.translations.map((t:any)=>[t.id,t]));
  const results=subtitles.map(sub=>{
    const t=map.get(sub.id); if(!t?.viFull) throw new Error('Thiếu bản dịch câu '+sub.id);
    const pacing=evaluateDubbingPacing(t.viFull,sub.startTime,sub.endTime,sub.speed);
    return {...sub,ttsAudioUrl:undefined,ttsDuration:undefined,textVi:t.viFull,suggestedViShort:t.viShort,notes:t.contextNote,modelUsedTrans:data.modelUsed,status:(pacing.isOverflow?'warning_overflow':'translated') as SubtitleStatus};
  });
  onProgress(100,'Hoàn thành dịch offline.');return results;
}
export async function retranslateSingleSentence(sub:Subtitle,mode:TranslationProvider) {
  const [result]=await runQwenTranslation([sub],[],mode,()=>{});
  return {textVi:result.textVi!,suggestedViShort:result.suggestedViShort,notes:result.notes};
}
