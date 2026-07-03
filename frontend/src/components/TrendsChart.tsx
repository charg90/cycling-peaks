import React, { useState } from 'react'

interface DailyLoad {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss: number
}

interface TrendsChartProps {
  data: DailyLoad[]
}

type Period = '3M' | '6M' | '12M'

function filterData(data: DailyLoad[], period: Period): DailyLoad[] {
  const now = new Date()
  const months = period === '3M' ? 3 : period === '6M' ? 6 : 12
  const cutoff = new Date(now)
  cutoff.setMonth(now.getMonth() - months)
  const cutoffStr = cutoff.toISOString().split('T')[0]
  return data.filter(d => d.date >= cutoffStr)
}

export default function TrendsChart({ data }: TrendsChartProps) {
  const [period, setPeriod] = useState<Period>('3M')

  const filtered = filterData(data, period)
  // Reverse to chronological order for drawing
  const sorted = [...filtered].sort((a, b) => a.date.localeCompare(b.date))

  if (sorted.length === 0) {
    return (
      <div className="card">
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '16px' }}>TRENDS — CTL / ATL / TSB</h2>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-2)' }}>
          No hay datos de carga para este período
        </div>
      </div>
    )
  }

  // Canvas-based chart
  const W = 800
  const H = 280
  const padding = { top: 20, right: 20, bottom: 40, left: 50 }
  const chartW = W - padding.left - padding.right
  const chartH = H - padding.top - padding.bottom

  const allValues = sorted.flatMap(d => [d.ctl, d.atl, d.tsb])
  const maxVal = Math.max(...allValues, 1)
  const minVal = Math.min(...allValues, -50)
  const range = maxVal - minVal

  const x = (i: number) => padding.left + (i / (sorted.length - 1)) * chartW
  const y = (v: number) => padding.top + chartH - ((v - minVal) / range) * chartH

  // Build SVG paths
  const ctlPath = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.ctl)}`).join(' ')
  const atlPath = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.atl)}`).join(' ')
  const tsbPath = sorted.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.tsb)}`).join(' ')

  // X-axis labels (month names)
  const labelCount = period === '3M' ? 3 : period === '6M' ? 6 : 12
  const labelStep = Math.max(1, Math.floor(sorted.length / labelCount))
  const xLabels = sorted
    .filter((_, i) => i % labelStep === 0 || i === sorted.length - 1)
    .map((d, _, arr) => {
      const idx = sorted.indexOf(d)
      return { x: x(idx), label: new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }
    })

  // Y-axis gridlines
  const gridStep = 20
  const yGridlines: number[] = []
  for (let v = Math.ceil(minVal / gridStep) * gridStep; v <= maxVal; v += gridStep) {
    yGridlines.push(v)
  }

  const today = new Date().toISOString().split('T')[0]
  const last = sorted[sorted.length - 1]
  const prevCtl = sorted.length > 30 ? sorted[sorted.length - 30].ctl : null

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>TRENDS — CTL / ATL / TSB</h2>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-2)', padding: '3px', borderRadius: '6px' }}>
          {(['3M','6M','12M'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: '4px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer',
              background: period === p ? 'var(--primary)' : 'transparent',
              color: period === p ? '#fff' : 'var(--text-2)', fontSize: '0.8rem',
            }}>{p}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid */}
        {yGridlines.map(v => (
          <g key={v}>
            <line
              x1={padding.left} y1={y(v)} x2={W - padding.right} y2={y(v)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="4,4"
            />
            <text x={padding.left - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)">
              {Math.round(v)}
            </text>
          </g>
        ))}

        {/* Zero line for TSB */}
        <line
          x1={padding.left} y1={y(0)} x2={W - padding.right} y2={y(0)}
          stroke="var(--text-3)" strokeWidth="1"
        />
        <text x={padding.left - 8} y={y(0) + 4} textAnchor="end" fontSize="10" fill="var(--text-3)">0</text>

        {/* Lines */}
        <path d={ctlPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        <path d={atlPath} fill="none" stroke="#f97316" strokeWidth="2" strokeLinejoin="round" />
        <path d={tsbPath} fill="none" stroke="#22c55e" strokeWidth="1.5" strokeDasharray="4,3" strokeLinejoin="round" />

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)">
            {l.label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '8px' }}>
        {[
          { color: '#3b82f6', label: 'CTL (Forma)', value: last.ctl },
          { color: '#f97316', label: 'ATL (Fatiga)', value: last.atl },
          { color: '#22c55e', label: 'TSB (Balance)', value: last.tsb },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '20px', height: '3px', background: l.color, borderRadius: '2px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{l.label}</span>
            <span style={{ fontSize: '0.8rem', fontFamily: 'JetBrains Mono', color: 'var(--text)' }}>
              {l.value.toFixed(1)}
            </span>
          </div>
        ))}
      </div>

      {/* Change indicator */}
      {prevCtl !== null && (
        <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          CTL hace 30 días: {prevCtl.toFixed(1)}
          {' → '}
          Hoy: {last.ctl.toFixed(1)}
          {' '}
          <span style={{ color: last.ctl > prevCtl ? 'var(--success)' : last.ctl < prevCtl ? 'var(--danger)' : 'var(--text-2)' }}>
            ({last.ctl > prevCtl ? '↑' : last.ctl < prevCtl ? '↓' : '→'} {(Math.abs(last.ctl - prevCtl)).toFixed(1)})
          </span>
        </div>
      )}
    </div>
  )
}
