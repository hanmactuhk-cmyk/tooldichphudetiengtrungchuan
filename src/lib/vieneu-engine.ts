import { VieNeuVoice } from '../types';

export const VIENEU_VOICES: VieNeuVoice[] = [];
export async function loadVieNeuVoices(){
 const r=await fetch('/api/voices');if(!r.ok)throw new Error('Không đọc được danh sách giọng VieNeu.');
 const data=await r.json();VIENEU_VOICES.splice(0,VIENEU_VOICES.length,...data.voices.map((v:any)=>({...v,accent:v.region||'Bắc',tone:'Tự nhiên',sampleText:'Xin chào, đây là giọng VieNeu tiếng Việt.',supportedExpressions:[]})));
 return data;
}
// Helper to write string to DataView
function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Convert AudioBuffer to 48kHz 16-bit PCM WAV Blob
export function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = 48000;
  const format = 1; // PCM
  const bitDepth = 16;
  const numSamples = Math.floor(buffer.length * (sampleRate / buffer.sampleRate));

  // Resample buffer if needed (simple linear interp or single-rate)
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numOfChan; ch++) {
    const origData = buffer.getChannelData(ch);
    const resampled = new Float32Array(numSamples);
    const ratio = buffer.length / numSamples;
    for (let i = 0; i < numSamples; i++) {
      const origIndex = i * ratio;
      const lower = Math.floor(origIndex);
      const upper = Math.min(lower + 1, buffer.length - 1);
      const fraction = origIndex - lower;
      resampled[i] = origData[lower] * (1 - fraction) + origData[upper] * fraction;
    }
    channelData.push(resampled);
  }

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numOfChan * bytesPerSample;
  const dataSize = numSamples * blockAlign;
  const bufferSize = 44 + dataSize;
  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // RIFF chunk length
  view.setUint32(4, 36 + dataSize, true);
  // RIFF type
  writeString(view, 8, 'WAVE');
  // format chunk identifier
  writeString(view, 12, 'fmt ');
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 is PCM)
  view.setUint16(20, format, true);
  // channel count
  view.setUint16(22, numOfChan, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * blockAlign)
  view.setUint32(28, sampleRate * blockAlign, true);
  // block align
  view.setUint16(32, blockAlign, true);
  // bits per sample
  view.setUint16(34, bitDepth, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // data chunk length
  view.setUint32(40, dataSize, true);

  // Write the PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let ch = 0; ch < numOfChan; ch++) {
      let sample = Math.max(-1, Math.min(1, channelData[ch][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

export async function synthesizeVieNeuTTS(text:string,voiceId:string,speed=1,pitch=0,volume=1,expressivity=.3):Promise<{audioUrl:string;duration:number;wavBlob:Blob}> {
  const response=await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,voice_id:voiceId,speed,pitch,volume,expressivity})});
  const data=await response.json();if(!response.ok) throw new Error(data.detail || 'Tạo giọng thất bại');
  const audio=await fetch(data.audioUrl);if(!audio.ok) throw new Error('Không đọc được âm thanh đã tạo.');
  const wavBlob=await audio.blob();return {audioUrl:data.audioUrl,duration:data.duration,wavBlob};
}

// Helper to play synthesized preview
let currentAudioElement: HTMLAudioElement | null = null;

export function playAudioPreview(url: string, onEnd?: () => void): HTMLAudioElement {
  window.dispatchEvent(new Event('hnvoice-preview'));
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
  }
  const audio = new Audio(url);
  currentAudioElement = audio;
  if (onEnd) {
    audio.onended = onEnd;
  }
  audio.play().catch((e) => console.warn('Preview play prevented:', e));
  return audio;
}

export function stopAudioPreview() {
  if (currentAudioElement) {
    currentAudioElement.pause();
    currentAudioElement.currentTime = 0;
    currentAudioElement = null;
  }
}
