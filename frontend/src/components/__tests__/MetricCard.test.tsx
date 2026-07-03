import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MetricCard from '../MetricCard'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="CTL (Forma)" value="45.3" />)
    expect(screen.getByText('CTL (Forma)')).toBeInTheDocument()
    expect(screen.getByText('45.3')).toBeInTheDocument()
  })

  it('renders sublabel when provided', () => {
    render(<MetricCard label="ATL" value="32.1" sublabel="7-day stress" />)
    expect(screen.getByText('7-day stress')).toBeInTheDocument()
  })

  it('does not render sublabel when omitted', () => {
    render(<MetricCard label="TSB" value="13.2" />)
    expect(screen.queryByText('7-day stress')).not.toBeInTheDocument()
  })
})