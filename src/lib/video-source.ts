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
    const response = await fetch(source);
    if (!response.ok) throw new Error(String(response.status));
    return await response.blob();
  } catch { throw new Error('Video không còn truy cập được. Hãy chọn lại tệp video ở bước 1.'); }
}
