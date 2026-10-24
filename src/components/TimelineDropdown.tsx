import React,{useEffect,useRef,useState} from 'react';
import {ClipContextMenu} from './ClipContextMenu';
export function TimelineDropdown({label,children}:{label:string;children:React.ReactNode}){
 const anchor=useRef<HTMLButtonElement>(null),[at,setAt]=useState<{x:number;y:number}|null>(null);
 useEffect(()=>{if(!at)return;const close=(e:Event)=>{if(!(e.target as HTMLElement).closest('[data-clip-context]')&&!anchor.current?.contains(e.target as Node))setAt(null)};const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAt(null);anchor.current?.focus()}};window.addEventListener('pointerdown',close);window.addEventListener('keydown',key);return()=>{window.removeEventListener('pointerdown',close);window.removeEventListener('keydown',key)}},[at]);
 return <><button ref={anchor} aria-expanded={!!at} aria-haspopup="menu" className="timeline-dropdown-trigger" onClick={()=>{const r=anchor.current!.getBoundingClientRect();setAt(at?null:{x:r.left,y:r.bottom+4})}}>{label} ▾</button>{at&&<ClipContextMenu x={at.x} y={at.y} label={'Menu '+label} onClose={()=>setAt(null)}><div className="grid gap-2" onClick={e=>{const b=(e.target as HTMLElement).closest('button');if(b&&!b.disabled)setAt(null)}}>{children}</div></ClipContextMenu>}</>;
}
