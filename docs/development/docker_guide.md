# Docker Development Guide

AISRestroOS provides a development environment managed via Docker Compose.

## Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+

## Quick Start Commands

### 1. Build and Start All Services
```bash
docker compose up --build
```
- **Frontend:** Accessible from Windows browser at `http://localhost:5173`
- **Backend API & Swagger Docs:** Accessible at `http://localhost:8000/docs`
- **Health check:** `http://localhost:8000/api/v1/health`

### 2. Stop Development Services
```bash
docker compose down
```
> **IMPORTANT:** Do NOT use `docker compose down -v` during standard development. `-v` deletes Docker named volumes, while your SQLite database is safely mounted to `./data/db` on the host machine.

### 3. View Live Logs
```bash
docker compose logs -f
# Or view a single service:
docker compose logs -f backend
docker compose logs -f frontend
```

### 4. Rebuild Clean Container Images
```bash
docker compose up --build --force-recreate
```

## Running Tests

### Run Backend Tests (Pytest)
```bash
# In Docker:
docker compose exec backend pytest apps/backend/tests -v

# Or natively on Windows host:
python -m pytest apps/backend/tests -v
```

### Run Frontend Tests (Vitest)
```bash
# In Docker:
docker compose exec frontend npm test

# Or natively on Windows host:
npm --prefix apps/frontend test
```

## SQLite Data Persistence & Backup

### Persistence Location
The development database is bind-mounted directly to the host machine:
- Host path: `./data/db/aisrestroos.db`
- Container path: `/app/data/aisrestroos.db`

Database files (`.db`, `.db-wal`, `.db-shm`) reside outside disposable container layers and survive rebuilds, stops, and restarts.

### Backup Procedure
1. **Via API / UI:** Click "Download Database Snapshot" in the Settings tab or access `GET /api/v1/system/backup`.
2. **Via File Copy:**
   ```powershell
   Copy-Item ./data/db/aisrestroos.db -Destination ./backups/aisrestroos_$(Get-Date -Format 'yyyyMMdd_HHmmss').db
   ```
