import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationDetailed, formatDate, formatDateLong } from '../format'

describe('formatDuration', () => {
  it('formats minutes only when under one hour', () => {
    expect(formatDuration(0)).toBe('0m')
    expect(formatDuration(30)).toBe('0m')
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(600)).toBe('10m')
    expect(formatDuration(3599)).toBe('59m')
  })

  it('formats hours and minutes when over one hour', () => {
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(3660)).toBe('1h 1m')
    expect(formatDuration(5400)).toBe('1h 30m')
    expect(formatDuration(7200)).toBe('2h 0m')
    expect(formatDuration(3661)).toBe('1h 1m')
  })
})

describe('formatDurationDetailed', () => {
  it('formats minutes and seconds when under one hour', () => {
    expect(formatDurationDetailed(0)).toBe('0m 0s')
    expect(formatDurationDetailed(45)).toBe('0m 45s')
    expect(formatDurationDetailed(125)).toBe('2m 5s')
  })

  it('formats hours and minutes when over one hour, omitting seconds', () => {
    expect(formatDurationDetailed(3600)).toBe('1h 0m')
    expect(formatDurationDetailed(7325)).toBe('2h 2m')
  })
})

describe('formatDate', () => {
  it('returns a localized short date string', () => {
    const result = formatDate('2025-03-15T12:00:00Z')
    expect(result).toMatch(/mar/i)
    expect(result).toMatch(/15/)
  })
})

describe('formatDateLong', () => {
  it('returns a long localized date', () => {
    const result = formatDateLong('2025-12-25T15:30:00Z')
    expect(result).toMatch(/dic/i)
    expect(result).toMatch(/25/)
    expect(result).toMatch(/2025/)
  })
})