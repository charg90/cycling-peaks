import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { api } from '../client'

describe('api client', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('getAthlete calls /api/v1/athlete and returns parsed JSON', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'charly', name: 'Charly', ftp: 220 })),
    )

    const result = await api.getAthlete()
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/athlete')
    expect(result).toEqual({ id: 'charly', name: 'Charly', ftp: 220 })
  })

  it('getSummary uses generic typing', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ctl: 50, atl: 40 })),
    )
    const result = await api.getSummary<{ ctl: number }>()
    expect(result.ctl).toBe(50)
  })

  it('getWorkouts appends page and limit query params', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
    await api.getWorkouts(2)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/workouts?page=2&limit=30')
  })

  it('getLoadHistory uses provided days', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
    await api.getLoadHistory(180)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/load/history?days=180')
  })

  it('throws on non-OK responses', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response('', { status: 500 }))
    await expect(api.getSummary()).rejects.toThrow('/dashboard/summary: 500')
  })

  it('triggerSync POSTs to /sync/trigger', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response())
    await api.triggerSync()
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/sync/trigger', { method: 'POST' })
  })

  it('updateFTP sends PUT with body', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response())
    await api.updateFTP(250)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/athlete/ftp', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ftp: 250 }),
    })
  })

  it('getZonesBalance includes days query', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({})))
    await api.getZonesBalance(60)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/zones/balance?days=60')
  })

  it('getFTPHistory includes limit query', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({})))
    await api.getFTPHistory(10)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/athlete/ftp-history?limit=10')
  })
})