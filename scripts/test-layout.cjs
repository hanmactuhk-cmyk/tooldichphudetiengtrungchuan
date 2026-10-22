const {chromium}=require(process.env.HN_PLAYWRIGHT||'playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HN_TEST_OUT||'test-results/layout');fs.mkdirSync(out,{recursive:true});const errors=[];
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1600,height:1050}});page.on('pageerror',e=>errors.push(String(e)));await page.goto(process.env.HN_TEST_URL||'http://127.0.0.1:8006',{waitUntil:'networkidle'});
 await page.getByLabel('Chọn video',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/video-tieng-trung.mp4'));await page.getByRole('heading',{name:'Nhận diện tiếng Trung',exact:true}).waitFor();
 await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();await page.getByLabel('Nhập SRT Việt',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/voice-ui.srt'));
 await page.getByTestId('subtitle-overlay').waitFor();
 const report={ratios:[],drags:[]};
 for(const aspect of ['16:9','9:16','auto']){
  await page.getByLabel('Tỷ lệ khung hình',{exact:true}).selectOption(aspect);await page.waitForTimeout(200);
  const frame=await page.getByTestId('video-frame').boundingBox(),picture=await page.getByTestId('video-picture').boundingBox();const actual=frame.width/frame.height;assert(Math.abs(actual-(aspect==='9:16'?9/16:16/9))<.02);report.ratios.push({aspect,actual});
  const cap=page.getByTestId('subtitle-overlay'),before=await cap.boundingBox();await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.down();await page.mouse.move(picture.x+picture.width*.55,picture.y+picture.height*.2,{steps:8});await page.mouse.up();await page.waitForTimeout(200);
  const after=await cap.boundingBox();console.log('Dragged',aspect,before.y,after.y);assert(Math.abs((after.y+after.height/2)-(picture.y+picture.height*.2))<after.height/2+3);assert(after.x>=picture.x-.5&&after.y>=picture.y-.5&&after.x+after.width<=picture.x+picture.width+.5&&after.y+after.height<=picture.y+picture.height+.5);report.drags.push({aspect,before,after,picture});
 }
 await page.getByLabel('Phạm vi kéo phụ đề',{exact:true}).selectOption('cue');const cap=await page.getByTestId('subtitle-overlay').boundingBox(),picture=await page.getByTestId('video-picture').boundingBox();await page.mouse.move(cap.x+cap.width/2,cap.y+cap.height/2);await page.mouse.down();await page.mouse.move(picture.x+picture.width*.7,picture.y+picture.height*.6,{steps:8});await page.mouse.up();
 await page.screenshot({path:path.join(out,'layout-landscape.png')});
 await page.getByLabel('Tách đôi câu srt-0001',{exact:true}).click();assert.equal(await page.getByRole('button',{name:/^Tách đôi câu/}).count(),4);report.splitCount=4;
 await page.getByRole('button',{name:'5. Xuất file',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Phụ đề có vị trí (.ass)',exact:true}).click();const d=await download;await d.saveAs(path.join(out,'layout.ass'));assert(fs.readFileSync(path.join(out,'layout.ass'),'utf8').includes('\\pos('));
 await page.getByRole('button',{name:'2. Nhận diện',exact:true}).click();assert(await page.getByRole('button',{name:'Tải video lên Gemini → lấy SRT',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'Nghe lời nói → phụ đề',exact:true}).isEnabled());assert(await page.getByRole('button',{name:'Quét chữ phụ đề (OCR)',exact:true}).isEnabled());
 await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();await page.getByLabel('Chọn video',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/video-portrait.mp4'));await page.getByRole('heading',{name:'Nhận diện tiếng Trung',exact:true}).waitFor();
 await page.waitForFunction(()=>document.querySelector('video')?.videoWidth===360);await page.getByRole('button',{name:'1. Video / SRT',exact:true}).click();await page.getByLabel('Nhập SRT Việt',{exact:true}).setInputFiles(path.join(root,'tests/fixtures/voice-ui.srt'));await page.getByTestId('subtitle-overlay').waitFor();
 for(const size of [{width:1600,height:1050},{width:1120,height:750}]){
  await page.setViewportSize(size);await page.waitForTimeout(250);const picture=await page.getByTestId('video-picture').boundingBox(),frame=await page.getByTestId('video-frame').boundingBox(),caption=await page.getByTestId('subtitle-overlay').boundingBox();assert(Math.abs(frame.width/frame.height-9/16)<.02);assert(caption.x>=picture.x-.5&&caption.y>=picture.y-.5&&caption.x+caption.width<=picture.x+picture.width+.5&&caption.y+caption.height<=picture.y+picture.height+.5);
 }
 const small=await page.getByTestId('video-picture').boundingBox();await page.getByRole('button',{name:'Phóng to khung hình',exact:true}).click();await page.waitForTimeout(250);const large=await page.getByTestId('video-picture').boundingBox();assert(large.height>small.height*2);report.focusMode=true;await page.screenshot({path:path.join(out,'layout-portrait.png')});await page.getByRole('button',{name:'Hiện bảng biên tập',exact:true}).click();report.portraitAndResize=true;
 report.errors=errors;assert.equal(errors.length,0);fs.writeFileSync(path.join(out,'layout-test.json'),JSON.stringify(report,null,2));await browser.close();console.log('LAYOUT TEST PASSED');
})().catch(e=>{console.error(e);process.exit(1);});
