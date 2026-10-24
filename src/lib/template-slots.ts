import {ProjectData,TemplateRole,VisualClip} from '../types';
import {visualTracks} from './visual-engine';

export function templateRole(c:VisualClip):TemplateRole|undefined {
  if(c.templateRole)return c.templateRole;
  if(c.template&&c.name.startsWith('Nền trên ·'))return 'top';
  if(c.template&&c.name.startsWith('Nền dưới ·'))return 'bottom';
  if(c.kind==='blur'&&c.name==='Mờ nền trên')return 'blur';
  if(c.kind==='text'&&c.name==='Tên kênh')return 'channel';
  if(c.kind==='text'&&c.name==='Tiêu đề')return 'title';
}

// A preset owns five slots. Reapply replaces content, retaining edited timing and rows.
export function replaceTemplate(p:ProjectData,incoming:VisualClip[]) {
  const clips=p.visuals||[],hasLegacy=clips.some(c=>c.template||c.templateRole);
  const managed=clips.filter(c=>c.templateRole||(hasLegacy&&templateRole(c)));
  const next=incoming.flatMap(c=>{
    const explicit=managed.filter(v=>v.templateRole===c.templateRole);
    const legacy=[...managed].reverse().find(v=>!v.templateRole&&templateRole(v)===c.templateRole);
    const matches=explicit.length?explicit:legacy?[legacy]:[];
    if(!matches.length)return [{...c,trackId:'template-'+c.templateRole}];
    return matches.map(old=>{
      const geometry=old.templateLayout===c.templateLayout&&old.templateBandHeight===c.templateBandHeight?{x:old.x,y:old.y,width:old.width,height:old.height,keyframes:old.keyframes}:{};
      return {...c,...geometry,id:old.id,trackId:old.trackId||'track-'+old.id,startTime:old.startTime,endTime:old.endTime};
    });
  });
  const visuals=[...clips.filter(c=>!managed.includes(c)),...next];
  const used=new Set(visuals.map(c=>c.trackId||'track-'+c.id));
  const oldRows=new Set(managed.map(c=>c.trackId||'track-'+c.id));
  const tracks=visualTracks(visuals,visualTracks(clips,p.visualTracks).filter(t=>!oldRows.has(t.id)||used.has(t.id))).map(t=>{const old=managed.find(c=>(c.trackId||'track-'+c.id)===t.id&&c.name===t.name),updated=old&&next.find(c=>c.id===old.id);return updated?{...t,name:updated.name}:t});
  return {...p,visuals,visualTracks:tracks,decoration:p.decoration?{...p.decoration,enabled:false}:p.decoration};
}
