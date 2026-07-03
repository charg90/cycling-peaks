import React from 'react'

interface ZoneData {
  z1: number; z2: number; z3: number; z4: number;
  z5: number; z6: number; z7: number; total: number;
}

interface WorkoutDetailProps {
  workout: {
    id: string
    title: string
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
  ftp: number
  onClose: () => void
}

const ZONE_NAMES: Record<string, string> = {
  z1: 'Z1 Recovery', z2: 'Z2 Endurance', z3: 'Z3 Tempo',
  z4: 'Z4 Threshold', z5: 'Z5 VO2max', z6: 'Z6 Anaerobic', z7: 'Z7 Neuromuscular',
}

const ZONE_COLORS: Record<string, string> = {
  z1: '#94a3b8', z2: '#3b82f6', z3: '#22c55e',
  z4: '#eab308', z5: '#f97316', z6: '#ef4444', z7: '#dc2626',
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-AR', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch { return iso }
}

function ZoneBar({ zone, seconds, total, ftp }: { zone: string; seconds: number; total: number; ftp: number }) {
  const pct = total > 0 ? (seconds / total) * 100 : 0
  const color = ZONE_COLORS[zone]
  const mins = Math.round(seconds / 60)
  const watts = zone === 'z1' ? `${Math.round(ftp * 0.4)}-${Math.round(ftp * 0.55)}` :
                 zone === 'z2' ? `${Math.round(ftp * 0.55)}-${Math.round(ftp * 0.75)}` :
                 zone === 'z3' ? `${Math.round(ftp * 0.75)}-${Math.round(ftp * 0.90)}` :
                 zone === 'z4' ? `${Math.round(ftp * 0.90)}-${Math.round(ftp * 1.05)}` :
                 zone === 'z5' ? `${Math.round(ftp * 1.05)}-${Math.round(ftp * 1.20)}` :
                 zone === 'z6' ? `${Math.round(ftp * 1.20)}-${Math.round(ftp * 1.50)}` :
                 `${Math.round(ftp * 1.50)}+`

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text)' }}>
          <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', background: color, marginRight: '6px' }} />
          {ZONE_NAMES[zone]}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
          {mins}m <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>({pct.toFixed(0)}%)</span>
          <span style={{ marginLeft: '8px', color: 'var(--text-3)', fontSize: '0.7rem', fontFamily: 'monospace' }}>{watts}W</span>
        </span>
      </div>
      <div style={{ height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

export default function WorkoutDetail({ workout, ftp, onClose }: WorkoutDetailProps) {
  let zones: ZoneData = { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0, z6: 0, z7: 0, total: 0 }
  try {
    if (workout.time_in_zones_json) {
      zones = JSON.parse(workout.time_in_zones_json)
    }
  } catch {}

  const zoneKeys = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: '16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--surface-1)', borderRadius: '16px',
        maxWidth: '560px', width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: '1px solid var(--border)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text)' }}>
                {workout.title}
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>
                {formatDate(workout.start_time)} · {formatDuration(workout.duration_secs)}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'var(--surface-2)', border: 'none', borderRadius: '8px',
                padding: '6px 10px', cursor: 'pointer', color: 'var(--text-2)', fontSize: '0.9rem',
              }}
            >✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', display: 'grid', gap: '20px' }}>
          {/* Key metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {[
              { label: 'NP', value: workout.normalized_power ? `${workout.normalized_power}W` : '—' },
              { label: 'Avg Power', value: workout.avg_power ? `${workout.avg_power}W` : '—' },
              { label: 'Max Power', value: workout.max_power ? `${workout.max_power}W` : '—' },
              { label: 'TSS', value: workout.tss > 0 ? `${workout.tss}` : '—' },
              { label: 'IF', value: workout.intensity_factor > 0 ? workout.intensity_factor.toFixed(2) : '—' },
              { label: 'Avg HR', value: workout.avg_hr > 0 ? `${workout.avg_hr}bpm` : '—' },
              { label: 'Dist', value: workout.distance_meters > 0 ? `${(workout.distance_meters/1000).toFixed(1)}km` : '—' },
              { label: 'Elev', value: workout.elevation_gain_meters > 0 ? `${Math.round(workout.elevation_gain_meters)}m` : '—' },
              { label: 'FTP', value: ftp > 0 ? `${ftp}W` : '—' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center', background: 'var(--surface-2)', borderRadius: '8px', padding: '10px 6px' }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--primary)' }}>{m.value}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '2px' }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Power zones */}
          {zones.total > 0 && (
            <div>
              <h3 style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '12px', fontWeight: 600 }}>
                Power Zones
              </h3>
              {zoneKeys.map(z => (
                <ZoneBar key={z} zone={z} seconds={zones[z]} total={zones.total} ftp={ftp} />
              ))}
            </div>
          )}

          {zones.total === 0 && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-2)', fontSize: '0.875rem' }}>
              No hay datos de potencia para este entreno
            </div>
          )}

          {/* Garmin link */}
          {workout.garmin_connect_url && (
            <a
              href={workout.garmin_connect_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'block', textAlign: 'center', padding: '10px',
                background: 'var(--surface-2)', color: 'var(--text-2)',
                borderRadius: '8px', fontSize: '0.875rem', textDecoration: 'none',
              }}
            >
              Ver en Garmin Connect →
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
