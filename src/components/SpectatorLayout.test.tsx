// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { generateClubCode } from '../domain/club-codes'
import * as store from '../stores/client-p2p-store'
import type { PlayerDto, ResultType, RoundDto, TournamentListItemDto } from '../types/api'
import { SpectatorLayout } from './SpectatorLayout'

const mockTournaments: TournamentListItemDto[] = [
  {
    id: 1,
    name: 'Test Tournament',
    group: 'A',
    pairingSystem: 'Monrad',
    nrOfRounds: 7,
    roundsPlayed: 2,
    playerCount: 8,
    finished: false,
  },
]

const mockRounds: RoundDto[] = [
  {
    roundNr: 1,
    hasAllResults: true,
    gameCount: 4,
    games: [],
  },
  {
    roundNr: 2,
    hasAllResults: false,
    gameCount: 4,
    games: [
      {
        boardNr: 1,
        roundNr: 2,
        whitePlayer: { id: 1, name: 'Anna Svensson', club: 'Skara SK', rating: 1800, lotNr: 1 },
        blackPlayer: {
          id: 2,
          name: 'Erik Johansson',
          club: 'Lidköping SS',
          rating: 1750,
          lotNr: 2,
        },
        resultType: 'WHITE_WIN',
        whiteScore: 1,
        blackScore: 0,
        resultDisplay: '1-0',
      },
      {
        boardNr: 2,
        roundNr: 2,
        whitePlayer: { id: 3, name: 'Karl Nilsson', club: 'Lidköping SS', rating: 1700, lotNr: 3 },
        blackPlayer: { id: 4, name: 'Maria Lindberg', club: 'Skara SK', rating: 1650, lotNr: 4 },
        resultType: 'NO_RESULT',
        whiteScore: 0,
        blackScore: 0,
        resultDisplay: '',
      },
    ],
  },
]

const mockPlayers: PlayerDto[] = [
  {
    id: 1,
    lastName: 'Svensson',
    firstName: 'Anna',
    club: 'Skara SK',
    clubIndex: 0,
    ratingN: 1800,
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
  {
    id: 2,
    lastName: 'Johansson',
    firstName: 'Erik',
    club: 'Lidköping SS',
    clubIndex: 0,
    ratingN: 1750,
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
    lotNr: 2,
  },
  {
    id: 3,
    lastName: 'Nilsson',
    firstName: 'Karl',
    club: 'Lidköping SS',
    clubIndex: 0,
    ratingN: 1700,
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
    lotNr: 3,
  },
  {
    id: 4,
    lastName: 'Lindberg',
    firstName: 'Maria',
    club: 'Skara SK',
    clubIndex: 0,
    ratingN: 1650,
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
    lotNr: 4,
  },
  {
    id: 5,
    lastName: 'Persson',
    firstName: 'Nils',
    club: null,
    clubIndex: 0,
    ratingN: 1400,
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
    lotNr: 5,
  },
]

vi.mock('../hooks/useTournaments', () => ({
  useTournaments: vi.fn(() => ({ data: mockTournaments })),
}))

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockUseRounds = vi.fn((_tid?: number) => ({ data: mockRounds }))
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockUseRound = vi.fn((_tid?: number, _roundNr?: number) => ({ data: mockRounds[1] }))

vi.mock('../hooks/useRounds', () => ({
  useRounds: (tid?: number) => mockUseRounds(tid),
  useRound: (tid?: number, roundNr?: number) => mockUseRound(tid, roundNr),
}))

vi.mock('../hooks/useTournamentPlayers', () => ({
  useTournamentPlayers: vi.fn(() => ({ data: mockPlayers })),
}))

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('SpectatorLayout', () => {
  beforeEach(() => {
    store.resetClientStore()
    mockUseRounds.mockReturnValue({ data: mockRounds })
    mockUseRound.mockReturnValue({ data: mockRounds[1] })
  })

  afterEach(cleanup)

  it('renders tournament name and latest round', () => {
    renderWithQuery(<SpectatorLayout />)
    expect(screen.getByText('Test Tournament')).toBeTruthy()
    expect(screen.getByText('Rond 2')).toBeTruthy()
  })

  it('shows all pairings when no club filter', () => {
    renderWithQuery(<SpectatorLayout />)
    const table = screen.getByTestId('spectator-pairings')
    const rows = table.querySelectorAll('tbody tr')
    expect(rows.length).toBe(2)
    expect(screen.getByText('Anna Svensson')).toBeTruthy()
    expect(screen.getByText('Erik Johansson')).toBeTruthy()
  })

  it('filters games by club when clubFilter is set', () => {
    store.setShareMode('view')
    store.setClubFilter(['Skara SK'])
    renderWithQuery(<SpectatorLayout />)
    expect(screen.getByText('Skara SK')).toBeTruthy()
    const table = screen.getByTestId('spectator-pairings')
    const rows = table.querySelectorAll('tbody tr')
    // Both games involve Skara SK players
    expect(rows.length).toBe(2)
  })

  it('redacts opponent first name for non-club players when club filter active', () => {
    store.setShareMode('view')
    store.setClubFilter(['Skara SK'])
    renderWithQuery(<SpectatorLayout />)
    // Skara SK players show full name
    expect(screen.getByText('Anna Svensson')).toBeTruthy()
    expect(screen.getByText('Maria Lindberg')).toBeTruthy()
    // Opponents show only first name
    expect(screen.getByText('Erik')).toBeTruthy()
    expect(screen.getByText('Karl')).toBeTruthy()
    // Full opponent names should not appear
    expect(screen.queryByText('Erik Johansson')).toBeNull()
    expect(screen.queryByText('Karl Nilsson')).toBeNull()
  })

  it('shows result display for completed games', () => {
    renderWithQuery(<SpectatorLayout />)
    expect(screen.getByText('1-0')).toBeTruthy()
  })

  it('uses the per-game resultDisplay so Schack4an scores render as 3-1 not 1-0', () => {
    const schack4anRound: RoundDto = {
      roundNr: 2,
      hasAllResults: false,
      gameCount: 1,
      games: [
        {
          boardNr: 1,
          roundNr: 2,
          whitePlayer: { id: 1, name: 'Anna Svensson', club: 'Skara SK', rating: 1800, lotNr: 1 },
          blackPlayer: {
            id: 2,
            name: 'Erik Johansson',
            club: 'Lidköping SS',
            rating: 1750,
            lotNr: 2,
          },
          resultType: 'WHITE_WIN',
          whiteScore: 3,
          blackScore: 1,
          resultDisplay: '3-1',
        },
      ],
    }
    mockUseRound.mockReturnValue({ data: schack4anRound })
    renderWithQuery(<SpectatorLayout />)
    expect(screen.getByText('3-1')).toBeTruthy()
  })

  it('shows club badge when filter is active', () => {
    store.setClubFilter(['Skara SK'])
    renderWithQuery(<SpectatorLayout />)
    const badge = screen.getByText('Skara SK')
    expect(badge.classList.contains('spectator-club-badge')).toBe(true)
  })

  it('advances to the latest round when rounds data updates', () => {
    renderWithQuery(<SpectatorLayout />)
    expect(screen.getByText('Rond 2')).toBeTruthy()

    const round3: RoundDto = {
      roundNr: 3,
      hasAllResults: false,
      gameCount: 4,
      games: [
        {
          boardNr: 1,
          roundNr: 3,
          whitePlayer: { id: 4, name: 'Maria Lindberg', club: 'Skara SK', rating: 1650, lotNr: 4 },
          blackPlayer: { id: 1, name: 'Anna Svensson', club: 'Skara SK', rating: 1800, lotNr: 1 },
          resultType: 'NO_RESULT' as ResultType,
          whiteScore: 0,
          blackScore: 0,
          resultDisplay: '',
        },
      ],
    }
    const updatedRounds: RoundDto[] = [...mockRounds, round3]
    mockUseRounds.mockReturnValue({ data: updatedRounds })
    mockUseRound.mockReturnValue({ data: round3 })

    // Force re-render — simulates React Query invalidation
    cleanup()
    renderWithQuery(<SpectatorLayout />)

    expect(screen.getByText('Rond 3')).toBeTruthy()
    expect(screen.getByText('Maria Lindberg')).toBeTruthy()
  })

  it('shows club code dialog in view mode when clubs exist', () => {
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    expect(screen.getByTestId('club-code-dialog')).toBeTruthy()
    expect(screen.getByPlaceholderText('### ###')).toBeTruthy()
  })

  it('accepts valid club code and sets filter', () => {
    const allClubs = ['Lidköping SS', 'Skara SK', '__CLUBLESS__']
    const secret = 'Test Tournament/A'
    const code = generateClubCode(['Skara SK'], allClubs, secret)
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    const input = screen.getByPlaceholderText('### ###')
    fireEvent.change(input, { target: { value: code } })
    fireEvent.click(screen.getByTestId('club-code-submit'))

    expect(store.getClientP2PState().clubFilter).toEqual(['Skara SK'])
  })

  it('auto-inserts a space separator as the user types digits', () => {
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    const input = screen.getByPlaceholderText('### ###') as HTMLInputElement
    fireEvent.change(input, { target: { value: '123456' } })

    expect(input.value).toBe('123 456')
  })

  it('accepts a code entered with a space separator', () => {
    const allClubs = ['Lidköping SS', 'Skara SK', '__CLUBLESS__']
    const secret = 'Test Tournament/A'
    const code = generateClubCode(['Skara SK'], allClubs, secret)
    const mid = Math.floor(code.length / 2)
    const spaced = `${code.slice(0, mid)} ${code.slice(mid)}`
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    const input = screen.getByPlaceholderText('### ###')
    fireEvent.change(input, { target: { value: spaced } })
    fireEvent.click(screen.getByTestId('club-code-submit'))

    expect(store.getClientP2PState().clubFilter).toEqual(['Skara SK'])
  })

  it('does not set club filter when dialog is dismissed', () => {
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    // Close via overlay click
    fireEvent.click(screen.getByTestId('dialog-overlay'))

    expect(store.getClientP2PState().clubFilter).toBeNull()
  })

  it('does not set club filter when invalid code is entered', () => {
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    const input = screen.getByPlaceholderText('### ###')
    fireEvent.change(input, { target: { value: 'XXXXXX' } })
    fireEvent.click(screen.getByTestId('club-code-submit'))

    expect(store.getClientP2PState().clubFilter).toBeNull()
  })

  it('does not show dialog when club filter is already set', () => {
    store.setShareMode('view')
    store.setRoomCode('TESTRC')
    store.setClubFilter(['Skara SK'])

    renderWithQuery(<SpectatorLayout />)

    expect(screen.queryByTestId('club-code-dialog')).toBeNull()
  })

  it('verifies codes that include clubless players', () => {
    const allClubs = ['Lidköping SS', 'Skara SK', '__CLUBLESS__']
    const secret = 'Test Tournament/A'
    const code = generateClubCode(['Skara SK', '__CLUBLESS__'], allClubs, secret)
    store.setShareMode('view')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    const input = screen.getByPlaceholderText('### ###')
    fireEvent.change(input, { target: { value: code } })
    fireEvent.click(screen.getByTestId('club-code-submit'))

    const filter = store.getClientP2PState().clubFilter
    expect(filter).toContain('Skara SK')
    expect(filter).toContain('__CLUBLESS__')
  })

  it('does not show dialog in full share mode', () => {
    store.setShareMode('full')
    store.setRoomCode('TESTRC')

    renderWithQuery(<SpectatorLayout />)

    expect(screen.queryByTestId('club-code-dialog')).toBeNull()
  })

  it('highlights club players with a CSS class when club filter is active', () => {
    store.setShareMode('view')
    store.setClubFilter(['Skara SK'])
    renderWithQuery(<SpectatorLayout />)
    // Club players should be highlighted
    const anna = screen.getByText('Anna Svensson')
    expect(anna.classList.contains('spectator-club-player')).toBe(true)
    const maria = screen.getByText('Maria Lindberg')
    expect(maria.classList.contains('spectator-club-player')).toBe(true)
    // Opponents should NOT be highlighted
    const erik = screen.getByText('Erik')
    expect(erik.classList.contains('spectator-club-player')).toBe(false)
    const karl = screen.getByText('Karl')
    expect(karl.classList.contains('spectator-club-player')).toBe(false)
  })
})
