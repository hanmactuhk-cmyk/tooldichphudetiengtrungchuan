import {ProjectData,Subtitle} from '../types';
import {projectClips,validateTimeline} from './timeline-engine';

export interface SplitSettings {maxWords:number;wordsPerSecond:number;maxSpeed:number;protectedPhrases:string[];allowConcise:boolean;}
export const DEFAULT_SPLIT:SplitSettings={maxWords:8,wordsPerSecond:3,maxSpeed:1.2,protectedPhrases:[],allowConcise:false};
export interface SplitRow {id:string;original:Subtitle;parts:{text:string;start:number;end:number;estimate:number}[];warnings:string[];changed:boolean;}
export interface SplitPlan {settings:SplitSettings;rows:SplitRow[];report:{original:number;long:number;split:number;after:number;overflow:number;manual:number};}
const lex=(s:string)=>s.match(/\S+/gu)||[];
export const countWords=(s:string)=>lex(s).filter(w=>/[\p{L}\p{N}]/u.test(w)).length;
const bare=(s:string)=>s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu,'').toLocaleLowerCase('vi');
const commonPhrases=['bởi vì','cho nên','tuy nhiên','mặc dù','không được','không phải','chưa bao giờ','có thể','không thể','thế nhưng','bao nhiêu','cho phép','rời khỏi','nhân quả','tự ý','thực sự','không chỉ','mà còn'];
const clause=new Set(['nhưng','nếu','khi','vì','nên','rằng','mà','để','và','hoặc','dù']);

// Lossless segmentation: tokens and punctuation remain in their original order.
// Ambiguous linguistic boundaries are exposed for review, never claimed as AI verification.
export function segmentVietnamese(text:string,maxWords:number,protectedPhrases:string[]=[]){
 const words=lex(text),n=words.length,cost=Array(n+1).fill(Infinity),prev=Array(n+1).fill(-1),counts=[0];cost[0]=0;
 for(const w of words)counts.push(counts[counts.length-1]+countWords(w));
 const blocked=new Set<number>();
 for(const phrase of [...commonPhrases,...protectedPhrases]){const ps=lex(phrase).map(bare);if(!ps.length)continue;for(let i=0;i+ps.length<=n;i++)if(ps.every((p,j)=>bare(words[i+j])===p))for(let k=i+1;k<i+ps.length;k++)blocked.add(k);}
 // Consecutive capitalized words usually belong to a person's or place's name.
 for(let i=1;i<n;i++)if(/^\p{Lu}/u.test(words[i-1])&&/^\p{Lu}/u.test(words[i]))blocked.add(i);
 for(let end=1;end<=n;end++)for(let start=end-1;start>=0;start--){const size=counts[end]-counts[start];if(size>maxWords)break;if(!size||!Number.isFinite(cost[start])||end<n&&blocked.has(end))continue;
  const natural=end===n||/[.!?…。！？;；:,，：]$/u.test(words[end-1])||clause.has(bare(words[end]||''));
  const penalty=(end===n?0:natural?0:5)+Math.pow((maxWords-size)/maxWords,2)+(size===1?4:0)+1;
  if(cost[start]+penalty<cost[end]){cost[end]=cost[start]+penalty;prev[end]=start;}
 }
 if(prev[n]<0)return {texts:[text.trim()],ambiguous:true,blocked:true};
 const texts:string[]=[];let end=n,ambiguous=false;while(end>0){const start=prev[end];texts.unshift(words.slice(start,end).join(' '));if(end<n&&!/[.!?…。！？;；:,，：]$/u.test(words[end-1])&&!clause.has(bare(words[end]||'')))ambiguous=true;end=start;}
 return {texts,ambiguous,blocked:false};
}
export function estimateRead(text:string,rate:number){return countWords(text)/rate+(text.match(/[,;:，；：]/gu)?.length||0)*.1+(text.match(/[.!?…。！？]/gu)?.length||0)*.14;}
export function planSmartSplit(subtitles:Subtitle[],settings:SplitSettings,ids?:Set<string>):SplitPlan{
 if(!Number.isInteger(settings.maxWords)||settings.maxWords<4||settings.maxWords>20||!Number.isFinite(settings.wordsPerSecond)||settings.wordsPerSecond<1||settings.wordsPerSecond>8||!Number.isFinite(settings.maxSpeed)||settings.maxSpeed<1||settings.maxSpeed>1.5)throw Error('Cài đặt chia câu không hợp lệ.');
 const visible=subtitles.filter(s=>!s.hiddenVi&&s.textVi?.trim()).sort((a,b)=>(a.viStartTime??a.startTime)-(b.viStartTime??b.startTime));
 const rows=visible.filter(s=>!ids?.size||ids.has(s.id)).map(s=>{
  const text=s.textVi!.trim(),a=s.viStartTime??s.startTime,b=s.viEndTime??s.endTime,warnings:string[]=[];
  const long=countWords(text)>settings.maxWords,split=long?segmentVietnamese(text,settings.maxWords,settings.protectedPhrases):{texts:[text],ambiguous:false,blocked:false};
  if(!Number.isFinite(a+b)||a<0||b<=a)warnings.push('Mốc thời gian không hợp lệ.');
  if(split.blocked)warnings.push('Cụm tên riêng / cụm bảo vệ dài hơn giới hạn; cần chia thủ công.');
  if(split.ambiguous&&!split.blocked)warnings.push('Cần kiểm tra điểm ngắt ngữ nghĩa; toàn bộ chữ được giữ nguyên.');
  const estimates=split.texts.map(t=>estimateRead(t,settings.wordsPerSecond)),total=estimates.reduce((x,y)=>x+y,0);
  if(total>b-a+.001)warnings.push('Cần xử lý thời lượng: ước tính '+total.toFixed(2)+' giây / '+(b-a).toFixed(2)+' giây.');
  const index=visible.indexOf(s),next=visible[index+1],before=visible[index-1];if(next&&(next.viStartTime??next.startTime)<b-.00001||before&&(before.viEndTime??before.endTime)>a+.00001)warnings.push('Phụ đề gốc đang chồng thời gian với câu liền kề.');
  if((b-a)/split.texts.length<.04)warnings.push('Không đủ 0,04 giây cho mỗi đoạn; cần chỉnh thủ công.');
  let at=a;const parts=split.texts.map((text,i)=>{const start=at,end=i===split.texts.length-1?b:Math.round((a+(b-a)*estimates.slice(0,i+1).reduce((x,y)=>x+y,0)/total)*1000)/1000;at=end;return {text,start,end,estimate:estimates[i]};});
  if(parts.some(p=>p.end-p.start<.039)&&!warnings.some(w=>w.includes('0,04')))warnings.push('Không đủ 0,04 giây cho mỗi đoạn; cần chỉnh thủ công.');
  return {id:s.id,original:s,parts,warnings,changed:long&&!split.blocked};
 });
 return {settings,rows,report:{original:rows.length,long:rows.filter(r=>countWords(r.original.textVi!)>settings.maxWords).length,split:rows.filter(r=>r.changed).length,after:rows.reduce((n,r)=>n+r.parts.length,0),overflow:rows.filter(r=>r.warnings.some(w=>w.includes('thời lượng'))).length,manual:rows.filter(r=>r.warnings.length).length}};
}
export function applySmartSplit(p:ProjectData,plan:SplitPlan):ProjectData{
 const changed=plan.rows.filter(r=>r.changed);
 const capIds=new Set(plan.rows.filter(r=>r.original.smartSourceId&&r.original.smartMaxSpeed!==plan.settings.maxSpeed).map(r=>r.id));
 if(!changed.length){if(!capIds.size)throw Error('Không có câu dài có thể chia.');return {...p,smartSplitSettings:plan.settings,subtitles:p.subtitles.map(s=>capIds.has(s.id)?{...s,smartMaxSpeed:plan.settings.maxSpeed,...((s.ttsFitSpeed||1)>plan.settings.maxSpeed?{status:'warning_overflow' as const,smartWarnings:['Giọng đã có vượt giới hạn mới; cần tạo lại hoặc chỉnh lời.']}:{} )}:s)};}
 for(const r of changed){if(r.parts.some(c=>c.end-c.start<.039||countWords(c.text)>plan.settings.maxWords)||r.warnings.some(w=>w.includes('chồng thời gian')||w.includes('không hợp lệ')))throw Error('Câu '+r.id+' cần chỉnh mốc thời gian trước khi áp dụng.');if(lex(r.parts.map(c=>c.text).join(' ')).join(' ')!==lex(r.original.textVi!).join(' '))throw Error('Nội dung chia không khớp câu gốc.');}
 const map=new Map(changed.map(r=>[r.id,r])),subtitles:Subtitle[]=[];
 for(const s of p.subtitles){const row=map.get(s.id);if(!row){subtitles.push(capIds.has(s.id)?{...s,smartMaxSpeed:plan.settings.maxSpeed}:s);continue;}subtitles.push({...s,hiddenVi:true,smartOriginal:true});const sourceId=s.smartSourceId||s.id,group=crypto.randomUUID();
  for(const c of row.parts)subtitles.push({...s,id:crypto.randomUUID(),textVi:c.text,hiddenZh:true,hiddenVi:false,smartOriginal:false,smartSourceId:sourceId,smartGroupId:group,smartGroupCount:row.parts.length,smartGroupStart:row.parts[0].start,smartGroupEnd:row.parts[row.parts.length-1].end,smartMaxSpeed:plan.settings.maxSpeed,smartWarnings:row.warnings,startTime:c.start,endTime:c.end,viStartTime:c.start,viEndTime:c.end,ttsAudioUrl:undefined,ttsDuration:undefined,dubStartTime:undefined,dubEndTime:undefined,ttsFitSpeed:undefined,ttsShift:undefined,suggestedViShort:undefined,status:row.warnings.some(w=>w.includes('thời lượng'))?'warning_overflow':'needs_tts'});
 }
 const audioClips=projectClips(p).map(c=>c.subtitleId&&map.has(c.subtitleId)?{...c,muted:true}:c);
 if(subtitles.length>20000)throw Error('Quá 20.000 đoạn sau khi chia. Hãy xử lý từng project nhỏ hơn.');
 return validateTimeline({...p,subtitles,audioClips,manualTimeline:true,dubAudioUrl:undefined,dubDuration:undefined,smartSplitSettings:plan.settings,smartSplitBackup:{subtitles:p.subtitles,audioClips:p.audioClips,manualTimeline:p.manualTimeline,dubAudioUrl:p.dubAudioUrl,dubDuration:p.dubDuration,selectedSubtitleId:p.selectedSubtitleId},selectedSubtitleId:subtitles.find(s=>s.smartGroupId&&!s.hiddenVi)?.id||p.selectedSubtitleId});
}
export function undoSmartSplit(p:ProjectData):ProjectData{if(!p.smartSplitBackup)throw Error('Không có bản trước khi chia.');return {...p,...p.smartSplitBackup,smartSplitBackup:undefined};}
