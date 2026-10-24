import React,{useRef,useState} from 'react';
import {MediaAsset} from '../types';
import {PropertySection} from './PropertySection';
export const MEDIA_DRAG='application/x-hnstudio-media';
export function MediaLibrary({items,busy,onImport,onInsert,onRemove}:{items:MediaAsset[];busy:boolean;onImport:(f:File[])=>Promise<void>;onInsert:(id:string)=>void;onRemove:(id:string)=>void}) {
  const input=useRef<HTMLInputElement>(null),[filter,setFilter]=useState('all'),[search,setSearch]=useState(''),[note,setNote]=useState('');
  const load=async(files:File[])=>{try{setNote('');await onImport(files)}catch(e){setNote(String(e))}};
  return <div className="media-library" onDragOver={e=>{if(e.dataTransfer.types.includes('Files'))e.preventDefault()}} onDrop={e=>{if(e.dataTransfer.files.length){e.preventDefault();load(Array.from(e.dataTransfer.files))}}}>
    <PropertySection title="Thư viện dự án"><button className="primary-action" disabled={busy} onClick={()=>input.current?.click()}>↥ Nhập video / ảnh</button><input ref={input} aria-label="Nhập media vào thư viện" type="file" multiple hidden accept="video/*,image/png,image/jpeg,image/webp" onChange={e=>{load(Array.from(e.target.files||[]));e.target.value=''}}/><p>Nhập một lần, kéo xuống hàng và thời điểm cần dùng. Nhập tệp chưa tạo ô trên timeline.</p><input aria-label="Tìm media" placeholder="Tìm theo tên…" value={search} onChange={e=>setSearch(e.target.value)}/><nav className="segment-menu">{[['all','Tất cả'],['video','Video'],['image','Ảnh']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</nav></PropertySection>
    <div className="media-grid">{items.filter(a=>(filter==='all'||a.kind===filter)&&a.name.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(a=><article key={a.id} className="media-card" data-media-asset={a.id} draggable={!busy} onDragStart={e=>{e.dataTransfer.setData(MEDIA_DRAG,a.id);e.dataTransfer.effectAllowed='copy'}} onDoubleClick={()=>onInsert(a.id)}>
      <div className="asset-thumbnail">{a.kind==='image'?<img src={a.url} alt={a.name} draggable={false}/>:<video src={a.url+'#t=0.1'} muted preload="metadata"/>}<span>{a.kind==='video'?'▶ '+a.duration.toFixed(1)+'s':'▧ Ảnh'}</span></div><b title={a.name}>{a.name}</b><div className="flex gap-1"><button disabled={busy} aria-label={'Thêm '+a.name+' vào timeline'} onClick={()=>onInsert(a.id)}>＋ Dùng</button><button aria-label={'Bỏ '+a.name+' khỏi thư viện'} title="Chỉ bỏ khỏi thư viện, giữ các ô đang dùng" onClick={()=>onRemove(a.id)}>×</button></div>
    </article>)}</div>{!items.length&&<div className="empty-library">▧<p>Thả video hoặc ảnh vào đây</p></div>}{note&&<p role="status">{note}</p>}
  </div>;
}
