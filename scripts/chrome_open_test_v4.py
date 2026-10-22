import json,time,requests
from pathlib import Path
from playwright.sync_api import sync_playwright
base='http://127.0.0.1:8001';report={}
report['initial']=requests.get(base+'/api/browser/status').json();assert all(s['connected'] for s in report['initial'].values()),report
for provider in ['chatgpt','gemini']:
 r=requests.post(base+'/api/browser/open',json={'provider':provider},timeout=10);r.raise_for_status();report[provider+'Open']=r.json()
with sync_playwright() as pw:
 b=pw.chromium.connect_over_cdp('http://127.0.0.1:9223')
 drafts=[]
 for page in b.contexts[0].pages:
  if 'gemini.google.com' in page.url:
   loc=page.locator('rich-textarea [contenteditable=true]')
   if loc.count() and loc.first.inner_text().strip():drafts.append(True)
 if not drafts:b.close();report['coldRestartAttempted']=True
 else:report['coldRestartAttempted']=False
if report['coldRestartAttempted']:
 for _ in range(20):
  if not requests.get(base+'/api/browser/status').json()['gemini']['connected']:break
  time.sleep(.25)
 r=requests.post(base+'/api/browser/open',json={'provider':'gemini'},timeout=15);r.raise_for_status();report['restartOpen']=r.json()
 for _ in range(60):
  status=requests.get(base+'/api/browser/status').json()
  if status['gemini']['connected'] and status['gemini']['serviceOpen']:break
  time.sleep(.5)
 assert status['gemini']['connected'],status
report['final']=requests.get(base+'/api/browser/status').json();assert all(s['connected'] for s in report['final'].values())
Path('../../outputs/v4-tests/packaged/chrome-open-status.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print('CHROME OPEN/STATUS PASSED',report,flush=True)
