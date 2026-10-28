import React,{useState} from 'react';
import {ProjectData} from '../types';
import {DEFAULT_SPLIT,SplitSettings,SplitPlan,planSmartSplit,countWords} from '../lib/smart-split';
import {FloatingPanel} from './FloatingPanel';
import {playAudioPreview,stopAudioPreview} from '../lib/vieneu-engine';

export function SmartSplitDialog({project,selectedIds,onClose,onApply,onUndo,onSeek}:{project:ProjectData;selectedIds:string[];onClose:()=>void;onApply:(plan:SplitPlan)=>void;onUndo:()=>void;onSeek:(time:number)=>void}){
 const [settings,setSettings]=useState<SplitSettings>(project.smartSplitSettings||DEFAULT_SPLIT),[scope,setScope]=useState('all'),[plan,setPlan]=useState<SplitPlan|null>(null),[error,setError]=useState('');
 const update=(v:Partial<SplitSettings>)=>{setSettings(s=>({...s,...v}));setPlan(null);setError('')};
 const preview=()=>{try{setPlan(planSmartSplit(project.subtitles,settings,scope==='selected'?new Set(selectedIds):undefined));setError('')}catch(e){setError(String(e))}};
 return <FloatingPanel title="Tự động chia câu dài" width={620} onClose={()=>{stopAudioPreview();onClose()}}><div className="space-y-3 text-xs" data-testid="smart-split-dialog">
  <p>Chỉ chia phụ đề Việt thành các đoạn ngắn để hiện trên video. Không nhờ AI viết lại hay bỏ chữ. Âm thanh đã tạo giữ nguyên tệp, thời lượng, âm lượng và tốc độ; không cắt, chia hay tạo lại giọng đọc.</p>
  <label>Phạm vi<select aria-label="Phạm vi chia câu" value={scope} onChange={e=>{setScope(e.target.value);setPlan(null)}}><option value="all">Toàn bộ phụ đề Việt</option><option value="selected" disabled={!selectedIds.length}>Các câu đang chọn ({selectedIds.length})</option></select></label>
  <label>Giới hạn từ mỗi câu: <b>{settings.maxWords}</b><input aria-label="Giới hạn từ mỗi câu" type="range" min={4} max={20} step={1} value={settings.maxWords} onChange={e=>update({maxWords:+e.target.value})}/></label>
  <label>Tốc độ đọc ước tính để chia mốc phụ đề: <b>{settings.wordsPerSecond.toFixed(1)} từ/giây</b><input aria-label="Tốc độ đọc ước tính" type="range" min={1} max={8} step={.1} value={settings.wordsPerSecond} onChange={e=>update({wordsPerSecond:+e.target.value})}/></label>
  <label>Cụm từ / tên riêng cần giữ liền (mỗi dòng một cụm)<textarea aria-label="Cụm từ cần giữ liền" rows={2} value={settings.protectedPhrases.join('\n')} onChange={e=>update({protectedPhrases:e.target.value.split('\n').filter(Boolean)})}/></label>
  <p>✓ Giữ nguyên toàn bộ chữ và dấu câu · ✓ Giữ mốc đầu/cuối của câu gốc · ✓ Chia các mốc con nối tiếp nhau. Điểm ngắt theo dấu câu, mệnh đề và tên riêng; chỗ khó sẽ được đánh dấu để duyệt.</p>
  <div className="flex gap-2"><button className="primary-action" onClick={preview}>Xem trước</button><button disabled={!project.smartSplitBackup} onClick={onUndo}>Hoàn tác lần chia trước</button></div>
  {error&&<p role="alert">{error}</p>}
  {plan&&<><div role="status" className="border rounded-xl p-3"><p>Ban đầu: {plan.report.original} câu · Dài hơn {settings.maxWords} từ: {plan.report.long}</p><p>Đã chia: {plan.report.split} · Sau chia: {plan.report.after}</p><p>Ước tính chưa đủ thời lượng: {plan.report.overflow} · Cần kiểm tra thủ công: {plan.report.manual}</p><p>Thời gian các đoạn phụ đề được chia theo ước tính đọc, bên trong mốc câu gốc. Âm thanh hiện có không bị thay đổi.</p></div>
   {plan.rows.map((r,i)=><section key={r.id} className="rounded-xl border p-3 space-y-2" style={r.warnings.length?{borderColor:'#f59e0b'}:{}} data-testid="split-preview-row"><b>#{i+1} · {project.characters.find(c=>c.id===r.original.characterId)?.name||'Người nói'} · <span style={countWords(r.original.textVi!)>settings.maxWords?{color:'#e87924',fontWeight:800}:{}}>{countWords(r.original.textVi!)} từ</span></b><p>{r.original.textZh}</p><p>{r.original.textVi}</p>{r.warnings.map(w=><p key={w} role="note">⚠ {w}</p>)}{r.parts.map((c,k)=><div key={k} className="rounded-lg border p-2"><span>{c.start.toFixed(3)} → {c.end.toFixed(3)} · {countWords(c.text)} từ · ước tính {c.estimate.toFixed(2)}s</span><p>{c.text}</p><button onClick={()=>onSeek(c.start)}>Xem tại mốc này</button>{!r.changed&&r.original.ttsAudioUrl&&<button onClick={()=>playAudioPreview(r.original.ttsAudioUrl!)}>Nghe giọng đã có</button>}</div>)}</section>)}
   <p>Câu có cảnh báo vẫn cần bạn kiểm tra; mốc phụ đề là ước tính. Âm thanh gốc vẫn nằm nguyên vẹn trên timeline.</p><button className="primary-action" disabled={!plan.rows.some(r=>r.changed)} onClick={()=>onApply(plan)}>Áp dụng chỉ phụ đề</button></>}
  <button onClick={onClose}>Hủy</button>
 </div></FloatingPanel>;
}
