import {ProjectData,VisualClip} from '../types';
export async function loadTextFonts(items:{fontFamily?:string;bold?:boolean;italic?:boolean}[]) {
 const specs=[...new Set(items.map(s=>`${s.italic?'italic ':''}${s.bold===false?400:700} 32px "${s.fontFamily||'Arial'}"`))];
 await Promise.all(specs.map(s=>document.fonts.load(s,'Tiếng Việt: Đặng Thị Hằng, Ắ Ặ Ễ Ỡ Ữ Ỵ')));await document.fonts.ready;
}
export async function ensureProjectFonts(p:ProjectData){await loadTextFonts([p.captionLayout||{},...(p.subtitles||[]).map(c=>({...p.captionLayout,...c.captionStyle})),p.decoration||{},...(p.visuals||[]).filter(c=>c.kind==='text').map(c=>c.textStyle||{})])}
