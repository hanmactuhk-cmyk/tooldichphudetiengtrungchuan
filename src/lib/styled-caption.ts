import bundledFonts from './bundled-fonts.json';
import {CaptionLayout,ProjectData,Subtitle,VideoDecoration} from '../types';
export const FONTS=[...bundledFonts,'Arial','Segoe UI','Segoe UI Semibold','Segoe UI Black','Segoe UI Light','Segoe UI Semilight','Tahoma','Calibri','Calibri Light','Cambria','Candara','Candara Light','Constantia','Corbel','Corbel Light','Consolas','Courier New','Times New Roman','Verdana','Palatino Linotype'];
export const DEFAULT_DECORATION:VideoDecoration={enabled:false,topText:'TIÊU ĐỀ VIDEO',bottomText:'Hoài Nguyễn Studio',topHeight:.08,bottomHeight:.08,backgroundColor:'#facc15',textColor:'#111111',fontFamily:'Arial',fontSize:3.5,overlays:[]};
let canvas:HTMLCanvasElement|undefined;
export function captionBox(text:string,w:number,layout:CaptionLayout){
 let size=w*layout.fontSize/100;const pad=w*.012,max=Math.max(1,w*layout.width/100-pad*2);
 const context=typeof document!=='undefined'?(canvas??=document.createElement('canvas')).getContext('2d'):null;
 const setFont=()=>{if(context)context.font=`${layout.italic?'italic ':''}${layout.bold===false?400:700} ${size}px "${layout.fontFamily||'Arial'}"`;};setFont();
 const measure=(s:string)=>context?.measureText(s).width??[...s].length*size*.55;
 // A long unbroken word scales the box down instead of splitting that word.
 const longest=Math.max(1,...(text.match(/\S+/gu)||[]).map(measure));if(longest>max){size*=max/longest;setFont();}
 const lines:string[]=[];for(const paragraph of text.split('\n')){let line='';for(const token of paragraph.match(/\S+\s*|\s+/gu)||['']){if(measure(line+token.trimEnd())>max&&line.trim()){lines.push(line.trim());line='';}line+=token;}lines.push(line.trim());}
 let cursor=0;const lineStarts=lines.map(line=>{const at=line?text.indexOf(line,cursor):cursor;cursor=Math.max(cursor,at+line.length);return Math.max(0,at);});
 return {lines,lineStarts,size,pad,width:Math.min(w*layout.width/100,Math.max(...lines.map(measure),1)+2*pad),height:lines.length*size*1.28+2*pad,lineHeight:size*1.28};
}

export function visibleCue(c:Subtitle,lang:'zh'|'vi',dub:boolean){return {text:lang==='zh'?(c.hiddenZh?'':c.textZh):(c.hiddenVi?'':c.textVi||''),start:lang==='zh'?c.zhStartTime??(dub?c.dubStartTime??c.startTime:c.startTime):c.viStartTime??(dub?c.dubStartTime??c.startTime:c.startTime),end:lang==='zh'?c.zhEndTime??(dub?c.dubEndTime??c.endTime:c.endTime):c.viEndTime??(dub?c.dubEndTime??c.endTime:c.endTime)};}
export function outputFrame(p:ProjectData){const w=p.videoWidth||1920,h=p.videoHeight||1080,a=p.captionLayout?.aspect||'auto',ratio=a==='16:9'?16/9:a==='9:16'?9/16:w/h;return {w,h,ow:Math.ceil(Math.max(w,h*ratio)/2)*2,oh:Math.ceil(Math.max(h,w/ratio)/2)*2};}
export function rgba(hex:string,opacity:number){const v=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#000000';return `rgba(${parseInt(v.slice(1,3),16)},${parseInt(v.slice(3,5),16)},${parseInt(v.slice(5,7),16)},${opacity})`;}

export function placeCaptions(items:{cue:Subtitle;lang:'vi'|'zh';text:string}[],w:number,h:number,layout:CaptionLayout,bounds={top:0,bottom:h}){
 const measured=items.map(i=>{const style={...layout,...i.cue.captionStyle};return {...i,style,box:captionBox(i.text,w,style)};});const total=measured.reduce((n,i)=>n+i.box.height,0),anchor=items[0]?.cue.position||layout.position;const center=Math.max(bounds.top+total/2,Math.min(bounds.bottom-total/2,anchor.y*h));let offset=-total/2;
 return measured.map(i=>{const x=Math.max(i.box.width/2,Math.min(w-i.box.width/2,anchor.x*w)),y=center+offset+i.box.height/2;offset+=i.box.height;return {...i,x,y};});
}

export function roundedRectPath(w:number,h:number,radius:number){const r=Math.min(w,h)*Math.max(0,Math.min(.5,radius)),k=.55228475*r;return `m ${r} 0 l ${w-r} 0 b ${w-r+k} 0 ${w} ${r-k} ${w} ${r} l ${w} ${h-r} b ${w} ${h-r+k} ${w-r+k} ${h} ${w-r} ${h} l ${r} ${h} b ${r-k} ${h} 0 ${h-r+k} 0 ${h-r} l 0 ${r} b 0 ${r-k} ${r-k} 0 ${r} 0`;}
export function coloredCharacters(line:string,start:number,colors?:Record<number,string>){let offset=start;return Array.from(line).map(text=>{const index=offset;offset+=text.length;return {text,index,color:colors?.[index]};});}

export const fontOptions=(current?:string)=>current&&!FONTS.includes(current)?[current,...FONTS]:FONTS;

export function assFontSize(size:number,style:CaptionLayout){const context=typeof document!=='undefined'?(canvas??=document.createElement('canvas')).getContext('2d'):null;if(!context)return size;context.font=`${style.italic?'italic ':''}${style.bold===false?400:700} 1000px "${style.fontFamily||'Arial'}"`;const metrics=context.measureText('Ấg');const height=metrics.fontBoundingBoxAscent+metrics.fontBoundingBoxDescent;return size*(Number.isFinite(height)&&height>0?height/1000:1);}
