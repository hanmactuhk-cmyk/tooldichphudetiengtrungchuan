import React from 'react';
import {ProjectData,TextTarget} from '../types';
import {PropertySection} from './PropertySection';
export function TemplateParts({project:p,onProject,onSelect}:{project:ProjectData;onProject:(fn:(p:ProjectData)=>ProjectData)=>void;onSelect:(id:string,isText:boolean)=>void}){
 const clips=(p.visuals||[]).filter(c=>c.templateRole&&c.templateRole!=='date');if(!clips.length)return null;
 return <PropertySection title="Thành phần trong bộ khung"><p>Cả bộ dùng một hàng timeline. Chọn từng phần để chỉnh; bật/tắt ngay tại đây.</p>{clips.map(c=><div key={c.id} className="template-part-row"><input type="checkbox" aria-label={'Bật '+c.name} checked={c.enabled} onChange={e=>onProject(p=>({...p,visuals:p.visuals?.map(v=>v.id===c.id?{...v,enabled:e.target.checked}:v)}))}/><button onClick={()=>onSelect(c.id,c.kind==='text')}>{c.name}</button></div>)}</PropertySection>;
}
