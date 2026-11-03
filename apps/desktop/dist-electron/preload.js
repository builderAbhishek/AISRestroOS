"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getAppPaths: () => electron_1.ipcRenderer.invoke('get-app-paths'),
    getPrinters: () => electron_1.ipcRenderer.invoke('get-printers'),
    printHtml: (data) => electron_1.ipcRenderer.invoke('print-html', data),
    testPrint: (data) => electron_1.ipcRenderer.invoke('test-print', data),
    platform: process.platform,
    isElectron: true,
});
