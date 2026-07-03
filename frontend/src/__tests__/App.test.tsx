import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import App from '../App'
import { api } from '../api/client'
import type { Summary, Workout, DailyLoad, Athlete } from '../types/load'

vi.mock('../api/client', () => ({
  api: {
    getAthlete: vi.fn(),
    getSummary: vi.fn(),
    getWorkouts: vi.fn(),
    getLoadHistory: vi.fn(),
    getLoadToday: vi.fn(),
    getSyncStatus: vi.fn(),
    triggerSync: vi.fn(),
    updateFTP: vi.fn(),
    getZonesBalance: vi.fn(),
    getFTPHistory: vi.fn(),
    getOvertrainingAlert: vi.fn(),
  },
}))

const fakeSummary: Summary = {
  ctl: 50,
  atl: 40,
  tsb: 10,
  status: 'optimal',
  this_week: { tss: 300, workouts: 4, hours: 8 },
  this_month: { tss: 1200, workouts: 16, hours: 30 },
  last_workout: { title: 'Long ride', tss: 150, date: '2025-06-14' },
}

const fakeAthlete: Athlete = { id: 'charly', name: 'Charly', ftp: 220 }

const fakeWorkouts: { data: Workout[] } = { data: [] }
const fakeLoad: { data: DailyLoad[] } = { data: [] }

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.getSummary).mockResolvedValue(fakeSummary)
    vi.mocked(api.getWorkouts).mockResolvedValue(fakeWorkouts)
    vi.mocked(api.getLoadHistory).mockResolvedValue(fakeLoad)
    vi.mocked(api.getAthlete).mockResolvedValue(fakeAthlete)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders dashboard after data loads', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/CTL \(Forma\)/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/ATL \(Fatiga\)/i)).toBeInTheDocument()
    expect(screen.getByText(/TSB \(Balance\)/i)).toBeInTheDocument()
    expect(screen.getByText(/cycling peaks/i)).toBeInTheDocument()
  })

  it('renders summary metrics correctly', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText('50.0')).toBeInTheDocument()
    })
    expect(screen.getByText('40.0')).toBeInTheDocument()
    expect(screen.getByText('+10.0')).toBeInTheDocument()
  })

  it('renders week and month summaries', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/esta semana/i)).toBeInTheDocument()
    })
    expect(screen.getByText('300')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('8.0h')).toBeInTheDocument()
  })

  it('switches to calendar tab', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/cycling peaks/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /calendar/i }))
    await waitFor(() => {
      expect(screen.getByText('Hoy')).toBeInTheDocument()
    })
    expect(screen.getByText('Lun')).toBeInTheDocument()
  })

  it('switches to settings tab', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/cycling peaks/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /settings/i }))
    await waitFor(() => {
      expect(screen.getByText(/configuración/i)).toBeInTheDocument()
    })
  })

  it('toggles theme', async () => {
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/cycling peaks/i)).toBeInTheDocument()
    })
    const themeButton = screen.getByTitle(/modo claro/i)
    fireEvent.click(themeButton)
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    fireEvent.click(screen.getByTitle(/modo oscuro/i))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('triggers sync on button click', async () => {
    vi.mocked(api.triggerSync).mockResolvedValue(new Response())
    render(<App />)
    await waitFor(() => {
      expect(screen.getByText(/sync garmin/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/sync garmin/i))
    expect(api.triggerSync).toHaveBeenCalled()
  })

  it('shows overtraining alert when TSB < -30 for 3+ consecutive days', async () => {
    vi.mocked(api.getLoadHistory).mockResolvedValue({
      data: [
        { date: '2025-06-14', ctl: 100, atl: 150, tsb: -40, tss: 200 },
        { date: '2025-06-13', ctl: 100, atl: 150, tsb: -35, tss: 200 },
        { date: '2025-06-12', ctl: 100, atl: 150, tsb: -32, tss: 200 },
      ],
    })
    render(<App />)
    expect(await screen.findByText(/overreaching detectado/i)).toBeInTheDocument()
  })
})