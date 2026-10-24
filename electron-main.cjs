const { app, BrowserWindow, dialog, session, ipcMain, shell } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const crypto = require('node:crypto');
let worker, mainWindow, splash, quitting = false, logFd;
app.setName('HN601');
// A stable installed profile allows the installer and older portable copy to coexist.
const installedMode=app.isPackaged&&fs.existsSync(path.join(path.dirname(process.execPath),'installed-mode'));
if(installedMode&&!app.commandLine.hasSwitch('user-data-dir')){
 app.setPath('userData',path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HN601','UserData'));
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
 app.on('second-instance',()=>{const win=mainWindow||splash;if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 app.whenReady().then(start).catch(fail);
}
function fail(error){
 if(quitting)return;
 dialog.showErrorBox('Không mở được HN Voice Studio',`${error.message}\n\nNhật ký: ${app.getPath('userData')}\\worker.log`);app.quit();
}
async function freePort(){
 return new Promise((resolve,reject)=>{const server=net.createServer();server.once('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
}
async function start(){
 const root=app.isPackaged?process.resourcesPath:path.join(__dirname,'resources');
 const executable=path.join(root,'runtime','hn-worker','hn-worker.exe');
 if(!fs.existsSync(executable))throw new Error('Thiếu bộ xử lý. Hãy giải nén đủ bộ phát hành hoặc chạy scripts/build-worker.ps1 khi xây từ mã nguồn.');
 const data=app.getPath('userData');fs.mkdirSync(data,{recursive:true});let settings={};
 const settingsPath=path.join(data,'desktop-settings.json');
 if(fs.existsSync(settingsPath))settings=JSON.parse(fs.readFileSync(settingsPath,'utf8'));
 const legacySettings=path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HN Voice Studio','UserData','desktop-settings.json');if(!settings.browserHome&&fs.existsSync(legacySettings)){try{const old=JSON.parse(fs.readFileSync(legacySettings,'utf8'));if(old.browserHome)settings.browserHome=old.browserHome}catch{}}
 const legacyVoices=path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HN Voice Studio','UserData','voices');const newVoices=path.join(data,'voices');fs.mkdirSync(newVoices,{recursive:true});if(fs.existsSync(legacyVoices))for(const file of fs.readdirSync(legacyVoices)){if(/^clone-[a-f0-9]{32}\.(json|npz)$/.test(file)&&!fs.existsSync(path.join(newVoices,file)))fs.copyFileSync(path.join(legacyVoices,file),path.join(newVoices,file));}
 splash=new BrowserWindow({width:520,height:520,transparent:true,hasShadow:false,frame:false,resizable:false,maximizable:false,center:true,show:false,backgroundColor:'#00000000',icon:path.join(__dirname,'dist','hnstudio.ico'),webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
 let splashShownAt=Date.now();
 splash.once('ready-to-show',()=>{splashShownAt=Date.now();splash?.show();});
 await splash.loadFile(path.join(__dirname,'splash.html'));
 const splashStatus=(message)=>{if(splash&&!splash.isDestroyed())splash.webContents.executeJavaScript('window.setStartupStatus('+JSON.stringify(message)+')').catch(()=>{});};
 splashStatus('Đang khởi động bộ xử lý…');
 const port=await freePort(),instance=crypto.randomUUID(),origin=`http://127.0.0.1:${port}`;
 const cacheHome=process.env.HN_CACHE_DIR||settings.cacheHome||path.join(data,'cache');
 fs.mkdirSync(cacheHome,{recursive:true});
 const tempHome=path.join(cacheHome,'temp');fs.mkdirSync(tempHome,{recursive:true});
 const logPath=path.join(data,'worker.log');
 if(fs.existsSync(logPath)&&fs.statSync(logPath).size>5*1024*1024)fs.renameSync(logPath,logPath+'.old');
 logFd=fs.openSync(logPath,'a');
 worker=spawn(executable,[],{cwd:path.dirname(executable),windowsHide:true,stdio:['ignore',logFd,logFd],env:{...process.env,HN_MODELS_DIR:path.join(root,'models'),HN_CACHE_DIR:cacheHome,HN_VOICES_DIR:path.join(data,'voices'),TEMP:tempHome,TMP:tempHome,TMPDIR:tempHome,HN_PORT:String(port),HN_INSTANCE_ID:instance,HN_BROWSER_HOME:process.env.HN_BROWSER_HOME||settings.browserHome||path.join(process.env.LOCALAPPDATA||app.getPath('appData'),'HN Voice Studio','UserData','chrome-profiles')}});
 worker.once('error',fail);worker.once('exit',code=>{if(!quitting)fail(new Error(`Bộ xử lý đã dừng (mã ${code}). Hãy kiểm tra đủ tệp và nhật ký.`));});
 let ready=false;
 for(let i=0;i<180&&!quitting;i++){
  try{const response=await fetch(origin+'/api/health',{signal:AbortSignal.timeout(1000)});const health=await response.json();if(response.ok&&health.instanceId===instance){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 if(quitting)return;if(!ready)throw new Error('Bộ xử lý không sẵn sàng sau 90 giây.');
 splashStatus('Đang mở không gian làm việc…');
 const permitted=(wc,permission)=>!!wc&&wc===mainWindow?.webContents&&new URL(wc.getURL()).origin===origin&&['fullscreen','clipboard-sanitized-write'].includes(permission);
 session.defaultSession.setPermissionRequestHandler((wc,permission,callback)=>callback(permitted(wc,permission)));
 session.defaultSession.setPermissionCheckHandler((wc,permission)=>permitted(wc,permission));
 mainWindow=new BrowserWindow({icon:path.join(__dirname,'dist','hnstudio.ico'),title:'HN601 '+app.getVersion(),width:1440,height:930,minWidth:1100,minHeight:700,show:false,backgroundColor:'#101827',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,preload:path.join(__dirname,'preload.cjs')}});
 mainWindow.on('page-title-updated',event=>{event.preventDefault();mainWindow.setTitle('HNstudio '+app.getVersion());});
 mainWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
 mainWindow.webContents.on('will-attach-webview',event=>event.preventDefault());
 let chosenExport=null,lastExport=null;
 const trusted=event=>event.sender===mainWindow?.webContents&&new URL(event.senderFrame.url).origin===origin;
 ipcMain.handle('hn-get-theme',event=>{if(!trusted(event))throw Error('Nguồn không hợp lệ.');return ['simple','modern','glow','glow-dark'].includes(settings.theme)?settings.theme:'glow'});
 ipcMain.handle('hn-set-theme',(event,theme)=>{if(!trusted(event)||!['simple','modern','glow','glow-dark'].includes(theme))throw Error('Giao diện không hợp lệ.');settings.theme=theme;fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));return theme});
 ipcMain.handle('hn-choose-export',async(event,name)=>{
  if(!trusted(event))throw Error('Nguồn không hợp lệ.');
  const result=await dialog.showSaveDialog(mainWindow,{title:'Chọn nơi lưu video MP4',defaultPath:path.join(settings.exportHome||app.getPath('videos'),path.basename(String(name))),filters:[{name:'Video MP4',extensions:['mp4']}]});
  chosenExport=result.canceled?null:result.filePath;return chosenExport;
 });
 ipcMain.handle('hn-save-export',async(event,url)=>{
  if(!trusted(event)||!chosenExport||!/^\/cache\/export-[a-f0-9]{64}\.mp4$/.test(String(url)))throw Error('Tệp xuất không hợp lệ.');
  const source=path.join(cacheHome,path.basename(url)),destination=chosenExport;chosenExport=null;
  await fs.promises.copyFile(source,destination);lastExport=destination;settings.exportHome=path.dirname(destination);fs.writeFileSync(settingsPath,JSON.stringify(settings,null,2));return destination;
 });
 const autoFolders=new Map();
 ipcMain.handle('hn-auto-folder',async event=>{if(!trusted(event))throw Error('Nguồn không hợp lệ.');const result=await dialog.showOpenDialog(mainWindow,{title:'Chọn thư mục lưu Auto HN601',properties:['openDirectory','createDirectory']});if(result.canceled)return null;const token=crypto.randomUUID(),folder=path.join(result.filePaths[0],'HN601-'+new Date().toISOString().replace(/[:.]/g,'-'));await fs.promises.mkdir(folder,{recursive:true});autoFolders.set(token,folder);return {token,path:folder};});
 ipcMain.handle('hn-auto-output',async(event,payload)=>{if(!trusted(event)||!autoFolders.has(payload.token)||!/^\/cache\/export-[a-f0-9]{64}\.mp4$/.test(String(payload.url)))throw Error('Kết quả Auto không hợp lệ.');const folder=autoFolders.get(payload.token),name=path.basename(String(payload.name||'Thuyet-minh')).replace(/[<>:"/\\|?*]/g,'_').slice(0,100);const destination=path.join(folder,name+'.mp4');await fs.promises.copyFile(path.join(cacheHome,path.basename(payload.url)),destination);if(typeof payload.srt==='string')await fs.promises.writeFile(path.join(folder,name+'.srt'),payload.srt,'utf8');lastExport=destination;return destination;});
 const autoProjectPath=payload=>{if(!autoFolders.has(payload.autoToken))throw Error('Hãy chọn lại thư mục Auto.');return path.join(autoFolders.get(payload.autoToken),'Du-an-HN601.hnproject');};
 require('./desktop-project.cjs')({ipcMain,dialog,mainWindow,trusted,cacheHome,origin,voiceHome:path.join(data,'voices'),autoProjectPath});
 ipcMain.handle('hn-reveal-export',event=>{if(trusted(event)&&lastExport)shell.showItemInFolder(lastExport);});
 session.defaultSession.on('will-download',(_event,item)=>{item.setSaveDialogOptions({title:'Lưu file xuất từ HN Voice Studio',defaultPath:path.join(app.getPath('downloads'),path.basename(item.getFilename()))});});
 mainWindow.once('ready-to-show',async()=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,3000-(Date.now()-splashShownAt))));if(quitting||!mainWindow||mainWindow.isDestroyed())return;mainWindow.show();if(splash&&!splash.isDestroyed()){splash.destroy();splash=null;}});
 await mainWindow.loadURL(origin);mainWindow.on('closed',()=>{mainWindow=null;app.quit();});
}
app.on('before-quit',()=>{quitting=true;if(worker&&!worker.killed)worker.kill();if(logFd!==undefined){fs.closeSync(logFd);logFd=undefined;}});
app.on('window-all-closed',()=>app.quit());
