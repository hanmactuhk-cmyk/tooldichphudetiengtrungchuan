import {readVideo} from './video-source';
import {apiJson} from './jobs';
import { Subtitle, Character } from '../types';

export interface AsrOptions {
  model: 'SenseVoice-Small' | 'Paraformer-ZH' | 'OCR-ZH';
  cropTop?:number;
  useVad: boolean;
  usePunc: boolean;
  confidenceThreshold: number;
}

export async function runOfflineASR(video: Blob | string, options: AsrOptions, onProgress: (percent: number, text: string) => void): Promise<Subtitle[]> {
  if (!video) throw new Error('Hãy chọn video trước khi nhận diện.');
  onProgress(10, options.model==='OCR-ZH'?'Đang quét chữ phụ đề trên khung hình...':'Đang nhận diện lời nói trên máy...');
  const blob = await readVideo(video);
  const body = new FormData(); body.append('file', blob, 'video.mp4');
  if(options.model==='OCR-ZH')body.append('crop_top',String(options.cropTop??0.55));
  const data = await apiJson(options.model==='OCR-ZH'?'/api/ocr':'/api/transcribe', {method:'POST',body});
  if (!Array.isArray(data.subtitles)) throw new Error('Kết quả nhận diện không hợp lệ.');
  onProgress(100, 'Đã nhận diện phụ đề.');
  return data.subtitles;
}
export async function runParaformerOnSentence(sub: Subtitle): Promise<{textZh:string; confidence:number;model:'Paraformer-ZH'}> {
  throw new Error('Chưa cài Paraformer. Hãy chạy lại nhận diện video bằng Whisper-small.');
}
