import React, { useRef, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Volume2,
  Video,
  FileText,
  Mic,
  AlertTriangle,
  Scissors,
  Split,
  Combine,
  Trash2,
} from 'lucide-react';
import { Subtitle, Character } from '../types';

interface TimelineProps {
  subtitles: Subtitle[];
  characters: Character[];
  currentTime: number;
  duration: number;
  selectedSubtitleId: string | null;
  onSelectSubtitle: (id: string | null) => void;
  onSeek: (time: number) => void;
  onSplitSubtitle: (id: string, splitTime: number) => void;
  onDeleteSubtitle: (id: string) => void;
}

export const Timeline: React.FC<TimelineProps> = ({
  subtitles,
  characters,
  currentTime,
  duration,
  selectedSubtitleId,
  onSelectSubtitle,
  onSeek,
  onSplitSubtitle,
  onDeleteSubtitle,
}) => {
  const [pixelsPerSecond, setPixelsPerSecond] = useState<number>(45);
  const timelineContentRef = useRef<HTMLDivElement | null>(null);

  const totalWidth = Math.max(800, duration * pixelsPerSecond + 100);

  // Handle click on timeline time ruler to seek
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineContentRef.current) return;
    const rect = timelineContentRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left + timelineContentRef.current.scrollLeft;
    const newTime = Math.max(0, Math.min(duration, clickX / pixelsPerSecond));
    onSeek(newTime);
  };

  const selectedSub = subtitles.find((s) => s.id === selectedSubtitleId);

  return (
    <div className="h-64 bg-[#141418] border-t border-[#27272a] flex flex-col select-none shrink-0">
      {/* Timeline Toolbar */}
      <div className="h-9 bg-[#18181c] border-b border-[#27272a] px-3 flex items-center justify-between text-xs">
        {/* Track labels & editing buttons */}
        <div className="flex items-center space-x-2">
          <span className="font-semibold text-zinc-300 text-[11px] uppercase tracking-wider">
            CapCut Timeline Multi-Track
          </span>

          <div className="h-4 w-[1px] bg-zinc-700 mx-1" />

          {selectedSub && (
            <div className="flex items-center space-x-1.5 animate-fadeIn">
              <button
                onClick={() => onSplitSubtitle(selectedSub.id, currentTime)}
                disabled={currentTime <= selectedSub.startTime || currentTime >= selectedSub.endTime}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center space-x-1 text-[11px] disabled:opacity-40"
                title="Tách phụ đề tại con trỏ hiện tại"
              >
                <Scissors className="w-3 h-3 text-amber-400" />
                <span>Tách câu (C)</span>
              </button>

              <button
                onClick={() => onDeleteSubtitle(selectedSub.id)}
                className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-red-900/40 text-red-300 flex items-center space-x-1 text-[11px]"
                title="Xóa phụ đề đang chọn"
              >
                <Trash2 className="w-3 h-3 text-red-400" />
                <span>Xóa</span>
              </button>
            </div>
          )}
        </div>

        {/* Zoom controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPixelsPerSecond((p) => Math.max(20, p - 10))}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title="Thu nhỏ Timeline (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-zinc-400 font-mono w-10 text-center">
            {pixelsPerSecond} px/s
          </span>
          <button
            onClick={() => setPixelsPerSecond((p) => Math.min(140, p + 10))}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white"
            title="Phóng to Timeline (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Track Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Headers (Left column) */}
        <div className="w-44 bg-[#16161a] border-r border-[#27272a] flex flex-col shrink-0 text-xs text-zinc-400">
          {/* Header ruler placeholder */}
          <div className="h-6 border-b border-[#27272a] px-3 flex items-center text-[10px] text-zinc-500 font-mono">
            TRACKS
          </div>

          {/* Track 1: Video */}
          <div className="h-10 border-b border-[#27272a] px-3 flex items-center space-x-2 text-zinc-300">
            <Video className="w-3.5 h-3.5 text-blue-400" />
            <span className="truncate font-medium text-[11px]">Video MP4</span>
          </div>

          {/* Track 2: Original Audio */}
          <div className="h-10 border-b border-[#27272a] px-3 flex items-center space-x-2 text-zinc-300">
            <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="truncate font-medium text-[11px]">Âm thanh gốc</span>
          </div>

          {/* Track 3: Chinese Subtitles */}
          <div className="h-10 border-b border-[#27272a] px-3 flex items-center space-x-2 text-zinc-300">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate font-medium text-[11px]">Phụ đề Trung</span>
          </div>

          {/* Track 4: Vietnamese Subtitles */}
          <div className="h-10 border-b border-[#27272a] px-3 flex items-center space-x-2 text-zinc-300">
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span className="truncate font-medium text-[11px]">Phụ đề Việt (bản dịch)</span>
          </div>

          {/* Track 5: Piper Dubbing */}
          <div className="h-12 border-b border-[#27272a] px-3 flex items-center space-x-2 text-zinc-300">
            <Mic className="w-3.5 h-3.5 text-rose-400" />
            <span className="truncate font-medium text-[11px]">VieNeu-TTS</span>
          </div>
        </div>

        {/* Scrollable Track Content (Right canvas area) */}
        <div
          ref={timelineContentRef}
          className="flex-1 overflow-x-auto overflow-y-hidden relative bg-[#0f0f13]"
          onClick={handleTimelineClick}
        >
          <div className="relative h-full" style={{ width: `${totalWidth}px` }}>
            {/* Time Ruler (Top bar) */}
            <div className="h-6 border-b border-[#27272a] bg-[#121216] relative">
              {Array.from({ length: Math.ceil(duration) + 5 }).map((_, sec) => (
                <div
                  key={sec}
                  className="absolute top-0 bottom-0 border-l border-zinc-800 text-[9px] font-mono text-zinc-500 pl-1"
                  style={{ left: `${sec * pixelsPerSecond}px` }}
                >
                  {sec % 5 === 0 ? `${sec}s` : ''}
                </div>
              ))}
            </div>

            {/* Playhead Scrubber */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all duration-75"
              style={{ left: `${currentTime * pixelsPerSecond}px` }}
            >
              {/* Playhead handle */}
              <div className="w-3.5 h-3.5 -ml-[7px] bg-rose-500 rounded-sm rotate-45 shadow-md flex items-center justify-center pointer-events-auto cursor-ew-resize" />
              {/* Playhead vertical red line */}
              <div className="w-[1.5px] h-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            </div>

            {/* Track 1: Video Strip */}
            <div className="h-10 border-b border-[#27272a] bg-zinc-900/60 relative flex items-center">
              <div
                className="h-7 bg-blue-950/70 border border-blue-500/40 rounded px-2 flex items-center text-[10px] text-blue-200"
                style={{ width: `${duration * pixelsPerSecond}px` }}
              >
                🎬 Video gốc tiếng Trung ({duration.toFixed(1)}s)
              </div>
            </div>

            {/* Track 2: Original Audio Waveform Strip */}
            <div className="h-10 border-b border-[#27272a] bg-zinc-900/40 relative flex items-center">
              <div
                className="h-7 bg-emerald-950/60 border border-emerald-500/30 rounded px-2 flex items-center overflow-hidden"
                style={{ width: `${duration * pixelsPerSecond}px` }}
              >
                <div className="w-full flex items-center space-x-1 opacity-70">
                  {Array.from({ length: Math.floor((duration * pixelsPerSecond) / 6) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-emerald-400 rounded-full"
                      style={{ height: `${Math.abs(Math.sin(i * 0.7)) * 18 + 4}px` }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Track 3: Chinese Subtitles Track */}
            <div className="h-10 border-b border-[#27272a] relative">
              {subtitles.map((sub) => {
                const left = sub.startTime * pixelsPerSecond;
                const width = Math.max(30, (sub.endTime - sub.startTime) * pixelsPerSecond);
                const isSelected = sub.id === selectedSubtitleId;
                const char = characters.find((c) => c.id === sub.characterId);

                return (
                  <div
                    key={`zh-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSubtitle(sub.id);
                    }}
                    className={`absolute top-1.5 h-7 rounded border px-1.5 flex items-center text-[11px] truncate cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-amber-500/30 border-amber-400 text-white shadow-md z-20 ring-1 ring-amber-400'
                        : 'bg-zinc-800/90 border-zinc-700 text-amber-200 hover:bg-zinc-700/80'
                    }`}
                    style={{ left: `${left}px`, width: `${width}px` }}
                    title={`[${sub.startTime.toFixed(1)}s - ${sub.endTime.toFixed(1)}s] ${sub.textZh}`}
                  >
                    <span className="truncate">{sub.textZh}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 4: Vietnamese Subtitles Track (bản dịch) */}
            <div className="h-10 border-b border-[#27272a] relative">
              {subtitles.map((sub) => {
                const left = sub.startTime * pixelsPerSecond;
                const width = Math.max(30, (sub.endTime - sub.startTime) * pixelsPerSecond);
                const isSelected = sub.id === selectedSubtitleId;
                const char = characters.find((c) => c.id === sub.characterId);

                return (
                  <div
                    key={`vi-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSubtitle(sub.id);
                    }}
                    className={`absolute top-1.5 h-7 rounded border px-1.5 flex items-center text-[11px] truncate cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-400 text-white shadow-md z-20 ring-1 ring-purple-400'
                        : 'border-zinc-700 text-zinc-100 hover:brightness-110'
                    }`}
                    style={{
                      left: `${left}px`,
                      width: `${width}px`,
                      backgroundColor: char ? `${char.color}35` : '#3730a340',
                      borderLeftColor: char ? char.color : '#818cf8',
                      borderLeftWidth: '3px',
                    }}
                    title={`[${sub.startTime.toFixed(1)}s - ${sub.endTime.toFixed(1)}s] ${
                      sub.textVi || '(Chưa dịch)'
                    }`}
                  >
                    <span className="truncate">{sub.textVi || sub.textZh}</span>
                  </div>
                );
              })}
            </div>

            {/* Track 5: VieNeu-TTS Audio Track */}
            <div className="h-12 border-b border-[#27272a] relative bg-zinc-950/40">
              {subtitles.map((sub) => {
                const left = (sub.dubStartTime??sub.startTime) * pixelsPerSecond;
                const slotWidth = (sub.endTime - sub.startTime) * pixelsPerSecond;
                const isSelected = sub.id === selectedSubtitleId;
                const hasTts = !!sub.ttsAudioUrl;
                const measuredTtsDuration = sub.ttsDuration || (sub.endTime - sub.startTime);
                const ttsBlockWidth = measuredTtsDuration * pixelsPerSecond;
                const isOverflow = measuredTtsDuration > (sub.endTime - sub.startTime) + 0.15;

                return (
                  <div
                    key={`tts-${sub.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSubtitle(sub.id);
                    }}
                    className={`absolute top-1.5 h-9 rounded-md border px-2 flex items-center justify-between text-[11px] cursor-pointer transition-all ${
                      isOverflow
                        ? 'bg-rose-950/80 border-rose-500 text-rose-200'
                        : hasTts
                        ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'
                        : 'bg-zinc-900 border-dashed border-zinc-700 text-zinc-500'
                    } ${isSelected ? 'ring-2 ring-white z-20' : ''}`}
                    style={{
                      left: `${left}px`,
                      width: `${hasTts ? Math.max(35, ttsBlockWidth) : Math.max(35, slotWidth)}px`,
                    }}
                    title={
                      hasTts
                        ? `WAV 48kHz: ${measuredTtsDuration.toFixed(2)}s (Khung phụ đề: ${(
                            sub.endTime - sub.startTime
                          ).toFixed(2)}s)${isOverflow ? ' - CẢNH BÁO: Dài hơn khung!' : ''}`
                        : 'Chưa tạo file âm thanh VieNeu'
                    }
                  >
                    <div className="flex items-center space-x-1 truncate">
                      <Mic className={`w-3 h-3 ${hasTts ? 'text-emerald-400' : 'text-zinc-600'}`} />
                      <span className="truncate font-mono">
                        {hasTts ? `${measuredTtsDuration.toFixed(2)}s` : 'TTS'}
                      </span>
                    </div>

                    {isOverflow && (
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 animate-bounce" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
