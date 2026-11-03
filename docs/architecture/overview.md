# AISRestroOS — Architectural Design Overview

AISRestroOS is an offline-first commercial restaurant Point of Sale (POS) and management platform designed specifically for Windows laptops and desktop environments.

## 1. Architectural Philosophy: Offline-First & Resilient
- **Zero Cloud Runtime Dependency:** The POS operates 100% locally on the restaurant's Windows machine. No active internet connection is required to take orders, print KOTs, or generate tax invoices.
- **SQLite Single-File Embedded Engine:** All business data (orders, menu, KOTs, invoices, payments) is saved locally in SQLite with Write-Ahead Logging (`WAL`) mode enabled and `busy_timeout` set to 5000ms.
- **Monorepo Separation:**
  - `apps/frontend`: React 18 + Vite + Tailwind CSS + Zustand + TanStack Query
  - `apps/backend`: Python 3.12 + FastAPI + SQLAlchemy 2.0 + Pydantic v2
  - `apps/desktop`: Electron wrapper shell with native Windows printer and AppData bridges
  - `shared`: Enums, constants, and color palette shared contracts

```
+-------------------------------------------------------------+
|                 Windows Machine Environment                 |
|                                                             |
|  +---------------------+        +-------------------------+ |
|  |   Electron Desktop  |        |    React 18 Frontend    | |
|  |     Shell Wrapper   | <----> |  Tailwind / Zustand POS | |
|  +---------------------+        +-------------------------+ |
|             |                                |              |
|             v                                v              |
|  +-------------------------------------------------------+  |
|  |      FastAPI Backend Engine (Localhost:8000)          |  |
|  |   - Pricing & Tax Calculator (Integer Paise)          |  |
|  |   - Incremental KOT Ticket Manager                    |  |
|  |   - Multi-Payment Settlement Engine                   |  |
|  +-------------------------------------------------------+  |
|                             |                               |
|                             v                               |
|  +-------------------------------------------------------+  |
|  |        Local SQLite Database (WAL Mode Enabled)       |  |
|  |  Development: ./data/db/aisrestroos.db                 |  |
|  |  Production:  %APPDATA%\AISRestroOS\data\aisrestroos.db|  |
|  +-------------------------------------------------------+  |
+-------------------------------------------------------------+
```

## 2. Integer Paise Financial Representation
All currency calculations across the backend and database use integer paise (₹1.00 = 100 paise).
This avoids floating-point rounding errors and ensures penny-accurate tax and discount calculations required for GST and audit compliance.

## 3. Brand Identity
The UI adheres strictly to the **Bhagwa (Saffron Orange)** palette:
- Primary: `#F07818`
- Primary Dark: `#C85A0A`
- Primary Light: `#FFF0E3`
- Background: `#F7F8FA`
- Surface: `#FFFFFF`
- Text Primary: `#202124`
- Text Secondary: `#6B7280`
- Success: `#16865B`
- Danger: `#D94343`
