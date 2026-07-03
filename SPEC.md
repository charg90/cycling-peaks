# Cycling Peaks — SPEC.md

## 1. Concept & Vision

Cycling Peaks es tu propio TrainingPeaks personal, corriendo 100% en local, alimentado por tus datos reales de Garmin Connect. No dependés de nadie: ni de Garmin, ni de TrainingPeaks, ni de la nube.

Yo (Hermes) leo tus datos y te doy training advice proactivo: "Charly, CTL 68, TSB +12, mañana tenés zona 4 sin drama." Vos arrancás el día sabiendo exactamente cómo estás.

**Filosofía:** Local-first. Tus datos son tuyos. El servidor corre en tu máquina, los reports llegan por Telegram.

---

## 2. Design Language

### Aesthetic
Dark athletic dashboard. Inspirado en apps de cycling/wearable (Wahoo, TrainerRoad). Números grandes, énfasis en métricas clave, color que dice "forma/fatiga" de un vistazo.

### Color Palette
```
Background:    #0D0D0D (near black)
Surface:       #1A1A1A (cards)
Surface-2:     #262626 (inputs, hover)
Primary:       #00D4AA (teal — forma buena)
Danger:        #FF4757 (rojo — sobreentrenamiento)
Warning:       #FFA502 (naranja — fatiga moderada)
Text-primary:  #FFFFFF
Text-secondary:#A0A0A0
Accent:        #5B8DEF (azul — elementos interactivos)
```

### Typography
- Headings: `Inter`, 700, tracking tight
- Metrics: `JetBrains Mono` (números grandes, monospace)
- Body: `Inter`, 400

### Spatial System
- Base unit: 4px
- Card padding: 24px
- Grid gap: 16px
- Border radius: 12px

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER (Charly)                         │
│  ┌──────────────┐     ┌──────────────┐                 │
│  │  React UI    │     │  Hermes      │                 │
│  │  Dashboard   │     │  (Telegram)  │                 │
│  └──────┬───────┘     └──────┬───────┘                 │
│         │                    │                          │
│         │ HTTP               │ reads /api/...           │
│         ▼                    │                          │
│  ┌─────────────────────────────────────────────┐        │
│  │          Go + Fiber API (:8080)             │        │
│  │  - REST endpoints                            │        │
│  │  - Goroutines for concurrent jobs          │        │
│  │  - SQLite read/write                        │        │
│  └──────────────┬──────────────────────────────┘        │
│                 │                                          │
│         ┌───────┴───────┐                                 │
│         ▼               ▼                                 │
│  ┌─────────────┐  ┌──────────────┐                       │
│  │  Python     │  │  SQLite DB   │                       │
│  │  Sync       │  │  cycling.db  │                       │
│  │  (garmin-   │◄─┤              │                       │
│  │  connect)   │  │              │                       │
│  └──────┬──────┘  └──────────────┘                       │
│         │ fetch workouts, TSS, NP, IF, HR                 │
│         ▼                                                 │
│  ┌─────────────────────────────────┐                     │
│  │   Garmin Connect API            │                     │
│  │   (community reverse-engineered) │                     │
│  └─────────────────────────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

### Sync Strategy
- Python daemon corre cada 1hr (configurable)
- Login con credenciales Garmin (oauth o email/password via garminconnect lib)
- Diff sync: solo trae workouts nuevos desde último sync
- Rate limiting respetuoso (1 req/sec)
- Error handling con retry exponencial (max 3 intentos)

### Data Freshness
- Workouts: synced hourly
- CTL/ATL/TSB: recalculados en cada sync
- Dashboard: polling cada 5 min o SSE/long-poll

---

## 4. Data Model

### SQLite Schema

```sql
-- Athletes (single user, but schema supports multi)
CREATE TABLE athletes (
    id TEXT PRIMARY KEY,        -- 'charly'
    name TEXT NOT NULL,
    ftp INTEGER,                -- Functional Threshold Power (w)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Workouts synced from Garmin
CREATE TABLE workouts (
    id TEXT PRIMARY KEY,                    -- Garmin activity ID
    athlete_id TEXT REFERENCES athletes(id),
    title TEXT,
    sport_type TEXT DEFAULT 'cycling',       -- always cycling for now
    start_time TIMESTAMP NOT NULL,
    duration_secs INTEGER,
    distance_meters REAL,
    elevation_gain_meters REAL,
    
    -- Power metrics
    normalized_power INTEGER,               -- NP (w)
    avg_power INTEGER,
    max_power INTEGER,
    intensity_factor REAL,                  -- IF (0.x)
    tss INTEGER,                            -- Training Stress Score
    ftp_at_time INTEGER,                     -- FTP used for calculation
    
    -- HR metrics
    avg_hr INTEGER,
    max_hr INTEGER,
    time_in_zones_json TEXT,                -- {"z1": secs, "z2": secs, ...}
    
    -- Raw data
    garmin_connect_url TEXT,
    raw_fit_file_path TEXT,
    
    -- Meta
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(athlete_id, id)
);

-- Daily Training Load (calculated)
CREATE TABLE daily_load (
    date DATE PRIMARY KEY,
    athlete_id TEXT REFERENCES athletes(id),
    ctl REAL,                               -- Chronic Training Load (30d avg TSS)
    atl REAL,                               -- Acute Training Load (7d avg TSS)
    tsb REAL,                               -- Training Stress Balance (CTL - ATL)
    tss INTEGER,                            -- TSS for the day
    training_status TEXT,                   -- 'fresh', 'optimal', 'peaking', 'overreaching', 'unproductive'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sync metadata
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    athlete_id TEXT REFERENCES athletes(id),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    workouts_fetched INTEGER DEFAULT 0,
    workouts_new INTEGER DEFAULT 0,
    status TEXT,                            -- 'running', 'success', 'failed'
    error TEXT
);
```

### Calculated Metrics

**TSS** (Training Stress Score):
```
TSS = (duration_secs × NP × IF) / (FTP × 3600) × 100
```

**CTL** (Chronic Training Load) — forma a largo plazo:
```
CTL = EMA_30d(TSS)  -- exponentially weighted moving average, 30-day lookback
```

**ATL** (Acute Training Load) — fatiga reciente:
```
ATL = EMA_7d(TSS)   -- 7-day lookback
```

**TSB** (Training Stress Balance):
```
TSB = CTL - ATL     -- positivo = descansado, negativo = fatigado
```

**Training Status**:
| TSB Range | Status |
|-----------|--------|
| > +25 | 🟢 Fresh (detraining) |
| +5 to +25 | 🔵 Optimal |
| -5 to +5 | 🟡 Borderline |
| -25 to -5 | 🟠 Overreaching |
| < -25 | 🔴 Unproductive |

---

## 5. API Endpoints

### Base URL: `http://localhost:8080/api/v1`

#### Athlete
```
GET  /athlete              → { id, name, ftp, created_at }
PUT  /athlete/ftp          → { ftp: 250 }  update FTP
```

#### Workouts
```
GET  /workouts                      → [workout, ...] (paginated, default 30)
GET  /workouts?from=2025-01-01      → filtered by date
GET  /workouts/:id                  → single workout detail
```

#### Training Load
```
GET  /load/today                    → { ctl, atl, tsb, tss, status }
GET  /load/history?days=90          → [{date, ctl, atl, tsb, tss, status}, ...]
GET  /load/trends                   → {weekly_change_ctl, monthly_change_ctl, ...}
```

#### Dashboard (aggregated)
```
GET  /dashboard/summary             → main numbers for dashboard
GET  /dashboard/week?offset=0       → last 7 days summary
GET  /dashboard/month               → current month stats
```

#### Sync
```
POST /sync/trigger                  → manually trigger Garmin sync
GET  /sync/status                   → { last_sync, status, workouts_count }
```

### Response Shapes

```json
// GET /load/today
{
  "date": "2026-07-02",
  "ctl": 68.4,
  "atl": 52.1,
  "tsb": 16.3,
  "tss_today": 85,
  "status": "optimal",
  "trend": "improving"
}

// GET /workouts (paginated)
{
  "data": [...],
  "pagination": { "page": 1, "per_page": 30, "total": 245 }
}

// GET /dashboard/summary
{
  "ctl": 68.4,
  "atl": 52.1,
  "tsb": 16.3,
  "status": "optimal",
  "this_week": { "tss": 420, "workouts": 5, "hours": 8.5 },
  "this_month": { "tss": 1650, "workouts": 18, "hours": 32.0 },
  "last_workout": { "title": "Intervalos Z4", "tss": 85, "date": "2026-07-01" }
}
```

---

## 6. Frontend (React + Vite)

### Pages

1. **Dashboard** (`/`) — El overview. Números grandes: CTL, ATL, TSB, status, último entreno.
2. **Calendar** (`/calendar`) — Calendario mensual con días coloreados por intensidad (TSS).
3. **Trends** (`/trends`) — Gráficos de CTL/ATL/TSB en el tiempo.
4. **Workouts** (`/workouts`) — Lista de entrenos con filtros y detalle inline.
5. **Settings** (`/settings`) — FTP, credenciales Garmin (ocultas), sync frequency.

### Component Inventory

| Component | States | Notes |
|-----------|--------|-------|
| `MetricCard` | default, loading, error | Número grande + label + trend arrow |
| `CTLDisplay` | fresh/optimal/borderline/overreaching/unproductive | Color-coded |
| `TSBGauge` | -30 to +30 | Visual gauge with zones |
| `WorkoutRow` | default, expanded | Click to expand detail |
| `CalendarDay` | rest, easy, moderate, hard, very_hard | Color intensity |
| `TrendChart` | loading, empty, data | Line chart CTL/ATL/TSB |
| `SyncStatus` | idle, syncing, error, success | Shows last sync time |

### Color coding (Dashboard)
- 🟢 Optimal / Fresh: `#00D4AA`
- 🔵 Resting: `#5B8DEF`
- 🟡 Borderline: `#FFA502`
- 🟠 Overreaching: `#FF6B35`
- 🔴 Unproductive: `#FF4757`

---

## 7. Python Sync Daemon

### Responsibilities
- Login to Garmin Connect (creds stored in env or config file)
- Fetch new workouts since last sync
- Parse response into normalized format
- Write to SQLite
- Recalculate daily_load (CTL/ATL/TSB) after each sync
- Log sync results

### garminconnect library usage
```python
from garminconnect import Garmin
import json

client = Garmin(email, password)
client.login()

# Fetch cycling workouts from last 30 days
workouts = client.get_activities_by_date(start, end)

for w in workouts:
    details = client.get_activity_details(w['activityId'])
    metrics = client.get_activity_metrics(w['activityId'])
    # Parse TSS, NP, IF, avg_power, etc.
    # Insert into SQLite
```

### Concurrency
- Sync runs as a goroutine triggered by Go scheduler
- Python script called via `exec` or subprocess
- Multiple workers (configurable, default 3 concurrent syncs to different endpoints)

---

## 8. Hermes Integration

### Reports (via Telegram, daily at 9AM or on-demand)

```
🌅 Buenos días Charly!

Forma: CTL 68.4 | Fatiga: ATL 52.1 | Balance: TSB +16.3
📊 Status: OPTIMAL — Perfecto para sesión dura

📅 Esta semana: 5 entrenos | 420 TSS | 8.5h
💪 Último: Intervalos Z4 ayer (85 TSS)

🔮 Mañana: Sugerencia = Z2 suave (recuperación activa)
   Viene de 2 días duros, tu TSB +16 dice que estás listo.
```

### On-demand queries
Charly can ask:
- "¿Cómo vengo?" → current CTL/ATL/TSB + status
- "¿Cuándo fue mi último entreno duro?" → last high-intensity workout
- "¿Estoy sobreentrenado?" → trend analysis + recommendation
- "¿Cuántas horas tengo esta semana?" → weekly summary

---

## 9. Project Structure

```
cycling-peaks/
├── SPEC.md
├── README.md
├── backend/
│   ├── go.mod
│   ├── go.sum
│   ├── main.go
│   ├── internal/
│   │   ├── api/
│   │   │   ├── routes.go
│   │   │   ├── handlers/
│   │   │   │   ├── athlete.go
│   │   │   │   ├── workouts.go
│   │   │   │   ├── load.go
│   │   │   │   └── sync.go
│   │   │   └── middleware/
│   │   │       └── cors.go
│   │   ├── db/
│   │   │   ├── db.go
│   │   │   ├── migrations/
│   │   │   └── queries.go
│   │   ├── models/
│   │   │   ├── workout.go
│   │   │   ├── athlete.go
│   │   │   └── load.go
│   │   └── sync/
│   │       └── runner.go          # calls Python sync script
│   └── Dockerfile
├── sync/
│   ├── requirements.txt            # pip install -r requirements.txt
│   ├── main.py                     # entrypoint
│   ├── garmin_client.py           # Garmin Connect wrapper
│   ├── parser.py                   # parse Garmin response → normalized
│   └── calculators.py              # TSS, CTL, ATL, TSB calculations
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Calendar.tsx
│   │   │   ├── Trends.tsx
│   │   │   ├── Workouts.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── CTLDisplay.tsx
│   │   │   ├── TSBGauge.tsx
│   │   │   ├── WorkoutRow.tsx
│   │   │   ├── CalendarGrid.tsx
│   │   │   ├── TrendChart.tsx
│   │   │   └── SyncStatus.tsx
│   │   └── styles/
│   │       └── globals.css
│   └── Dockerfile
└── docker-compose.yml              # runs backend + frontend + redis (future)
```

---

## 10. MVP Priorities

### Phase 1 — Core Loop (THIS WEEK)
- [ ] Go API skeleton con endpoints `/load/today` y `/workouts`
- [ ] SQLite schema + migrations
- [ ] Python sync script funcional (hardcode credentials temporarily)
- [ ] React dashboard showing CTL / ATL / TSB
- [ ] Manual trigger de sync desde dashboard
- [ ] Hermes report básico

### Phase 2 — Polish
- [ ] Credenciales Garmin en settings (no hardcode)
- [ ] Auto-sync cada 1hr
- [ ] Calendario con colores por intensidad
- [ ] Trends chart (CTL over time)
- [ ] Polishing de UI

### Phase 3 — Smart
- [ ] Training advice (qué hacer mañana basándose en TSB)
- [ ] Weekly/monthly summaries
- [ ] FTP tracking (detect ftp test automatically)
- [ ] Notify cuando CTL baja o TSB se vuelve muy negativo

---

## 11. Environment Variables

```bash
# Backend
DATABASE_URL=cycling.db
PORT=8080
SYNC_INTERVAL_MINUTES=60

# Python Sync
GARMIN_EMAIL=tu@email.com
GARMIN_PASSWORD=tu_password
ATHLETE_ID=charly
```

---

## 12. Running locally

```bash
# Backend
cd backend && go run main.go

# Frontend
cd frontend && npm install && npm run dev

# Sync (manual)
cd sync && python main.py

# Or with Docker
docker-compose up
```
