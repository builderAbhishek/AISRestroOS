import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import http from 'http';

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const BACKEND_PORT = 8000;
const FRONTEND_DEV_URL = 'http://localhost:5173';

// Enforce single application instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getAppDataDir(): string {
  const appData = app.getPath('appData');
  return path.join(appData, 'AISRestroOS');
}

function checkBackendHealth(retries = 30, delayMs = 500): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const req = http.get(`http://localhost:${BACKEND_PORT}/api/v1/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on('error', () => {
        if (attempts >= retries) {
          clearInterval(interval);
          resolve(false);
        }
      });
    }, delayMs);
  });
}

function startPackagedBackend() {
  if (isDev) {
    console.log('[Electron] In dev mode, expecting Docker or local backend on port 8000.');
    return;
  }

  // In production Windows packaging, backend binary is packaged via PyInstaller
  const backendExecutable = path.join(
    process.resourcesPath,
    'backend',
    'aisrestroos-backend.exe'
  );

  const dataDir = path.join(getAppDataDir(), 'data');
  const dbUrl = `sqlite:///${path.join(dataDir, 'aisrestroos.db').replace(/\\/g, '/')}`;

  console.log(`[Electron] Launching packaged backend from ${backendExecutable}`);
  backendProcess = spawn(backendExecutable, [], {
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      ENVIRONMENT: 'production',
      BACKEND_PORT: `${BACKEND_PORT}`,
      SQLITE_WAL_MODE: 'true',
    },
  });

  backendProcess.on('error', (err) => {
    console.error('[Electron] Failed to start backend process:', err);
  });

  backendProcess.on('exit', (code) => {
    console.log(`[Electron] Backend process exited with code ${code}`);
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    minWidth: 1024,
    minHeight: 600,
    backgroundColor: '#F7F8FA',
    title: 'AISRestroOS — Commercial Restaurant POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    await mainWindow.loadURL(FRONTEND_DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    await checkBackendHealth();
    mainWindow.loadFile(path.join(__dirname, '../dist-frontend/index.html'));
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

app.on('window-all-closed', () => {
  if (backendProcess) {
    backendProcess.kill();
  }
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
