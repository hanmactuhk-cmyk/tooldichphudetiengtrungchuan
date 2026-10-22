const { _electron }=require(process.env.HN_PLAYWRIGHT);const fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{const base=path.resolve(__dirname,'..'),out=path.resolve(base,'../../outputs/v531-tests');fs.mkdirSync(out,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await _electron.launch({executablePath:path.resolve(base,'../../outputs/HN531/HN Voice Studio.exe'),args:['--user-data-dir='+path.join(out,'profile')],env,timeout:120000});const report={};
try{let page;for(let i=0;i<180;i++){page=app.windows().find(w=>w.url().startsWith('http:'));if(page)break;await new Promise(r=>setTimeout(r,500));}assert(page);await page.waitForLoadState('networkidle');report.version=await app.evaluate(({app})=>app.getVersion());const alerts=[];page.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});
for(const [fixture,button,key] of [['video-tieng-trung.mp4','Nghe lời nói → phụ đề','asr'],['video-phu-de-chu-trung.mp4','Quét chữ phụ đề (OCR)','ocr'],['video-tieng-trung.mp4','Tải video lên Gemini → lấy SRT','gemini']]){
 await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();await page.getByLabel('Chọn video',{exact:true}).setInputFiles(path.join(base,'tests/fixtures',fixture));await page.getByRole('heading',{name:'Nhận diện tiếng Trung',exact:true}).waitFor();
 await page.evaluate(()=>URL.revokeObjectURL(document.querySelector('video').src)); // reproduce a lost playback URL; uploads must still use the retained File.
 const requests=[];const onRequest=r=>{if(r.method()==='POST'&&/api\/(transcribe|ocr|gemini\/video-subtitles)/.test(r.url()))requests.push(r.url());};page.on('request',onRequest);
 const start=Date.now();await page.getByRole('button',{name:button,exact:true}).click();
 await Promise.race([page.getByRole('heading',{name:'Dịch Trung–Việt',exact:true}).waitFor({timeout:360000}),page.waitForFunction(()=>false,{},{timeout:360000})]);
 page.off('request',onRequest);assert.equal(alerts.length,0,alerts.join('\n'));assert(requests.length);report[key]={seconds:(Date.now()-start)/1000,posted:requests,cues:await page.locator('textarea').count()};assert(report[key].cues>0);fs.writeFileSync(path.join(out,'readers.json'),JSON.stringify(report,null,2));console.log(key,JSON.stringify(report[key]));
}
 await page.screenshot({path:path.join(out,'readers.png')});console.log('ALL THREE READERS PASSED');
}finally{await app.close();fs.writeFileSync(path.join(out,'readers.json'),JSON.stringify(report,null,2));}})().catch(e=>{console.error(e);process.exitCode=1;});
