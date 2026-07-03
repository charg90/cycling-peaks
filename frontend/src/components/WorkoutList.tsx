import React, { useState } from 'react'

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

interface WorkoutListProps {
  workouts: Workout[]
  loading?: boolean
}

type FilterPeriod = 'all' | '7d' | '30d' | '90d'

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function WorkoutList({ workouts, loading }: WorkoutListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterPeriod>('all')
  const [tssMin, setTssMin] = useState<number>(0)

  if (loading) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)' }}>
        Cargando workouts...
      </div>
    )
  }

  if (!workouts || workouts.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)' }}>
        No hay workouts registrados
      </div>
    )
  }

  // Apply filters
  const now = new Date()
  const cutoff: Record<FilterPeriod, Date | null> = {
    all: null,
    '7d': new Date(now.getTime() - 7 * 86400000),
    '30d': new Date(now.getTime() - 30 * 86400000),
    '90d': new Date(now.getTime() - 90 * 86400000),
  }
  const dateCutoff = cutoff[filter]

  const filtered = workouts.filter(w => {
    if (dateCutoff && new Date(w.start_time) < dateCutoff) return false
    if (w.tss < tssMin) return false
    return true
  })

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', margin: 0 }}>ENTRENOS ({filtered.length})</h2>

        {/* Period filter */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {(['all', '7d', '30d', '90d'] as FilterPeriod[]).map(p => (
            <button key={p} onClick={() => setFilter(p)} style={{
              padding: '4px 10px', fontSize: '0.75rem', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
              background: filter === p ? 'var(--primary)' : 'var(--surface-2)',
              color: filter === p ? '#fff' : 'var(--text-2)',
            }}>{p === 'all' ? 'Todos' : p}</button>
          ))}
        </div>

        {/* TSS filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>TSS ≥</span>
          <input
            type="number"
            value={tssMin}
            onChange={e => setTssMin(Number(e.target.value))}
            min={0} max={500}
            style={{
              width: '70px', padding: '4px 8px', background: 'var(--surface-2)',
              border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--text)', fontSize: '0.8rem', fontFamily: 'monospace',
            }}
          />
        </div>
      </div>
      {filtered.map((w) => {
          const isOpen = expanded === w.id
          return (
            <div key={w.id} style={{ borderBottom: '1px solid var(--surface-2)', paddingBottom: '8px', marginBottom: '8px' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : w.id)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto auto',
                  gap: '12px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{w.title}</div>
                  <div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>
                    {formatDate(w.start_time)} · {formatDuration(w.duration_secs)} · {(w.distance_meters / 1000).toFixed(1)} km
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: '0.875rem', color: w.tss > 0 ? 'var(--primary)' : 'var(--text-2)' }}>
                    {w.tss > 0 ? `${w.tss} TSS` : '—'}
                  </div>
                  {w.avg_power > 0 && (
                    <div style={{ color: 'var(--text-2)', fontSize: '0.75rem' }}>{w.avg_power}W avg</div>
                  )}
                </div>
                <div style={{ color: 'var(--text-2)', fontSize: '0.75rem', padding: '4px 8px', background: 'var(--surface-2)', borderRadius: '4px' }}>
                  {isOpen ? '▲' : '▼'}
                </div>
              </div>

              {isOpen && (
                <div style={{ marginTop: '12px', display: 'grid', gap: '12px', padding: '12px', background: 'var(--surface-1)', borderRadius: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    <div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', marginBottom: '2px' }}>POTENCIA</div>
                      <div style={{ fontWeight: 600 }}>{w.avg_power > 0 ? `${w.avg_power}W` : '—'}</div>
                      {w.normalized_power > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>NP {w.normalized_power}W</div>}
                      {w.max_power > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>MAX {w.max_power}W</div>}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', marginBottom: '2px' }}>FRECUENCIA CARDÍACA</div>
                      <div style={{ fontWeight: 600 }}>{w.avg_hr > 0 ? `${w.avg_hr} bpm` : '—'}</div>
                      {w.max_hr > 0 && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>MAX {w.max_hr} bpm</div>}
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', marginBottom: '2px' }}>INTENSIDAD</div>
                      <div style={{ fontWeight: 600 }}>{w.intensity_factor > 0 ? `${(w.intensity_factor * 100).toFixed(0)}% IF` : '—'}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', marginBottom: '2px' }}>ELEVACIÓN</div>
                      <div style={{ fontWeight: 600 }}>{w.elevation_gain_meters > 0 ? `${w.elevation_gain_meters}m` : '—'}</div>
                    </div>
                  </div>

                  {/* Power zones mini bars */}
                  {(() => {
                    let zones: any = null
                    try { if (w.time_in_zones_json) zones = JSON.parse(w.time_in_zones_json) } catch {}
                    if (!zones || zones.total === 0) return null
                    const zcolors: Record<string, string> = { z1:'#94a3b8', z2:'#3b82f6', z3:'#22c55e', z4:'#eab308', z5:'#f97316', z6:'#ef4444', z7:'#dc2626' }
                    const znames: Record<string, string> = { z1:'Z1', z2:'Z2', z3:'Z3', z4:'Z4', z5:'Z5', z6:'Z6', z7:'Z7' }
                    return (
                      <div>
                        <div style={{ color: 'var(--text-2)', fontSize: '0.7rem', marginBottom: '6px' }}>ZONAS DE POTENCIA</div>
                        <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                          {(['z1','z2','z3','z4','z5','z6','z7'] as const).map(z => {
                            const pct = zones.total > 0 ? (zones[z] / zones.total) * 100 : 0
                            if (pct < 1) return null
                            return (
                              <div key={z} title={`${znames[z]}: ${Math.round(zones[z]/60)}m (${pct.toFixed(0)}%)`}
                                style={{ width: `${pct}%`, background: zcolors[z], borderRadius: '4px', minWidth: '2px' }} />
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                          {(['z1','z2','z3','z4','z5','z6','z7'] as const).map(z => {
                            const pct = zones.total > 0 ? (zones[z] / zones.total) * 100 : 0
                            if (pct < 1) return null
                            return (
                              <div key={z} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: zcolors[z] }} />
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{znames[z]} {pct.toFixed(0)}%</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}

                  {w.garmin_connect_url && (
                    <div>
                      <a href={w.garmin_connect_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none' }}>
                        Ver en Garmin Connect →
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
