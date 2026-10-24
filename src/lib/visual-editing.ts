import {VisualClip} from '../types';
import {moveVisual} from './visual-engine';
import {TEMPLATE_TRACK} from './template-bundle';

export function snapVisualTime(value:number,duration:number,points:number[],pixelsPerSecond:number){
 let result=value,nearest=8/Math.max(.1,pixelsPerSecond);
 for(const point of points)for(const candidate of [point,point-duration]){
  const distance=Math.abs(candidate-value);
  if(candidate>=0&&distance<nearest){result=candidate;nearest=distance;}
 }
 return Math.max(0,result);
}
export function moveVisualToTrack(clips:VisualClip[],id:string,trackId:string,start?:number){
 const clip=clips.find(c=>c.id===id);
 if(!clip||clip.templateRole||trackId===TEMPLATE_TRACK)return clips;
 return clips.map(c=>c.id===id?{...(start===undefined?c:moveVisual(c,start)),trackId}:c);
}
