"""Recover a timed-out fill, honor cancellation and never double-submit."""
import sys,itertools,unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'resources/backend'))
from browser_translation import BrowserTranslator,AttachmentNotReady

class Editor:
 def __init__(self):self.text='';self.fills=0
 def get_attribute(self,*args,**kwargs):return 'true'
 def text_content(self,**kwargs):return self.text
 def fill(self,text,**kwargs):
  self.fills+=1;self.text=text
  if self.fills==1:raise TimeoutError('Renderer stalled after receiving complete text')
class Send:
 def __init__(self):self.clicks=0
 def is_enabled(self):return True
 def click(self,**kwargs):self.clicks+=1
class Page:
 url='https://chatgpt.com/'
 def is_closed(self):return False
 def locator(self,*args):return type('Empty',(),{'count':lambda _:0})()
class Ready(BrowserTranslator):
 def __init__(self):super().__init__('profiles');self.editor=Editor();self.send=Send();self.pauses=[]
 def dismiss_overlays(self,page):pass
 def visible(self,page,selectors):return self.send if selectors==['send'] else self.editor
 def pause(self,seconds,cancelled):
  self.pauses.append(seconds)
  if cancelled():raise RuntimeError('cancelled')

class ReadyTests(unittest.TestCase):
 cfg={'host':'chatgpt.com','editors':['edit'],'send':['send'],'answers':['answer'],'stop':['stop']}
 def test_timeout_after_fill_does_not_refill(self):
  service=Ready()
  with patch('browser_translation.time.monotonic',side_effect=itertools.count()):
   service.prepare_prompt(Page(),self.cfg,'short file instruction',lambda *_:None,lambda:False)
  self.assertEqual(service.editor.fills,1);self.assertEqual(service.send.clicks,0)
 def test_acknowledged_submission_not_sent_twice(self):
  service=Ready();service.prepare_prompt=lambda *_:None;acks=iter([False,True]);service.submitted=lambda *args,**kwargs:next(acks)
  service.send_prompt_once(Page(),self.cfg,'prompt',{'answer':0},lambda *_:None,lambda:False)
  self.assertEqual(service.send.clicks,0)
 def test_ack_after_click_only_one_click(self):
  service=Ready();service.prepare_prompt=lambda *_:None;acks=iter([False,False,True]);service.submitted=lambda *args,**kwargs:next(acks)
  service.send_prompt_once(Page(),self.cfg,'prompt',{'answer':0},lambda *_:None,lambda:False)
  self.assertEqual(service.send.clicks,1)
 def test_missing_attachment_never_clicked(self):
  service=Ready();service.prepare_prompt=lambda *_:None;service.submitted=lambda *args,**kwargs:False;service.attachment_present=lambda *_:False
  with self.assertRaises(AttachmentNotReady):service.send_prompt_once(Page(),self.cfg,'prompt',{'answer':0},lambda *_:None,lambda:False,attachment_name='all.srt')
  self.assertEqual(service.send.clicks,0)
 def test_cancelled_prepare_exits(self):
  service=Ready()
  with self.assertRaises(RuntimeError):service.prepare_prompt(Page(),self.cfg,'prompt',lambda *_:None,lambda:True)
if __name__=='__main__':unittest.main()
