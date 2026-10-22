"""Video -> Gemini web via the same user-owned Chrome profile as translation."""
import math,re,time
from pathlib import Path
from urllib.parse import urlparse
from subtitle_contract import parse_srt,to_srt,validate_cues
from browser_upload import attach_local_video

VIDEO_PROMPT=('Lấy phụ đề này giúp tôi, phụ đề khớp thời gian trên video. '
 'Trả về nội dung file SRT tiếng Trung với số thứ tự và thời gian HH:MM:SS,mmm --> HH:MM:SS,mmm. '
 'Chỉ trả nội dung SRT trong một khối mã srt, giữ nguyên tiếng Trung.')

def source_cues(text,duration,offset=0):
 rows=parse_srt(text)
 if not rows or len(rows)>10000:raise ValueError('Gemini chưa trả SRT có phụ đề hợp lệ. Phản hồi được giữ trên Chrome để kiểm tra.')
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
  with sync_playwright() as pw:
   try:browser=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{cfg["port"]}',timeout=10000)
   except Exception as exc:raise ValueError('Chưa kết nối Gemini. Bấm Mở Gemini, tự đăng nhập, rồi thử lại.') from exc
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
   progress(5,'Gemini: tải nguyên video lên một lần...')
   uploaded=attach_local_video(page,inputs.last,source);page.keyboard.press('Escape')
   # Do not send until the attachment is actually represented in Gemini's composer.
   try:page.locator('button[aria-label="đóng tệp đính kèm"],button[aria-label*="Remove attachment" i],button[aria-label*="Remove file" i],button[aria-label*="Close attachment" i]').first.wait_for(state='attached',timeout=60000)
   except Exception:raise ValueError('Gemini chưa xác nhận video đính kèm. Chưa gửi yêu cầu để tránh trả lời không có video.')
   editor=service.visible(page,cfg['editors']);editor.fill(VIDEO_PROMPT+f'\nĐây là toàn bộ video, dài khoảng {duration:.3f} giây. Lấy đầy đủ phụ đề từ đầu tới cuối trong một lần trả lời. Mốc thời gian tính từ đầu video, không đặt lại về 0 ở giữa video.')
   before={selector:page.locator(selector).count() for selector in cfg['answers']}
   sent=False;ready_since=None;deadline=time.monotonic()+1800
   while time.monotonic()<deadline:
    if cancelled():raise RuntimeError('Đã dừng chờ tải video; bản đính kèm có thể vẫn còn trên Chrome.')
    send=service.visible(page,cfg['send']);busy=service.visible(page,['[role="progressbar"]','mat-progress-spinner'])
    if send is not None and send.is_enabled() and busy is None:
     ready_since=ready_since or time.monotonic()
     if time.monotonic()-ready_since>=2:send.click();sent=True;break
    else:ready_since=None
    time.sleep(.5)
   if not sent:raise ValueError('Gemini chưa nhận được video hoặc đã hết hạn mức tải. Kiểm tra cửa sổ Gemini rồi thử lại.')
   progress(15,'Gemini: chờ lấy toàn bộ SRT của video...')
   valid=service.wait_response(page,cfg,before,lambda answer:source_cues(answer,duration),cancelled,timeout=1800)
   for i,c in enumerate(valid,1):c['id']=f'gemini-{i:04d}'
   validate_cues(valid);progress(100,'Đã lấy SRT toàn bộ video từ Gemini, chuyển sang bước Dịch.')
   return {'subtitles':valid,'srt':to_srt(valid),'modelUsed':'Gemini video qua Chrome CDP','conversationUrls':[page.url],'chunks':1,'wholeVideo':True,'uploadedFile':uploaded}
 finally:service.locks['gemini'].release()
