import {Character,Subtitle} from '../types';

export function normalizeSpeakerName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/gi,'d').toLocaleLowerCase('vi').replace(/[^\p{L}\p{N}]+/gu,'').trim();}

export function speakerPrefix(text:string){
 const match=text.match(/^\s*([^:\n：]{1,64})\s*[:：]\s*(\S[\s\S]*)$/);if(!match)return null;
 const name=match[1].trim();if(!/[\p{L}\p{N}]/u.test(name)||/[.!?。！？]/u.test(name))return null;
 return {name,key:normalizeSpeakerName(name),spoken:match[2].trim()};
}

// Remove only a leading speaker label; preserve the actual caption verbatim.
export function stripSpeakerPrefix(text:string,characters?:Character[]){
 const prefix=speakerPrefix(text);
 if(characters&&!characters.some(c=>normalizeSpeakerName(c.name)===prefix?.key))return text;
 return prefix?.spoken||text;
}

export function detectSubtitleSpeakers(subtitles:Subtitle[]){
 const found=new Map<string,string>();
 for(const cue of subtitles){
  // Use translated text first because that is where speaker labels are intended to be read.
  const text=cue.textVi?.trim()||cue.textZh?.trim()||'';const prefix=speakerPrefix(text);
  if(prefix?.key&&!found.has(prefix.key))found.set(prefix.key,prefix.name);
 }
 return [...found.values()];
}

function speakerFromPrefix(text:string,characters:Character[]){
 const prefix=speakerPrefix(text);if(!prefix)return null;
 const character=characters.find(c=>normalizeSpeakerName(c.name)===prefix.key);
 return prefix.spoken?{character,text:prefix.spoken}:null;
}

// Always use caption times, never old audio offsets from an earlier dubbing pass.
export function captionSpeechCues(subtitles:Subtitle[],ids:Set<string>,characters:Character[]){
 const ordered=subtitles.filter(s=>!s.hiddenVi&&s.textVi?.trim()).map(s=>({...s,startTime:s.viStartTime??s.startTime,endTime:s.viEndTime??s.endTime})).sort((a,b)=>a.startTime-b.startTime);
 return ordered.filter(s=>ids.has(s.id)).map(s=>{
  const next=ordered.find(c=>c.id!==s.id&&c.startTime>=s.startTime);
  const character=characters.find(c=>c.id===s.characterId);
  const speaker=speakerFromPrefix(s.textVi||'',characters);const selected=speaker?.character||character;
  const staleSpeaker=s.characterId&&!character&&!selected?speaker:null;
  return {...s,textVi:speaker?.text||staleSpeaker?.text||s.textVi,endTime:Math.min(s.endTime,next?.startTime??Infinity),characterId:selected?.id||s.characterId,voiceId:speaker?.character?.voiceId||s.voiceId||character?.voiceId||'Hải Đăng',expressivity:s.expressivity??selected?.expressivity??.3};
 });
}
