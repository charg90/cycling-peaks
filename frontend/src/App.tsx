import React, { useEffect, useState } from 'react'
import { api } from './api/client'
import MetricCard from './components/MetricCard'
import LoadChart from './components/LoadChart'
import WorkoutList from './components/WorkoutList'
import Calendar from './components/Calendar'
import TrendsChart from './components/TrendsChart'
import ZoneBalance from './components/ZoneBalance'
import FTPTrend from './components/FTPTrend'
import Settings from './components/Settings'
import './styles/globals.css'

interface Athlete {
  id: string
  name: string
  ftp: number
}

interface Summary {
  ctl: number
  atl: number
  tsb: number
  status: string
  this_week: { tss: number; workouts: number; hours: number }
  this_month: { tss: number; workouts: number; hours: number }
  last_workout?: { title: string; tss: number; date: string }
}

interface Workout {
  id: string
  title: string
  sport_type: string
  start_time: string
  duration_secs: number
  distance_meters: number
  elevation_gain_meters: number
  normalized_power: number
  avg_power: number
  max_power: number
  intensity_factor: number
  tss: number
  avg_hr: number
  max_hr: number
  time_in_zones_json: string
  garmin_connect_url: string
}

interface DailyLoad {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss: number
  training_status: string
}

type Tab = 'dashboard' | 'calendar' | 'settings'

function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [athlete, setAthlete] = useState<Athlete | null>(null)
  const [data, setData] = useState<Summary | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [loadHistory, setLoadHistory] = useState<DailyLoad[]>([])
  const [loading, setLoading] = useState(true)

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    if (tab === 'dashboard' || tab === 'calendar') {
      Promise.all([
        api.getSummary(),
        api.getWorkouts(1),
        api.getLoadHistory(365),
      ]).then(([summaryData, workoutsData, loadData]) => {
        setData(summaryData)
        setWorkouts(workoutsData.data || [])
        setLoadHistory(loadData.data || [])
        setLoading(false)
      })
    } else if (tab === 'settings' && !athlete) {
      api.getAthlete().then(setAthlete).catch(() => setAthlete({ id: 'charly', name: 'Charly', ftp: 220 }))
    }
  }, [tab])

  const handleFTPUpdated = (ftp: number) => {
    setAthlete(prev => prev ? { ...prev, ftp } : null)
  }

  if (loading) return <div className="app"><div className="loading">Loading...</div></div>

  const statusColors: Record<string, string> = {
    optimal: 'status-optimal',
    fresh: 'status-fresh',
    borderline: 'status-borderline',
    overreaching: 'status-overreaching',
    unproductive: 'status-unproductive',
  }

  const tsbColor = data!.tsb > 5 ? 'var(--primary)' : data!.tsb < -5 ? 'var(--danger)' : 'var(--warning)'

  return (
    <div className="app" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header + tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', color: 'var(--text-2)' }}>
          Cycling Peaks — Charly
        </h1>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '4px', borderRadius: '8px', alignItems: 'center' }}>
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            style={{
              padding: '8px 12px',
              background: 'transparent',
              color: 'var(--text-2)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
          onClick={() => setTab('dashboard')}
          style={{
            padding: '8px 20px',
            background: tab === 'dashboard' ? 'var(--primary)' : 'transparent',
            color: tab === 'dashboard' ? '#fff' : 'var(--text-2)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >Dashboard</button>
        <button
          onClick={() => setTab('calendar')}
          style={{
            padding: '8px 20px',
            background: tab === 'calendar' ? 'var(--primary)' : 'transparent',
            color: tab === 'calendar' ? '#fff' : 'var(--text-2)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >Calendar</button>
        <button
          onClick={() => setTab('settings')}
          style={{
            padding: '8px 20px',
            background: tab === 'settings' ? 'var(--primary)' : 'transparent',
            color: tab === 'settings' ? '#fff' : 'var(--text-2)',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.875rem',
          }}
        >Settings</button>
        </div>
      </div>

      {tab === 'dashboard' ? (
      <>
      {/* Métricas principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <MetricCard label="CTL (Forma)" value={data!.ctl.toFixed(1)} sublabel="30-day training load" />
        <MetricCard label="ATL (Fatiga)" value={data!.atl.toFixed(1)} sublabel="7-day stress" />
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px' }}>TSB (Balance)</div>
          <div className="metric-value" style={{ color: tsbColor }}>
            {data!.tsb > 0 ? '+' : ''}{data!.tsb.toFixed(1)}
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginTop: '8px' }}>
            {data!.tsb > 0 ? 'Descansado' : data!.tsb < 0 ? 'Fatigado' : 'Neutro'}
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px' }}>Status</div>
          <div className={`metric-value ${statusColors[data!.status] || ''}`} style={{ fontSize: '1.5rem' }}>
            {data!.status.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Stats semanales y mensuales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        <div className="card">
          <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '16px' }}>ESTA SEMANA</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_week.tss}</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>TSS</div></div>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_week.workouts}</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Entrenos</div></div>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_week.hours.toFixed(1)}h</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Horas</div></div>
          </div>
        </div>
        <div className="card">
          <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '16px' }}>ESTE MES</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_month.tss}</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>TSS</div></div>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_month.workouts}</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Entrenos</div></div>
            <div><div className="metric-value" style={{ fontSize: '1.5rem' }}>{data!.this_month.hours.toFixed(1)}h</div><div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>Horas</div></div>
          </div>
        </div>
      </div>

      {/* Último entreno */}
      {data!.last_workout && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '12px' }}>ÚLTIMO ENTRENO</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '600' }}>{data!.last_workout.title}</div>
              <div style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>{data!.last_workout.date}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'JetBrains Mono', fontSize: '1.25rem' }}>{data!.last_workout.tss} TSS</div>
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de carga */}
      <div style={{ marginBottom: '24px' }}>
        <LoadChart data={loadHistory} />
      </div>

      {/* Trends chart */}
      <div style={{ marginBottom: '24px' }}>
        <TrendsChart data={loadHistory} />
      </div>

      {/* FTP Trend */}
      <div style={{ marginBottom: '24px' }}>
        <FTPTrend />
      </div>

      {/* Zone Balance */}
      <div style={{ marginBottom: '24px' }}>
        <ZoneBalance ftp={athlete?.ftp || 220} />
      </div>

      {/* Overtraining alert */}
      {(() => {
        const last3 = loadHistory.slice(0, 3)
        const overtraining = last3.length >= 3 && last3.every(d => d.tsb < -30)
        if (!overtraining) return null
        return (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '24px',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--danger)', fontSize: '0.9rem' }}>
                Overreaching detectado
              </div>
              <div style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>
                TSB &lt; -30 por 3+ días consecutivos. Considerá descansar.
              </div>
            </div>
          </div>
        )
      })()}

      {/* Lista de entrenos */}
      <div style={{ marginBottom: '24px' }}>
        <WorkoutList workouts={workouts} />
      </div>

      {/* Botón de sync */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => api.triggerSync()}
          style={{ padding: '12px 24px', background: 'var(--surface-2)', color: 'var(--text)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
        >
          Sync Garmin
        </button>
      </div>
      </>
      ) : tab === 'calendar' ? (
        <Calendar workouts={workouts} />
      ) : (
        athlete ? <Settings athlete={athlete} onFTPUpdated={handleFTPUpdated} /> : null
      )}
    </div>
  )
}

export default App
