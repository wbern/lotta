// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sv } from '../../lib/swedish-text'
import type { TournamentDto } from '../../types/api'
import { TournamentDialog } from './TournamentDialog'

const mockMutate = vi.fn()
const mockMutation = { mutate: mockMutate, mutateAsync: vi.fn() }

const mockExisting = vi.hoisted(
  () => ({ value: undefined }) as { value: TournamentDto | undefined },
)

const mockMutationOverride = vi.hoisted(
  () => ({ value: undefined }) as { value: Record<string, unknown> | undefined },
)

vi.mock('../../hooks/useTournaments', () => ({
  useTournament: (id: number | undefined) =>
    id == null ? { data: undefined } : { data: mockExisting.value },
  useCreateTournament: () => mockMutationOverride.value ?? mockMutation,
  useUpdateTournament: () => mockMutationOverride.value ?? mockMutation,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  mockExisting.value = undefined
  mockMutationOverride.value = undefined
})

const baseTournament: TournamentDto = {
  id: 1,
  name: 'Test',
  group: 'A',
  pairingSystem: 'Monrad',
  initialPairing: 'Slumpad',
  nrOfRounds: 7,
  barredPairing: false,
  compensateWeakPlayerPP: false,
  pointsPerGame: 1,
  maxPointsForWin: 1,
  chess4: false,
  ratingChoice: 'ELO',
  showELO: true,
  showGroup: false,
  city: '',
  startDate: null,
  endDate: null,
  chiefArbiter: '',
  deputyArbiter: '',
  timeControl: '',
  federation: 'SWE',
  resultsPage: '',
  standingsPage: '',
  playerListPage: '',
  roundForRoundPage: '',
  clubStandingsPage: '',
  selectedTiebreaks: [],
  roundDates: [],
} as unknown as TournamentDto

describe('TournamentDialog randomize buttons', () => {
  it('populates tournament name when randomize button is clicked', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    const nameInput = screen.getByTestId('tournament-name-input') as HTMLInputElement
    expect(nameInput.value).toBe('')

    fireEvent.click(screen.getByTestId('randomize-name'))

    expect(nameInput.value).not.toBe('')
    expect(nameInput.value.split(' ')).toHaveLength(3)
  })
})

describe('TournamentDialog required field indicators', () => {
  it('shows red asterisk on Turnering label', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    const label = screen
      .getByTestId('tournament-name-input')
      .closest('.form-group')!
      .querySelector('label')!
    expect(label.querySelector('.required-asterisk')).not.toBeNull()
  })

  it('shows red asterisk on Grupp label', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    const label = screen
      .getByTestId('tournament-group-input')
      .closest('.form-group')!
      .querySelector('label')!
    expect(label.querySelector('.required-asterisk')).not.toBeNull()
  })
})

describe('TournamentDialog save validation', () => {
  it('shows inline error when saving with empty name and group', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Spara'))

    expect(screen.getByTestId('tournament-save-error')).not.toBeNull()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('clears error when user types in name field', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Spara'))
    expect(screen.getByTestId('tournament-save-error')).not.toBeNull()

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'Test' } })
    expect(screen.queryByTestId('tournament-save-error')).toBeNull()
  })
})

describe('TournamentDialog preset prefill', () => {
  it('prefills name from initialName and copies settings from preset tournament with empty group', () => {
    mockExisting.value = {
      ...baseTournament,
      id: 99,
      name: 'Some other name',
      group: 'X',
      chess4: true,
      pointsPerGame: 4,
      maxPointsForWin: 3,
      nrOfRounds: 5,
    }

    render(
      <TournamentDialog
        open
        tournamentId={undefined}
        initialName="Vårspelen 2026"
        presetFromTournamentId={99}
        onClose={vi.fn()}
      />,
    )

    const nameInput = screen.getByTestId('tournament-name-input') as HTMLInputElement
    const groupInput = screen.getByTestId('tournament-group-input') as HTMLInputElement
    const pointSystem = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement

    expect(nameInput.value).toBe('Vårspelen 2026')
    expect(groupInput.value).toBe('')
    expect(pointSystem.value).toBe('schack4an')
  })
})

describe('TournamentDialog create flow', () => {
  it('calls onClose after successful creation', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    // Simulate real TanStack Query behavior: onSuccess fires asynchronously
    mockMutate.mockImplementation(
      (_data: unknown, options?: { onSuccess?: (data: { id: number }) => void }) => {
        Promise.resolve().then(() => options?.onSuccess?.({ id: 42 }))
      },
    )

    render(
      <TournamentDialog open tournamentId={undefined} onClose={onClose} onCreated={onCreated} />,
    )

    fireEvent.change(screen.getByTestId('tournament-name-input'), {
      target: { value: 'Test Tournament' },
    })
    fireEvent.change(screen.getByTestId('tournament-group-input'), {
      target: { value: 'Group A' },
    })

    fireEvent.click(screen.getByText('Spara'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    // Wait for the async onSuccess callback
    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(42)
    })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('TournamentDialog point system preset', () => {
  it('defaults to standard 1-½-0 preset for a new tournament', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)
    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    expect(select.value).toBe('standard')
  })

  it('picking schack4an preset stores 3-2-1 scoring WITHOUT enabling chess4 (ADR-0006)', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'S4' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })
    fireEvent.change(screen.getByTestId('tournament-point-system-select'), {
      target: { value: 'schack4an' },
    })
    fireEvent.click(screen.getByText('Spara'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    const payload = mockMutate.mock.calls[0][0]
    // Scoring is decoupled from the Schackfyran format: 3-2-1 scoring, chess4 off.
    expect(payload.chess4).toBe(false)
    expect(payload.pointsPerGame).toBe(4)
    expect(payload.maxPointsForWin).toBe(3)
  })

  it('picking skollags preset stores chess4=false with pointsPerGame=2 on save', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'SDM' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })
    fireEvent.change(screen.getByTestId('tournament-point-system-select'), {
      target: { value: 'skollags' },
    })
    fireEvent.click(screen.getByText('Spara'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    const payload = mockMutate.mock.calls[0][0]
    expect(payload.chess4).toBe(false)
    expect(payload.pointsPerGame).toBe(2)
  })

  it('auto-selects manual preset and reveals raw fields for an existing non-preset tournament', () => {
    // ppg=3 is an arbitrary non-preset value — forces detectPointSystemPreset → 'manual'
    mockExisting.value = { ...baseTournament, chess4: false, pointsPerGame: 3 }

    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    expect(select.value).toBe('manual')
    expect(screen.getByTestId('tournament-points-per-game-input')).not.toBeNull()
    expect((screen.getByTestId('tournament-points-per-game-input') as HTMLInputElement).value).toBe(
      '3',
    )
  })

  it('hides raw pointsPerGame input until manual preset is picked', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    expect(screen.queryByTestId('tournament-points-per-game-input')).toBeNull()

    fireEvent.change(screen.getByTestId('tournament-point-system-select'), {
      target: { value: 'manual' },
    })

    expect(screen.getByTestId('tournament-points-per-game-input')).not.toBeNull()
  })

  it('keeps the Schack4an checkbox visible on the standard preset so old Lotta users can find it', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    expect(select.value).toBe('standard')
    expect(screen.getByTestId('tournament-chess4-checkbox')).not.toBeNull()
  })

  it('checking the Schack4an checkbox flips the dropdown to schack4an', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    expect(select.value).toBe('standard')

    fireEvent.click(screen.getByTestId('tournament-chess4-checkbox'))

    expect(select.value).toBe('schack4an')
  })

  it('switching from schack4an back to standard restores pre-chess4 pairing system', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'T' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    fireEvent.change(select, { target: { value: 'schack4an' } })
    expect(select.value).toBe('schack4an')
    fireEvent.change(select, { target: { value: 'standard' } })
    expect(select.value).toBe('standard')

    fireEvent.click(screen.getByText('Spara'))

    const payload = mockMutate.mock.calls[0][0]
    expect(payload.chess4).toBe(false)
    expect(payload.pointsPerGame).toBe(1)
    // Pre-chess4 defaults (Nordisk Schweizer / Rating) must come back so the
    // form does not silently leak Schack4an's Monrad/Slumpad overrides.
    expect(payload.pairingSystem).toBe('Nordisk Schweizer')
    expect(payload.initialPairing).toBe('Rating')
  })

  it('chains schack4an → manual → schack4an → standard without losing original pairing', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'T' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    // Standard → Schack4an: snapshots pairingSystem='Nordisk Schweizer'
    fireEvent.change(select, { target: { value: 'schack4an' } })
    // Detour through manual (form stays chess4=true)
    fireEvent.change(select, { target: { value: 'manual' } })
    // Back to Schack4an: must NOT re-snapshot the (now chess4-mode) form
    fireEvent.change(select, { target: { value: 'schack4an' } })
    // Finally Standard: should restore the original pre-chess4 pairing
    fireEvent.change(select, { target: { value: 'standard' } })

    fireEvent.click(screen.getByText('Spara'))
    const payload = mockMutate.mock.calls[0][0]
    expect(payload.pairingSystem).toBe('Nordisk Schweizer')
    expect(payload.initialPairing).toBe('Rating')
  })
})

describe('TournamentDialog scoring lock', () => {
  it('allows scoring changes on a tournament with no recorded results', () => {
    mockExisting.value = {
      ...baseTournament,
      hasRecordedResults: false,
    } as unknown as TournamentDto

    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    const checkbox = screen.getByTestId('tournament-chess4-checkbox') as HTMLInputElement

    expect(select.disabled).toBe(false)
    expect(checkbox.disabled).toBe(false)
    expect(screen.queryByTestId('scoring-locked-hint')).toBeNull()
  })

  it('disables scoring controls and shows a hint once results are recorded', () => {
    mockExisting.value = {
      ...baseTournament,
      hasRecordedResults: true,
    } as unknown as TournamentDto

    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-point-system-select') as HTMLSelectElement
    const checkbox = screen.getByTestId('tournament-chess4-checkbox') as HTMLInputElement

    expect(select.disabled).toBe(true)
    expect(checkbox.disabled).toBe(true)
    expect(screen.getByTestId('scoring-locked-hint').textContent).toMatch(/poängsystem/i)
  })

  it('locks the Anpassad pointsPerGame input when results are recorded', () => {
    mockExisting.value = {
      ...baseTournament,
      chess4: false,
      pointsPerGame: 3,
      hasRecordedResults: true,
    } as unknown as TournamentDto

    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const ppg = screen.getByTestId('tournament-points-per-game-input') as HTMLInputElement
    expect(ppg.disabled).toBe(true)
  })
})

describe('TournamentDialog seeded lock', () => {
  const seeded = {
    ...baseTournament,
    roundsPlayed: 1,
    hasRecordedResults: false,
  } as unknown as TournamentDto

  it('locks pairing-system controls once round 1 has been paired', () => {
    mockExisting.value = seeded
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const pairingSystem = screen.getByTestId(
      'tournament-pairing-system-select',
    ) as HTMLSelectElement
    expect(pairingSystem.disabled).toBe(true)
  })

  it('locks initialPairing once round 1 has been paired', () => {
    mockExisting.value = seeded
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const initialPairing = screen.getByTestId(
      'tournament-initial-pairing-select',
    ) as HTMLSelectElement
    expect(initialPairing.disabled).toBe(true)
  })

  it('locks ratingChoice once round 1 has been paired', () => {
    mockExisting.value = seeded
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const ratingChoice = screen.getByTestId('tournament-rating-choice-select') as HTMLSelectElement
    expect(ratingChoice.disabled).toBe(true)
  })

  it('locks barredPairing once round 1 has been paired', () => {
    mockExisting.value = seeded
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const barred = screen.getByTestId('tournament-barred-pairing-checkbox') as HTMLInputElement
    expect(barred.disabled).toBe(true)
  })

  it('locks compensateWeakPlayerPP once round 1 has been paired', () => {
    mockExisting.value = seeded
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const compensate = screen.getByTestId('tournament-compensate-weak-checkbox') as HTMLInputElement
    expect(compensate.disabled).toBe(true)
  })

  it('disables tiebreak management once round 1 has been paired', () => {
    mockExisting.value = { ...seeded, selectedTiebreaks: ['Buchholz'] } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const tiebreakAvailable = screen.getByTestId(
      'tournament-tiebreak-available-list',
    ) as HTMLSelectElement
    expect(tiebreakAvailable.disabled).toBe(true)
  })

  it('constrains nrOfRounds min to roundsPlayed once paired', () => {
    mockExisting.value = { ...seeded, roundsPlayed: 3 } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const rounds = screen.getByTestId('tournament-nr-of-rounds-input') as HTMLInputElement
    expect(rounds.min).toBe('3')
  })

  it('leaves all settings editable in draft state', () => {
    mockExisting.value = {
      ...baseTournament,
      roundsPlayed: 0,
      hasRecordedResults: false,
    } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    expect(
      (screen.getByTestId('tournament-pairing-system-select') as HTMLSelectElement).disabled,
    ).toBe(false)
    expect(
      (screen.getByTestId('tournament-initial-pairing-select') as HTMLSelectElement).disabled,
    ).toBe(false)
    expect(
      (screen.getByTestId('tournament-barred-pairing-checkbox') as HTMLInputElement).disabled,
    ).toBe(false)
  })
})

describe('TournamentDialog overlay close', () => {
  it('closes when clicking overlay with empty form', () => {
    const onClose = vi.fn()
    render(<TournamentDialog open tournamentId={undefined} onClose={onClose} />)

    fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onClose).toHaveBeenCalled()
  })

  it('does not close when clicking overlay after name has been entered', () => {
    const onClose = vi.fn()
    render(<TournamentDialog open tournamentId={undefined} onClose={onClose} />)

    const nameInput = screen.getByTestId('tournament-name-input')
    fireEvent.change(nameInput, { target: { value: 'Test' } })

    fireEvent.click(screen.getByTestId('dialog-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('TournamentDialog unsaved settings', () => {
  // Any change to the form counts, not only name and group: a user who picks
  // a pairing system, rounds or rating choice and then clicks outside (or
  // presses Escape) must not silently lose those choices.
  it('given a new tournament with an empty name, when the pairing system is changed and the overlay is clicked, then the dialog stays open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TournamentDialog open tournamentId={undefined} onClose={onClose} />)

    await user.selectOptions(screen.getByTestId('tournament-pairing-system-select'), 'Berger')
    fireEvent.click(screen.getByTestId('dialog-overlay'))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('given a new tournament, when the number of rounds is changed and Escape is pressed, then the dialog stays open', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TournamentDialog open tournamentId={undefined} onClose={onClose} />)

    await user.clear(screen.getByTestId('tournament-nr-of-rounds-input'))
    await user.type(screen.getByTestId('tournament-nr-of-rounds-input'), '5')
    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
  })

  it('given a new tournament, when a setting is changed and changed back, then clicking the overlay closes it', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<TournamentDialog open tournamentId={undefined} onClose={onClose} />)
    const select = screen.getByTestId('tournament-pairing-system-select') as HTMLSelectElement
    const original = select.value

    await user.selectOptions(select, 'Berger')
    await user.selectOptions(select, original)
    fireEvent.click(screen.getByTestId('dialog-overlay'))

    expect(onClose).toHaveBeenCalled()
  })
})

describe('TournamentDialog save errors', () => {
  const failWith = (message: string) =>
    mockMutate.mockImplementation((_data: unknown, options?: { onError?: (e: Error) => void }) => {
      Promise.resolve().then(() => options?.onError?.(new Error(message)))
    })

  it('shows the repository error inline when reducing rounds below paired rounds', async () => {
    const onClose = vi.fn()
    const message = 'Kan inte minska antal ronder under antalet redan lottade ronder.'
    failWith(message)
    mockExisting.value = {
      ...baseTournament,
      roundsPlayed: 3,
      hasRecordedResults: false,
    } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={onClose} />)

    fireEvent.change(screen.getByTestId('tournament-nr-of-rounds-input'), {
      target: { value: '2' },
    })
    fireEvent.click(screen.getByText('Spara'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('tournament-save-error').textContent).toBe(message)
    })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the error inline when creating a tournament fails', async () => {
    const onClose = vi.fn()
    const onCreated = vi.fn()
    failWith('Antal ronder måste vara minst 1.')
    render(
      <TournamentDialog open tournamentId={undefined} onClose={onClose} onCreated={onCreated} />,
    )

    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'T' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })
    fireEvent.click(screen.getByText('Spara'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('tournament-save-error').textContent).toBe(
        'Antal ronder måste vara minst 1.',
      )
    })
    expect(onClose).not.toHaveBeenCalled()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('falls back to the generic save-failed text when the error has no message', async () => {
    failWith('')
    mockExisting.value = { ...baseTournament } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Spara'))

    await vi.waitFor(() => {
      expect(screen.getByTestId('tournament-save-error').textContent).toBe(sv.common.saveFailed)
    })
  })

  it('clears a previous save error when the dialog is reopened', async () => {
    failWith('Något gick fel.')
    mockExisting.value = { ...baseTournament } as unknown as TournamentDto
    const { rerender } = render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    fireEvent.click(screen.getByText('Spara'))
    await vi.waitFor(() => {
      expect(screen.queryByTestId('tournament-save-error')).not.toBeNull()
    })

    rerender(<TournamentDialog open={false} tournamentId={1} onClose={vi.fn()} />)
    rerender(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    expect(screen.queryByTestId('tournament-save-error')).toBeNull()
  })

  it('disables Spara while a save is pending', () => {
    const pending = { ...mockMutation, isPending: true }
    mockMutationOverride.value = pending
    mockExisting.value = { ...baseTournament } as unknown as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    expect((screen.getByText('Spara') as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('TournamentDialog tiebreak labels', () => {
  it('given the tiebreak lists, when Prestationsrating is offered and chosen, then the option reads "Prestationsrating" but the saved id stays "Prestationsrating LASK"', () => {
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)
    fireEvent.change(screen.getByTestId('tournament-name-input'), { target: { value: 'T' } })
    fireEvent.change(screen.getByTestId('tournament-group-input'), { target: { value: 'A' } })

    const available = screen.getByTestId('tournament-tiebreak-available-list') as HTMLSelectElement
    const option = [...available.options].find((o) => o.value === 'Prestationsrating LASK')
    expect(option?.textContent).toBe('Prestationsrating')

    fireEvent.change(available, { target: { value: 'Prestationsrating LASK' } })
    fireEvent.doubleClick(available)
    const selected = screen.getByTestId('tournament-tiebreak-selected-list') as HTMLSelectElement
    expect([...selected.options].map((o) => [o.value, o.textContent])).toEqual([
      ['Prestationsrating LASK', 'Prestationsrating'],
    ])

    fireEvent.click(screen.getByText('Spara'))
    expect(mockMutate.mock.calls[0][0].selectedTiebreaks).toEqual(['Prestationsrating LASK'])
  })
})

describe('TournamentDialog rating choice', () => {
  // The dialog must save the internal code that getPlayerRating understands
  // (Java Lotta's enum names), not the Swedish label shown to the user.
  it.each([
    ['ELO', 'ELO'],
    ['Snabb-ELO', 'QUICK'],
    ['Blixt-ELO', 'BLITZ'],
    ['Snabb-ELO annars ELO', 'QUICK_THEN_ELO'],
    ['Blixt-ELO annars ELO', 'BLITZ_THEN_ELO'],
  ])('given a new tournament, when the arbiter picks "%s", then the tournament is saved with ratingChoice %s', async (label, code) => {
    const user = userEvent.setup()
    render(<TournamentDialog open tournamentId={undefined} onClose={vi.fn()} />)

    await user.type(screen.getByTestId('tournament-name-input'), 'Klubbkväll')
    await user.type(screen.getByTestId('tournament-group-input'), 'A')
    await user.selectOptions(
      screen.getByTestId('tournament-rating-choice-select'),
      screen.getByRole('option', { name: label }),
    )
    await user.click(screen.getByText('Spara'))

    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate.mock.calls[0][0]).toMatchObject({ ratingChoice: code })
  })

  it('given an existing tournament stored with BLITZ_THEN_ELO, when the dialog opens, then "Blixt-ELO annars ELO" is shown as selected', () => {
    mockExisting.value = { ...baseTournament, ratingChoice: 'BLITZ_THEN_ELO' } as TournamentDto
    render(<TournamentDialog open tournamentId={1} onClose={vi.fn()} />)

    const select = screen.getByTestId('tournament-rating-choice-select') as HTMLSelectElement
    expect(select.value).toBe('BLITZ_THEN_ELO')
    expect(select.selectedOptions[0].textContent).toBe('Blixt-ELO annars ELO')
  })
})
