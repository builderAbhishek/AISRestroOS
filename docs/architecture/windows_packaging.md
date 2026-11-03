# Windows Production Packaging Architecture

## Zero-Prerequisite Deployment
When deployed to a customer restaurant computer, the final package must run out-of-the-box **without requiring Docker, Python, Node.js, Git, or developer tooling**.

```
Customer's Windows Machine
├── %LOCALAPPDATA%\Programs\AISRestroOS\    <-- Installation directory (Binaries only)
│   ├── AISRestroOS.exe                    (Electron executable)
│   ├── resources\
│   │   ├── app.asar                       (Packaged React Frontend)
│   │   └── backend\
│   │       └── aisrestroos-backend.exe    (Packaged FastAPI PyInstaller executable)
│
└── %APPDATA%\AISRestroOS\                 <-- Persistent Business Data (Never deleted on uninstall)
    ├── data\
    │   ├── aisrestroos.db                 (SQLite business database)
    │   ├── aisrestroos.db-wal             (Write-Ahead Log)
    │   └── aisrestroos.db-shm
    ├── logs\
    │   └── aisrestroos.log
    └── backups\
        └── auto_backup_*.db
```

## Production Architecture Flow:
1. **Frontend Compilation:**
   - `npm --prefix apps/frontend run build` compiles React/TypeScript into optimized static assets (`dist/`).
2. **Backend Bundling via PyInstaller:**
   - PyInstaller packages the FastAPI server into a standalone self-contained Windows executable `aisrestroos-backend.exe`.
3. **Electron Launch Orchestration:**
   - Electron boots up, requests the Windows single-instance lock (`app.requestSingleInstanceLock()`).
   - Resolves `%APPDATA%\AISRestroOS\data\aisrestroos.db`.
   - Spawns `aisrestroos-backend.exe` as a child process with `DATABASE_URL` pointing to `%APPDATA%`.
   - Pings `http://localhost:8000/api/v1/health` until the backend signals readiness.
   - Loads the local packaged frontend files.
   - Upon window closure, cleanly shuts down the backend process.
4. **Data Isolation Rule:**
   - Under no circumstances is user business data stored inside the installation folder.
   - Uninstalling or upgrading the app binary preserves `%APPDATA%\AISRestroOS` untouched.
