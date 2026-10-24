// Keep the selected File alive; playback URLs are not upload storage.
const sources = new Map<string, File>();
export function rememberVideo(file: File): string {
  const url = URL.createObjectURL(file); sources.set(url, file); return url;
}
export async function readVideo(source: Blob | string): Promise<Blob> {
  if (source instanceof Blob) return source;
  const selected = sources.get(source);
  if (selected) {
    try { await selected.slice(0, 1).arrayBuffer(); return selected; }
    catch { throw new Error('Không đọc được tệp video. Tệp có thể đã bị đổi tên, di chuyển hoặc ổ đĩa mất kết nối. Hãy chọn lại video.'); }
  }
  try {
    let response = await fetch(source,{cache:'no-store'});
    if(!response.ok&&source.startsWith('/cache/')&&(window as any).hnDesktop?.repairProjectMedia){await (window as any).hnDesktop.repairProjectMedia();response=await fetch(source,{cache:'no-store'});}
    if (!response.ok) throw new Error(String(response.status));
    return await response.blob();
  } catch { throw new Error('Không đọc được video trong project. Kiểm tra thư mục .media đi kèm và mở lại project để khôi phục media.'); }
}

export async function projectVideo(p:{videoUrl:string|null;visuals?:{kind:string;url?:string}[]}){const urls=[...new Set([p.videoUrl,...(p.visuals||[]).filter(c=>c.kind==='video').map(c=>c.url)].filter((s):s is string=>!!s))];let error:unknown;for(const url of urls){try{return await readVideo(url)}catch(e){error=e}}throw error||Error('Project chưa có video để xuất.');}
