import {ProjectData,VisualClip} from '../types';
import {templateRole} from './template-slots';
import {moveVisual,splitVisual,visualTracks} from './visual-engine';
export const TEMPLATE_TRACK='template-set';
export function normalizeTemplateBundle(p:ProjectData):ProjectData {
 const all=p.visuals||[],legacy=all.some(c=>c.template||c.templateRole),old=all.filter(c=>c.templateRole||(legacy&&templateRole(c)));
 if(!old.length)return p;
 const oldIds=new Set(old.map(c=>c.trackId||'track-'+c.id));
 const visuals=all.filter(c=>templateRole(c)!=='date').map(c=>old.includes(c)?{...c,templateRole:templateRole(c),enabled:c.enabled&&(p.visualTracks?.find(t=>t.id===(c.trackId||'track-'+c.id))?.enabled!==false),trackId:TEMPLATE_TRACK,templateGroup:c.templateGroup||'main',textStyle:templateRole(c)==='channel'&&!c.templateGroup?{...c.textStyle!,align:'center' as const}:c.textStyle}:c);
 const used=new Set(visuals.map(c=>c.trackId||'track-'+c.id));
 const tracks=visualTracks(visuals,visualTracks(all,p.visualTracks).filter(t=>!oldIds.has(t.id)||used.has(t.id))).map(t=>t.id===TEMPLATE_TRACK?{...t,enabled:true,name:'Khung kênh · Nền / Tiêu đề'}:t);
 return {...p,visuals,visualTracks:tracks};
}
export type TimelineVisual=VisualClip&{members?:string[]};
export function timelineVisuals(clips:VisualClip[]):TimelineVisual[]{
 const groups=new Map<string,VisualClip[]>(),result:TimelineVisual[]=[];
 for(const c of clips){if(c.templateRole){const id=c.templateGroup||'main';groups.set(id,[...(groups.get(id)||[]),c])}else result.push(c)}
 for(const [id,children] of groups)result.push({...children[0],id:'bundle:'+id,kind:'image',name:'Khung kênh · Nền / Tiêu đề',startTime:Math.min(...children.map(c=>c.startTime)),endTime:Math.max(...children.map(c=>c.endTime)),enabled:children.some(c=>c.enabled),members:children.map(c=>c.id),keyframes:[]});
 return result;
}
export function visualSelection(clips:VisualClip[],id:string|null){return timelineVisuals(clips).find(c=>c.id===id||c.members?.includes(id||''))}
export function editVisuals(clips:VisualClip[],id:string,kind:string,time:number):VisualClip[]{
 const selected=visualSelection(clips,id);if(!selected)return clips;
 const ids=new Set(selected.members||[selected.id]),delta=time-selected.startTime,group=crypto.randomUUID();
 if(kind==='split'&&(time<=selected.startTime+.04||time>=selected.endTime-.04))throw Error('Đặt vạch phát bên trong ô cần cắt.');
 return clips.flatMap(c=>{
  if(!ids.has(c.id))return [c];
  if(kind==='delete')return [];
  if(kind==='move')return [moveVisual(c,c.startTime+Math.max(-selected.startTime,delta))];
  if(kind==='duplicate')return [c,moveVisual({...c,id:crypto.randomUUID(),templateGroup:c.templateRole?group:undefined},c.startTime+selected.endTime-selected.startTime)];
  if(kind==='split'){
   if(c.endTime<=time)return [c];
   if(c.startTime>=time)return [{...c,templateGroup:c.templateRole?group:undefined}];
   const [left,right]=splitVisual(c,time);return [left,{...right,templateGroup:c.templateRole?group:undefined}];
  }
  if(kind==='left'){if(c.endTime<=time)return [];const start=c.startTime===selected.startTime?time:Math.max(c.startTime,time);return [{...c,startTime:start,sourceStart:c.sourceStart+(c.kind==='video'?(start-c.startTime)*(c.rate||1):0)}]}
  if(kind==='right'){if(c.startTime>=time)return [];return [{...c,endTime:c.endTime===selected.endTime?time:Math.min(c.endTime,time)}]}
  return [c];
 });
}
