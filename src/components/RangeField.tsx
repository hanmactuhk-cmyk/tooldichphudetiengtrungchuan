import React from 'react';
export function RangeField({label,value,min=0,max=100,step=1,onChange,disabled=false,unit=''}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(n:number)=>void;disabled?:boolean;unit?:string}) {
 return <label className="range-field"><span>{label}<output>{Number(value.toFixed(3))}{unit}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>onChange(+e.target.value)}/></label>;
}
