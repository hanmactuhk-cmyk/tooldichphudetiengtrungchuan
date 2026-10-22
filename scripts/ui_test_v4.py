import json,time,re,wave,os
from pathlib import Path
from playwright.sync_api import sync_playwright
out=Path(os.environ.get('HN_TEST_OUT','../../outputs/v4-tests')).resolve();out.mkdir(parents=True,exist_ok=True);fixture=Path('tests/fixtures/voice-ui.srt').resolve()
fixture.write_text('1\n00:00:00,000 --> 00:00:01,000\nEm à, anh xin lỗi, hôm nay anh về muộn.\n\n2\n00:00:00,600 --> 00:00:01,300\nKhông sao đâu, anh đã ăn cơm chưa?\n\n3\n00:00:01,100 --> 00:00:02,000\nAnh chưa ăn, chúng mình cùng ăn nhé.\n',encoding='utf-8')
errors=[];report={}
with sync_playwright() as pw:
 browser=pw.chromium.connect_over_cdp('http://127.0.0.1:9224');page=browser.contexts[0].new_page();page.set_viewport_size({'width':1500,'height':1000})
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''(()=>{const Native=window.Audio;window.__hnAudio=[];window.Audio=function(src){const a=new Native(src);window.__hnAudio.push(a);return a;};window.Audio.prototype=Native.prototype;})();''')
 page.goto(os.environ.get('HN_TEST_URL','http://127.0.0.1:8004'),wait_until='networkidle')
 page.get_by_label('Chọn video',exact=True).set_input_files(str(Path(os.environ.get('HN_TEST_VIDEO','tests/fixtures/video-tieng-trung.mp4')).resolve()))
 page.get_by_role('heading',name='Nhận diện tiếng Trung',exact=True).wait_for(timeout=30000)
 page.get_by_role('button',name='1. Video / SRT',exact=True).click()
 page.get_by_label('Nhập SRT Việt',exact=True).set_input_files(str(fixture))
 page.get_by_role('heading',name='VieNeu-TTS v3 Turbo',exact=True).wait_for(timeout=30000)
 page.get_by_role('button',name='Thêm nhân vật / giọng',exact=True).click()
 actor=page.get_by_label('Nhân vật câu srt-0002',exact=True).locator('option').last.get_attribute('value')
 page.get_by_label('Nhân vật câu srt-0002',exact=True).select_option(actor)
 page.get_by_role('button',name='Tạo giọng và căn timeline',exact=True).click()
 page.wait_for_function('''()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.includes('Nghe thử'))&&!document.body.innerText.includes('Đang chờ tác vụ trước')&&!document.body.innerText.includes('VieNeu: tạo giọng câu')''',timeout=300000)
 report['previewButtons']=page.get_by_role('button',name=re.compile('Nghe thử')).count();assert report['previewButtons']==3
 report['originalMuted']=page.locator('video').evaluate('(v)=>v.muted');assert report['originalMuted']
 page.get_by_title('Phát / Tạm dừng (Phím Space)',exact=True).click();time.sleep(.7)
 count=page.evaluate('window.__hnAudio.filter(a=>!a.paused&&!a.ended).length');report['playingDuringVideo']=count;assert count<=1
 page.get_by_role('button',name=re.compile('Nghe thử')).nth(0).click();time.sleep(.6)
 count=page.evaluate('window.__hnAudio.filter(a=>!a.paused&&!a.ended).length');report['playingDuringPreview1']=count;assert count<=1
 page.get_by_role('button',name=re.compile('Nghe thử')).nth(1).click();time.sleep(.6)
 count=page.evaluate('window.__hnAudio.filter(a=>!a.paused&&!a.ended).length');report['playingDuringPreview2']=count;assert count<=1
 if os.environ.get('HN_TEST_TAIL'):
  page.get_by_title('Quay lại đầu',exact=True).click()
  page.get_by_title('Phát / Tạm dừng (Phím Space)',exact=True).click();time.sleep(2.7)
  shown=page.get_by_test_id('playback-time').inner_text();minutes,seconds=shown.split(':')
  report['tailTimeShown']=shown;report['shortVideoDuration']=page.locator('video').evaluate('(v)=>v.duration')
  assert int(minutes)*60+float(seconds)>report['shortVideoDuration']+.1,report
  page.get_by_title('Phát / Tạm dừng (Phím Space)',exact=True).click()
 page.get_by_role('button',name='5. Xuất file',exact=True).click()
 with page.expect_download(timeout=30000) as event:page.get_by_role('button',name='Giọng VieNeu toàn bộ (.wav)',exact=True).click()
 event.value.save_as(str(out/'ui-export-VieNeu.wav'))
 with wave.open(str(out/'ui-export-VieNeu.wav'),'rb') as wav:report['wav']={'frames':wav.getnframes(),'sampleRate':wav.getframerate(),'channels':wav.getnchannels()};assert wav.getnframes()>0
 with page.expect_download(timeout=30000) as event:page.get_by_role('button',name='Phụ đề theo giọng đã căn (.srt)',exact=True).click()
 event.value.save_as(str(out/'ui-export-theo-giong.srt'))
 page.get_by_role('button',name='3. Dịch',exact=True).click();assert page.get_by_label('Chọn cách dịch',exact=True).locator('option').count()==3
 page.get_by_label('Chọn cách dịch',exact=True).select_option('chatgpt')
 page.screenshot(path=str(out/'giao-dien-v4.png'),full_page=True)
 report['threeTranslationOptions']=True;report['pageErrors']=errors;assert not errors,errors
 (out/'ui-test.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('UI TEST PASSED',report,flush=True)

