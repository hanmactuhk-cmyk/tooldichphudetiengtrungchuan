"""Measure real TTS first, then fit a complete split group inside its original window."""
import math

def allocate_groups(cues,clips):
    planned=[dict(c) for c in cues]
    groups={}
    for i,c in enumerate(planned):
        if c.get('smartGroupId'):groups.setdefault(c['smartGroupId'],[]).append(i)
    for indexes in groups.values():
        first=planned[indexes[0]]
        if len(indexes)!=int(first.get('smartGroupCount',0)):continue
        start=float(first['smartGroupStart']);end=float(first['smartGroupEnd'])
        if not math.isfinite(start+end) or start<0 or end<=start:raise ValueError('Khoảng nhóm phụ đề đã chia không hợp lệ.')
        if any(abs(float(planned[i].get('smartGroupStart',-1))-start)>.001 or abs(float(planned[i].get('smartGroupEnd',-1))-end)>.001 for i in indexes):raise ValueError('Mốc nhóm phụ đề không thống nhất.')
        if any(i not in indexes and float(c['startTime'])<end-.00001 and float(c['endTime'])>start+.00001 for i,c in enumerate(planned)):raise ValueError('Nhóm phụ đề bị chồng thời gian với câu khác; cần kiểm tra thủ công.')
        durations=[float(clips[i]['duration']) for i in indexes]
        total=sum(durations)
        if total<=0 or not math.isfinite(total):raise ValueError('TTS trả thời lượng không hợp lệ.')
        # Different configured limits are safe: reserve each clip's minimum readable duration.
        minimums=[max(.04,d/float(planned[i].get('smartMaxSpeed',1.2))) for i,d in zip(indexes,durations)]
        if sum(minimums)>end-start+.000001:raise ValueError(f'Cần xử lý thời lượng nhóm {first.get("smartSourceId",first["id"])}: giọng thật {total:.2f}s, khoảng gốc {end-start:.2f}s; vượt giới hạn tăng tốc. Không cắt lời. Hãy chỉnh bản dịch hoặc mốc thời gian.')
        remainder=end-start-sum(minimums);at=start
        for n,(i,d,minimum) in enumerate(zip(indexes,durations,minimums)):
            until=end if n==len(indexes)-1 else round(at+minimum+remainder*d/total,6)
            planned[i]['startTime']=at;planned[i]['endTime']=until
            planned[i]['viStartTime']=at;planned[i]['viEndTime']=until;at=until
    return planned

def measured_speech(cues,dubbing,progress,cancelled):
    ordered=sorted(cues,key=lambda c:float(c['startTime']));raw=[]
    for i,cue in enumerate(ordered):
        if cancelled():raise RuntimeError('Đã dừng tạo giọng.')
        limit=float(cue.get('smartMaxSpeed',12))
        if not math.isfinite(limit) or not 1<=limit<=12:raise ValueError('Giới hạn tốc độ không hợp lệ.')
        progress(int(i/len(ordered)*80),f'Đang tạo và đo giọng {i+1}/{len(ordered)}')
        raw.append(dubbing.synthesize(cue['textVi'],cue.get('voiceId'),cue.get('speed',1),cue.get('pitch',0),cue.get('volume',1)))
    planned=allocate_groups(ordered,raw);pairs=sorted(zip(planned,raw),key=lambda p:float(p[0]['startTime']));result=[]
    for i,(cue,clip) in enumerate(pairs):
        if cancelled():raise RuntimeError('Đã dừng tạo giọng.')
        start=float(cue['startTime']);end=float(cue['endTime'])
        if i+1<len(pairs):end=min(end,float(pairs[i+1][0]['startTime']))
        limit=float(cue.get('smartMaxSpeed',12))
        try:fitted=dubbing.fit_to_slot(clip,end-start,max_speed=limit)
        except ValueError as exc:raise ValueError(f'Cần xử lý thời lượng câu “{cue["textVi"][:90]}”: WAV {clip["duration"]:.2f}s / khung {end-start:.2f}s; tối đa {limit:g}×. {exc}') from exc
        result.append((cue,fitted))
    return result
