import {stopAudioPreview} from '../lib/vieneu-engine';
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Subtitles,
  Layers,
  Sparkles,
} from 'lucide-react';
import { Subtitle, Character } from '../types';

interface VideoPlayerProps {
  videoUrl: string | null;
  dubAudioUrl?:string;
  dubDuration?:number;
  subtitles: Subtitle[];
  characters: Character[];
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  originalAudioVolume: number;
  originalAudioMuted: boolean;
  bgmDucking: boolean;
  onTimeUpdate: (time: number) => void;
  onTogglePlay: () => void;
  onChangeOriginalVolume: (vol: number) => void;
  onToggleOriginalMute: () => void;
  onToggleDucking: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  dubAudioUrl,
  dubDuration,
  subtitles,
  characters,
  currentTime,
  duration,
  isPlaying,
  originalAudioVolume,
  originalAudioMuted,
  bgmDucking,
  onTimeUpdate,
  onTogglePlay,
  onChangeOriginalVolume,
  onToggleOriginalMute,
  onToggleDucking,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [subtitleMode, setSubtitleMode] = useState<'bilingual' | 'vi' | 'zh' | 'off'>('bilingual');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const dubRef=useRef<HTMLAudioElement|null>(null);

  useEffect(()=>{
    const video=videoRef.current;if(!video)return;
    video.playbackRate=playbackSpeed;
    video.volume=Math.min(1,Math.max(0,originalAudioVolume*(bgmDucking&&subtitles.some(s=>s.ttsAudioUrl&&currentTime>=s.startTime&&currentTime<s.endTime)?0.25:1)));
    if(Math.abs(video.currentTime-Math.min(video.duration||currentTime,currentTime))>0.6)video.currentTime=Math.min(video.duration||currentTime,currentTime);
    if(isPlaying&&(!Number.isFinite(video.duration)||currentTime<video.duration-.05))video.play().catch(()=>{});else video.pause();
  },[videoUrl,isPlaying,currentTime,playbackSpeed,originalAudioVolume,bgmDucking,subtitles]);

  // Find currently active subtitle
  const activeSub = useMemo(() => {
    return subtitles.find(
      (s) => currentTime >= (dubAudioUrl?s.dubStartTime??s.startTime:s.startTime) && currentTime < (dubAudioUrl?s.dubEndTime??s.endTime:s.endTime)
    );
  }, [subtitles, currentTime, dubAudioUrl]);

  // Find character speaking
  const activeChar = useMemo(() => {
    if (!activeSub) return null;
    return characters.find((c) => c.id === activeSub.characterId);
  }, [activeSub, characters]);

  useEffect(()=>{
    if(!dubAudioUrl)return;
    const audio=new Audio(dubAudioUrl);dubRef.current=audio;
    audio.ontimeupdate=()=>{if(!videoRef.current||videoRef.current.ended||audio.currentTime>=(videoRef.current.duration||Infinity)-.05)onTimeUpdate(audio.currentTime);};
    return()=>{audio.pause();audio.src='';dubRef.current=null;};
  },[dubAudioUrl]);
  useEffect(()=>{
    const audio=dubRef.current;if(!audio)return;
    audio.playbackRate=playbackSpeed;
    if(Math.abs(audio.currentTime-currentTime)>.35)audio.currentTime=currentTime;
    if(isPlaying){stopAudioPreview();audio.play().catch(()=>{});}else audio.pause();
  },[isPlaying,currentTime,playbackSpeed,dubAudioUrl]);
  useEffect(()=>{const pauseForPreview=()=>{dubRef.current?.pause();videoRef.current?.pause();if(isPlaying)onTogglePlay();};window.addEventListener('hnvoice-preview',pauseForPreview);return()=>window.removeEventListener('hnvoice-preview',pauseForPreview);},[isPlaying,onTogglePlay]);
  useEffect(()=>{const audio=dubRef.current;if(!audio)return;audio.onended=()=>{if(isPlaying)onTogglePlay();};},[isPlaying,dubAudioUrl,onTogglePlay]);

  // Animation frame loop for simulated cinematic scene or video rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      // Draw background: Cinematic Chinese drama scene simulation
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#10141e');
      gradient.addColorStop(0.5, '#1e2436');
      gradient.addColorStop(1, '#0c0e14');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Living room / Office ambient lighting
      ctx.save();
      ctx.fillStyle = 'rgba(255, 180, 100, 0.08)';
      ctx.beginPath();
      ctx.arc(width * 0.75, height * 0.35, 180, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Film grain / Cinematic letterbox bars
      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, width, 40);
      ctx.fillRect(0, height - 40, width, 40);

      // Draw Drama Scene Characters
      const t = currentTime;
      const isSpeaking = !!activeChar;

      // Character avatar representation in canvas
      characters.forEach((char, idx) => {
        const xPos = width * 0.2 + idx * (width * 0.2);
        const isCurrentSpeaker = activeChar?.id === char.id;
        const yBase = height * 0.62;

        // Podium / silhouette
        ctx.save();
        ctx.shadowColor = isCurrentSpeaker ? char.color : 'transparent';
        ctx.shadowBlur = isCurrentSpeaker ? 25 : 0;

        ctx.fillStyle = isCurrentSpeaker ? char.color : '#27272a';
        ctx.beginPath();
        ctx.arc(xPos, yBase, isCurrentSpeaker ? 34 : 26, 0, Math.PI * 2);
        ctx.fill();

        // Icon initial
        ctx.fillStyle = '#ffffff';
        ctx.font = `${isCurrentSpeaker ? 'bold 20px' : '15px'} sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(char.name.charAt(0), xPos, yBase);

        // Name tag
        ctx.fillStyle = isCurrentSpeaker ? '#ffffff' : '#a1a1aa';
        ctx.font = '12px sans-serif';
        ctx.fillText(char.name.split(' ')[0], xPos, yBase + 46);

        // Speaking sound wave indicator
        if (isCurrentSpeaker && isPlaying) {
          const waveHeight = Math.sin(t * 12) * 8 + 12;
          ctx.strokeStyle = char.color;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(xPos - 15, yBase - 45);
          ctx.lineTo(xPos, yBase - 45 - waveHeight);
          ctx.lineTo(xPos + 15, yBase - 45);
          ctx.stroke();
        }

        ctx.restore();
      });

      // Overlay Scene Timecode & Tag
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`HN VOICE STUDIO • SENSEVOICE ASR • VIENEU-TTS v3 TURBO`, 20, 26);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [currentTime, characters, activeChar, isPlaying]);

  // Format seconds to mm:ss.ms
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0e0e11] border-b border-[#27272a] overflow-hidden select-none">
      {/* Video Viewport */}
      <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            src={videoUrl}
            className="w-full h-full object-contain"
            muted={originalAudioMuted}
            onTimeUpdate={e=>{if(currentTime<=e.currentTarget.duration+.05)onTimeUpdate(e.currentTarget.currentTime);}}
            onEnded={()=>{if(isPlaying&&(!dubAudioUrl||(dubDuration||0)<=(videoRef.current?.duration||0)+.05))onTogglePlay();}}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={854}
            height={480}
            className="w-full h-full max-h-[520px] object-contain shadow-2xl"
          />
        )}

        {/* Burned-in Subtitle Overlay on Video */}
        {subtitleMode !== 'off' && activeSub && (
          <div className="absolute bottom-12 inset-x-4 flex flex-col items-center pointer-events-none z-10 transition-all duration-150">
            {activeChar && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full mb-1 text-white shadow"
                style={{ backgroundColor: activeChar.color }}
              >
                {activeChar.name}
              </span>
            )}

            <div className="bg-black/75 backdrop-blur-sm px-4 py-2 rounded-lg text-center max-w-[85%] border border-white/10 shadow-2xl">
              {/* Vietnamese Subtitle */}
              {(subtitleMode === 'bilingual' || subtitleMode === 'vi') && (
                <p className="text-white font-medium text-base md:text-lg tracking-wide leading-snug drop-shadow-md">
                  {activeSub.textVi || activeSub.textZh}
                </p>
              )}

              {/* Chinese Original Subtitle */}
              {(subtitleMode === 'bilingual' || subtitleMode === 'zh') && (
                <p className="text-amber-300 text-xs md:text-sm font-normal tracking-wider opacity-90 mt-0.5">
                  {activeSub.textZh}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Active speaker pill (Top Left) */}
        {activeChar && (
          <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full animate-ping"
              style={{ backgroundColor: activeChar.color }}
            />
            <span className="text-zinc-300 font-medium">{activeChar.name}:</span>
            <span className="text-zinc-400 truncate max-w-[180px]">
              {activeSub?.voiceId ? 'VieNeu-TTS Đã gán' : 'Chưa gán giọng'}
            </span>
          </div>
        )}

        {/* Subtitle Display Mode Selector (Top Right) */}
        <div className="absolute top-4 right-4 flex items-center space-x-1 bg-black/60 backdrop-blur-md p-1 rounded-lg border border-white/10 text-xs">
          <Subtitles className="w-3.5 h-3.5 text-zinc-400 ml-1.5 mr-0.5" />
          <button
            onClick={() => setSubtitleMode('bilingual')}
            className={`px-2 py-0.5 rounded ${
              subtitleMode === 'bilingual'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Song ngữ
          </button>
          <button
            onClick={() => setSubtitleMode('vi')}
            className={`px-2 py-0.5 rounded ${
              subtitleMode === 'vi'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tiếng Việt
          </button>
          <button
            onClick={() => setSubtitleMode('zh')}
            className={`px-2 py-0.5 rounded ${
              subtitleMode === 'zh'
                ? 'bg-rose-600 text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tiếng Trung
          </button>
          <button
            onClick={() => setSubtitleMode('off')}
            className={`px-2 py-0.5 rounded ${
              subtitleMode === 'off'
                ? 'bg-zinc-700 text-white font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Tắt
          </button>
        </div>
      </div>

      {/* Video Playback Control Bar */}
      <div className="h-12 bg-[#141418] border-t border-[#27272a] flex items-center justify-between px-4 text-xs">
        {/* Play/Pause & Time */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onTogglePlay}
            className="w-8 h-8 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow transition-transform active:scale-95"
            title="Phát / Tạm dừng (Phím Space)"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
          </button>

          <button
            onClick={() => onTimeUpdate(0)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            title="Quay lại đầu"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="font-mono text-zinc-300 font-medium">
            <span data-testid="playback-time" className="text-white font-semibold">{formatTime(currentTime)}</span>
            <span className="text-zinc-500 mx-1">/</span>
            <span className="text-zinc-400">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Audio Mixing & Ducking Controls */}
        <div className="flex items-center space-x-4">
          {/* Original Audio controls */}
          <div className="flex items-center space-x-2 bg-[#1b1b20] px-2.5 py-1 rounded-md border border-zinc-800">
            <button
              onClick={onToggleOriginalMute}
              className={`p-1 rounded ${
                originalAudioMuted ? 'text-red-400' : 'text-zinc-400 hover:text-white'
              }`}
              title={originalAudioMuted ? 'Bật tiếng gốc' : 'Tắt tiếng gốc'}
            >
              {originalAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <span className="text-[11px] text-zinc-400">Âm thanh gốc:</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={originalAudioMuted ? 0 : originalAudioVolume}
              onChange={(e) => onChangeOriginalVolume(parseFloat(e.target.value))}
              className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-rose-500"
            />
          </div>

          {/* Background Audio Ducking Toggle */}
          <button
            onClick={onToggleDucking}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium flex items-center space-x-1.5 border transition-colors ${
              bgmDucking
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-zinc-200'
            }`}
            title="Tự động giảm âm lượng nhạc nền khi nhân vật đang nói tiếng Việt"
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Ducking nhạc nền</span>
          </button>

          {/* Speed Selector */}
          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
            className="bg-[#1b1b20] border border-zinc-800 rounded px-2 py-1 text-zinc-300 text-[11px] focus:outline-none"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
        </div>
      </div>
    </div>
  );
};

