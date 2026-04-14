// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClubDto, PlayerDto } from '../../types/api'
import { Chess4SetupTab } from './Chess4SetupTab'

const mockClubs: ClubDto[] = [
  { id: 1, name: 'SK Alfa', chess4Members: 0 },
  { id: 2, name: 'SK Beta', chess4Members: 4 },
]

const mockPlayers: PlayerDto[] = [
  {
    id: 1,
    lastName: 'Test',
    firstName: 'Player',
    club: 'SK Alfa',
    clubIndex: 1,
    ratingN: 1500,
    ratingI: 0,
    ratingQ: 0,
    ratingB: 0,
    ratingK: 0,
    ratingKQ: 0,
    ratingKB: 0,
    title: '',
    sex: null,
    federation: '',
    fideId: 0,
    ssfId: 0,
    birthdate: null,
    playerGroup: '',
    withdrawnFromRound: 0,
    manualTiebreak: 0,
    lotNr: 1,
  },
]

const mockMutate = vi.fn()

vi.mock('../../hooks/useClubs', () => ({
  useClubs: vi.fn(() => ({ data: mockClubs })),
  useRenameClub: vi.fn(() => ({ mutate: mockMutate })),
}))

vi.mock('../../hooks/useTournamentPlayers', () => ({
  useTournamentPlayers: vi.fn(() => ({ data: mockPlayers })),
}))

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('Chess4SetupTab', () => {
  beforeEach(() => {
    mockMutate.mockClear()
  })

  it('shows class size inputs directly without requiring double-click', () => {
    renderWithQuery(<Chess4SetupTab tournamentId={1} />)
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBe(2)
    expect((inputs[0] as HTMLInputElement).value).toBe('0')
    expect((inputs[1] as HTMLInputElement).value).toBe('4')
  })

  it('saves class size on blur', () => {
    renderWithQuery(<Chess4SetupTab tournamentId={1} />)
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[0], { target: { value: '6' } })
    fireEvent.blur(inputs[0])
    expect(mockMutate).toHaveBeenCalledWith({
      id: 1,
      dto: expect.objectContaining({ chess4Members: 6 }),
    })
  })

  it('does not mutate when value is unchanged on blur', () => {
    renderWithQuery(<Chess4SetupTab tournamentId={1} />)
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.blur(inputs[1])
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('resets to 0 when input is cleared and blurred', () => {
    renderWithQuery(<Chess4SetupTab tournamentId={1} />)
    const inputs = screen.getAllByRole('spinbutton')
    fireEvent.change(inputs[1], { target: { value: '' } })
    fireEvent.blur(inputs[1])
    expect(mockMutate).toHaveBeenCalledWith({
      id: 2,
      dto: expect.objectContaining({ chess4Members: 0 }),
    })
  })
})
