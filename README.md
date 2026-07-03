# Cycling Peaks

Tu propio TrainingPeaks personal. 100% local, con tus datos reales de Garmin Connect.

**Status:** Backend corriendo ✓ | Frontend Vercel ✓

## Stack

- Backend: Go + Fiber (API REST)
- Sync: Python (garminconnect)
- DB: SQLite
- Frontend: React + Vite
- Agent: Hermes (reports via Telegram)

## Quick Start

```bash
# Backend
cd ~/projects/cycling-peaks/backend
go mod download && go run main.go

# Sync (en otra terminal)
cd ~/projects/cycling-peaks/sync
pip install -r requirements.txt
export GARMIN_EMAIL=tu@email.com
export GARMIN_PASSWORD=tu_password
python main.py

# Frontend
cd ~/projects/cycling-peaks/frontend
npm install && npm run dev
```

## API Endpoints

- GET /api/v1/dashboard/summary - Resumen completo
- GET /api/v1/load/today - CTL, ATL, TSB de hoy
- GET /api/v1/load/history?days=90 - Historial de carga
- GET /api/v1/workouts - Lista de entrenos
- GET /api/v1/sync/status - Estado del sync
- POST /api/v1/sync/trigger - Triggerear sync
- PUT /api/v1/athlete/ftp - Actualizar FTP

## Environment Variables

- DATABASE_URL: cycling.db (path a SQLite)
- PORT: 8080
- SYNC_INTERVAL_MINUTES: 60
- GARMIN_EMAIL: tu email Garmin
- GARMIN_PASSWORD: tu password Garmin
