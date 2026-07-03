import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

interface DailyLoad {
  date: string
  ctl: number
  atl: number
  tsb: number
  tss: number
  training_status: string
}

interface LoadChartProps {
  data: DailyLoad[]
}

export default function LoadChart({ data }: LoadChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-2)' }}>
        No hay datos de carga todavía
      </div>
    )
  }

  const chartData = [...data].reverse().slice(-30)

  return (
    <div className="card" style={{ padding: '24px' }}>
      <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '16px' }}>CARGA DE ENTRENAMIENTO (30 DÍAS)</h2>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-2)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--text-2)' }}
            tickFormatter={(v: string) => {
              const d = new Date(v)
              return `${d.getDate()}/${d.getMonth() + 1}`
            }}
          />
          <YAxis tick={{ fontSize: 10, fill: 'var(--text-2)' }} />
          <Tooltip
            contentStyle={{
              background: 'var(--surface-1)',
              border: '1px solid var(--surface-2)',
              borderRadius: '8px',
              fontSize: '0.875rem',
            }}
            labelFormatter={(v: string) => new Date(v).toLocaleDateString('es-ES')}
          />
          <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
          <Line type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={2} name="CTL (Forma)" dot={false} />
          <Line type="monotone" dataKey="atl" stroke="#ef4444" strokeWidth={2} name="ATL (Fatiga)" dot={false} />
          <Line type="monotone" dataKey="tsb" stroke="#22c55e" strokeWidth={2} name="TSB (Balance)" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
