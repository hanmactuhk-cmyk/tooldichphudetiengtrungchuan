"""Video -> Gemini web via the same user-owned Chrome profile as translation."""
import math,re,time,tempfile
from pathlib import Path
from urllib.parse import urlparse
from subtitle_contract import parse_srt,to_srt,validate_cues

VIDEO_PROMPT=('Lấy phụ đề này giúp tôi, phụ đề khớp thời gian trên video. '
 'Trả về nội dung file SRT tiếng Trung với số thứ tự và thời gian HH:MM:SS,mmm --> HH:MM:SS,mmm. '
 'Chỉ trả nội dung SRT trong một khối mã srt, giữ nguyên tiếng Trung.')

def source_cues(text,duration,offset=0):
 rows=parse_srt(text)
 if not rows or len(rows)>5000:raise ValueError('Gemini chưa trả SRT có phụ đề hợp lệ. Phản hồi được giữ trên Chrome để kiểm tra.')
 result=[];previous=-1
 for i,row in enumerate(rows,1):
  a,b=row['startTime'],row['endTime'];value=row['textVi'].strip()
  if row['index']!=i or not(math.isfinite(a) and math.isfinite(b)) or a<0 or b<=a or a<previous or a>=duration or b>duration+1 or not value:
   raise ValueError('SRT Gemini có số thứ tự hoặc mốc ngoài video. Chưa thay phụ đề hiện tại; hãy kiểm tra phản hồi trên Chrome.')
  previous=a
  result.append({'id':f'gemini-{i}','startTime':round(offset+a,3),'endTime':round(offset+min(b,duration),3),'textZh':value,'characterId':'speaker-1','speed':1,'pitch':0,'volume':1,'status':'raw','modelUsedZh':'Gemini video CDP'})
 validate_cues(result)
 return result

def merge_cues(all_cues,new):
 for cue in new:
  text=re.sub(r'\s+','',cue['textZh'])
  duplicate=next((c for c in all_cues[-10:] if re.sub(r'\s+','',c['textZh'])==text and min(c['endTime'],cue['endTime'])>max(c['startTime'],cue['startTime'])),None)
  if duplicate:duplicate['endTime']=max(duplicate['endTime'],cue['endTime'])
  else:all_cues.append(cue)
 return all_cues

def extract_with_gemini(service,source,duration,ffmpeg,progress=lambda *_:None,cancelled=lambda:False):
 cfg=service.config('gemini')
 # Opening Chrome is asynchronous: wait for its CDP endpoint before connecting.
 service.open('gemini')
 from browser_translation import cdp_get
 for attempt in range(40):
  if cancelled():raise RuntimeError('Đã dừng lấy phụ đề.')
  try:cdp_get(cfg['port'],'/json/version');break
  except (OSError,ValueError):time.sleep(.5)
 else:raise ValueError('Chrome chưa mở được cổng điều khiển. Đóng Chrome Gemini riêng rồi thử lại.')
 if not service.locks['gemini'].acquire(blocking=False):raise ValueError('Gemini đang chạy tác vụ khác. Hãy chờ tác vụ đó hoàn tất.')
 try:
  from playwright.sync_api import sync_playwright
  with sync_playwright() as pw, tempfile.TemporaryDirectory(prefix='gemini-clips-',dir=source.parent) as temp:
   try:browser=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{cfg["port"]}',timeout=10000)
   except Exception as exc:raise ValueError('Chưa kết nối Gemini. Bấm Mở Gemini, tự đăng nhập, rồi thử lại.') from exc
   chunks=max(1,math.ceil(max(0,duration-1)/239));result=[];urls=[]
   for number in range(chunks):
    if cancelled():raise RuntimeError('Đã dừng lấy phụ đề Gemini.')
    offset=number*239;length=min(240,duration-offset)
    clip=source
    if chunks>1 or source.stat().st_size>64*1024**2 or source.suffix.lower()!='.mp4':
     progress(int(number/chunks*90)+1,f'Gemini: chuẩn bị đoạn {number+1}/{chunks}...')
     clip=Path(temp)/f'video-{number+1:03d}.mp4'
     ffmpeg('-ss',str(offset),'-i',source,'-t',str(length),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",'-c:v','libx264','-preset','veryfast','-crf','25','-c:a','aac','-b:a','64k','-movflags','+faststart',clip)
    page=browser.contexts[0].new_page();page.goto(cfg['url'],wait_until='domcontentloaded',timeout=60000)
    editor=None
    for _ in range(45):
     editor=service.visible(page,cfg['editors'])
     if editor is not None:break
     if cancelled():raise RuntimeError('Đã dừng lấy phụ đề.')
     time.sleep(1)
    if editor is None or urlparse(page.url).hostname!=cfg['host']:raise ValueError('Gemini chưa sẵn sàng. Hãy tự đăng nhập hoặc xử lý thông báo trên Chrome.')
    page.bring_to_front()
    if service.visible(page,['a:has-text("Sign in")','button:has-text("Sign in")','a:has-text("Đăng nhập")','button:has-text("Đăng nhập")']) is not None:raise ValueError('Gemini đã hết đăng nhập. Đăng nhập lại trong Chrome Gemini riêng rồi chạy lại. Không thể tải video khi chưa đăng nhập.')
    # A visible button can precede hydration; retry opening its menu without resending a video.
    inputs=page.locator('input[type="file"]:not([accept="image/*"])')
    attached=False
    for upload_attempt in range(3):
     if cancelled():raise RuntimeError('Đã dừng tải video.')
     upload=service.visible(page,['button[aria-label="Nội dung tải lên và công cụ"]','button[aria-label="Uploads and tools"]','button[aria-label="Upload & tools"]','button[aria-label="Add files"]','button[aria-label="Thêm tệp"]','button[aria-label="Open upload file menu"]'])
     if upload is None:time.sleep(1);continue
     page.keyboard.press('Escape');upload.click()
     try:inputs.last.wait_for(state='attached',timeout=6000);attached=True;break
     except Exception:time.sleep(1)
    if not attached:raise ValueError('Gemini chưa mở được mục tải tệp. Hãy kiểm tra thông báo/đăng nhập trong Chrome rồi thử lại.')
    progress(int(number/chunks*90)+3,f'Gemini: tải video đoạn {number+1}/{chunks} lên tài khoản của bạn...')
    inputs.last.set_input_files(str(clip.resolve()),timeout=60000);page.keyboard.press('Escape')
    # Do not send until the attachment is actually represented in Gemini's composer.
    try:page.locator('button[aria-label="đóng tệp đính kèm"],button[aria-label*="Remove attachment" i],button[aria-label*="Remove file" i],button[aria-label*="Close attachment" i]').first.wait_for(state='attached',timeout=60000)
    except Exception:raise ValueError('Gemini chưa xác nhận video đính kèm. Chưa gửi yêu cầu để tránh trả lời không có video.')
    editor=service.visible(page,cfg['editors']);editor.fill(VIDEO_PROMPT+f'\nVideo đính kèm dài khoảng {length:.3f} giây. Đây là đoạn {number+1}/{chunks}; luôn tính thời gian từ 00:00:00,000 của đoạn này.')
    before={selector:page.locator(selector).count() for selector in cfg['answers']}
    sent=False;ready_since=None;deadline=time.monotonic()+300
    while time.monotonic()<deadline:
     if cancelled():raise RuntimeError('Đã dừng chờ tải video; bản đính kèm có thể vẫn còn trên Chrome.')
     send=service.visible(page,cfg['send']);busy=service.visible(page,['[role="progressbar"]','mat-progress-spinner'])
     if send is not None and send.is_enabled() and busy is None:
      ready_since=ready_since or time.monotonic()
      if time.monotonic()-ready_since>=2:send.click();sent=True;break
     else:ready_since=None
     time.sleep(.5)
    if not sent:raise ValueError('Gemini chưa nhận được video hoặc đã hết hạn mức tải. Kiểm tra cửa sổ Gemini rồi thử lại.')
    progress(int(number/chunks*90)+5,f'Gemini: đang đọc đoạn {number+1}/{chunks} và tạo SRT...')
    valid=None;answer=''
    for response_attempt in range(2):
     deadline=time.monotonic()+600;last='';stable=time.monotonic()
     while time.monotonic()<deadline:
      if cancelled():raise RuntimeError('Đã dừng chờ Gemini. Phản hồi có thể vẫn tiếp tục trên Chrome.')
      answer=''
      for selector in cfg['answers']:
       loc=page.locator(selector)
       if loc.count()>before[selector]:
        last_answer=loc.last;code=last_answer.locator('pre code,[data-code-block-source] code')
        answer='\n\n'.join(code.all_text_contents()) if code.count() else last_answer.inner_text();break
      if answer!=last:last=answer;stable=time.monotonic()
      if answer and time.monotonic()-stable>=3 and service.visible(page,cfg['stop']) is None:
       try:valid=source_cues(answer,length,offset)
       except ValueError:
        if time.monotonic()-stable>10:break
       if valid is not None:break
      time.sleep(1)
     if valid is not None:break
     if response_attempt==0:
      progress(int(number/chunks*90)+7,'Gemini chưa trả SRT, đang yêu cầu lại một lần...')
      editor=service.visible(page,cfg['editors']);editor.fill(VIDEO_PROMPT+' Video đã được đính kèm ở trên, dài khoảng '+str(round(length,3))+' giây.')
      before={selector:page.locator(selector).count() for selector in cfg['answers']}
      send=service.visible(page,cfg['send'])
      if send is None or not send.is_enabled():break
      send.click()
    if valid is None:raise ValueError('Gemini chưa trả SRT sau hai lượt: '+answer[:240]+' — Phản hồi vẫn ở Chrome; có thể thử lại hoặc dùng OCR/Whisper offline.')
    merge_cues(result,valid);urls.append(page.url)
   result.sort(key=lambda c:(c['startTime'],c['endTime']))
   for i,c in enumerate(result,1):c['id']=f'gemini-{i:04d}'
   validate_cues(result);progress(100,'Đã lấy SRT Trung từ Gemini, chuyển sang bước Dịch.')
   return {'subtitles':result,'srt':to_srt(result),'modelUsed':'Gemini video qua Chrome CDP','conversationUrls':urls,'chunks':chunks}
 finally:service.locks['gemini'].release()
