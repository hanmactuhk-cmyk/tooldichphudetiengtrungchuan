import { Subtitle, ProjectData } from '../types';

// Convert seconds to SRT timestamp format (00:00:00,000)
export function formatSrtTimestamp(seconds: number): string {
  const pad = (num: number, size: number) => ('000' + num).slice(-size);
  const total=Math.max(0,Math.round(seconds*1000));
  const hrs=Math.floor(total/3600000);
  const mins=Math.floor(total/60000)%60;
  const secs=Math.floor(total/1000)%60;
  const millis=total%1000;
  return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(millis, 3)}`;
}

// Generate SRT file string
export function generateSrt(
  subtitles: Subtitle[],
  type: 'zh' | 'vi' | 'bilingual'
): string {
  const entries:{start:number;end:number;text:string}[]=[];
  for(const sub of subtitles){for(const language of type==='bilingual'?['vi','zh']: [type]){const text=language==='zh'?(sub.hiddenZh?'':sub.textZh):(sub.hiddenVi?'':sub.textVi||'');if(!text.trim())continue;const start=language==='zh'?sub.zhStartTime??sub.startTime:sub.viStartTime??sub.startTime,end=language==='zh'?sub.zhEndTime??sub.endTime:sub.viEndTime??sub.endTime;const same=type==='bilingual'?entries.find(e=>e.start===start&&e.end===end):undefined;if(same)same.text+='\n'+text;else entries.push({start,end,text});}}
  return entries.sort((a,b)=>a.start-b.start).map((e,i)=>`${i+1}\n${formatSrtTimestamp(e.start)} --> ${formatSrtTimestamp(e.end)}\n${e.text.trim()}\n`).join('\n');
}

// Trigger file download in browser
export function triggerDownload(content: BlobPart, filename: string, mimeType: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

