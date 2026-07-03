import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutList from '../WorkoutList'
import type { Workout } from '../../types/load'

const makeWorkout = (overrides: Partial<Workout> = {}): Workout => ({
  id: `w-${Math.random()}`,
  title: 'Morning ride',
  sport_type: 'cycling',
  start_time: '2025-06-10T08:00:00Z',
  duration_secs: 3600,
  distance_meters: 30000,
  elevation_gain_meters: 200,
  normalized_power: 220,
  avg_power: 200,
  max_power: 380,
  intensity_factor: 0.85,
  tss: 80,
  avg_hr: 150,
  max_hr: 175,
  time_in_zones_json: '',
  garmin_connect_url: '',
  ...overrides,
})

describe('WorkoutList', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading state', () => {
    render(<WorkoutList workouts={[]} loading />)
    expect(screen.getByText(/cargando workouts/i)).toBeInTheDocument()
  })

  it('shows empty state when no workouts', () => {
    render(<WorkoutList workouts={[]} />)
    expect(screen.getByText(/no hay workouts/i)).toBeInTheDocument()
  })

  it('renders workout count and rows', () => {
    const workouts = [
      makeWorkout({ id: '1', title: 'Easy spin' }),
      makeWorkout({ id: '2', title: 'Intervals' }),
    ]
    render(<WorkoutList workouts={workouts} />)
    expect(screen.getByText(/ENTRENOS \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText('Easy spin')).toBeInTheDocument()
    expect(screen.getByText('Intervals')).toBeInTheDocument()
  })

  it('expands workout row on click and shows detail metrics', () => {
    const workouts = [
      makeWorkout({ id: '1', title: 'Test ride', tss: 120, normalized_power: 230, max_power: 400 }),
    ]
    render(<WorkoutList workouts={workouts} />)

    fireEvent.click(screen.getByText('Test ride'))

    expect(screen.getByText('POTENCIA')).toBeInTheDocument()
    expect(screen.getByText('NP 230W')).toBeInTheDocument()
    expect(screen.getByText('MAX 400W')).toBeInTheDocument()
    expect(screen.getByText('120 TSS')).toBeInTheDocument()
    expect(screen.getByText('200W avg')).toBeInTheDocument()
  })

  it('collapses previously expanded row when another is clicked', () => {
    const workouts = [
      makeWorkout({ id: '1', title: 'First' }),
      makeWorkout({ id: '2', title: 'Second' }),
    ]
    render(<WorkoutList workouts={workouts} />)

    fireEvent.click(screen.getByText('First'))
    expect(screen.getByText('POTENCIA')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Second'))
    const all = screen.getAllByText('POTENCIA')
    expect(all.length).toBe(1)
  })

  it('filters workouts by period (7d)', () => {
    const workouts = [
      makeWorkout({ id: '1', title: 'Recent', start_time: '2025-06-14T08:00:00Z' }),
      makeWorkout({ id: '2', title: 'Old', start_time: '2025-05-20T08:00:00Z' }),
    ]
    render(<WorkoutList workouts={workouts} />)
    fireEvent.click(screen.getByRole('button', { name: '7d' }))
    expect(screen.getByText(/ENTRENOS \(1\)/i)).toBeInTheDocument()
    expect(screen.queryByText('Old')).not.toBeInTheDocument()
  })

  it('filters workouts by minimum TSS', () => {
    const workouts = [
      makeWorkout({ id: '1', title: 'Hard', tss: 150 }),
      makeWorkout({ id: '2', title: 'Easy', tss: 30 }),
    ]
    render(<WorkoutList workouts={workouts} />)
    const input = screen.getByDisplayValue('0') as HTMLInputElement
    fireEvent.change(input, { target: { value: '100' } })
    expect(screen.getByText(/ENTRENOS \(1\)/i)).toBeInTheDocument()
    expect(screen.queryByText('Easy')).not.toBeInTheDocument()
  })

  it('renders Garmin Connect link when present', () => {
    const workouts = [
      makeWorkout({
        id: '1',
        title: 'Linked',
        garmin_connect_url: 'https://connect.garmin.com/modern/activity/123',
      }),
    ]
    render(<WorkoutList workouts={workouts} />)
    fireEvent.click(screen.getByText('Linked'))
    const link = screen.getByText(/ver en garmin connect/i)
    expect(link.closest('a')).toHaveAttribute('href', 'https://connect.garmin.com/modern/activity/123')
  })

  it('renders zones bars when time_in_zones_json is provided', () => {
    const zones = { z1: 600, z2: 1200, z3: 600, z4: 0, z5: 0, z6: 0, z7: 0, total: 2400 }
    const workouts = [
      makeWorkout({ id: '1', title: 'Zoned', time_in_zones_json: JSON.stringify(zones) }),
    ]
    render(<WorkoutList workouts={workouts} />)
    fireEvent.click(screen.getByText('Zoned'))
    expect(screen.getByText(/zonas de potencia/i)).toBeInTheDocument()
    expect(screen.getByText(/Z1/i)).toBeInTheDocument()
    expect(screen.getByText(/Z2/i)).toBeInTheDocument()
    expect(screen.getByText(/Z3/i)).toBeInTheDocument()
  })
})