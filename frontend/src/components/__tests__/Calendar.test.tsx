import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Calendar from '../Calendar'
import type { Workout } from '../../types/load'

const makeWorkout = (start_time: string, tss = 80): Workout => ({
  id: `w-${start_time}`,
  title: 'Test ride',
  sport_type: 'cycling',
  start_time,
  duration_secs: 3600,
  distance_meters: 30000,
  elevation_gain_meters: 200,
  normalized_power: 200,
  avg_power: 180,
  max_power: 350,
  intensity_factor: 0.85,
  tss,
  avg_hr: 145,
  max_hr: 175,
  time_in_zones_json: '',
  garmin_connect_url: '',
})

describe('Calendar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows current month and year', () => {
    render(<Calendar workouts={[]} />)
    expect(screen.getByText(/Junio 2025/i)).toBeInTheDocument()
  })

  it('renders day headers in Spanish', () => {
    render(<Calendar workouts={[]} />)
    expect(screen.getByText('Lun')).toBeInTheDocument()
    expect(screen.getByText('Mar')).toBeInTheDocument()
    expect(screen.getByText('Dom')).toBeInTheDocument()
  })

  it('navigates to previous month', () => {
    render(<Calendar workouts={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByText(/Mayo 2025/i)).toBeInTheDocument()
  })

  it('navigates to next month', () => {
    render(<Calendar workouts={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '→' }))
    expect(screen.getByText(/Julio 2025/i)).toBeInTheDocument()
  })

  it('wraps year when going back from January', () => {
    render(<Calendar workouts={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByText(/Enero 2025/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '←' }))
    expect(screen.getByText(/Diciembre 2024/i)).toBeInTheDocument()
  })

  it('wraps year when going forward from December', () => {
    render(<Calendar workouts={[]} />)
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: '→' }))
    }
    expect(screen.getByText(/Diciembre 2025/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '→' }))
    expect(screen.getByText(/Enero 2026/i)).toBeInTheDocument()
  })

  it('returns to current month when "Hoy" is clicked', () => {
    render(<Calendar workouts={[]} />)
    fireEvent.click(screen.getByRole('button', { name: '→' }))
    expect(screen.getByText(/Julio 2025/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /hoy/i }))
    expect(screen.getByText(/Junio 2025/i)).toBeInTheDocument()
  })

  it('displays workout counts and total TSS for the month', () => {
    const workouts = [
      makeWorkout('2025-06-03T10:00:00Z', 100),
      makeWorkout('2025-06-10T10:00:00Z', 80),
    ]
    render(<Calendar workouts={workouts} />)
    expect(screen.getByText(/2 entrenos/i)).toBeInTheDocument()
    expect(screen.getByText(/180 TSS/i)).toBeInTheDocument()
  })

  it('ignores workouts outside the current month', () => {
    const workouts = [
      makeWorkout('2025-06-05T10:00:00Z', 75),
      makeWorkout('2025-05-15T10:00:00Z', 200),
      makeWorkout('2025-07-01T10:00:00Z', 150),
    ]
    render(<Calendar workouts={workouts} />)
    expect(screen.getByText(/1 entreno/i)).toBeInTheDocument()
    expect(screen.getByText(/75 TSS/i)).toBeInTheDocument()
  })
})