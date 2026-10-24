import React, { useState } from 'react';
import {
  Play,
  Square,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Mic,
  Languages,
  Sliders,
  Smile,
  Wind,
  Activity,
  ArrowRight,
  Filter,
  Search,
} from 'lucide-react';
import { Subtitle, Character } from '../types';
import { VIENEU_VOICES, playAudioPreview, stopAudioPreview } from '../lib/vieneu-engine';
import { evaluateDubbingPacing } from '../lib/translator-engine';

interface SubtitleEditorProps {
  isProcessing?:boolean;
  subtitles: Subtitle[];
  characters: Character[];
  selectedSubtitleId: string | null;
  onSelectSubtitle: (id: string | null) => void;
  onUpdateSubtitle: (id: string, updates: Partial<Subtitle>) => void;
  onRetranslateSentence: (id: string) => void;
  onOpenCaptionPopup:(id:string)=>void;
  onSplitCue:(id:string)=>void;
  onRegenerateTtsSentence: (id: string) => void;
  onCheckWithParaformer: (id: string) => void;
}

export const SubtitleEditor: React.FC<SubtitleEditorProps> = ({
  subtitles,
  characters,
  selectedSubtitleId,
  onSelectSubtitle,
  onUpdateSubtitle,
  onRetranslateSentence,
  onOpenCaptionPopup,
  onSplitCue,
  onRegenerateTtsSentence,
  onCheckWithParaformer,
  isProcessing,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_retranslation' | 'needs_tts' | 'warning_overflow'>('all');
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Filtered list
  const filteredSubtitles = subtitles.filter((sub) => {
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      sub.textZh.toLowerCase().includes(q) ||
      (sub.textVi && sub.textVi.toLowerCase().includes(q))
    );
  });

  const handlePlayAudio = (sub: Subtitle) => {
    if (playingId === sub.id) {
      stopAudioPreview();
      setPlayingId(null);
      return;
    }

    if (sub.ttsAudioUrl) {
      setPlayingId(sub.id);
      playAudioPreview(sub.ttsAudioUrl, () => setPlayingId(null));
    }
  };

  const handleInsertTag = (sub: Subtitle, tag: string) => {
    const current = sub.textVi || '';
    const updated = `${current} ${tag}`.trim();
    onUpdateSubtitle(sub.id, {
      textVi: updated,
      status: 'needs_tts',
    });
  };

  const getStatusBadge = (status: Subtitle['status']) => {
    switch (status) {
      case 'raw':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400">Chưa dịch</span>;
      case 'needs_retranslation':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30">Cần dịch lại</span>;
      case 'translated':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30">Đã dịch</span>;
      case 'needs_tts':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30">Cần tạo lại TTS</span>;
      case 'synced':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center space-x-1"><CheckCircle2 className="w-2.5 h-2.5" /><span>Đã căn giọng</span></span>;
      case 'warning_overflow':
        return <span className="px-1.5 py-0.5 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1"><AlertTriangle className="w-2.5 h-2.5" /><span>Quá dài</span></span>;
    }
  };

  return (
    <div inert={isProcessing} aria-busy={isProcessing} className={"w-72 lg:w-[320px] bg-[#16161a] border-l border-[#27272a] flex flex-col shrink-0 select-none overflow-hidden "+(isProcessing?"pointer-events-none opacity-60":"")}>
      {/* Editor Header */}
      <div className="p-3 border-b border-[#27272a] bg-[#18181c] space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Languages className="w-4 h-4 text-rose-400" />
            <h3 className="font-semibold text-zinc-200 text-xs tracking-wider uppercase">
              Biên tập phụ đề & Lồng tiếng
            </h3>
          </div>
          <span className="text-[11px] font-mono text-zinc-400">
            {subtitles.length} câu
          </span>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
            <input
              type="text"
              placeholder="Tìm kiếm tiếng Trung / Việt..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#111114] border border-zinc-800 rounded-md pl-8 pr-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-[#111114] border border-zinc-800 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="all">Tất cả</option>
            <option value="needs_retranslation">Cần dịch lại</option>
            <option value="needs_tts">Cần tạo lại TTS</option>
            <option value="warning_overflow">Cảnh báo thời lượng</option>
          </select>
        </div>
      </div>

      {/* Subtitles Scrollable List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5 divide-y divide-zinc-800/60">
        {filteredSubtitles.map((sub, index) => {
          const isSelected = sub.id === selectedSubtitleId;
          const char = characters.find((c) => c.id === sub.characterId);
          const duration = sub.endTime - sub.startTime;
          const pacing = sub.textVi ? evaluateDubbingPacing(sub.textVi, sub.startTime, sub.endTime, sub.speed) : null;

          return (
            <div
              key={sub.id}
              onClick={() => onSelectSubtitle(sub.id)}
              className={`pt-3 first:pt-0 rounded-lg p-2.5 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-zinc-800/80 border border-zinc-700 shadow-lg'
                  : 'hover:bg-zinc-800/40 border border-transparent'
              }`}
            >
              {/* Row Header: Number, Time, Character & Status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-zinc-400 text-xs font-bold">
                    #{index + 1}
                  </span>

                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    {sub.startTime.toFixed(1)}s - {sub.endTime.toFixed(1)}s ({duration.toFixed(1)}s)
                  </span>

                  {/* Character selector */}
                  <select
                    aria-label={`Nhân vật câu ${sub.id}`}
                    value={sub.characterId}
                    onChange={(e) => {
                      e.stopPropagation();
                      const newChar = characters.find((c) => c.id === e.target.value);
                      onUpdateSubtitle(sub.id, {
                        characterId: e.target.value,
                        voiceId: newChar?.voiceId || sub.voiceId,
                        status: 'needs_tts',
                      });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 focus:outline-none"
                    style={{ borderLeftColor: char?.color, borderLeftWidth: '3px' }}
                  >
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center space-x-1.5">
                  {getStatusBadge(sub.status)}
                </div>
              </div>

              {/* Chinese original field (Editable) */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span className="font-semibold text-amber-400">Phụ đề gốc:</span>

                </div>
                <textarea
                  rows={2}
                  value={sub.textZh}
                  onChange={(e) => {
                    onUpdateSubtitle(sub.id, {
                      textZh: e.target.value,
                      status: 'needs_retranslation', // Rule: marks needs retranslation without wiping Vietnamese/TTS
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-[#111114] border border-zinc-800 rounded p-1.5 text-xs text-amber-200 font-sans focus:outline-none focus:border-amber-500/70"
                />
              </div>

              {/* Vietnamese translated field (Editable) */}
              <div className="mb-2">
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span className="font-semibold text-rose-400">Tiếng Việt (bản dịch đã chọn):</span>
                  <div className="flex items-center space-x-1">
                  </div>
                </div>

                <textarea
                  rows={2}
                  value={sub.textVi || ''}
                  placeholder="Nhấn 'Dịch sang tiếng Việt' hoặc nhập bản dịch thủ công..."
                  onChange={(e) => {
                    onUpdateSubtitle(sub.id, {
                      textVi: e.target.value,
                      status: 'needs_tts', // Rule: marks needs TTS without wiping Chinese
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-[#111114] border border-zinc-800 rounded p-1.5 text-xs text-zinc-100 font-sans focus:outline-none focus:border-rose-500/70"
                />

                {/* Overflow Pacing Warning & Suggestion */}
                {pacing?.isOverflow && sub.suggestedViShort && (
                  <div className="mt-1 p-2 rounded bg-rose-950/40 border border-rose-500/40 text-[11px] space-y-1">
                    <div className="flex items-center text-rose-300 font-medium space-x-1">
                      <AlertTriangle className="w-3 h-3 text-rose-400" />
                      <span>Câu quá dài ({pacing.wordCount} từ / {duration.toFixed(1)}s)!</span>
                    </div>
                    <div className="text-zinc-300 text-[10px]">
                      Gợi ý rút gọn: <span className="text-amber-200">{sub.suggestedViShort}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateSubtitle(sub.id, {
                          textVi: sub.suggestedViShort,
                          status: 'needs_tts',
                        });
                      }}
                      className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-semibold"
                    >
                      Áp dụng bản rút gọn
                    </button>
                  </div>
                )}
              </div>

              {/* Subtitle Action & TTS Controls */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center space-x-1.5">
                  {/* Re-translate button */}
                  <button aria-label={'Mở popup phụ đề '+sub.id} disabled={isProcessing} className="text-[10px] bg-cyan-900 rounded px-2 py-1" onClick={e=>{e.stopPropagation();onOpenCaptionPopup(sub.id);}}>Chỉnh popup</button><button aria-label={'Tách đôi câu '+sub.id} disabled={isProcessing} className="text-[10px] bg-zinc-800 rounded px-2 py-1" onClick={e=>{e.stopPropagation();onSplitCue(sub.id);}}>Tách đôi câu</button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRetranslateSentence(sub.id);
                    }}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] flex items-center space-x-1 border border-zinc-700"
                    title="Dịch lại câu này với OPUS-MT"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-blue-400" />
                    <span>Dịch lại</span>
                  </button>

                  {/* Regenerate TTS button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerateTtsSentence(sub.id);
                    }}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] flex items-center space-x-1 border border-zinc-700"
                    title="Tạo lại giọng đọc tiếng Việt câu này"
                  >
                    <Mic className="w-2.5 h-2.5 text-rose-400" />
                    <span>Tạo lại TTS</span>
                  </button>
                </div>

                {/* Audio preview playback */}
                {sub.ttsAudioUrl && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayAudio(sub);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold flex items-center space-x-1 shadow transition-colors ${
                      playingId === sub.id
                        ? 'bg-rose-600 text-white animate-pulse'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {playingId === sub.id ? (
                      <>
                        <Square className="w-2.5 h-2.5 fill-white" />
                        <span>Dừng</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-2.5 h-2.5 fill-white" />
                        <span>Nghe thử ({sub.ttsDuration?.toFixed(1)}s)</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
