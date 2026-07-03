import React, { useState } from 'react'

interface ZoneBalanceProps {
  ftp: number
}

const ZONE_NAMES: Record<string, string> = {
  z1: 'Z1 Recovery', z2: 'Z2 Endurance', z3: 'Z3 Tempo',
  z4: 'Z4 Threshold', z5: 'Z5 VO2max', z6: 'Z6 Anaerobic', z7: 'Z7 Neuro',
}
const ZONE_COLORS: Record<string, string> = {
  z1: '#94a3b8', z2: '#3b82f6', z3: '#22c55e',
  z4: '#eab308', z5: '#f97316', z6: '#ef4444', z7: '#dc2626',
}
const ZONE_WATTS: Record<string, string> = {
  z1: '<55%', z2: '55-75%', z3: '75-90%', z4: '90-105%', z5: '105-120%', z6: '120-150%', z7: '>150%',
}

interface ZoneData {
  seconds: number
  minutes: number
  pct: number
}

export default function ZoneBalance({ ftp }: ZoneBalanceProps) {
  const [days, setDays] = useState<number>(90)
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/v1/zones/balance?days=${days}`)
      const json = await res.json()
      setData(json)
    } catch (e: any) {
      setError('Error cargando zonas')
    } finally {
      setLoading(false)
    }
  }

  const handleDaysChange = (d: number) => {
    setDays(d)
    setLoading(true)
    fetch(`/api/v1/zones/balance?days=${d}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError('Error'))
      .finally(() => setLoading(false))
  }

  // Auto-fetch on mount
  React.useEffect(() => { fetchData() }, [])

  const totalMins = data ? (data.total_secs || 0) / 60 : 0

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>BALANCE DE ZONAS</h2>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[30, 60, 90].map(d => (
            <button key={d} onClick={() => handleDaysChange(d)} style={{
              padding: '4px 10px', fontSize: '0.75rem', border: 'none',
              borderRadius: '6px', cursor: 'pointer',
              background: days === d ? 'var(--primary)' : 'var(--surface-2)',
              color: days === d ? '#fff' : 'var(--text-2)',
            }}>{d}d</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-2)' }}>Cargando...</div>}
      {error && <div style={{ textAlign: 'center', padding: '20px', color: 'var(--danger)' }}>{error}</div>}

      {data && totalMins === 0 && (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-2)' }}>
          No hay datos de potencia para este período
        </div>
      )}

      {data && totalMins > 0 && (
        <>
          {/* Stacked bar */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{
              height: '24px', borderRadius: '6px', overflow: 'hidden',
              display: 'flex', gap: '2px',
            }}>
              {(['z1','z2','z3','z4','z5','z6','z7'] as const).map(z => {
                const zone = data.zones?.[z] as ZoneData
                const pct = zone?.pct || 0
                if (pct < 1) return null
                return (
                  <div key={z} title={`${ZONE_NAMES[z]}: ${zone.minutes.toFixed(0)}m (${pct.toFixed(1)}%)`}
                    style={{ width: `${pct}%`, background: ZONE_COLORS[z], minWidth: '2px' }} />
                )
              })}
            </div>
          </div>

          {/* Zone breakdown */}
          <div style={{ display: 'grid', gap: '6px' }}>
            {(['z1','z2','z3','z4','z5','z6','z7'] as const).map(z => {
              const zone = data.zones?.[z] as ZoneData
              const pct = zone?.pct || 0
              if (pct === 0) return null
              return (
                <div key={z} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: ZONE_COLORS[z], flexShrink: 0 }} />
                  <div style={{ flex: '0 0 100px', fontSize: '0.8rem', color: 'var(--text)' }}>{ZONE_NAMES[z]}</div>
                  <div style={{ flex: '0 0 60px', fontSize: '0.8rem', color: 'var(--text-3)', textAlign: 'right' }}>{ZONE_WATTS[z]}</div>
                  <div style={{ flex: 1, height: '6px', background: 'var(--surface-2)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: ZONE_COLORS[z], borderRadius: '3px' }} />
                  </div>
                  <div style={{ flex: '0 0 80px', fontSize: '0.8rem', color: 'var(--text-2)', textAlign: 'right' }}>
                    {zone.minutes.toFixed(0)}m <span style={{ color: 'var(--text-3)', fontSize: '0.7rem' }}>({pct.toFixed(0)}%)</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ marginTop: '12px', fontSize: '0.75rem', color: 'var(--text-3)', textAlign: 'center' }}>
            Total: {totalMins.toFixed(0)} min de datos de potencia | FTP: {ftp}W
          </div>
        </>
      )}
    </div>
  )
}
