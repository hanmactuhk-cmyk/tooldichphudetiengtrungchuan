import {CaptionLayout,ProjectData,Subtitle,VideoDecoration} from '../types';
export const FONTS=['Arial','Segoe UI','Tahoma','Calibri','Georgia','Times New Roman','Consolas'];
export const DEFAULT_DECORATION:VideoDecoration={enabled:false,topText:'TIÊU ĐỀ VIDEO',bottomText:'Hoài Nguyễn Studio',topHeight:.08,bottomHeight:.08,backgroundColor:'#facc15',textColor:'#111111',fontFamily:'Arial',fontSize:3.5,overlays:[]};
let canvas:HTMLCanvasElement|undefined;
export function captionBox(text:string,w:number,layout:CaptionLayout){
 const size=w*layout.fontSize/100,pad=w*.012,max=w*layout.width/100-pad*2;
 const context=typeof document!=='undefined'?(canvas??=document.createElement('canvas')).getContext('2d'):null;
 if(context)context.font=`700 ${size}px "${layout.fontFamily||'Arial'}"`;
 const measure=(s:string)=>context?.measureText(s).width??[...s].length*size*.55;
 const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const token of paragraph.match(/\S+\s*|\s+/gu)||['']){if(measure(line+token)>max&&line.trim()){lines.push(line.trim());line='';}if(measure(token)>max){for(const ch of token){if(measure(line+ch)>max&&line){lines.push(line.trim());line='';}line+=ch;}}else line+=token;}lines.push(line.trim());}
 return {lines,size,pad,width:Math.min(w*layout.width/100,Math.max(...lines.map(measure),1)+2*pad),height:lines.length*size*1.28+2*pad,lineHeight:size*1.28};
}
export function visibleCue(c:Subtitle,lang:'zh'|'vi',dub:boolean){return {text:lang==='zh'?(c.hiddenZh?'':c.textZh):(c.hiddenVi?'':c.textVi||''),start:lang==='zh'?c.zhStartTime??(dub?c.dubStartTime??c.startTime:c.startTime):c.viStartTime??(dub?c.dubStartTime??c.startTime:c.startTime),end:lang==='zh'?c.zhEndTime??(dub?c.dubEndTime??c.endTime:c.endTime):c.viEndTime??(dub?c.dubEndTime??c.endTime:c.endTime)};}
export function outputFrame(p:ProjectData){const w=p.videoWidth||1920,h=p.videoHeight||1080,a=p.captionLayout?.aspect||'auto',ratio=a==='16:9'?16/9:a==='9:16'?9/16:w/h;return {w,h,ow:Math.ceil(Math.max(w,h*ratio)/2)*2,oh:Math.ceil(Math.max(h,w/ratio)/2)*2};}
export function rgba(hex:string,opacity:number){const v=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#000000';return `rgba(${parseInt(v.slice(1,3),16)},${parseInt(v.slice(3,5),16)},${parseInt(v.slice(5,7),16)},${opacity})`;}

export function placeCaptions(items:{cue:Subtitle;lang:'vi'|'zh';text:string}[],w:number,h:number,layout:CaptionLayout){
 const measured=items.map(i=>({...i,box:captionBox(i.text,w,layout)}));const total=measured.reduce((n,i)=>n+i.box.height,0),anchor=items[0]?.cue.position||layout.position;const center=Math.max(total/2,Math.min(h-total/2,anchor.y*h));let offset=-total/2;
 return measured.map(i=>{const x=Math.max(i.box.width/2,Math.min(w-i.box.width/2,anchor.x*w)),y=center+offset+i.box.height/2;offset+=i.box.height;return {...i,x,y};});
}
