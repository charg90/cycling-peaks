import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Settings from '../Settings'
import { api } from '../../api/client'

vi.mock('../../api/client', () => ({
  api: {
    updateFTP: vi.fn(),
  },
}))

const mockedUpdateFTP = vi.mocked(api.updateFTP)

const baseAthlete = { id: 'charly', name: 'Charly', ftp: 220 }

describe('Settings', () => {
  beforeEach(() => {
    mockedUpdateFTP.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders current FTP in input', () => {
    render(<Settings athlete={baseAthlete} onFTPUpdated={vi.fn()} />)
    const input = screen.getByDisplayValue('220') as HTMLInputElement
    expect(input.value).toBe('220')
  })

  it('disables save button when FTP unchanged', () => {
    render(<Settings athlete={baseAthlete} onFTPUpdated={vi.fn()} />)
    const button = screen.getByRole('button', { name: /guardar ftp/i }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('enables save button after FTP change', () => {
    render(<Settings athlete={baseAthlete} onFTPUpdated={vi.fn()} />)
    const input = screen.getByDisplayValue('220')
    fireEvent.change(input, { target: { value: '230' } })
    const button = screen.getByRole('button', { name: /guardar ftp/i }) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it('calls updateFTP and onFTPUpdated on save', async () => {
    vi.useRealTimers()
    mockedUpdateFTP.mockResolvedValue(new Response())

    const onFTPUpdated = vi.fn()
    render(<Settings athlete={baseAthlete} onFTPUpdated={onFTPUpdated} />)

    const input = screen.getByDisplayValue('220')
    fireEvent.change(input, { target: { value: '240' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar ftp/i }))

    await waitFor(() => {
      expect(mockedUpdateFTP).toHaveBeenCalledWith(240)
    })
    await waitFor(() => {
      expect(onFTPUpdated).toHaveBeenCalledWith(240)
    })
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument()
  })

  it('shows error alert when updateFTP fails', async () => {
    vi.useRealTimers()
    mockedUpdateFTP.mockRejectedValue(new Error('boom'))
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<Settings athlete={baseAthlete} onFTPUpdated={vi.fn()} />)
    const input = screen.getByDisplayValue('220')
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.click(screen.getByRole('button', { name: /guardar ftp/i }))

    await waitFor(() => {
      expect(alertMock).toHaveBeenCalledWith('Error guardando FTP')
    })
    alertMock.mockRestore()
  })
})