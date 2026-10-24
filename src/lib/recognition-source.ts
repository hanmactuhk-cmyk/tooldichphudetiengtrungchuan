import {ProjectData,VisualClip,Subtitle} from '../types';
import {orderedVisuals} from './visual-engine';
import {runJob,apiJson} from './jobs';
import {readVideo} from './video-source';
export type RecognitionPart={url:string;sourceStart:number;duration:number;rate:number;offset:number;sourceClipId?:string};
export function recognitionParts(p:ProjectData,selectedId?:string):RecognitionPart[]{
 const selected=p.visuals?.find(c=>c.id===selectedId&&c.kind==='video');
 const part=(c:VisualClip,a=c.startTime,b=c.endTime)=>({url:p.visuals?.find(v=>v.id===c.id)?.url||c.url!,sourceStart:c.sourceStart+(a-c.startTime)*(c.rate||1),duration:b-a,rate:c.rate||1,offset:a,sourceClipId:c.id});
 if(selected?.url)return [part(selected)];
 if(!p.videoEdited)return p.videoUrl?[{url:p.videoUrl,sourceStart:0,duration:p.duration,rate:1,offset:0}]:[];
 let videos=orderedVisuals(p.visuals||[],p.visualTracks).filter(c=>c.kind==='video'&&c.enabled&&c.url&&c.endTime>c.startTime);
 const primary=videos.filter(c=>c.trackId==='base-video'||c.trackId?.startsWith('edit-video-'));if(primary.length)videos=primary;
 const boundaries=[...new Set(videos.flatMap(c=>[c.startTime,c.endTime]))].sort((a,b)=>a-b),result:RecognitionPart[]=[];
 for(let i=0;i<boundaries.length-1;i++){const a=boundaries[i],b=boundaries[i+1],c=videos.filter(c=>c.startTime<=a&&c.endTime>=b).at(-1);if(!c)continue;const prev=result.at(-1);if(prev?.sourceClipId===c.id&&Math.abs(prev.offset+prev.duration-a)<.001)prev.duration=b-prev.offset;else result.push(part(c,a,b));}
 return result;
}
export async function recognizeProject(p:ProjectData,mode:'speech'|'ocr',cropTop:number,progress:(p:number,t:string)=>void,selectedId?:string):Promise<Subtitle[]>{
 const parts=recognitionParts(p,selectedId);if(!parts.length)throw Error('Không có đoạn video đang bật để nhận diện.');
 const total=parts.reduce((n,c)=>n+c.duration,0);let elapsed=0;const cues:Subtitle[]=[];
 for(let i=0;i<parts.length;i++){const part=parts[i];let url=part.url;if(!url.startsWith('/cache/')){progress(elapsed/total*100,'Đang chuẩn bị video nguồn…');const form=new FormData();form.append('file',await readVideo(url),'source.mp4');url=(await apiJson('/api/media/import',{method:'POST',body:form})).url;}const result=await runJob('/api/asr-job',{url,mode,cropTop,sourceStart:part.sourceStart,duration:part.duration,rate:part.rate,allowEmpty:true},(percent,text)=>progress((elapsed+part.duration*percent/100)/total*100,`Đoạn ${i+1}/${parts.length} · ${text}`));
 for(const cue of result.subtitles||[]){const a=Math.max(0,Math.min(part.duration,cue.startTime)),b=Math.min(part.duration,cue.endTime);if(b-a>=.04)cues.push({...cue,id:`recognition-${i}-${cue.id}`,startTime:a+part.offset,endTime:b+part.offset,sourceClipId:part.sourceClipId});}elapsed+=part.duration;}
 if(!cues.length)throw Error(mode==='ocr'?'Không tìm thấy chữ Trung trong vùng quét. Hãy kiểm tra video và chiều cao vùng OCR.':'Không tìm thấy lời nói tiếng Trung. Nếu video chỉ có chữ, hãy dùng Quét chữ phụ đề (OCR).');
 return cues;
}
