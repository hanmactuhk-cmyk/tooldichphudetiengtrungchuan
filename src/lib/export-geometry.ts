import {ProjectData} from '../types';
export const DEFAULT_EXPORT={resolution:'source' as const,quality:'fast' as const,renderMode:'gpu' as const};
export function exportGeometry(p:ProjectData){const sw=p.videoWidth||1920,sh=p.videoHeight||1080,mode=p.exportSettings?.resolution;
 if(mode==='1080p'||mode==='1080p-portrait'){const ow=mode==='1080p'?1920:1080,oh=mode==='1080p'?1080:1920,k=Math.min(ow/sw,oh/sh);return {w:Math.max(2,Math.min(ow,Math.round(sw*k/2)*2)),h:Math.max(2,Math.min(oh,Math.round(sh*k/2)*2)),ow,oh};}
 const a=p.captionLayout?.aspect||'auto',ratio=a==='16:9'?16/9:a==='9:16'?9/16:sw/sh;return {w:sw,h:sh,ow:Math.ceil(Math.max(sw,sh*ratio)/2)*2,oh:Math.ceil(Math.max(sh,sw/ratio)/2)*2};}
