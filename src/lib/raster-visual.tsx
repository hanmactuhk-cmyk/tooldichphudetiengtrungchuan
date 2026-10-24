import {loadTextFonts} from './project-fonts';
import worldLand from './world-land.json';
import React,{useEffect,useRef} from 'react';import {VisualClip,TextStyle} from '../types';
export const DEFAULT_TEXT:TextStyle={fontFamily:'Arial',fontSize:4,color:'#ffffff',bold:true,italic:false,background:'#00000000',radius:.12,autoFit:true};
export const PATTERNS=[['world','Bản đồ'],['waves','Sóng mềm'],['dots','Chấm bi'],['diagonal','Sọc chéo'],['grid','Lưới'],['chevron','Chữ V'],['mesh','Tam giác'],['hex','Tổ ong'],['bubbles','Bong bóng'],['stars','Ngôi sao'],['stripes','Đường ngang'],['rays','Tia sáng'],['leaves','Lá'],['particles','Hạt sáng'],['grain','Vân hạt']].map(([id,label])=>({id,label}));
export const THEMES=Array.from({length:15},(_,i)=>({name:['Ngọc lục bảo','Đại dương','Tím đêm','Đỏ ruby','Hổ phách','Xanh bạc hà','Lam điện','Hồng phấn','Cam hoàng hôn','Đen vàng','Xanh rêu','Tím hồng','Bạc xanh','Đỏ rượu','Xanh trời'][i],color:['#08734d','#073d76','#39216d','#881e3e','#845408','#126b66','#123a85','#813a70','#a13b21','#29251b','#294f32','#682771','#304859','#641d2d','#075972'][i],secondary:['#4ccb9b','#3f9fe5','#a78ae9','#ed6a93','#f2cd68'][i%5],pattern:PATTERNS[i].id}));
export function rasterKey(c:VisualClip,w:number,h:number){return JSON.stringify(['raster-v601',c.kind,c.text,c.textStyle,c.template,c.width,c.height,w,h]);}
export function textLayout(c:VisualClip,w:number,h:number){
 const d={...DEFAULT_TEXT,...c.textStyle},cw=Math.max(2,c.width*w),ch=Math.max(2,c.height*h),ctx=document.createElement('canvas').getContext('2d')!;
 let left=cw*.04,right=cw*.04,top=ch*.05,bottom=ch*.05;
 if(d.badge){left=d.badgeMark?.trim()?ch*(.04+.78*.95):ch*.23;right=ch*.24;top=ch*.15;bottom=ch*.25;}
 const sx=d.condensed?.76:1,available=Math.max(1,(cw-left-right)/sx),text=d.uppercase?(c.text||'').toLocaleUpperCase('vi-VN'):(c.text||'');let size=Math.max(4,w*d.fontSize/100),lines:string[]=[];const lineSpace=d.lineSpacing||(d.condensed?1.18:1.25);
 const wrap=()=>{ctx.font=`${d.italic?'italic ':''}${d.bold?'700 ':''}${size}px "${d.fontFamily}"`;lines=[];for(const para of text.split('\n')){let line='';for(const word of para.split(/\s+/)){const test=line?line+' '+word:word;if(line&&ctx.measureText(test).width>available){lines.push(line);line=word}else line=test}lines.push(line)}};
 wrap();if(d.autoFit)while(size>5&&(lines.length*size*lineSpace>ch-top-bottom||lines.some(l=>ctx.measureText(l).width>available))){size*=.95;wrap()}
 const metrics=ctx.measureText(lines.join('')||'Ấg'),ascent=metrics.actualBoundingBoxAscent||size*.8,descent=metrics.actualBoundingBoxDescent||size*.2,total=(lines.length-1)*size*lineSpace+ascent+descent;
 const y=d.verticalAlign==='top'?top:top+(ch-top-bottom-total)/2;
 return {left,right,top,bottom,sx,available,size,lines,lineSpace,y,ascent,descent,font:ctx.font};
}
export function rasterVisual(c:VisualClip,w:number,h:number){const canvas=document.createElement('canvas');canvas.width=Math.max(2,Math.round(c.width*w));canvas.height=Math.max(2,Math.round(c.height*h));const ctx=canvas.getContext('2d')!,cw=canvas.width,ch=canvas.height;
 if(c.template){const d=c.template;ctx.beginPath();ctx.roundRect(0,0,cw,ch,Math.min(cw,ch)*d.radius);ctx.clip();const g=ctx.createLinearGradient(0,0,0,ch);
 if(d.surface==='news-top'){g.addColorStop(0,'#081d1b88');g.addColorStop(1,'#081d1b00')}
 else if(d.surface==='news-bottom'){g.addColorStop(0,d.secondary+'00');g.addColorStop(.055,d.secondary+'66');g.addColorStop(.17,d.secondary);g.addColorStop(.56,d.secondary);g.addColorStop(1,d.color)}
 else{g.addColorStop(0,d.fade?d.color+'00':d.secondary);g.addColorStop(d.fade?.25:1,d.color);g.addColorStop(1,d.color)}ctx.fillStyle=g;ctx.fillRect(0,0,cw,ch);ctx.globalAlpha=d.surface==='news-top'?0:.14;ctx.strokeStyle=d.secondary;ctx.fillStyle=d.secondary;ctx.lineWidth=Math.max(1,cw/400);
 if(d.pattern==='dots')for(let y=12;y<ch;y+=24)for(let x=12;x<cw;x+=24){ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fill()}
 if(d.pattern==='grid'||d.pattern==='diagonal')for(let x=-ch;x<cw+ch;x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(d.pattern==='grid'?x:x+ch,ch);ctx.stroke();if(d.pattern==='grid'){ctx.beginPath();ctx.moveTo(0,x);ctx.lineTo(cw,x);ctx.stroke()}}
 if(d.pattern==='waves')for(let y=0;y<ch;y+=22){ctx.beginPath();for(let x=0;x<=cw;x+=4){const yy=y+Math.sin(x/55+y/40)*12;x?ctx.lineTo(x,yy):ctx.moveTo(x,yy)}ctx.stroke()}
 if(d.pattern==='world'&&d.surface!=='news-top'){
  ctx.save();ctx.globalAlpha=d.surface==='news-bottom'?.16:.13;ctx.fillStyle=d.surface==='news-bottom'?'#a3f0c2':d.secondary;
  const mapW=cw*1.15,mapH=d.surface==='news-bottom'?ch*.6:ch*.9,mapX=-cw*.075,mapY=d.surface==='news-bottom'?ch*.47:ch*.07;
  for(const ring of worldLand){ctx.beginPath();ring.forEach(([x,y],i)=>i?ctx.lineTo(mapX+x*mapW,mapY+y*mapH):ctx.moveTo(mapX+x*mapW,mapY+y*mapH));ctx.closePath();ctx.fill()}
  ctx.restore();
 }

 if(d.pattern==='chevron'||d.pattern==='mesh')for(let y=0;y<ch;y+=30){ctx.beginPath();for(let x=0;x<=cw;x+=30){ctx.lineTo(x,y+(x/30%2)*18)}ctx.stroke();if(d.pattern==='mesh'){ctx.beginPath();for(let x=0;x<cw;x+=30){ctx.moveTo(x,y);ctx.lineTo(x+15,y+30)}ctx.stroke()}}
 if(d.pattern==='hex')for(let y=0;y<ch+30;y+=40)for(let x=0;x<cw+30;x+=46){ctx.beginPath();for(let i=0;i<6;i++){const a=i*Math.PI/3;ctx.lineTo(x+(y/40%2)*23+23*Math.cos(a),y+23*Math.sin(a))}ctx.closePath();ctx.stroke()}
 if(d.pattern==='bubbles'||d.pattern==='stars'||d.pattern==='particles'||d.pattern==='grain'){const count=d.pattern==='grain'?500:60;for(let i=0;i<count;i++){const rand=(n:number)=>{const a=Math.sin(n*127.1)*43758.5453;return a-Math.floor(a)},x=rand(i+1)*cw,y=rand(i+100)*ch,r=d.pattern==='grain'?1:d.pattern==='particles'?1+rand(i+44)*3:4+rand(i+50)*16;ctx.beginPath();if(d.pattern==='stars'){for(let j=0;j<8;j++){const a=j*Math.PI/4,rr=j%2?r*.3:r;ctx.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr)}ctx.closePath();ctx.fill()}else{ctx.arc(x,y,r,0,Math.PI*2);d.pattern==='bubbles'?ctx.stroke():ctx.fill()}}}
 if(d.pattern==='stripes')for(let y=0;y<ch;y+=15){ctx.fillRect(0,y,cw,3)}
 if(d.pattern==='rays')for(let i=0;i<16;i+=2){ctx.beginPath();ctx.moveTo(cw*.15,ch);ctx.lineTo(cw*.15+Math.cos(i*Math.PI/16)*cw*2,ch-Math.sin(i*Math.PI/16)*ch*2);ctx.lineTo(cw*.15+Math.cos((i+1)*Math.PI/16)*cw*2,ch-Math.sin((i+1)*Math.PI/16)*ch*2);ctx.closePath();ctx.fill()}
 if(d.pattern==='leaves')for(let y=0;y<ch;y+=50)for(let x=0;x<cw;x+=50){ctx.beginPath();ctx.moveTo(x,y+35);ctx.quadraticCurveTo(x-5,y+2,x+35,y);ctx.quadraticCurveTo(x+40,y+30,x,y+35);ctx.fill()}
 ctx.globalAlpha=1;
 }
 if(c.kind==='text'){
  const d={...DEFAULT_TEXT,...c.textStyle};if(d.backgroundOpacity!==undefined)d.background=d.background.slice(0,7)+Math.round(d.backgroundOpacity*255).toString(16).padStart(2,'0');let left=cw*.04,right=cw*.04,top=ch*.05,bottom=ch*.05;
  if(d.badge){
   const inset=ch*.09,bh=ch*.78,bx=ch*.04,by=ch*.06,bw=cw-ch*.12,round=bh/2;
   ctx.save();ctx.shadowColor='#001b2477';ctx.shadowBlur=d.badge==='solid'?0:ch*.075;ctx.shadowOffsetY=d.badge==='solid'?0:ch*.055;ctx.beginPath();ctx.roundRect(bx,by,bw,bh,round);
   const ring=ctx.createLinearGradient(0,by,0,by+bh);ring.addColorStop(0,'#f5fffcdf');ring.addColorStop(.43,'#9ce1c2a6');ring.addColorStop(1,'#c2f3d251');ctx.fillStyle=d.badge==='solid'?d.background:ring;ctx.fill();ctx.restore();
   ctx.beginPath();ctx.roundRect(bx+inset,by+inset,bw-inset*2,bh-inset*2,(bh-inset*2)/2);
   const fill=ctx.createLinearGradient(0,by,0,by+bh);const color=d.background.slice(0,7);fill.addColorStop(0,d.badge==='glass'?color+'a0':color);fill.addColorStop(1,d.badge==='outline'?color+'22':color);ctx.fillStyle=fill;ctx.fill();
   const mark=d.badgeMark?.trim();left=ch*.23;right=ch*.24;top=by+inset;bottom=ch-(by+bh-inset);
   if(mark){const r=bh*.27,cx=bx+bh*.52,cy=by+bh*.5;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#ffffff';ctx.fill();ctx.save();ctx.fillStyle=color;ctx.font=`900 ${r*(mark.length>2?.8:1.1)}px Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(mark.slice(0,4),cx,cy+r*.03,r*1.7);ctx.restore();left=bx+bh*.95;}
  }else{ctx.fillStyle=d.background;ctx.beginPath();ctx.roundRect(0,0,cw,ch,Math.min(cw,ch)*d.radius);ctx.fill()}
  const t=textLayout(c,w,h);ctx.font=t.font;(ctx as any).letterSpacing=(d.letterSpacing||0)*w/1920+'px';ctx.save();ctx.translate(t.left,0);ctx.scale(t.sx,1);ctx.fillStyle=d.color;ctx.textAlign=d.align==='left'?'left':d.align==='right'?'right':'center';ctx.textBaseline='alphabetic';
  t.lines.forEach((line,i)=>{const x=d.align==='left'?0:d.align==='right'?t.available:t.available/2,y=t.y+t.ascent+i*t.size*t.lineSpace;ctx.shadowColor='#000000';ctx.shadowBlur=(d.shadow||0)*w/1920;ctx.shadowOffsetY=(d.shadow||0)*w/1920;if(d.strokeWidth){ctx.lineWidth=d.strokeWidth*w/1920;ctx.strokeStyle=d.strokeColor||'#000000';ctx.strokeText(line,x,y)}ctx.fillText(line,x,y);if(d.underline){const width=ctx.measureText(line).width;ctx.fillRect(d.align==='left'?0:d.align==='right'?t.available-width:(t.available-width)/2,y+t.size*.1,width,Math.max(1,t.size*.06))}});ctx.restore();
 }
 return canvas;}
export function RasterVisual({clip,w,h}:{clip:VisualClip;w:number;h:number}){const ref=useRef<HTMLCanvasElement>(null),key=rasterKey(clip,w,h);useEffect(()=>{let active=true;loadTextFonts(clip.kind==='text'?[clip.textStyle||{}]:[]).then(()=>{if(!active)return;const c=rasterVisual(clip,w,h),target=ref.current!;target.width=c.width;target.height=c.height;target.getContext('2d')!.drawImage(c,0,0)});return()=>{active=false}},[key]);return <canvas ref={ref} className="w-full h-full pointer-events-none"/>}
export async function prepareVisuals(clips:VisualClip[],w:number,h:number){const result=[];await loadTextFonts(clips.filter(c=>c.kind==='text').map(c=>c.textStyle||{}));for(const c of clips){if((c.kind==='text'||c.template)&&(!c.url||c.renderKey!==rasterKey(c,w,h))){const canvas=rasterVisual(c,w,h),blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Không tạo được lớp chữ.')),'image/png')),form=new FormData();form.append('file',blob,'layer.png');const r=await fetch('/api/media/import',{method:'POST',body:form});const data=await r.json();if(!r.ok)throw Error(data.detail||'Không tạo được lớp hình.');result.push({...c,url:data.url,renderKey:rasterKey(c,w,h)})}else result.push(c)}return result;}
