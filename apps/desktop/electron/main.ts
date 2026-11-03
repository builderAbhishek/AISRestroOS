import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_DEV_URL = 'http://localhost:5173';

function getAppDataDir(): string {
  const appData = app.getPath('appData');
  return path.join(appData, 'AISRestroOS');
}

function logToFile(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${msg}\n`;
  try {
    const logsDir = path.join(getAppDataDir(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, 'electron.log');
    fs.appendFileSync(logFilePath, line, 'utf-8');
  } catch (err) {
    // ignore logging failure
  }
  console.log(msg);
}

// Enforce single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  logToFile('[Electron] Second instance prevented by singleInstanceLock. Quitting...');
  app.quit();
} else {
  app.on('second-instance', () => {
    logToFile('[Electron] Second instance triggered; bringing main window to front.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function checkBackendHealth(retries = 35, delayMs = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/v1/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          logToFile(`[Electron] Backend health check PASSED after ${attempts} attempt(s).`);
          resolve(true);
        }
      });
      req.on('error', (err) => {
        if (attempts >= retries) {
          clearInterval(interval);
          logToFile(`[Electron] Backend health check TIMED OUT after ${retries} attempts. Last error: ${err.message}`);
          resolve(false);
        }
      });
      req.setTimeout(800, () => {
        req.destroy();
      });
    }, delayMs);
  });
}

function killBackend() {
  if (backendProcess && backendProcess.pid) {
    logToFile(`[Electron] Shutting down backend process PID ${backendProcess.pid}...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', `${backendProcess.pid}`, '/T', '/F']);
      } else {
        backendProcess.kill();
      }
    } catch (err) {
      logToFile(`[Electron] Error killing backend process: ${err}`);
    }
    backendProcess = null;
  }
}

function startPackagedBackend() {
  if (isDev) {
    logToFile('[Electron] In dev mode, expecting Docker or local backend on port 8000.');
    return;
  }

  const backendExecutable = path.join(
    process.resourcesPath,
    'backend',
    'aisrestroos-backend.exe'
  );

  if (!fs.existsSync(backendExecutable)) {
    logToFile(`[Electron ERROR] Backend executable missing at: ${backendExecutable}`);
    dialog.showErrorBox(
      'AISRestroOS — Missing Backend Executable',
      `The local backend server could not be located at:\n${backendExecutable}\nPlease reinstall the application.`
    );
    return;
  }

  const appDataDir = getAppDataDir();
  const dataDir = path.join(appDataDir, 'data');
  const uploadsDir = path.join(appDataDir, 'uploads');
  const backupsDir = path.join(appDataDir, 'backups');
  const logsDir = path.join(appDataDir, 'logs');

  // Ensure directories exist
  for (const dir of [dataDir, uploadsDir, backupsDir, logsDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const dbUrl = `sqlite:///${path.join(dataDir, 'aisrestroos.db').replace(/\\/g, '/')}`;

  logToFile(`[Electron] Launching packaged backend from ${backendExecutable}`);
  backendProcess = spawn(backendExecutable, [`--port=${BACKEND_PORT}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      ENVIRONMENT: 'production',
      BACKEND_PORT: `${BACKEND_PORT}`,
      SQLITE_WAL_MODE: 'true',
      AISRESTRO_DATA_DIR: dataDir,
      UPLOADS_DIR: uploadsDir,
      BACKUP_DIR: backupsDir,
      LOGS_DIR: logsDir,
    },
  });

  backendProcess.stdout?.on('data', (data) => {
    logToFile(`[Backend] ${data.toString().trim()}`);
  });

  backendProcess.stderr?.on('data', (data) => {
    logToFile(`[Backend ERR] ${data.toString().trim()}`);
  });

  backendProcess.on('error', (err) => {
    logToFile(`[Electron ERROR] Failed to start backend process: ${err}`);
  });

  backendProcess.on('exit', (code) => {
    logToFile(`[Electron] Backend process exited with code ${code}`);
  });
}

async function createWindow() {
  logToFile('=== [Electron] Initializing BrowserWindow ===');
  logToFile(`[Diagnostics] app.isPackaged: ${app.isPackaged}`);
  logToFile(`[Diagnostics] process.resourcesPath: ${process.resourcesPath}`);
  logToFile(`[Diagnostics] app.getAppPath(): ${app.getAppPath()}`);
  logToFile(`[Diagnostics] __dirname: ${__dirname}`);

  const iconPath = isDev
    ? path.join(__dirname, '../resources/icon.png')
    : path.join(process.resourcesPath, 'icon.png');

  // Resolve preload script
  const preloadCandidates = [
    path.join(__dirname, 'preload.js'),
    path.join(app.getAppPath(), 'dist-electron/preload.js'),
    path.join(process.resourcesPath, 'app.asar/dist-electron/preload.js'),
  ];
  const preloadPath = preloadCandidates.find((p) => fs.existsSync(p)) || path.join(__dirname, 'preload.js');
  logToFile(`[Diagnostics] Resolved preload path: ${preloadPath} (exists: ${fs.existsSync(preloadPath)})`);

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#F7F8FA',
    title: 'AISRestroOS — Commercial Restaurant POS',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Attach diagnostic listeners
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    logToFile(`[Renderer FAIL-LOAD] code=${errorCode}, desc="${errorDescription}", url="${validatedURL}", isMainFrame=${isMainFrame}`);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    logToFile(`[Renderer PROCESS-GONE] reason=${details.reason}, exitCode=${details.exitCode}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levelNames = ['VERBOSE', 'INFO', 'WARNING', 'ERROR'];
    const lvl = levelNames[level] || 'LOG';
    const filename = sourceId ? path.basename(sourceId) : 'renderer';
    logToFile(`[Renderer ${lvl}] (${filename}:${line}) ${message}`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    logToFile(`[Renderer FINISH-LOAD] Successfully loaded: ${mainWindow?.webContents.getURL()}`);
  });

  // Enable F12 toggle for DevTools in packaged build
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow?.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  if (isDev) {
    logToFile(`[Electron] Loading Dev URL: ${FRONTEND_DEV_URL}`);
    await mainWindow.loadURL(FRONTEND_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Wait for backend to be healthy before loading UI
    logToFile('[Electron] Checking local backend health before rendering UI...');
    const isHealthy = await checkBackendHealth(35, 1000);
    if (!isHealthy) {
      logToFile('[Electron WARNING] Backend health check failed before UI load.');
      dialog.showErrorBox(
        'AISRestroOS — Backend Startup Warning',
        'The local SQLite backend server is taking longer than expected to initialize.\nCheck %APPDATA%\\AISRestroOS\\logs\\backend.log.'
      );
    }

    // Resolve packaged frontend index.html
    const frontendCandidates = [
      path.join(app.getAppPath(), 'dist-frontend/index.html'),
      path.join(__dirname, '../dist-frontend/index.html'),
      path.join(process.resourcesPath, 'app.asar/dist-frontend/index.html'),
      path.join(process.resourcesPath, 'dist-frontend/index.html'),
    ];

    let frontendIndexPath: string | null = null;
    for (const cand of frontendCandidates) {
      const exists = fs.existsSync(cand);
      logToFile(`[Diagnostics] Checking frontend candidate: ${cand} (exists: ${exists})`);
      if (exists && !frontendIndexPath) {
        frontendIndexPath = cand;
      }
    }

    if (frontendIndexPath) {
      logToFile(`[Electron] Loading production frontend index file: ${frontendIndexPath}`);
      await mainWindow.loadFile(frontendIndexPath);
    } else {
      logToFile('[Electron ERROR] Frontend index.html not found in any candidate path!');
      dialog.showErrorBox(
        'AISRestroOS — Missing Frontend Bundle',
        'The application frontend files could not be located inside the package.\nPlease reinstall AISRestroOS.'
      );
      await mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/docs`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  startPackagedBackend();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  killBackend();
});

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC communication
ipcMain.handle('get-app-paths', () => {
  return {
    appData: getAppDataDir(),
    userData: app.getPath('userData'),
    isOffline: true,
  };
});

ipcMain.handle('get-printers', async () => {
  if (!mainWindow) return [];
  return await mainWindow.webContents.getPrintersAsync();
});

ipcMain.handle('print-html', async (_event, { html, printerName, silent, widthMm = 80 }) => {
  const isSilent = silent === true && Boolean(printerName);
  const printWindow = new BrowserWindow({
    show: !isSilent,
    width: widthMm === 58 ? 384 : 576,
    height: 700,
    parent: mainWindow || undefined,
    modal: !isSilent,
    title: 'AISRestroOS — Kitchen Ticket Print',
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return new Promise((resolve) => {
    printWindow.webContents.print(
      {
        silent: isSilent,
        printBackground: true,
        deviceName: isSilent ? printerName : undefined,
      },
      (success, failureReason) => {
        try {
          printWindow.close();
        } catch {
          // Window may already be closed
        }
        resolve({ success, failureReason });
      }
    );
  });
});

ipcMain.handle('test-print', async (_event, { printerName, format = '80mm' }) => {
  const testHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: monospace; padding: 12px; margin: 0; font-size: 13px; line-height: 1.4; }
          .header { text-align: center; font-weight: bold; font-size: 15px; border-bottom: 2px dashed #000; padding-bottom: 6px; }
          .details { margin: 12px 0; }
          .footer { text-align: center; border-top: 2px dashed #000; padding-top: 6px; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="header">AISRestroOS Diagnostic Test Print</div>
        <div class="details">
          <p><strong>Device:</strong> ${printerName || 'Default System Printer'}</p>
          <p><strong>Paper Width:</strong> ${format}</p>
          <p><strong>Timestamp:</strong> ${new Date().toLocaleString('en-IN')}</p>
          <p><strong>Interface:</strong> Windows Native Spooler / ESC-POS</p>
          <p><strong>Communication:</strong> VERIFIED OK</p>
        </div>
        <div class="footer">
          AISRestroOS Commercial Offline Restaurant POS<br/>
          All calculations performed in integer paise
        </div>
      </body>
    </html>
  `;

  const printWindow = new BrowserWindow({
    show: false,
    width: format === '58mm' ? 384 : 576,
    height: 800,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(testHtml)}`);

  return new Promise((resolve) => {
    printWindow.webContents.print(
      {
        silent: true,
        printBackground: true,
        deviceName: printerName || undefined,
      },
      (success, failureReason) => {
        printWindow.close();
        resolve({ success, failureReason });
      }
    );
  });
});
