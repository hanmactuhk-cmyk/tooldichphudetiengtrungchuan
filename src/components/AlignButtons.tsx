import React from 'react';
import {AlignLeft,AlignCenter,AlignRight} from 'lucide-react';
export type TextAlign='left'|'center'|'right';
export function AlignButtons({value='center',onChange,disabled=false,label='Căn chữ'}:{value?:TextAlign;onChange:(v:TextAlign)=>void;disabled?:boolean;label?:string}) {
 return <div role="group" aria-label={label} className="align-buttons">{([['left','Căn trái',AlignLeft],['center','Căn giữa',AlignCenter],['right','Căn phải',AlignRight]] as const).map(([id,title,Icon])=><button key={id} type="button" title={title} aria-label={label+' · '+title} aria-pressed={value===id} disabled={disabled} onClick={()=>onChange(id)}><Icon size={17}/></button>)}</div>;
}
