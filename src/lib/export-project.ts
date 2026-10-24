import {ProjectData} from '../types';
import {apiJson} from './jobs';
import {readVideo} from './video-source';
import {generateAss,DEFAULT_CAPTION_LAYOUT} from './caption-layout';
import {prepareVisuals} from './raster-visual';
import {orderedVisuals} from './visual-engine';
import {timelineEnd} from './timeline-engine';
import {ensureProjectFonts} from './project-fonts';
export async function uploadJob(url:string,form:FormData,progress:(p:number,t:string)=>void){
 const {jobId}=await apiJson(url,{method:'POST',body:form});window.dispatchEvent(new CustomEvent('hn-job',{detail:jobId}));
 try{for(;;){const job=await apiJson('/api/jobs/'+jobId);progress(job.percent,job.message);if(job.state==='done')return job.result;if(['error','cancelled'].includes(job.state))throw Error(job.error||job.message);await new Promise(r=>setTimeout(r,750))}}finally{window.dispatchEvent(new CustomEvent('hn-job',{detail:null}))}
}
export async function exportProjectVideo(p:ProjectData,progress:(p:number,t:string)=>void,captions=true){
 await ensureProjectFonts(p);const form=new FormData();form.append('file',await readVideo(p.videoUrl!),p.videoFileName||'video.mp4');form.append('options',JSON.stringify({rendererRevision:'6.0.1',timelineDuration:timelineEnd(p),visuals:orderedVisuals(await prepareVisuals(p.visuals||[],p.videoWidth||1920,p.videoHeight||1080),p.visualTracks),videoEdited:p.videoEdited,ass:generateAss(captions?p:{...p,captionLayout:{...DEFAULT_CAPTION_LAYOUT,...p.captionLayout,language:'off'},decoration:undefined}),blur:p.blurRegion,aspect:p.captionLayout?.aspect||'auto',dubAudioUrl:p.dubAudioUrl,originalMuted:p.originalAudioMuted,originalVolume:p.originalAudioVolume}));return uploadJob('/api/video/export',form,progress);
}
