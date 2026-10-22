const { _electron } = require(process.env.HN_PLAYWRIGHT || 'playwright');
const {spawn,spawnSync}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HN_TEST_OUT||path.join(root,'test-results/desktop'));fs.mkdirSync(out,{recursive:true});
 const executablePath=process.env.HN_DESKTOP_EXE||path.join(root,'release/win-unpacked/HN Voice Studio.exe');
 const launchEnv={...process.env,HN_BROWSER_HOME:process.env.HN_BROWSER_HOME||path.join(out,'chrome-profiles')};delete launchEnv.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath,args:['--user-data-dir='+path.join(out,'profile')],env:launchEnv,timeout:120000});
 const report={};let origin;
 try{
  let page;
  for(let n=0;n<180;n++) {page=app.windows().find(w=>w.url().startsWith('http://127.0.0.1:'));if(page)break;await new Promise(r=>setTimeout(r,500));}
  assert(page,'Main desktop window did not open');await page.waitForLoadState('networkidle');origin=new URL(page.url()).origin;
  report.health=await (await fetch(origin+'/api/health')).json();assert(report.health.instanceId);assert(Object.values(report.health.models).every(Boolean));
  report.desktop=await app.evaluate(({BrowserWindow,app})=>({version:app.getVersion(),windows:BrowserWindow.getAllWindows().length,preferences:BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('http:')).webContents.getLastWebPreferences()}));
  assert.equal(report.desktop.windows,1);assert.equal(report.desktop.preferences.nodeIntegration,false);assert.equal(report.desktop.preferences.contextIsolation,true);assert.equal(report.desktop.preferences.sandbox,true);
  const duplicate=spawn(executablePath,['--user-data-dir='+path.join(out,'profile')],{windowsHide:true,stdio:'ignore',env:launchEnv});await new Promise((res,rej)=>{duplicate.once('exit',res);duplicate.once('error',rej);setTimeout(()=>rej(new Error('Second instance did not exit')),10000).unref();});
  report.singleInstance=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().length===1);assert(report.singleInstance);
  const python=process.env.HN_TEST_PYTHON||'python';
  for(const script of (process.env.HN_SKIP_MODEL_TESTS?[]:['regression_v4.py','quality_test_v4.py'])){
   const r=spawnSync(python,[path.join(root,'scripts',script)],{cwd:root,env:{...process.env,PYTHONUTF8:'1',HN_TEST_URL:origin,HN_TEST_OUT:out},encoding:'utf8',timeout:600000});
   fs.writeFileSync(path.join(out,script+'.log'),r.stdout+'\n'+r.stderr);assert.equal(r.status,0,r.stdout+'\n'+r.stderr);console.log(script,'PASSED');
  }
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.evaluate(()=>{const Native=window.Audio;window.__hnAudio=[];window.Audio=function(src){const a=new Native(src);window.__hnAudio.push(a);return a;};window.Audio.prototype=Native.prototype;});
  await page.getByLabel('Chọn video',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/video-two-seconds.mp4'));
  await page.getByRole('heading',{name:'Nhận diện tiếng Trung',exact:true}).waitFor();
  await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();
  await page.getByLabel('Nhập SRT Việt',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/voice-ui.srt'));
  await page.getByRole('heading',{name:'VieNeu-TTS v3 Turbo',exact:true}).waitFor();
  await page.getByRole('button',{name:'Thêm nhân vật / giọng',exact:true}).click();
  const actor=await page.getByLabel('Nhân vật câu srt-0002',{exact:true}).locator('option').last().getAttribute('value');
  await page.getByLabel('Nhân vật câu srt-0002',{exact:true}).selectOption(actor);
  await page.getByRole('button',{name:'Tạo giọng và căn timeline',exact:true}).click();
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).filter(b=>b.textContent.includes('Nghe thử')).length===3&&!document.body.innerText.includes('VieNeu: tạo giọng câu'),{},{timeout:300000});
  report.originalMuted=await page.locator('video').evaluate(v=>v.muted);assert(report.originalMuted);
  report.playingCounts=[];
  await page.getByTitle('Phát / Tạm dừng (Phím Space)',{exact:true}).click();await page.waitForTimeout(600);
  report.playingCounts.push(await page.evaluate(()=>window.__hnAudio.filter(a=>!a.paused&&!a.ended).length));
  for(const n of [0,1]){await page.getByRole('button',{name:/Nghe thử/}).nth(n).click();await page.waitForTimeout(500);report.playingCounts.push(await page.evaluate(()=>window.__hnAudio.filter(a=>!a.paused&&!a.ended).length));}
  assert(report.playingCounts.every(n=>n===1));
  await page.getByTitle('Quay lại đầu',{exact:true}).click();await page.getByTitle('Phát / Tạm dừng (Phím Space)',{exact:true}).click();await page.waitForTimeout(2700);
  report.tailTime=await page.getByTestId('playback-time').innerText();report.videoDuration=await page.locator('video').evaluate(v=>v.duration);assert(Number(report.tailTime.split(':')[1])>report.videoDuration+.1);
  await page.getByTitle('Phát / Tạm dừng (Phím Space)',{exact:true}).click();
  const downloadDir=path.join(out,'exports-'+Date.now());fs.mkdirSync(downloadDir);await app.evaluate(({session},out)=>{globalThis.__hnTestDownloads=[];session.defaultSession.on('will-download',(_e,item)=>{item.setSavePath(out+'/'+item.getFilename());item.once('done',(_event,state)=>globalThis.__hnTestDownloads.push({name:item.getFilename(),state,path:item.getSavePath()}));});},downloadDir);
  await page.getByRole('button',{name:'5. Xuất file',exact:true}).click();
  let completed=0;for(const label of ['Giọng VieNeu toàn bộ (.wav)','Phụ đề theo giọng đã căn (.srt)']){await page.getByRole('button',{name:label,exact:true}).click();for(let n=0;n<60;n++){const downloads=await app.evaluate(()=>globalThis.__hnTestDownloads);if(downloads.length>completed){assert.equal(downloads[completed].state,'completed',JSON.stringify(downloads));completed++;break;}await new Promise(r=>setTimeout(r,250));}assert(completed>0);}assert.equal(completed,2);
  await page.waitForTimeout(1000);report.exports=fs.readdirSync(downloadDir).filter(n=>/\.(wav|srt)$/.test(n));assert(report.exports.some(n=>n.endsWith('.srt')));for(const name of report.exports)fs.copyFileSync(path.join(downloadDir,name),path.join(out,name));
  await page.getByRole('button',{name:'3. Dịch',exact:true}).click();assert.equal(await page.getByLabel('Chọn cách dịch',{exact:true}).locator('option').count(),3);
  await page.screenshot({path:path.join(out,'electron-app.png')});report.pageErrors=errors;assert.equal(errors.length,0);
  if(process.env.HN_TEST_GEMINI_VIDEO){
    await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();await page.getByLabel('Chọn video',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/video-tieng-trung.mp4'));await page.getByRole('heading',{name:'Nhận diện tiếng Trung',exact:true}).waitFor();
    await page.getByRole('button',{name:'Mở Gemini / đăng nhập',exact:true}).click();
    await page.waitForFunction(async()=>{const r=await fetch('/api/browser/status');return r.ok&&(await r.json()).gemini.connected;},{},{timeout:30000});
    await page.getByRole('button',{name:'Tải video lên Gemini → lấy SRT',exact:true}).click();
    await page.getByRole('heading',{name:'Dịch Trung–Việt',exact:true}).waitFor({timeout:660000});
    report.geminiCues=await page.locator('textarea:not([placeholder])').count();assert(report.geminiCues>0);
    await page.getByLabel('Chọn cách dịch',{exact:true}).selectOption('gemini');await page.getByRole('button',{name:'Dịch sang tiếng Việt',exact:true}).click();
    await page.getByRole('heading',{name:'VieNeu-TTS v3 Turbo',exact:true}).waitFor({timeout:360000});
    const vi=await page.locator('textarea[placeholder]').evaluateAll(els=>els.map(e=>e.value));assert(vi.length&&vi.every(t=>t.trim().length&&!t.includes('```')&&!t.includes('<ElicitationsGroup>')));report.geminiVideoToTranslation=true;
    fs.writeFileSync(path.join(out,'gemini-video-translated.json'),JSON.stringify(vi,null,2));await page.screenshot({path:path.join(out,'gemini-video-native.png')});
  }
  console.log('NATIVE ELECTRON UI PASSED');
 }finally{await app.close();}
 await new Promise(r=>setTimeout(r,1000));let stopped=false;try{await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});}catch{stopped=true;}assert(stopped,'Worker still running after desktop exit');report.workerStoppedOnExit=stopped;
 fs.writeFileSync(path.join(out,'desktop-test.json'),JSON.stringify(report,null,2));console.log('DESKTOP TEST PASSED');
})().catch(e=>{console.error(e);process.exitCode=1;});


