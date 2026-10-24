import React,{useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
export function ClipContextMenu({x,y,children,onClose}:{x:number;y:number;children:React.ReactNode;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null),[pos,setPos]=useState<{left:number;top:number}|null>(null);
 useLayoutEffect(()=>{const el=ref.current;if(!el)return;const place=()=>{const r=el.getBoundingClientRect();setPos({left:Math.max(8,Math.min(x,window.innerWidth-r.width-8)),top:Math.max(8,Math.min(y,window.innerHeight-r.height-8))})};place();const observer=new ResizeObserver(place);observer.observe(el);window.addEventListener('resize',place);return()=>{observer.disconnect();window.removeEventListener('resize',place)}},[x,y]);
 return createPortal(<div ref={ref} data-clip-context role="menu" aria-label="Menu clip" className="clip-context" style={{left:pos?.left??x,top:pos?.top??y,visibility:pos?'visible':'hidden',maxWidth:'calc(100vw - 16px)',maxHeight:'calc(100dvh - 16px)',overflowY:'auto',zIndex:10000}} onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape')onClose()}}>{children}</div>,document.querySelector('.hn-studio')||document.body);
}
