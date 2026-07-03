import { useState } from 'react'
import { getMonthDays } from '../utils/calendar'
import type { Workout } from '../types/load'

interface CalendarProps {
  workouts: Workout[]
}

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS_ES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

export default function Calendar({ workouts }: CalendarProps) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { daysInMonth, startWeekday } = getMonthDays(year, month)

  // Build workout map by day
  const workoutMap: Record<number, Workout[]> = {}
  for (const w of workouts) {
    const d = new Date(w.start_time)
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate()
      if (!workoutMap[day]) workoutMap[day] = []
      workoutMap[day].push(w)
    }
  }

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0) }
    else setMonth(month + 1)
  }
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  // Total TSS this month
  const monthTSS = Object.values(workoutMap).flat().reduce((s, w) => s + w.tss, 0)
  const monthCount = Object.values(workoutMap).flat().length

  // Build calendar grid (Mon first)
  const cells: (number | null)[] = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const isToday = (day: number | null): boolean => {
    if (day === null) return false
    return day === now.getDate() && year === now.getFullYear() && month === now.getMonth()
  }

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={prevMonth} style={{
            padding: '6px 12px', background: 'var(--surface-2)', border: 'none',
            borderRadius: '6px', cursor: 'pointer', color: 'var(--text)',
          }}>←</button>
          <span style={{ fontWeight: 600, fontSize: '1rem', minWidth: '180px', textAlign: 'center' }}>
            {MONTHS_ES[month]} {year}
          </span>
          <button onClick={nextMonth} style={{
            padding: '6px 12px', background: 'var(--surface-2)', border: 'none',
            borderRadius: '6px', cursor: 'pointer', color: 'var(--text)',
          }}>→</button>
        </div>
        <button onClick={goToday} style={{
          padding: '6px 12px', background: 'var(--surface-2)', border: 'none',
          borderRadius: '6px', cursor: 'pointer', color: 'var(--text-2)', fontSize: '0.8rem',
        }}>Hoy</button>
      </div>

      {/* Month summary */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-2)' }}>
        <span>📅 {monthCount} entrenos</span>
        <span>⚡ {monthTSS} TSS</span>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '4px' }}>
        {DAYS_ES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-3)', padding: '4px 0' }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((day, idx) => {
          const dayWorkouts = (day && workoutMap[day]) || []
          const totalTSS = dayWorkouts.reduce((s, w) => s + w.tss, 0)
          const hasWorkout = dayWorkouts.length > 0
          return (
            <div key={idx} style={{
              aspectRatio: '1',
              borderRadius: '8px',
              border: isToday(day) ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: dayWorkouts.length > 0
                ? `rgba(37,99,235,${Math.min(0.1 + (totalTSS / 200), 0.5)})`
                : 'transparent',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              minHeight: '48px',
              cursor: hasWorkout ? 'default' : 'default',
              position: 'relative',
            }}>
              {day !== null && (
                <>
                  <span style={{
                    fontSize: '0.8rem',
                    color: isToday(day) ? 'var(--primary)' : 'var(--text)',
                    fontWeight: isToday(day) ? 700 : 400,
                  }}>{day}</span>
                  {hasWorkout && (
                    <div style={{ display: 'flex', gap: '2px', marginTop: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      {dayWorkouts.slice(0, 3).map((w, wi) => (
                        <div key={wi} title={`${w.title} - ${w.tss} TSS`} style={{
                          width: '6px', height: '6px', borderRadius: '50%',
                          background: w.tss > 0 ? 'var(--primary)' : 'var(--text-3)',
                        }} />
                      ))}
                      {dayWorkouts.length > 3 && <span style={{ fontSize: '0.6rem', color: 'var(--text-3)' }}>+{dayWorkouts.length - 3}</span>}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center', justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(37,99,235,0.3)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>&lt;50 TSS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(37,99,235,0.6)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>50-100 TSS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: 'rgba(37,99,235,0.9)' }} />
          <span style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>&gt;100 TSS</span>
        </div>
      </div>
    </div>
  )
}
