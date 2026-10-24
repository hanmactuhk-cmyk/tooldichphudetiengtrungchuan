import {motionAt} from './text-motion';
import {captionBox,assFontSize,placeCaptions,roundedRectPath,coloredCharacters,visibleCue,outputFrame,DEFAULT_DECORATION} from './styled-caption';
import {CaptionLayout,Subtitle,ProjectData} from '../types';
export const DEFAULT_CAPTION_LAYOUT:CaptionLayout={aspect:'auto',position:{x:.5,y:.86},width:90,fontSize:4,bold:true,italic:false,cornerRadius:.2,fontFamily:'Arial',textColor:'#ffffff',backgroundColor:'#000000',backgroundOpacity:.75,language:'vi'};
export function splitText(text:string):[string,string]{
 const value=text.trim();if(!value)return ['',''];
 const middle=value.length/2;const boundaries=[...value.matchAll(/[，。！？、；,.!?;]\s*|\s+/gu)].map(m=>m.index!+m[0].length).filter(i=>i>0&&i<value.length);
 const index=boundaries.length?boundaries.reduce((a,b)=>Math.abs(b-middle)<Math.abs(a-middle)?b:a):[...value].slice(0,Math.ceil([...value].length/2)).join('').length;
 return [value.slice(0,index).trim(),value.slice(index).trim()];
}
export function splitCue(cue:Subtitle):Subtitle[]{
 if(cue.endTime-cue.startTime<.4)throw new Error('Câu quá ngắn để tách. Cần ít nhất 0,4 giây.');
 const zh=splitText(cue.textZh),vi=splitText(cue.textVi||'');
 if(!(vi[1]||zh[1]))throw new Error('Câu chỉ có một ký tự hoặc một từ quá ngắn để tách.');
 const basis=cue.textVi?vi:zh;const total=basis[0].length+basis[1].length;
 const fraction=Math.max(.2,Math.min(.8,basis[0].length/Math.max(1,total)));const middle=cue.startTime+(cue.endTime-cue.startTime)*fraction;
 return [0,1].map(i=>({...cue,id:cue.id+'-'+crypto.randomUUID(),textZh:zh[i],textVi:cue.textVi?vi[i]:undefined,startTime:i?middle:cue.startTime,endTime:i?cue.endTime:middle,ttsAudioUrl:undefined,ttsDuration:undefined,dubStartTime:undefined,dubEndTime:undefined,ttsShift:undefined,ttsFitSpeed:undefined,status:cue.textVi?'translated':'raw'}));
}
function stamp(t:number){const cs=Math.round(t*100);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;}
function safe(t:string){return t.replace(/\\/g,'\\').replace(/[{}]/g,'').replace(/\r?\n/g,'\\N');}
function assColor(hex:string,alpha=0){const h=/^#[0-9a-f]{6}$/i.test(hex)?hex:'#ffffff';return `&H${Math.round(alpha).toString(16).padStart(2,'0')}${h.slice(5,7)}${h.slice(3,5)}${h.slice(1,3)}&`;}
function styledLine(line:string,start:number,style:CaptionLayout){let color=style.textColor||'#ffffff';return coloredCharacters(line,start,style.characterColors).map(c=>{const next=c.color||style.textColor||'#ffffff',prefix=next!==color?`{\\1c${assColor(next)}}`:'';color=next;return prefix+safe(c.text);}).join('');}
export function generateAss(project:ProjectData){
 const {w,h,ow,oh}=outputFrame(project),layout={...DEFAULT_CAPTION_LAYOUT,...project.captionLayout};
 const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${ow}\nPlayResY: ${oh}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, Bold, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV\nStyle: Default,Arial,40,&H00FFFFFF,-1,1,0,0,5,0,0,0\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 const events:string[]=[];
 const event=(layer:number,a:number,b:number,tags:string,text:string)=>events.push(`Dialogue: ${layer},${stamp(a)},${stamp(b)},Default,,0,0,0,,{${tags}}${text}`);
 const rect=(layer:number,a:number,b:number,x:number,y:number,bw:number,bh:number,color:string,opacity:number,radius=0,extraTags='')=>{if(opacity<=0)return;event(layer,a,b,`\\an7\\pos(${x.toFixed(2)},${y.toFixed(2)})\\bord0\\shad0\\1c${assColor(color)}\\1a&H${Math.round((1-opacity)*255).toString(16).padStart(2,'0')}&\\p1${extraTags}`,roundedRectPath(bw,bh,radius));};
 const box=(text:string,a:number,b:number,x:number,y:number,width:number,style:CaptionLayout,layer=2,motionStart=a,motionEnd=b)=>{
  const m=captionBox(text,width,style),animated=!!style.motion&&Object.values(style.motion).some(p=>p&&p.effect!=='none'),step=animated?1/12:b-a;
  for(let t=a;t<b-.00001;t+=step){const end=Math.min(b,t+step),v=motionAt(style.motion,t,motionStart,motionEnd,text.length,text.split(/\s+/).length),xx=x+v.x*w,yy=y+v.y*h,scale=v.scale;

   const clip=v.reveal<1?`\\clip(${Math.round(xx-m.width*scale/2)},0,${Math.round(xx-m.width*scale/2+m.width*scale*v.reveal)},${oh})`:'';
   const opacity=(style.backgroundOpacity??.75)*v.opacity;rect(layer,t,end,xx-m.width*scale/2,yy-m.height*scale/2,m.width*scale,m.height*scale,style.backgroundColor||'#000000',opacity,style.cornerRadius??.2,clip);
   m.lines.forEach((line,i)=>event(layer+1,t,end,`\\an${style.align==='left'?4:style.align==='right'?6:5}\\pos(${(style.align==='left'?xx-m.width*scale/2+m.pad*scale:style.align==='right'?xx+m.width*scale/2-m.pad*scale:xx).toFixed(2)},${(yy-m.height*scale/2+(m.pad+(i+.5)*m.lineHeight)*scale).toFixed(2)})\\fn${(style.fontFamily||'Arial').replace(/[{},\\]/g,'')}\\fs${(assFontSize(m.size,style)*scale).toFixed(2)}\\b${style.bold===false?0:1}\\i${style.italic?1:0}\\u${style.underline?1:0}\\fsp${(style.letterSpacing||0)*w/1920*scale}\\bord${(style.strokeWidth||0)*scale}\\shad${(style.shadow||0)*scale}\\3c${assColor(style.strokeColor||'#000000')}\\blur${v.glow*8}\\1a&H${Math.round((1-v.opacity)*255).toString(16).padStart(2,'0')}&${clip}\\1c${assColor(style.textColor||'#ffffff')}`,styledLine(line,m.lineStarts[i],style)));
  }
 };

 const d=project.decoration||DEFAULT_DECORATION;const mode=layout.language||'vi';const bounds=d.enabled?{top:Math.max(0,d.topHeight*oh-(oh-h)/2),bottom:Math.min(h,(1-d.bottomHeight)*oh-(oh-h)/2)}:{top:0,bottom:h};
 const langs:('vi'|'zh')[]=mode==='bilingual'?['vi','zh']:mode==='off'?[]:[mode];
 const rows=langs.flatMap(lang=>project.subtitles.map(cue=>({cue,lang,...visibleCue(cue,lang,!!project.dubAudioUrl&&!project.manualTimeline)})).filter(r=>r.text&&r.end>r.start));const times=[...new Set(rows.flatMap(r=>[r.start,r.end]))].sort((a,b)=>a-b);
 for(let i=0;i<times.length-1;i++){const a=times[i],b=times[i+1];const active=langs.flatMap(lang=>{const row=rows.find(r=>r.lang===lang&&r.start<=a&&r.end>=b);return row?[row]:[];});for(const item of placeCaptions(active,w,h,layout,bounds))box(item.text,a,b,(ow-w)/2+item.x,(oh-h)/2+item.y,w,item.style,2,item.lang==='zh'?item.cue.zhStartTime??item.cue.startTime:item.cue.viStartTime??item.cue.startTime,item.lang==='zh'?item.cue.zhEndTime??item.cue.endTime:item.cue.viEndTime??item.cue.endTime);}

 const duration=Math.max(project.duration,project.dubDuration||0,...project.subtitles.map(s=>Math.max(s.endTime,s.zhEndTime||0,s.viEndTime||0)));
 if(d.enabled){for(const [text,height,y] of [[d.topText,d.topHeight,0],[d.bottomText,d.bottomHeight,1-d.bottomHeight]] as [string,number,number][]){rect(5,0,duration,0,y*oh,ow,height*oh,d.backgroundColor,1);if(text)box(text,0,duration,ow/2,(y+height/2)*oh,ow,{...layout,width:98,fontSize:d.fontSize,fontFamily:d.fontFamily,align:d.align,textColor:d.textColor,bold:d.bold!==false,italic:d.italic,characterColors:y===0?d.topColors:d.bottomColors,backgroundOpacity:0},6);}}
 for(const t of d.overlays)if(t.text)box(t.text,0,duration,t.x*ow,t.y*oh,ow,{...layout,fontSize:d.fontSize,fontFamily:d.fontFamily,align:d.align,textColor:d.overlayColor||'#ffffff',bold:d.bold!==false,italic:d.italic,characterColors:t.characterColors},8);
 return events.length?header+events.join('\n'):'';
}
