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
  const sorted = [...subtitles].sort((a, b) => a.startTime - b.startTime);
  return sorted
    .map((sub, index) => {
      const idx = index + 1;
      const timeStr = `${formatSrtTimestamp(sub.startTime)} --> ${formatSrtTimestamp(sub.endTime)}`;
      let text = '';
      if (type === 'zh') text = sub.textZh;
      else if (type === 'vi') text = sub.textVi || '';
      else text = `${sub.textVi || ''}\n${sub.textZh}`;
      return `${idx}\n${timeStr}\n${text.trim()}\n`;
    })
    .join('\n');
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

