import {CaptionLayout,Subtitle,ProjectData} from '../types';
export const DEFAULT_CAPTION_LAYOUT:CaptionLayout={aspect:'auto',position:{x:.5,y:.86},width:90,fontSize:4};
export function splitText(text:string):[string,string]{
 const value=text.trim();if(!value)return ['',''];
 const middle=value.length/2;const boundaries=[...value.matchAll(/[，。！？、；,.!?;]\s*|\s+/gu)].map(m=>m.index!+m[0].length).filter(i=>i>0&&i<value.length);
 const index=boundaries.length?boundaries.reduce((a,b)=>Math.abs(b-middle)<Math.abs(a-middle)?b:a):[...value].slice(0,Math.ceil([...value].length/2)).join('').length;
 return [value.slice(0,index).trim(),value.slice(index).trim()];
}
export function splitCue(cue:Subtitle):Subtitle[]{
 if(cue.endTime-cue.startTime<.4)throw new Error('Câu quá ngắn để tách. Cần ít nhất 0,4 giây.');
 const zh=splitText(cue.textZh),vi=splitText(cue.textVi||'');
 if(!(vi[1]||zh[1]))throw new Error('Câu chỉ có một ký tự hoặc một từ quá ngắn để tách.');
 const basis=cue.textVi?vi:zh;const total=basis[0].length+basis[1].length;
 const fraction=Math.max(.2,Math.min(.8,basis[0].length/Math.max(1,total)));const middle=cue.startTime+(cue.endTime-cue.startTime)*fraction;
 return [0,1].map(i=>({...cue,id:cue.id+'-'+crypto.randomUUID(),textZh:zh[i],textVi:cue.textVi?vi[i]:undefined,startTime:i?middle:cue.startTime,endTime:i?cue.endTime:middle,ttsAudioUrl:undefined,ttsDuration:undefined,dubStartTime:undefined,dubEndTime:undefined,ttsShift:undefined,ttsFitSpeed:undefined,status:cue.textVi?'translated':'raw'}));
}
function stamp(t:number){const cs=Math.round(t*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;}
function safe(t:string){return t.replace(/\\/g,'\\\\').replace(/[{}]/g,'').replace(/\r?\n/g,'\\N');}
export function generateAss(project:ProjectData){
 const w=project.videoWidth||1920,h=project.videoHeight||1080,layout=project.captionLayout||DEFAULT_CAPTION_LAYOUT;
 const font=Math.max(16,Math.round(w*layout.fontSize/100));
 const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,${font},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,5,20,20,20,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 return header+[...project.subtitles].sort((a,b)=>a.startTime-b.startTime).map(c=>{const p=c.position||layout.position;const text=c.textVi||c.textZh;const pair=splitText(text);const wrapped=text.length>Math.floor(layout.width/layout.fontSize*1.8)&&pair[1]?pair.join('\n'):text;const x=Math.round(Math.max(0,Math.min(1,p.x))*w),y=Math.round(Math.max(0,Math.min(1,p.y))*h);return `Dialogue: 0,${stamp(project.dubAudioUrl?c.dubStartTime??c.startTime:c.startTime)},${stamp(project.dubAudioUrl?c.dubEndTime??c.endTime:c.endTime)},Default,,0,0,0,,{\\an5\\pos(${x},${y})}${safe(wrapped)}`;}).join('\n');
}
