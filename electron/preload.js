const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_event, info) => cb(info)),
  installUpdate: () => ipcRenderer.send('install-update'),
});
