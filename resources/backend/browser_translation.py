"""User-owned Chrome profiles, controlled through loopback CDP only.

Passwords, cookies and tokens are never read or exported. Login remains manual.
"""
import json
import os
import subprocess
import threading
import time
import tempfile
import uuid
from pathlib import Path
from urllib.parse import urlparse
from http.client import HTTPConnection
from browser_upload import attach_local_file
from subtitle_contract import INSTRUCTION,MULTI_SPEAKER_INSTRUCTION,to_srt,from_srt,validate_cues,parse_srt

class AttachmentNotReady(ValueError):pass

SERVICES={
    'gemini':{'url':'https://gemini.google.com/app','host':'gemini.google.com','port':9223,
        'editors':['rich-textarea [contenteditable="true"]','[role="textbox"][contenteditable="true"]'],
        'answers':['model-response .model-response-text','model-response message-content','model-response'],
        'send':['button[aria-label="Send message"]','button[aria-label="Gửi tin nhắn"]','button.send-button'],
        'stop':['button[aria-label="Stop response"]','button[aria-label="Dừng phản hồi"]','button[aria-label="Dừng"]','button[aria-label="Stop"]','button.stop-button']},
    'chatgpt':{'url':'https://chatgpt.com/','host':'chatgpt.com','port':9224,
        'editors':['#prompt-textarea','[contenteditable="true"][data-lexical-editor="true"]','[role="textbox"][contenteditable="true"]'],
        'answers':['[data-message-author-role="assistant"] .markdown','[data-message-author-role="assistant"]','[class*="DilResponseRoot"][data-dil-message-id]'],
        'send':['button[data-testid="send-button"]','button[aria-label="Send prompt"]','button[aria-label="Gửi lời nhắc"]','button[aria-label="Send message"]','button[aria-label="Gửi tin nhắn"]','button#composer-submit-button','button[aria-label="Gửi"]','button[aria-label="Send"]'],
        'stop':['button[data-testid="stop-button"]','button[aria-label="Stop streaming"]','button[aria-label="Stop generating"]','button[aria-label="Dừng tạo"]','button[aria-label="Dừng phản hồi"]','button[aria-label="Dừng"]','button[aria-label="Stop"]']}}

def cdp_get(port,path):
    # Direct loopback HTTP: no proxy lookup, TLS context, or browser credentials.
    connection=HTTPConnection('127.0.0.1',port,timeout=2)
    try:
        connection.request('GET',path)
        response=connection.getresponse()
        if response.status!=200:raise OSError(f'Chrome CDP trả HTTP {response.status}')
        return json.loads(response.read().decode('utf-8'))
    finally:connection.close()

class BrowserTranslator:
    def __init__(self,profiles):
        self.profiles=Path(profiles).resolve();self.locks={k:threading.Lock() for k in SERVICES}

    def config(self,provider):
        if provider not in SERVICES:raise ValueError('Chỉ hỗ trợ Gemini hoặc ChatGPT.')
        return SERVICES[provider]

    def open(self,provider):
        cfg=self.config(provider)
        endpoint=f'http://127.0.0.1:{cfg["port"]}'
        try:
            cdp_get(cfg['port'],'/json/version')
            return {'status':'opened','provider':provider,'url':cfg['url']}
        except (OSError,ValueError):pass
        candidates=[os.environ.get('HN_CHROME_EXE',''),r'C:\Program Files\Google\Chrome\Application\chrome.exe',r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',str(Path(os.environ.get('LOCALAPPDATA',''))/'Google/Chrome/Application/chrome.exe')]
        chrome=next((p for p in candidates if p and Path(p).is_file()),None)
        if not chrome:raise ValueError('Chưa tìm thấy Google Chrome. Hãy cài Chrome hoặc đặt HN_CHROME_EXE.')
        profile=self.profiles/provider;profile.mkdir(parents=True,exist_ok=True)
        subprocess.Popen([chrome,'--remote-debugging-address=127.0.0.1',f'--remote-debugging-port={cfg["port"]}',f'--user-data-dir={profile}','--no-first-run','--new-window',cfg['url']],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        return {'status':'login_required','provider':provider,'url':cfg['url'],'message':'Hãy tự đăng nhập trong cửa sổ Chrome, rồi chạy dịch.'}

    def status(self,provider):
        cfg=self.config(provider)
        try:
            pages=cdp_get(cfg['port'],'/json/list')
            return {'provider':provider,'connected':True,'serviceOpen':any(urlparse(p.get('url','')).hostname==cfg['host'] for p in pages),'probe':'direct-http'}
        except Exception as exc:return {'provider':provider,'connected':False,'serviceOpen':False,'probe':'direct-http','error':type(exc).__name__+': '+str(exc)[:160]}

    @staticmethod
    def visible(page,selectors):
        for selector in selectors:
            locator=page.locator(selector)
            for i in range(locator.count()):
                candidate=locator.nth(i)
                if candidate.is_visible():return candidate
        return None

    def dismiss_overlays(self,page):
        # Close only the optional pricing promotion, never buy/select a plan.
        close=self.visible(page,['button[aria-label="Đóng bảng giá"]','button[aria-label="Close pricing"]'])
        if close is not None:close.click(timeout=15000)

    def attachment_present(self,page,name):
        card=page.get_by_role('button',name=name,exact=True)
        if card.count() and card.first.is_visible():return True
        # Gemini attaches files outside rich-textarea, next to the compose box.
        if urlparse(page.url).hostname=='gemini.google.com':
            for selector in ['.attachment-container','.file-preview','[class*="file-preview"]','[class*="upload-chip"]','[class*="attachment"]']:
                for chip in page.locator(selector).all():
                    if chip.is_visible() and name in (chip.text_content() or ''):return True
            chip=page.locator('.gem-attachment-content').filter(has=page.get_by_text(Path(name).stem,exact=True))
            if chip.count() and chip.first.is_visible() and chip.first.locator('button[aria-label^="close "]').count():return True
            labels=page.get_by_text(name,exact=False)
            if labels.count() and any(labels.nth(i).is_visible() for i in range(labels.count())):return True
        return False

    @staticmethod
    def normalized(text):
        # ProseMirror paragraphs may omit line separators in textContent.
        return ''.join(str(text).replace('\u200b','').split())

    def editor_matches(self,editor,prompt):
        if editor.get_attribute('contenteditable',timeout=15000)=='true':
            text=editor.text_content(timeout=15000) or ''
        else:text=editor.input_value(timeout=15000)
        return self.normalized(text)==self.normalized(prompt)

    @staticmethod
    def pause(seconds,cancelled):
        until=time.monotonic()+seconds
        while time.monotonic()<until:
            if cancelled():raise RuntimeError('Đã dừng dịch.')
            time.sleep(min(.5,max(0,until-time.monotonic())))

    def prepare_prompt(self,page,cfg,prompt,progress,cancelled):
        attempt=0
        while True:
            if cancelled():raise RuntimeError('Đã dừng dịch.')
            if page.is_closed():raise ValueError('Tab dịch đã đóng. Mở Chrome rồi chạy lại.')
            if urlparse(page.url).hostname!=cfg['host']:raise ValueError('Chrome đang ở trang đăng nhập. Hãy đăng nhập lại.')
            attempt+=1
            try:
                self.dismiss_overlays(page)
                editor=self.visible(page,cfg['editors'])
                if editor is None:
                    if self.visible(page,['button:has-text("Log in")','a:has-text("Log in")','button:has-text("Đăng nhập")']) is not None:raise ValueError('ChatGPT yêu cầu đăng nhập lại. Hãy tự đăng nhập rồi thử lại.')
                    progress(3,'Chờ khung chat sẵn sàng...')
                    self.pause(3,cancelled);continue
                # A timed-out fill can already have inserted the ENTIRE prompt.
                # Read before every retry; never overwrite it while Chrome recovers.
                if not self.editor_matches(editor,prompt):
                    progress(5,f'Điền lời nhắc vào Chrome, lần {attempt}; cho phép chờ tới 3 phút...')
                    editor.fill(prompt,timeout=180000)
                progress(7,'Chờ Chrome ổn định và kiểm tra lời nhắc, tệp đính kèm trước khi gửi...')
                stable_since=None
                while True:
                    if cancelled():raise RuntimeError('Đã dừng dịch.')
                    current=self.visible(page,cfg['editors'])
                    send=self.visible(page,cfg['send'])
                    ready=current is not None and self.editor_matches(current,prompt) and send is not None and send.is_enabled()
                    if ready:
                        stable_since=stable_since or time.monotonic()
                        if time.monotonic()-stable_since>=6:return
                    else:
                        stable_since=None
                        if current is not None and not self.editor_matches(current,prompt):break
                    self.pause(2,cancelled)
            except (RuntimeError,ValueError):raise
            except Exception:
                # Suppress Playwright's error containing the full private SRT.
                progress(5,f'Chrome đang chậm; chờ hồi phục rồi kiểm tra lại nội dung (lần {attempt})...')
                self.pause(min(3*attempt,15),cancelled)

    def submitted(self,page,cfg,before,prompt,allow_answer_ack=True):
        # A new answer or Stop button is a positive acknowledgement in our new tab.
        if allow_answer_ack and self.visible(page,cfg['stop']) is not None:return True
        if allow_answer_ack and any(page.locator(selector).count()>before[selector] for selector in cfg['answers']):return True
        for selector in ['[data-message-author-role="user"]','[class*="DilUserMessage"][data-dil-message-id]']:
            users=page.locator(selector)
            if users.count() and self.normalized(users.last.text_content(timeout=10000) or '')==self.normalized(prompt):return True
        return False

    def send_prompt_once(self,page,cfg,prompt,before,progress,cancelled,attachment_name=None):
        issued=False
        while True:
            if cancelled():raise RuntimeError('Đã dừng dịch.')
            if self.submitted(page,cfg,before,prompt,allow_answer_ack=issued):return
            self.prepare_prompt(page,cfg,prompt,progress,cancelled)
            # Recheck acceptance immediately before clicking, including recovery after a timeout.
            if self.submitted(page,cfg,before,prompt,allow_answer_ack=issued):return
            self.dismiss_overlays(page)
            if attachment_name and not self.attachment_present(page,attachment_name):raise AttachmentNotReady('Tệp SRT đã rời khung nhập trước khi gửi; sẽ đính kèm lại.')
            send=self.visible(page,cfg['send'])
            if not issued:
                for selector in cfg['answers']:before[selector]=page.locator(selector).count()
            issued=True
            try:send.click(timeout=120000)
            except Exception:
                progress(9,'Chưa xác nhận nút Gửi; chờ kiểm tra ChatGPT đã nhận chưa để tránh gửi trùng...')
            until=time.monotonic()+180
            while time.monotonic()<until:
                if cancelled():raise RuntimeError('Đã dừng dịch.')
                try:
                    if self.submitted(page,cfg,before,prompt):return
                except Exception:pass
                self.pause(3,cancelled)
            # Only retry when the full draft is still present. A cleared draft is ambiguous:
            # keep waiting for its acknowledgement rather than blindly submitting again.
            editor=self.visible(page,cfg['editors'])
            if editor is not None and self.editor_matches(editor,prompt):
                progress(8,'Bản nháp vẫn còn, chưa có xác nhận gửi; chờ ổn định rồi thử lại...')
                self.pause(10,cancelled)
            else:
                progress(10,'Nội dung đã rời khung nhập; tiếp tục chờ phản hồi, không gửi trùng...')
                while not self.submitted(page,cfg,before,prompt):self.pause(3,cancelled)
                return

    def attach_srt(self,page,source,progress,cancelled):
        self.dismiss_overlays(page)
        selectors='input[type="file"]:not([accept="image/*"])'
        inputs=page.locator(selectors)
        if not inputs.count():
            menu=self.visible(page,['button[aria-label="Thêm tệp và nội dung khác"]','button[aria-label="Add files and more"]','button[aria-label="Attach files"]','button[aria-label="Add photos & files"]','button[aria-label="Nội dung tải lên và công cụ"]','button[aria-label="Uploads and tools"]','button[aria-label="Upload & tools"]','button[aria-label="Add files"]','button[aria-label="Thêm tệp"]','button[aria-label="Open upload file menu"]','button[aria-label="Mở trình đơn tải tệp lên"]'])
            if menu is not None:menu.click(timeout=120000)
            local=self.visible(page,['[role="menuitem"]:has-text("Upload files")','[role="menuitem"]:has-text("Tải tệp lên")'])
            if local is not None:local.click(timeout=120000)
            inputs.last.wait_for(state='attached',timeout=180000)
        progress(4,'Đính kèm một file SRT chứa toàn bộ phụ đề lên dịch vụ...')
        metadata=attach_local_file(page,inputs.last,source,allow_cleared=True)
        page.keyboard.press('Escape')
        until=time.monotonic()+300
        while time.monotonic()<until:
            if cancelled():raise RuntimeError('Đã dừng tải SRT.')
            card=page.get_by_role('button',name=source.name,exact=True)
            if self.attachment_present(page,source.name):
                progress(5,'Đã nhận thẻ tệp SRT; chờ xử lý xong trước khi gửi...')
                return metadata
            self.pause(2,cancelled)
        raise AttachmentNotReady('Chưa xác nhận tệp SRT. Hãy kiểm tra hạn mức/thông báo tải tệp trên Chrome.')

    def wait_response(self,page,cfg,before,validate,cancelled,timeout=1800,progress=lambda *_:None,total_cues=0):
        deadline=time.monotonic()+timeout;last='';stable_since=time.monotonic();validation_error=None;reported_count=0
        while time.monotonic()<deadline:
            if cancelled():raise RuntimeError('Đã dừng chờ. Phản hồi có thể vẫn tiếp tục trên Chrome.')
            try:
                answer=''
                for selector in cfg['answers']:
                    loc=page.locator(selector)
                    if loc.count()>before[selector]:
                        last_answer=loc.last
                        code=last_answer.locator('pre code,[data-code-block-source] code')
                        if not code.count():code=last_answer.locator('pre')
                        answer='\n\n'.join(code.all_text_contents()) if code.count() else last_answer.inner_text()
                        break
                response_finished=self.visible(page,cfg['stop']) is None
            except Exception:
                if page.is_closed():raise ValueError('Tab phản hồi đã đóng. Mở Chrome rồi thử lại.')
                self.pause(3,cancelled);continue
            if answer!=last:last=answer;stable_since=time.monotonic()
            if total_cues:
                count=len(parse_srt(answer))
                if count>=reported_count+20 or (count==total_cues and count!=reported_count):
                    reported_count=count;progress(min(95,15+int(count/total_cues*80)),f'Đang nhận bản dịch: {count}/{total_cues} câu; đợi phản hồi hoàn tất...')
            if answer and response_finished and time.monotonic()-stable_since>=5:
                try:return validate(answer)
                except ValueError as exc:
                    validation_error=exc
                    # Never import a partial SRT or automatically send another batch.
                    if time.monotonic()-stable_since>=20:
                        raise ValueError(str(exc)+' Phản hồi chưa đủ/hợp lệ nên chưa thay phụ đề trong tool. Phản hồi vẫn được giữ trên Chrome.') from exc
            time.sleep(1)
        raise ValueError('Hết thời gian chờ phản hồi đầy đủ. '+(str(validation_error) if validation_error else '')+' Phản hồi vẫn ở Chrome.')

    def translate(self,provider,cues,characters=None,progress=lambda *_:None,cancelled=lambda:False,input_mode='srt-file',speaker_mode='single'):
        validate_cues(cues);cfg=self.config(provider)
        if not self.locks[provider].acquire(blocking=False):raise ValueError('Đã có một phiên dịch trên hồ sơ này. Hãy chờ phiên đó hoàn tất.')
        try:
            from playwright.sync_api import sync_playwright
            cache=Path(os.environ.get('HN_CACHE_DIR',self.profiles.parent/'cache'))/'browser-srt'
            cache.mkdir(parents=True,exist_ok=True)
            with sync_playwright() as pw, tempfile.TemporaryDirectory(prefix='srt-',dir=cache) as folder:
                try:browser=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{cfg["port"]}',timeout=30000)
                except Exception as exc:raise ValueError('Chưa kết nối được Chrome. Bấm Mở Chrome và tự đăng nhập trước.') from exc
                context=browser.contexts[0];results=[];accepted_submissions=0;attachments=[];retry_pages=[]
                batches=[(0,cues)]
                for start,batch in batches:
                    retries=0
                    while True:
                        if cancelled():raise RuntimeError('Đã dừng dịch.')
                        page=context.new_page();retry_pages.append(page)
                        # Bound only tabs created by this job, avoiding Chrome memory growth
                        # during repeated failures. Existing user tabs are untouched.
                        if len(retry_pages)>2:
                            old=retry_pages.pop(0)
                            try:old.close()
                            except Exception:pass
                        page.set_default_timeout(120000)
                        page.goto(cfg['url'],wait_until='domcontentloaded',timeout=180000)
                        context_prompt='\nThông tin nhân vật (nếu có):\n'+json.dumps(characters or [],ensure_ascii=False)
                        if results:context_prompt+='\nBản dịch trước để giữ xưng hô:\n'+json.dumps(results[-8:],ensure_ascii=False)
                        instruction=INSTRUCTION+(('\n'+MULTI_SPEAKER_INSTRUCTION) if speaker_mode=='multi' else '')
                        if input_mode=='srt-file':
                            source=Path(folder)/('hn-'+uuid.uuid4().hex[:8]+'.srt')
                            source.write_text(to_srt(batch),encoding='utf-8')
                            try:attachments.append(self.attach_srt(page,source,progress,cancelled))
                            except AttachmentNotReady:
                                retries+=1;progress(4,'Tệp SRT chưa sẵn sàng; chờ 30 giây rồi đính kèm lại...');self.pause(30,cancelled);continue
                            prompt=instruction+f' Toàn bộ {len(batch)} câu tiếng Trung nằm trong tệp {source.name} đính kèm. Hãy đọc toàn bộ tệp và dịch đủ từ câu 1 đến câu {len(batch)} trong một lần trả lời, không chỉ dịch một phần rồi hỏi có tiếp tục không.'+context_prompt
                        else:prompt=instruction+context_prompt+'\n<SRT_CAN_DICH>\n'+to_srt(batch)+'\n</SRT_CAN_DICH>'
                        before={selector:page.locator(selector).count() for selector in cfg['answers']}
                        try:self.send_prompt_once(page,cfg,prompt,before,progress,cancelled,attachment_name=source.name if input_mode=='srt-file' else None)
                        except AttachmentNotReady:
                            retries+=1;progress(5,'Bản đính kèm thay đổi; chờ ổn định rồi tải lại toàn bộ SRT...');self.pause(15,cancelled);continue
                        accepted_submissions+=1
                        progress(15,'Đã gửi SRT; chờ tạo xong toàn bộ bản dịch...')
                        try:
                            valid=self.wait_response(page,cfg,before,lambda answer:from_srt(answer,batch),cancelled,timeout=3600 if provider=='chatgpt' else 1800,progress=progress,total_cues=len(batch))
                            results.extend(valid);break
                        except ValueError:
                            if page.is_closed():raise
                            retries+=1;delay=min(30*retries,180)
                            progress(15,f'Phản hồi chưa đủ/hợp lệ; đợi {delay} giây rồi gửi lại toàn bộ SRT (lần {retries+1}). Bấm Dừng để hủy.')
                            self.pause(delay,cancelled)
                return {'translations':results,'modelUsed':provider+' qua Chrome CDP','conversationUrl':page.url,'submissions':accepted_submissions,'wholeSrt':True,'inputMode':input_mode,'attachments':attachments}
        finally:self.locks[provider].release()
