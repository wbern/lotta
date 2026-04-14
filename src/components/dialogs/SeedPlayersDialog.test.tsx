// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedFakePlayers } from '../../api/seed-players'
import { SeedPlayersDialog } from './SeedPlayersDialog'

vi.mock('../../api/seed-players', () => ({
  seedFakePlayers: vi.fn().mockResolvedValue({ players: [], clubs: [] }),
}))

vi.mock('../../api/tournament-players', () => ({
  addTournamentPlayers: vi.fn().mockResolvedValue(undefined),
}))

function renderDialog(props: Partial<Parameters<typeof SeedPlayersDialog>[0]> = {}) {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <SeedPlayersDialog open onClose={vi.fn()} {...props} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('SeedPlayersDialog club generation', () => {
  it('shows a checkbox for creating random clubs', () => {
    renderDialog()

    expect(screen.getByTestId('seed-create-clubs')).not.toBeNull()
  })

  it('shows club count input when checkbox is checked', () => {
    renderDialog()

    expect(screen.queryByTestId('seed-club-count')).toBeNull()

    const checkbox = screen.getByTestId('seed-create-clubs').querySelector('input')!
    fireEvent.click(checkbox)

    const clubCountInput = screen.getByTestId('seed-club-count') as HTMLInputElement
    expect(clubCountInput).not.toBeNull()
    expect(clubCountInput.value).toBe('5')
  })

  it('passes clubCount option when clubs checkbox is enabled', async () => {
    renderDialog()

    const checkbox = screen.getByTestId('seed-create-clubs').querySelector('input')!
    fireEvent.click(checkbox)

    fireEvent.click(screen.getByText('Skapa'))

    await waitFor(() => {
      expect(seedFakePlayers).toHaveBeenCalledWith(20, { clubCount: 5 })
    })
  })

  it('passes no clubCount option when clubs checkbox is disabled', async () => {
    renderDialog()

    fireEvent.click(screen.getByText('Skapa'))

    await waitFor(() => {
      expect(seedFakePlayers).toHaveBeenCalledWith(20, { clubCount: undefined })
    })
  })
})
