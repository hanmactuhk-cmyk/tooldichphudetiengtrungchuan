"""Exercise the provider workflows beyond their former split thresholds."""
import sys,tempfile,unittest,contextlib,types
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from browser_translation import BrowserTranslator
from video_subtitles import extract_with_gemini
from subtitle_contract import to_srt,from_srt

class Element:
 def __init__(self,page):self.page=page
 @property
 def last(self):return self
 @property
 def first(self):return self
 def count(self):return 0
 def wait_for(self,**kwargs):pass
 def set_input_files(self,*args,**kwargs):raise AssertionError('Must not use Playwright payload file upload')
 def element_handle(self):return self
 def evaluate(self,script,arg=None):
  if 'Array.from' in script:
   source=self.page.uploads[-1];return [{'name':source.name,'size':source.stat().st_size}]
 def fill(self,text):self.page.prompts.append(text)
 def click(self):pass
 def is_enabled(self):return True
class Session:
 def __init__(self,page):self.page=page
 def send(self,method,params):
  if method=='DOM.getDocument':return {'root':{'nodeId':1}}
  if method=='DOM.querySelector':return {'nodeId':2}
  if method=='DOM.setFileInputFiles':
   assert set(params)=={'nodeId','files'}
   self.page.uploads.extend(Path(p) for p in params['files']);return {}
  raise AssertionError(method)
 def detach(self):pass
class Page:
 def __init__(self):self.url='https://gemini.google.com/app/test';self.uploads=[];self.prompts=[];self.context=type('Context',(),{'new_cdp_session':lambda _,page:Session(page)})();self.keyboard=type('Keyboard',(),{'press':lambda *_:None})()
 def goto(self,url,**kwargs):self.url=url
 def bring_to_front(self):pass
 def set_default_timeout(self,*args):pass
 def is_closed(self):return False
 def locator(self,*_):return Element(self)
class Service(BrowserTranslator):
 def __init__(self,page,cues):super().__init__('profiles');self.page=page;self.cues=cues;self.sends=0;self.waits=0
 def open(self,*_):pass
 def attach_srt(self,page,source,*args):
  self.page.srt_text=source.read_text(encoding='utf-8');return {'name':source.name,'size':source.stat().st_size}
 def send_prompt_once(self,page,cfg,prompt,before,progress,cancelled,**kwargs):Element(page).fill(prompt)

 def visible(self,page,selectors):
  if any('Sign in' in s or 'Đăng nhập' in s or 'progress' in s or 'spinner' in s for s in selectors):return None
  return Element(page)
 def wait_response(self,page,cfg,before,validate,cancelled,**kwargs):
  self.waits+=1
  translated=[dict(c,textZh='Xin chào.') for c in self.cues]
  return validate(to_srt(translated))
class WholeSubmissionTests(unittest.TestCase):
 def playwright(self,page):
  context=type('Context',(),{'new_page':lambda _:page})();browser=type('Browser',(),{'contexts':[context]})();pw=type('PW',(),{'chromium':type('Chromium',(),{'connect_over_cdp':lambda *_args,**_kwargs:browser})()})();api=types.ModuleType('playwright.sync_api');api.sync_playwright=lambda:contextlib.nullcontext(pw);return patch.dict(sys.modules,{'playwright':types.ModuleType('playwright'),'playwright.sync_api':api})
 def test_chatgpt_81_cues_one_request(self):
  page=Page();cues=[dict(id=str(i),startTime=i*2,endTime=i*2+1,textZh='你好。') for i in range(81)];service=Service(page,cues)
  with self.playwright(page):
   result=service.translate('chatgpt',cues)
  self.assertEqual(len(page.prompts),1);self.assertEqual(service.waits,1);self.assertEqual(result['submissions'],1);self.assertEqual(len(result['translations']),81)
  self.assertEqual(to_srt(cues),page.srt_text);self.assertLess(len(page.prompts[0]),2000);self.assertNotIn('<SRT_CAN_DICH>',page.prompts[0]);self.assertEqual(result['inputMode'],'srt-file');self.assertEqual(result['translations'][-1]['id'],'80')
 def test_incomplete_reply_retries_whole_file(self):
  page=Page();cues=[dict(id=str(i),startTime=i*2,endTime=i*2+1,textZh='你好。') for i in range(81)];service=Service(page,cues)
  original=service.wait_response;calls=[]
  def response(*args,**kwargs):
   calls.append(1)
   if len(calls)==1:raise ValueError('Incomplete SRT')
   return original(*args,**kwargs)
  service.wait_response=response;service.pause=lambda *_:None
  with self.playwright(page):result=service.translate('chatgpt',cues)
  self.assertEqual(result['submissions'],2);self.assertEqual(len(result['translations']),81);self.assertEqual(to_srt(cues),page.srt_text);self.assertEqual(len(page.prompts),2)
 def test_long_video_original_file_single_upload(self):
  page=Page();cue=dict(id='one',startTime=598,endTime=599,textZh='你好。');service=Service(page,[cue])
  temp_root=Path(__file__).resolve().parents[1]/'test-results';temp_root.mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(dir=temp_root) as folder:
   source=Path(folder)/'original.mp4'
   with source.open('wb') as f:f.truncate(210*1024*1024)
   with self.playwright(page),patch('browser_translation.cdp_get',return_value={}),patch('video_subtitles.time.sleep'),patch('video_subtitles.time.monotonic',side_effect=range(10000)):
    result=extract_with_gemini(service,source,600,lambda *_:self.fail('Must never cut or transcode video'))
   self.assertEqual(page.uploads,[source.resolve()]);self.assertEqual(len(page.prompts),1);self.assertEqual(result['chunks'],1);self.assertTrue(result['wholeVideo']);self.assertEqual(result['uploadedFile']['size'],210*1024*1024);self.assertEqual(result['subtitles'][0]['startTime'],598)
 def test_partial_srt_never_imported(self):
  cues=[dict(id=str(i),startTime=i,endTime=i+.5,textZh='你好') for i in range(81)]
  with self.assertRaises(ValueError):from_srt(to_srt([dict(cues[0],textZh='Xin chào')]),cues)
if __name__=='__main__':unittest.main()
