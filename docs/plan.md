# IMS Implementation Plan

## 1. Project Scaffolding
- Initialize root `ims` directory.
- Scaffold `backend` using Express and TypeScript.
- Scaffold `frontend` using Vite + React + TypeScript.
- Create `docker-compose.yml` for Postgres, MongoDB, and Redis.

## 2. Backend Design
- **Ingestion & Processing:** 
  - Express API `/api/signals`.
  - Rate Limiter using Redis. Fallback to in-memory if Redis fails.
  - Debouncing component ID failures (10 sec window).
  - Memory Buffer for async Data Lake pushes (MongoDB).
- **Workflow & State:**
  - Strategy Pattern for `AlertStrategy` (P0/P2).
  - State Pattern for `WorkItemState` (OPEN, INVESTIGATING, RESOLVED, CLOSED).
- **Models:** defined in `models.ts` supporting MongoDB (signals) and Postgres (Work Items).

## 3. Frontend Design
- **Vanilla CSS:** Custom premium CSS in `index.css`. Glassmorphism-inspired dark theme, dynamic animations, hover effects, strict color palettes.
- **Routing:** React Router DOM.
- **Dashboard View:** Polls `/api/incidents` and renders active items with severity.
- **Incident Detail View:** Renders raw signals dynamically from Data Lake, shows state transition buttons, and mandatory RCA form.

## 4. Run Instructions
- Run backend via `npm run dev` in `backend` dir.
- Mock data via `npm run mock`.
- Run frontend via `npm run dev` in `frontend` dir.
