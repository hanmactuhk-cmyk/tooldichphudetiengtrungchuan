import {ProjectData,MediaAsset,VisualClip} from '../types';
import {visualTracks} from './visual-engine';
export function insertLibraryAsset(p:ProjectData,asset:MediaAsset,start:number,trackId?:string) {
  if(!p.videoUrl&&asset.kind!=='video')throw Error('Đưa một video vào timeline trước khi thêm ảnh phủ.');
  const first=!p.videoUrl,at=first?0:Math.max(0,start),id=crypto.randomUUID();
  const row=trackId||(first?'base-video':'library-overlays');
  const clip:VisualClip={id,assetId:asset.id,trackId:row,kind:asset.kind,name:asset.name,url:asset.url,nativeWidth:asset.width,nativeHeight:asset.height,startTime:at,endTime:at+(asset.kind==='video'?asset.duration:5),sourceStart:0,sourceDuration:asset.duration||5,x:asset.kind==='image'?.25:0,y:asset.kind==='image'?.25:0,width:asset.kind==='image'?.5:1,height:asset.kind==='image'?.5:1,opacity:1,enabled:true,keyframes:[]};
  const visuals=[...(p.visuals||[]),clip],tracks=visualTracks(p.visuals||[],p.visualTracks);
  if(!tracks.some(t=>t.id===row))tracks.push({id:row,name:first?'Video gốc':'Lớp phủ thư viện',enabled:true});
  const project={...p,visuals,visualTracks:tracks,videoEdited:true,...(first?{videoUrl:asset.url,videoFileName:asset.name,videoWidth:asset.width,videoHeight:asset.height,duration:asset.duration,title:asset.name.replace(/\.[^.]+$/,'')}: {})};
  return {project,clip};
}
