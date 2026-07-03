import React, { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Athlete {
  id: string
  name: string
  ftp: number
}

interface SettingsProps {
  athlete: Athlete
  onFTPUpdated: (ftp: number) => void
}

export default function Settings({ athlete, onFTPUpdated }: SettingsProps) {
  const [ftp, setFtp] = useState(athlete.ftp)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.updateFTP(ftp)
      onFTPUpdated(ftp)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      alert('Error guardando FTP')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = () => {
    // Open Garmin Connect
    window.open('https://connect.garmin.com/', '_blank')
  }

  return (
    <div className="card">
      <h2 style={{ fontSize: '1rem', color: 'var(--text-2)', marginBottom: '24px' }}>
        Configuración
      </h2>

      <div style={{ display: 'grid', gap: '24px' }}>
        {/* FTP Setting */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px' }}>
            FTP (Functional Threshold Power) — vatios
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="number"
              value={ftp}
              onChange={e => setFtp(Number(e.target.value))}
              min={100}
              max={500}
              style={{
                width: '120px',
                padding: '10px 14px',
                background: 'var(--surface-2)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '1rem',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            />
            <span style={{ color: 'var(--text-2)', fontSize: '0.875rem' }}>vatios</span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-2)' }}>
            Usado para calcular IF y TSS: IF = NP / FTP, TSS = dur_h × IF² × 100
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={saving || ftp === athlete.ftp}
            style={{
              padding: '10px 24px',
              background: saving ? 'var(--surface-2)' : 'var(--primary)',
              color: saving ? 'var(--text-2)' : '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: saving || ftp === athlete.ftp ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              opacity: ftp === athlete.ftp ? 0.5 : 1,
            }}
          >
            {saving ? 'Guardando...' : 'Guardar FTP'}
          </button>
          {saved && (
            <span style={{ color: 'var(--success)', fontSize: '0.875rem' }}>
              ✓ Guardado
            </span>
          )}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

        {/* Garmin Connect */}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px' }}>
            Fuente de datos
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: '#0070cc', display: 'inline-block'
            }} />
            <span style={{ fontSize: '0.875rem' }}>Garmin Connect</span>
          </div>
          <button
            onClick={handleTest}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Abrir Garmin Connect →
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

        {/* Athlete info */}
        <div>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-2)', marginBottom: '8px', display: 'block' }}>
            Atleta
          </label>
          <div style={{ fontSize: '0.875rem', color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
            {athlete.name} ({athlete.id})
          </div>
        </div>
      </div>
    </div>
  )
}
