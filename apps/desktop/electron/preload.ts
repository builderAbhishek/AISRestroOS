import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printHtml: (data: { html: string; printerName?: string; silent?: boolean; widthMm?: number }) =>
    ipcRenderer.invoke('print-html', data),
  testPrint: (data: { printerName?: string; format?: string }) =>
    ipcRenderer.invoke('test-print', data),
  platform: process.platform,
  isElectron: true,
});
