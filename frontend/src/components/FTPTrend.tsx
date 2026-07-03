import React, { useState } from 'react'
import type { FTPHistoryItem } from '../types/load'

const METHOD_LABELS: Record<string, string> = {
  'model+tss': 'Modelo CP + TSS',
  'power_duration_model': 'Modelo CP',
  'tss_formula': 'Fórmula TSS',
  'avg_power_fallback': 'Pot. promedio',
}

export default function FTPTrend() {
  const [data, setData] = useState<FTPHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  React.useEffect(() => {
    fetch('/api/v1/athlete/ftp-history?limit=30')
      .then(r => r.json())
      .then(json => {
        const arr: FTPHistoryItem[] = (json.data || []).reverse()
        setData(arr)
        setLoading(false)
      })
      .catch(() => { setError('Error'); setLoading(false) })
  }, [])

  if (loading) return <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-2)' }}>Cargando FTP...</div>
  if (error) return null
  if (data.length === 0) return null

  const withPower = data.filter(d => d.avg_p > 0)
  if (withPower.length === 0) return null

  const W = 700
  const H = 200
  const padding = { top: 15, right: 15, bottom: 35, left: 50 }
  const chartW = W - padding.left - padding.right
  const chartH = H - padding.top - padding.bottom

  const ftps = withPower.map(d => d.ftp)
  const minP = Math.min(...ftps) * 0.92
  const maxP = Math.max(...ftps) * 1.08
  const range = maxP - minP || 1

  const x = (i: number) => padding.left + (i / (withPower.length - 1 || 1)) * chartW
  const y = (v: number) => padding.top + chartH - ((v - minP) / range) * chartH

  const pathD = withPower.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.ftp)}`).join(' ')

  const gridStep = 25
  const gridLines: number[] = []
  for (let v = Math.ceil(minP / gridStep) * gridStep; v <= maxP; v += gridStep) {
    gridLines.push(v)
  }

  const latest = withPower[withPower.length - 1]
  const latestMethod = METHOD_LABELS[latest?.method] || latest?.method || ''
  const peakFTP = Math.max(...ftps)

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h2 style={{ fontSize: '1rem', color: 'var(--text-2)' }}>FTP ESTIMADO — MODELO CP</h2>
        <div style={{ display: 'flex', gap: '20px', fontSize: '0.8rem' }}>
          <span>Actual: <strong style={{ fontFamily: 'JetBrains Mono', color: 'var(--primary)' }}>{latest?.ftp}W</strong></span>
          <span>Método: <span style={{ color: 'var(--text-2)' }}>{latestMethod}</span></span>
          <span>Pico: <strong style={{ fontFamily: 'JetBrains Mono' }}>{peakFTP}W</strong></span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {gridLines.map(v => (
          <g key={v}>
            <line x1={padding.left} y1={y(v)} x2={W - padding.right} y2={y(v)}
              stroke="var(--border)" strokeWidth="1" strokeDasharray="3,3" />
            <text x={padding.left - 6} y={y(v) + 4} textAnchor="end" fontSize="9" fill="var(--text-3)">{Math.round(v)}</text>
          </g>
        ))}
        <path d={pathD} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
        {withPower.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.ftp)} r="3" fill="var(--primary)" />
        ))}
        {(() => {
          const step = Math.max(1, Math.floor(withPower.length / 6))
          return withPower
            .filter((_, i) => i % step === 0 || i === withPower.length - 1)
            .map((d) => {
              const i = withPower.indexOf(d)
              const label = new Date(d.date + 'T12:00:00').toLocaleDateString('es-ES', { month: 'short', year: '2-digit' })
              return <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="var(--text-3)">{label}</text>
            })
        })()}
      </svg>

      {/* Method explanation */}
      <div style={{ marginTop: '8px', display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.7rem', color: 'var(--text-3)', justifyContent: 'center' }}>
        {[
          ['model+tss', 'Modelo CP (70%) + fórmula TSS (30%)'],
          ['power_duration_model', 'Modelo CP: P(t) = CP + W\'/t'],
          ['tss_formula', 'FTP = NP / √(TSS / dur_h × 100)'],
          ['avg_power_fallback', 'Potencia promedio directa'],
        ].map(([key, desc]) => (
          <span key={key} style={{ opacity: key === latest?.method ? 1 : 0.4 }}>
            <strong>{METHOD_LABELS[key]}:</strong> {desc}
          </span>
        ))}
      </div>
    </div>
  )
}
