import { describe, it, expect } from 'vitest'
import { getMonthDays } from '../calendar'

describe('getMonthDays', () => {
  it('returns 31 days for January', () => {
    const result = getMonthDays(2025, 0)
    expect(result.daysInMonth).toBe(31)
  })

  it('returns 30 days for April', () => {
    const result = getMonthDays(2025, 3)
    expect(result.daysInMonth).toBe(30)
  })

  it('returns 28 days for February in non-leap year', () => {
    expect(getMonthDays(2025, 1).daysInMonth).toBe(28)
  })

  it('returns 29 days for February in leap year', () => {
    expect(getMonthDays(2024, 1).daysInMonth).toBe(29)
  })

  it('returns 31 days for December', () => {
    expect(getMonthDays(2025, 11).daysInMonth).toBe(31)
  })

  it('treats Monday as weekday 0', () => {
    // December 2024 starts on Sunday, so startWeekday would be 6
    // January 2025 starts on Wednesday = weekday 2 (Monday=0)
    expect(getMonthDays(2025, 0).startWeekday).toBe(2)
  })

  it('treats Sunday as weekday 6', () => {
    // June 2025 starts on Sunday = weekday 6
    const result = getMonthDays(2025, 5)
    expect(result.startWeekday).toBe(6)
  })
})