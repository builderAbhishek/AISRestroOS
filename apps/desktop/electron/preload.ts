import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  platform: process.platform,
  isElectron: true,
});
