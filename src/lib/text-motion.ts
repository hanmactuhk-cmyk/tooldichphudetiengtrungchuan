export interface MotionPreset{effect:string;duration:number;intensity:number;}
export interface TextMotion{enter?:MotionPreset;exit?:MotionPreset;loop?:MotionPreset;}
export const MOTION_EFFECTS=[['none','Không có'],['fade','Mờ dần'],['left','Trượt từ trái'],['right','Trượt từ phải'],['up','Trượt từ trên'],['down','Trượt từ dưới'],['zoom-in','Phóng to'],['zoom-out','Thu nhỏ'],['bounce','Bật nảy'],['typewriter','Gõ chữ'],['words','Hiện từng từ'],['shake','Rung nhẹ'],['blink','Nhấp nháy'],['glow','Phát sáng']];
export function motionAt(m:TextMotion|undefined,t:number,a:number,b:number,count=20,words=5){
 const out={x:0,y:0,scale:1,opacity:1,reveal:1,glow:0};if(!m)return out;
 for(const [phase,preset] of Object.entries(m)){if(!preset||preset.effect==='none')continue;const d=Math.max(.08,Math.min(preset.duration,Math.max(.08,(b-a)/2))),loop=phase==='loop';let p=loop?((t-a)%Math.max(.1,preset.duration))/Math.max(.1,preset.duration):phase==='exit'?Math.min(1,Math.max(0,(b-t)/d)):Math.min(1,Math.max(0,(t-a)/d));const linear=p;const eased=phase==='exit'?p*p:1-Math.pow(1-p,3);if(!loop&&!['typewriter','words'].includes(preset.effect))p=eased;const i=preset.intensity??1,e=preset.effect;
 if(e==='fade')out.opacity*=loop?.825-.175*Math.cos(p*Math.PI*2):p;
 if(['left','right','up','down'].includes(e)){const v=(loop?Math.sin(p*Math.PI*2)*.04:(1-p)*.15)*i;if(e==='left'||e==='right')out.x+=(e==='left'?-v:v);else out.y+=(e==='up'?-v:v);if(!loop)out.opacity*=p;}
 if(e==='zoom-in')out.scale*=loop?1+Math.sin(p*Math.PI*2)*.08*i:1-(1-p)*.5*i;
 if(e==='zoom-out')out.scale*=loop?1+Math.sin(p*Math.PI*2)*.08*i:1+(1-p)*.5*i;
 if(e==='bounce')out.scale*=loop?1+Math.abs(Math.sin(p*Math.PI*2))*.12*i:1-Math.exp(-7*linear)*Math.cos(linear*Math.PI*3)*.3*i*(linear<1?1:0);
 if(!loop&&['zoom-in','zoom-out','bounce'].includes(e))out.opacity*=p;
 if(e==='typewriter'||e==='words'){const n=Math.max(1,e==='words'?words:count);out.reveal*=p>=1?1:(Math.floor(p*n)+Math.min(1,(p*n%1)*3))/n;}
 if(e==='shake')out.x+=Math.sin((t-a)*30)*.01*i;
 if(e==='blink')out.opacity*=.45+.55*(Math.sin((t-a)*10)+1)/2;
 if(e==='glow')out.glow=Math.max(out.glow,(.4+.6*(Math.sin((t-a)*7)+1)/2)*i);
 }
 out.scale=Math.max(.05,out.scale);return out;
}
export function motionCss(m:TextMotion|undefined,t:number,a:number,b:number,w:number,h:number,count=20,words=5){const v=motionAt(m,t,a,b,count,words);return {opacity:v.opacity,transform:`translate(${v.x*w}px,${v.y*h}px) scale(${v.scale})`,clipPath:v.reveal<1?`inset(0 ${(1-v.reveal)*100}% 0 0)`:undefined,filter:v.glow?`drop-shadow(0 0 ${v.glow*8*w/1920}px currentColor)`:undefined};}
