// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MenuBar } from './MenuBar'

const mockPairMutate = vi.fn()

vi.mock('../../hooks/useRounds', () => ({
  usePairNextRound: () => ({ mutate: mockPairMutate }),
}))

function renderMenuBar(props: { tournamentId?: number; roundNr?: number } = {}) {
  return render(<MenuBar tournamentId={props.tournamentId} roundNr={props.roundNr} />)
}

function openMenu(name: string) {
  fireEvent.click(screen.getByText(name))
}

function setupPairError(message: string) {
  mockPairMutate.mockImplementation((_: unknown, opts: { onError: (e: Error) => void }) => {
    opts.onError(new Error(message))
  })
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('MenuBar disabled menus without tournament', () => {
  it('disables Lotta and Ställning when no tournament is selected', () => {
    renderMenuBar()

    expect(screen.getByText('Lotta').closest('button')!.disabled).toBe(true)
    expect(screen.getByText('Ställning').closest('button')!.disabled).toBe(true)
  })

  it('enables Lotta and Ställning when a tournament is selected', () => {
    renderMenuBar({ tournamentId: 1 })

    expect(screen.getByText('Lotta').closest('button')!.disabled).toBe(false)
    expect(screen.getByText('Ställning').closest('button')!.disabled).toBe(false)
  })

  it('does not open Lotta dropdown when disabled', () => {
    renderMenuBar()

    openMenu('Lotta')

    expect(screen.queryByText('Lotta nästa rond')).toBeNull()
  })

  it('keeps Turnering, Spelare, Inställningar, and Hjälp enabled without tournament', () => {
    renderMenuBar()

    for (const label of ['Turnering', 'Spelare', 'Inställningar', 'Hjälp']) {
      expect(screen.getByText(label).closest('button')!.disabled).toBe(false)
    }
  })
})

describe('MenuBar about dialog', () => {
  it('opens about dialog when clicking Om in Hjälp menu', () => {
    renderMenuBar()

    openMenu('Hjälp')
    fireEvent.click(screen.getByText('Om'))

    expect(screen.getByText('Om Lotta')).not.toBeNull()
    expect(screen.getByText('William Bernting')).not.toBeNull()
  })

  it('closes about dialog when clicking Stäng', () => {
    renderMenuBar()

    openMenu('Hjälp')
    fireEvent.click(screen.getByText('Om'))
    expect(screen.getByText('Om Lotta')).not.toBeNull()

    fireEvent.click(screen.getByText('Stäng'))
    expect(screen.queryByText('Om Lotta')).toBeNull()
  })
})

describe('MenuBar pairing error', () => {
  it('shows error dialog when pairing fails', () => {
    setupPairError('Inga spelare registrerade')
    renderMenuBar({ tournamentId: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))

    expect(screen.getByText('Kan inte lotta')).toBeTruthy()
    expect(screen.getByTestId('pair-error').textContent).toContain('Inga spelare registrerade')
  })

  it('closes error dialog when clicking OK', () => {
    setupPairError('Inga spelare registrerade')
    renderMenuBar({ tournamentId: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))
    expect(screen.getByText('Kan inte lotta')).toBeTruthy()

    fireEvent.click(screen.getByText('OK'))
    expect(screen.queryByText('Kan inte lotta')).toBeNull()
  })

  it('clears error on successful pairing', () => {
    let capturedOpts: { onSuccess?: () => void; onError?: (e: Error) => void } = {}
    mockPairMutate.mockImplementation(
      (_: unknown, opts: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
        capturedOpts = opts
      },
    )

    renderMenuBar({ tournamentId: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))
    act(() => capturedOpts.onError?.(new Error('Inga spelare registrerade')))
    expect(screen.getByText('Kan inte lotta')).toBeTruthy()

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))
    act(() => capturedOpts.onSuccess?.())
    expect(screen.queryByText('Kan inte lotta')).toBeNull()
  })
})
