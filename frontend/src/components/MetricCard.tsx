interface Props {
  label: string
  value: string
  sublabel?: string
}

function MetricCard({ label, value, sublabel }: Props) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px' }}>{label}</div>
      <div className="metric-value">{value}</div>
      {sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '4px' }}>{sublabel}</div>}
    </div>
  )
}

export default MetricCard
