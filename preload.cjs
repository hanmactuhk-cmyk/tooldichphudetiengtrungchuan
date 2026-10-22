const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('hnDesktop',{chooseExport:name=>ipcRenderer.invoke('hn-choose-export',name),saveExport:url=>ipcRenderer.invoke('hn-save-export',url),revealExport:()=>ipcRenderer.invoke('hn-reveal-export')});
