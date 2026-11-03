# AISRestroOS — Commercial Offline-First Restaurant POS

AISRestroOS is a commercial, offline-first restaurant management and Point of Sale (POS) system engineered specifically for Windows desktop and laptop environments.

Built for Indian and South Asian restaurants, it operates 100% locally with zero cloud dependencies during runtime. It stores all business transactions in an embedded, high-performance SQLite database with Write-Ahead Logging (WAL) and penny-accurate integer paise accounting.

---

## 1. Technology Stack

- **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS, Lucide React, Zustand, TanStack Query
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic
- **Database:** Local SQLite (`WAL` mode enabled, `busy_timeout=5000ms`, integer paise)
- **Desktop Wrapper:** Electron (Desktop shell with AppData persistence and thermal print bridges)
- **Development Environment:** Docker & Docker Compose

---

## 2. Brand Design System — Bhagwa / Saffron Orange

The user interface follows the **Bhagwa Brand System**:
- **Primary:** `#F07818` (Bhagwa Orange — used for key actions, active navigation, POS highlights)
- **Primary Dark:** `#C85A0A`
- **Primary Light:** `#FFF0E3`
- **Background:** `#F7F8FA`
- **Surface:** `#FFFFFF`
- **Text Primary:** `#202124`
- **Text Secondary:** `#6B7280`
- **Border:** `#E8EAF0`
- **Success:** `#16865B`
- **Warning:** `#D98A16`
- **Danger:** `#D94343`

---

## 3. Project Structure

```
AISRestroOS/
├── apps/
│   ├── frontend/             # React 18 + Vite + Tailwind CSS + Zustand
│   │   ├── Dockerfile
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/   # UI primitives, Sidebar, TopHeader, SetupWizard
│   │   │   ├── modules/      # Dashboard, POS, Orders, Menu, Tables, Settings
│   │   │   ├── services/     # Typed API clients for backend
│   │   │   ├── store/        # Zustand cartStore & uiStore
│   │   │   └── types/
│   │   └── package.json
│   ├── backend/              # Python FastAPI + SQLAlchemy 2.0 + SQLite
│   │   ├── Dockerfile
│   │   ├── app/
│   │   │   ├── api/v1/       # REST routes: restaurant, menu, tables, orders, kot, billing, dashboard
│   │   │   ├── business_logic/ # Pricing calculator, KOT manager, Settlement service
│   │   │   ├── core/         # Config, logging, domain exceptions
│   │   │   ├── database/     # SQLite session with WAL pragmas & base models
│   │   │   ├── models/       # SQLAlchemy 2.0 ORM models
│   │   │   ├── printing/     # ESC/POS thermal text formatters (80mm / 58mm)
│   │   │   └── schemas/      # Pydantic v2 validation models
│   │   ├── tests/            # Pytest test suite (100% passing)
│   │   └── requirements.txt
│   └── desktop/              # Electron desktop wrapper
│       └── electron/         # main.ts, preload.ts
├── data/
│   └── db/                   # Persistent SQLite database (aisrestroos.db)
├── docs/                     # Architecture, database schema, and dev guides
├── shared/                   # Shared contracts, enums and brand constants
├── docker-compose.yml        # Docker development orchestration
├── .env.example
├── README.md
└── package.json
```

---

## 4. Docker Quick Start Commands

The development environment is manageable via Docker Compose.

### Start Environment:
```bash
docker compose up --build
```
- **Web POS:** Open [http://localhost:5173](http://localhost:5173) in any browser.
- **FastAPI Swagger Docs:** Open [http://localhost:8000/docs](http://localhost:8000/docs).
- **Backend Health:** [http://localhost:8000/api/v1/health](http://localhost:8000/api/v1/health).

### Stop Environment:
```bash
docker compose down
```
*(Do NOT use `docker compose down -v` to prevent accidental volume removal. SQLite data is persisted in `./data/db`)*

### View Logs:
```bash
docker compose logs -f
```

### Rebuild Force Recreate:
```bash
docker compose up --build --force-recreate
```

---

## 5. Running Tests

### Run Backend Tests (Pytest)
```bash
python -m pytest apps/backend/tests -v
```
Covers:
- Restaurant setup and duplicate prevention
- Menu categories & items CRUD with portion variants and add-on groups
- Dine-in order creation and table occupancy lock
- Duplicate active order prevention on occupied tables
- Incremental KOT generation and duplicate kitchen print prevention
- Tax calculations (CGST 2.5% + SGST 2.5% = 5% GST) and discounts
- Full Cash settlement with change due calculation
- Split payments (UPI + Cash)
- Partial payments (table remains occupied until fully paid)
- Table release on settlement
- Dashboard analytics aggregation

### Run Frontend Tests (Vitest)
```bash
npm --prefix apps/frontend test
```
Covers:
- Zustand cart state & portion price additions
- Variant and add-on pricing mathematics
- Quantity updates and item deletion
- Discount and tax calculations
- Bhagwa UI primitives (Button, Input, Badge, EmptyState)
- Currency formatting in INR (`₹`)

---

## 6. POS Order Workflow

1. **Step 1 — Order Type & Table:**
   - Choose Dine-in, Takeaway, or Delivery.
   - For Dine-in, pick an available table.
   - If an occupied table is selected, the system automatically loads its active open order! No duplicate orders are ever created.
2. **Step 2 — Add Items:**
   - Search or browse categories.
   - Select portion variants (Half, Full, Regular, Large) and optional add-ons (Extra Cheese, Spice Level).
   - Enter kitchen notes ("Less spicy, no onion").
3. **Step 3 — Add & Print KOT:**
   - Validates order and saves to SQLite.
   - Creates incremental KOT record with sequence numbering (`ORD-0001-K1`, `ORD-0001-K2`).
   - Only new or increased portions are sent to the kitchen.
4. **Step 4 — Generate Bill / Settle:**
   - Computes final invoice with discounts and GST.
   - Accepts Cash (with change due calculation), UPI, Card, Other, or Split payment.
   - On full payment, marks order completed, frees the table back to `available`, and generates printable 80mm / 58mm tax invoice receipt.
   - Dashboard instantly refreshes with updated revenue.

---

## 7. Windows Production Packaging Plan

For customer deployment, the app does **NOT** require Docker, Node.js, Python, or Git:
1. React frontend compiles into static bundle: `apps/frontend/dist/`.
2. Python FastAPI backend compiles into standalone binary: `aisrestroos-backend.exe` via PyInstaller.
3. Electron launches `aisrestroos-backend.exe` and points `DATABASE_URL` to `%APPDATA%\AISRestroOS\data\aisrestroos.db`.
4. Electron loads the local static frontend.
5. All user data resides strictly under `%APPDATA%\AISRestroOS\` and is never deleted during app upgrades or uninstalls.
