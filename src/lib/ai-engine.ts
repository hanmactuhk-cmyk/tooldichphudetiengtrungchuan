import { Subtitle } from '../types';
import { runOfflineASR } from './asr-engine';
import { runQwenTranslation } from './translator-engine';
import { synthesizeVieNeuTTS } from './vieneu-engine';

export class AIEngine {
  async transcribeVideo(videoPath: string): Promise<Subtitle[]> {
    return runOfflineASR(videoPath, {
      model: 'SenseVoice-Small',
      useVad: true,
      usePunc: true,
      confidenceThreshold: 0.9,
    }, () => {});
  }

  async translateSubtitles(subtitles: Subtitle[]): Promise<Subtitle[]> {
    return runQwenTranslation(subtitles, [], 'offline', () => {});
  }

  async generateTTS(text: string, voiceId: string): Promise<string> {
    const res = await synthesizeVieNeuTTS(text, voiceId);
    return res.audioUrl;
  }
}

export const aiEngine = new AIEngine();
