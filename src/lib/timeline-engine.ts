import {ProjectData,Subtitle,TimelineAudioClip} from '../types';
export type TimelineEdit={track:'subtitle'|'zh'|'vi'|'voice'|'audio';id:string;kind:'move'|'left'|'right'|'split'|'delete'|'duplicate'|'mute'|'volume';time:number;linked:boolean};
const round=(n:number)=>Math.round(n*1000)/1000;
export const audioEnd=(c:TimelineAudioClip)=>c.startTime+c.trimEnd-c.trimStart;
export function deleteTimelineSelection(original:ProjectData,items:{track:'subtitle'|'zh'|'vi'|'voice'|'audio';id:string}[],linked:boolean):ProjectData{
 const subtitles=timelineSubtitles(original),clips=projectClips(original);
 const subIds=new Set(items.filter(i=>i.track==='subtitle').map(i=>i.id));
 const clipIds=new Set(items.filter(i=>i.track==='voice'||i.track==='audio').map(i=>i.id));
 if(linked)for(const c of clips)if(clipIds.has(c.id)&&c.subtitleId)subIds.add(c.subtitleId);
 const zhIds=new Set(items.filter(i=>i.track==='zh').map(i=>i.id)),viIds=new Set(items.filter(i=>i.track==='vi').map(i=>i.id));
 return validateTimeline({...original,manualTimeline:true,selectedSubtitleId:null,subtitles:subtitles.filter(s=>!subIds.has(s.id)).map(s=>({...s,hiddenZh:zhIds.has(s.id)||s.hiddenZh,hiddenVi:viIds.has(s.id)||s.hiddenVi})),audioClips:clips.filter(c=>!clipIds.has(c.id)&&!(linked&&c.subtitleId&&subIds.has(c.subtitleId)))});
}
export function projectClips(p:ProjectData):TimelineAudioClip[]{return p.audioClips??p.subtitles.filter(s=>s.ttsAudioUrl).map(s=>({id:'voice-'+s.id,subtitleId:s.id,track:'voice',name:s.textVi||s.textZh,audioUrl:s.ttsAudioUrl!,startTime:s.dubStartTime??s.startTime,trimStart:0,trimEnd:s.ttsDuration||s.endTime-s.startTime,sourceDuration:s.ttsDuration||s.endTime-s.startTime,volume:1}));}
export function timelineSubtitles(p:ProjectData){return p.manualTimeline||!p.dubAudioUrl?p.subtitles:p.subtitles.map(s=>({...s,startTime:s.dubStartTime??s.startTime,endTime:s.dubEndTime??s.endTime}));}
export function timelineEnd(p:ProjectData){return Math.max(p.videoEdited?0:p.duration,...(p.visuals||[]).map(c=>c.endTime),...p.subtitles.flatMap(s=>[s.endTime,s.zhEndTime||0,s.viEndTime||0]),...projectClips(p).map(audioEnd),0);}
export function validateTimeline(p:ProjectData){
 for(const s of p.subtitles)if(!Number.isFinite(s.startTime+s.endTime)||s.startTime<0||s.endTime-s.startTime<.039)throw Error('Phụ đề cần dài ít nhất 0,04 giây.');
 const clips=projectClips(p);const ids=new Set<string>();
 for(const c of clips){if(ids.has(c.id)||![c.startTime,c.trimStart,c.trimEnd,c.sourceDuration,c.volume].every(Number.isFinite)||c.startTime<0||c.trimStart<0||c.trimEnd>c.sourceDuration+.002||c.trimEnd-c.trimStart<.039)throw Error('Mốc âm thanh không hợp lệ.');ids.add(c.id);}
 for(const track of ['voice','audio']){const lane=clips.filter(c=>c.track===track&&!c.muted).sort((a,b)=>a.startTime-b.startTime);for(let i=1;i<lane.length;i++)if(lane[i].startTime<audioEnd(lane[i-1])-.00001)throw Error('Đoạn âm thanh trùng nhau trên cùng hàng. Hãy kéo vào khoảng trống hoặc bật nam châm.');}
 if(timelineEnd(p)>86400)throw Error('Timeline tối đa 24 giờ.');return p;
}
export function editTimeline(original:ProjectData,e:TimelineEdit):ProjectData{
 if(e.track==='zh'||e.track==='vi'){
  const lang=e.track,s=timelineSubtitles(original).find(c=>c.id===e.id);if(!s)return original;
  const a=lang==='zh'?s.zhStartTime??s.startTime:s.viStartTime??s.startTime,b=lang==='zh'?s.zhEndTime??s.endTime:s.viEndTime??s.endTime;
  const isolated={...original,subtitles:[{...s,startTime:a,endTime:b}],audioClips:[],manualTimeline:true};
  const edited=editTimeline(isolated,{...e,track:'subtitle',linked:false});
  const timing=(c:Subtitle)=>lang==='zh'?{zhStartTime:c.startTime,zhEndTime:c.endTime}:{viStartTime:c.startTime,viEndTime:c.endTime};
  if(e.kind==='delete')return deleteTimelineSelection(original,[{track:lang,id:s.id}],false);
  if(e.kind==='split'||e.kind==='duplicate'){
   const parts=edited.subtitles.filter(c=>e.kind==='split'||c.id!==s.id).map(c=>({...c,id:crypto.randomUUID(),ttsAudioUrl:undefined,ttsDuration:undefined,...timing(c),hiddenZh:lang!=='zh',hiddenVi:lang!=='vi'}));
   return validateTimeline({...original,audioClips:projectClips(original),subtitles:[...original.subtitles.map(c=>c.id===s.id&&e.kind==='split'?{...c,...(lang==='zh'?{hiddenZh:true}:{hiddenVi:true})}:c),...parts]});
  }
  return validateTimeline({...original,audioClips:projectClips(original),subtitles:original.subtitles.map(c=>c.id===s.id?{...c,...timing(edited.subtitles[0])}:c)});
 }
 const p={...original,manualTimeline:true,subtitles:timelineSubtitles(original).map(s=>({...s})),audioClips:projectClips(original).map(c=>({...c}))};const clips=p.audioClips;const makeId=()=>crypto.randomUUID();
 const splitSub=(s:Subtitle,t:number)=>{if(t-s.startTime<.04||s.endTime-t<.04)throw Error('Đặt vạch phát bên trong đoạn để cắt.');const f=(t-s.startTime)/(s.endTime-s.startTime);function text(v:string){const a=[...v.trim()];let k=Math.max(1,Math.min(a.length-1,Math.round(a.length*f)));const words=[...v.matchAll(/\s+|[，。！？、,.!?;]/gu)].map(m=>m.index!+m[0].length).filter(i=>i>0&&i<v.length);if(words.length)k=words.reduce((x,y)=>Math.abs(y-v.length*f)<Math.abs(x-v.length*f)?y:x);else k=a.slice(0,k).join('').length;return [v.slice(0,k).trim(),v.slice(k).trim()];}const zh=text(s.textZh),vi=text(s.textVi||'');return [{...s,endTime:t,textZh:zh[0],textVi:s.textVi?vi[0]:undefined},{...s,id:makeId(),startTime:t,textZh:zh[1],textVi:s.textVi?vi[1]:undefined}];};
 const splitAudio=(c:TimelineAudioClip,t:number,secondSub?:string)=>{if(t<=c.startTime+.039)return [{...c,subtitleId:secondSub??c.subtitleId}];if(audioEnd(c)-t<.04)return [c];const cut=c.trimStart+t-c.startTime;return [{...c,trimEnd:cut},{...c,id:makeId(),subtitleId:secondSub??c.subtitleId,startTime:t,trimStart:cut}];};
 if(e.track==='subtitle'){
  const s=p.subtitles.find(s=>s.id===e.id);if(!s)return original;const associated=clips.filter(c=>c.subtitleId===s.id);const start=s.startTime,end=s.endTime;
  if(e.kind==='move'){const delta=round(Math.max(0,e.time)-start);s.startTime=round(start+delta);s.endTime=round(end+delta);if(e.linked)for(const c of associated)c.startTime=round(c.startTime+delta);}
  if(e.kind==='left')s.startTime=round(Math.max(0,Math.min(e.time,end-.04)));
  if(e.kind==='right')s.endTime=round(Math.max(start+.04,e.time));
  if((e.kind==='left'||e.kind==='right')&&e.linked){p.audioClips=clips.flatMap(c=>{if(c.subtitleId!==s.id)return [c];const base=c.startTime-c.trimStart,a=Math.max(s.startTime,base),b=Math.min(s.endTime,base+c.sourceDuration);return b-a<.04?[]:[{...c,startTime:round(a),trimStart:round(a-base),trimEnd:round(b-base)}]});}
  if(e.kind==='split'){const parts=splitSub(s,e.time);p.subtitles=p.subtitles.flatMap(x=>x.id===s.id?parts:[x]);if(e.linked)p.audioClips=clips.flatMap(c=>c.subtitleId===s.id?splitAudio(c,e.time,parts[1].id):[c]);}
  if(e.kind==='delete'){p.subtitles=p.subtitles.filter(x=>x.id!==s.id);if(e.linked)p.audioClips=clips.filter(c=>c.subtitleId!==s.id);}
  if(e.kind==='duplicate'){const copy={...s,id:makeId(),startTime:end,endTime:end+end-start};p.subtitles.push(copy);if(e.linked)for(const c of associated)clips.push({...c,id:makeId(),subtitleId:copy.id,startTime:c.startTime+end-start});}
 }else{
  const c=clips.find(c=>c.id===e.id);if(!c)return original;const start=c.startTime,end=audioEnd(c);const s=p.subtitles.find(s=>s.id===c.subtitleId);
  if(e.kind==='move'){const delta=round(Math.max(0,e.time)-start);c.startTime=round(start+delta);if(e.linked&&s){s.startTime=round(s.startTime+delta);s.endTime=round(s.endTime+delta);for(const other of clips)if(other!==c&&other.subtitleId===s.id)other.startTime=round(other.startTime+delta);}}
  if(e.kind==='left'){const t=Math.max(0,start-c.trimStart,Math.min(e.time,end-.04));c.trimStart=round(c.trimStart+t-start);c.startTime=round(t);}
  if(e.kind==='right')c.trimEnd=round(Math.max(c.trimStart+.04,Math.min(c.sourceDuration,c.trimStart+e.time-start)));
  if((e.kind==='left'||e.kind==='right')&&e.linked&&s){s.startTime=round(s.startTime+c.startTime-start);s.endTime=round(s.endTime+audioEnd(c)-end);}
  if(e.kind==='split'){if(e.time<=start+.039||e.time>=end-.039)throw Error('Đặt vạch phát bên trong đoạn để cắt.');let subId:string|undefined;if(e.linked&&s&&e.time>s.startTime+.039&&e.time<s.endTime-.039){const parts=splitSub(s,e.time);p.subtitles=p.subtitles.flatMap(x=>x.id===s.id?parts:[x]);subId=parts[1].id;}p.audioClips=clips.flatMap(x=>x.id===c.id?splitAudio(x,e.time,subId):[x]);}
  if(e.kind==='delete'){p.audioClips=clips.filter(x=>x.id!==c.id);if(e.linked&&s){p.subtitles=p.subtitles.filter(x=>x.id!==s.id);p.audioClips=p.audioClips.filter(x=>x.subtitleId!==s.id);}}
  if(e.kind==='duplicate'){let subId:string|undefined;if(e.linked&&s){subId=makeId();p.subtitles.push({...s,id:subId,startTime:s.startTime+end-start,endTime:s.endTime+end-start});}clips.push({...c,id:makeId(),subtitleId:subId,startTime:round(end)});}
  if(e.kind==='mute')c.muted=!c.muted;
  if(e.kind==='volume')c.volume=Math.max(0,Math.min(2,e.time));
 }
 p.subtitles.sort((a,b)=>a.startTime-b.startTime);return validateTimeline(p);
}
