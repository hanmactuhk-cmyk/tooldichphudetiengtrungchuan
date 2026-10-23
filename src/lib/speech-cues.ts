import {Character,Subtitle} from '../types';

// Always use caption times, never old audio offsets from an earlier dubbing pass.
export function captionSpeechCues(subtitles:Subtitle[],ids:Set<string>,characters:Character[]){
 const ordered=subtitles.filter(s=>!s.hiddenVi&&s.textVi?.trim()).map(s=>({...s,startTime:s.viStartTime??s.startTime,endTime:s.viEndTime??s.endTime})).sort((a,b)=>a.startTime-b.startTime);
 return ordered.filter(s=>ids.has(s.id)).map(s=>{
  const next=ordered.find(c=>c.id!==s.id&&c.startTime>=s.startTime);
  return {...s,endTime:Math.min(s.endTime,next?.startTime??Infinity),voiceId:s.voiceId||characters.find(c=>c.id===s.characterId)?.voiceId||'Hải Đăng'};
 });
}
