"""User-owned Chrome profiles, controlled through loopback CDP only.

Passwords, cookies and tokens are never read or exported. Login remains manual.
"""
import json
import os
import subprocess
import threading
import time
from pathlib import Path
from urllib.parse import urlparse
from http.client import HTTPConnection
from subtitle_contract import INSTRUCTION,to_srt,from_srt,validate_cues

SERVICES={
    'gemini':{'url':'https://gemini.google.com/app','host':'gemini.google.com','port':9223,
        'editors':['rich-textarea [contenteditable="true"]','[role="textbox"][contenteditable="true"]'],
        'answers':['model-response .model-response-text','model-response message-content','model-response'],
        'send':['button[aria-label="Send message"]','button[aria-label="Gửi tin nhắn"]','button.send-button'],
        'stop':['button[aria-label="Stop response"]','button[aria-label="Dừng phản hồi"]','button.stop-button']},
    'chatgpt':{'url':'https://chatgpt.com/','host':'chatgpt.com','port':9224,
        'editors':['#prompt-textarea','[contenteditable="true"][data-lexical-editor="true"]','[role="textbox"][contenteditable="true"]'],
        'answers':['[data-message-author-role="assistant"] .markdown','[data-message-author-role="assistant"]','[class*="DilResponseRoot"][data-dil-message-id]'],
        'send':['button[data-testid="send-button"]','button[aria-label="Send prompt"]','button[aria-label="Gửi lời nhắc"]'],
        'stop':['button[data-testid="stop-button"]','button[aria-label="Stop streaming"]']}}

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
        self.profiles=Path(profiles);self.locks={k:threading.Lock() for k in SERVICES}

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

    def translate(self,provider,cues,characters=None,progress=lambda *_:None,cancelled=lambda:False):
        validate_cues(cues);cfg=self.config(provider)
        if not self.locks[provider].acquire(blocking=False):raise ValueError('Đã có một phiên dịch trên hồ sơ này. Hãy chờ phiên đó hoàn tất.')
        try:
            from playwright.sync_api import sync_playwright
            with sync_playwright() as pw:
                try:browser=pw.chromium.connect_over_cdp(f'http://127.0.0.1:{cfg["port"]}',timeout=10000)
                except Exception as exc:raise ValueError('Chưa kết nối được Chrome. Bấm Mở Chrome và tự đăng nhập trước.') from exc
                context=browser.contexts[0]
                page=context.new_page();page.goto(cfg['url'],wait_until='domcontentloaded',timeout=60000)
                editor=None
                for _ in range(30):
                    editor=self.visible(page,cfg['editors'])
                    if editor is not None:break
                    if cancelled():raise RuntimeError('Đã dừng dịch.')
                    time.sleep(1)
                if editor is None:raise ValueError('Chưa thấy khung chat. Hãy đăng nhập và xử lý thông báo trên Chrome, rồi thử lại.')
                if urlparse(page.url).hostname != cfg['host']:raise ValueError('Chrome đang ở trang đăng nhập. Bạn cần tự đăng nhập trước.')
                results=[]
                # Bounded batches prevent truncation; previous context is included explicitly.
                for start in range(0,len(cues),40):
                    batch=cues[start:start+40]
                    if cancelled():raise RuntimeError('Đã dừng dịch.')
                    progress(round(start/len(cues)*95),f'{provider}: gửi và chờ dịch câu {start+1}–{start+len(batch)}...')
                    prompt=INSTRUCTION+'\nThông tin nhân vật (nếu có):\n'+json.dumps(characters or [],ensure_ascii=False)
                    if results:prompt+='\nBản dịch trước để giữ xưng hô:\n'+json.dumps(results[-8:],ensure_ascii=False)
                    prompt+='\n<SRT_CAN_DICH>\n'+to_srt(batch)+'\n</SRT_CAN_DICH>'
                    editor=self.visible(page,cfg['editors'])
                    if editor is None:raise ValueError('Khung chat đã thay đổi. Hãy mở lại trang dịch.')
                    editor.fill(prompt)
                    before={selector:page.locator(selector).count() for selector in cfg['answers']}
                    send=self.visible(page,cfg['send'])
                    if send is not None and send.is_enabled():send.click()
                    else:editor.press('Enter')
                    deadline=time.monotonic()+300;last='';stable_since=time.monotonic();valid=None
                    while time.monotonic()<deadline:
                        if cancelled():raise RuntimeError('Đã dừng chờ. Phản hồi trên trang web có thể vẫn đang tạo.')
                        answer=''
                        for selector in cfg['answers']:
                            loc=page.locator(selector)
                            if loc.count()>before[selector]:
                                last_answer=loc.last
                                code=last_answer.locator('pre code,[data-code-block-source] code')
                                if code.count():answer='\n\n'.join(code.all_text_contents())
                                else:
                                    code=last_answer.locator('pre')
                                    answer='\n\n'.join(code.all_text_contents()) if code.count() else last_answer.inner_text()
                                break
                        if answer!=last:last=answer;stable_since=time.monotonic()
                        if answer and time.monotonic()-stable_since>=3 and self.visible(page,cfg['stop']) is None:
                            try:valid=from_srt(answer,batch)
                            except ValueError:
                                # A completed but malformed reply is preserved in the browser.
                                if time.monotonic()-stable_since>10:raise
                            if valid is not None:break
                        time.sleep(1)
                    if valid is None:raise ValueError('Hết thời gian chờ hoặc bản dịch chưa đủ câu. Phản hồi vẫn được giữ trên Chrome; có thể dán SRT để nhập lại.')
                    results.extend(valid)
                # Do not close the browser or translated conversation.
                return {'translations':results,'modelUsed':provider+' qua Chrome CDP','conversationUrl':page.url}
        finally:self.locks[provider].release()
