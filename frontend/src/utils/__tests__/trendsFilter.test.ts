import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { filterData } from '../../components/TrendsChart'
import type { DailyLoad } from '../../types/load'

const makeEntry = (baseDate: Date, daysAgo: number, ctl = 50): DailyLoad => {
  const d = new Date(baseDate)
  d.setDate(d.getDate() - daysAgo)
  return {
    date: d.toISOString().split('T')[0],
    ctl,
    atl: 40,
    tsb: 10,
  }
}

describe('filterData', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('includes only entries within the 3M window', () => {
    const now = new Date()
    const data = [
      makeEntry(now, 10),
      makeEntry(now, 60),
      makeEntry(now, 100),
      makeEntry(now, 200),
    ]
    const filtered = filterData(data, '3M')
    expect(filtered.length).toBe(2)
    expect(filtered.map(d => d.date)).toContain(data[0].date)
    expect(filtered.map(d => d.date)).toContain(data[1].date)
    expect(filtered.map(d => d.date)).not.toContain(data[2].date)
    expect(filtered.map(d => d.date)).not.toContain(data[3].date)
  })

  it('returns more entries for 6M than for 3M', () => {
    const now = new Date()
    const data = [
      makeEntry(now, 30),
      makeEntry(now, 100),
      makeEntry(now, 150),
      makeEntry(now, 200),
      makeEntry(now, 400),
    ]
    expect(filterData(data, '3M').length).toBeLessThan(filterData(data, '6M').length)
  })

  it('returns the most entries for 12M', () => {
    const now = new Date()
    const data = [
      makeEntry(now, 30),
      makeEntry(now, 200),
      makeEntry(now, 300),
      makeEntry(now, 400),
    ]
    expect(filterData(data, '12M').length).toBeGreaterThan(filterData(data, '6M').length)
  })

  it('returns empty array when no entries match', () => {
    const now = new Date()
    const old = [makeEntry(now, 500), makeEntry(now, 800)]
    expect(filterData(old, '3M')).toEqual([])
  })
})