// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TournamentListItemDto } from '../../types/api'
import { AddGroupDialog } from './AddGroupDialog'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const tournaments: TournamentListItemDto[] = [
  {
    id: 1,
    name: 'Vårspelen 2026',
    group: 'Grupp A',
    pairingSystem: 'Monrad',
    nrOfRounds: 7,
    roundsPlayed: 0,
    playerCount: 0,
    finished: false,
  },
  {
    id: 2,
    name: 'Vårspelen 2026',
    group: 'Grupp B',
    pairingSystem: 'Monrad',
    nrOfRounds: 7,
    roundsPlayed: 0,
    playerCount: 0,
    finished: false,
  },
  {
    id: 3,
    name: 'Höstspelen 2026',
    group: 'Öppen',
    pairingSystem: 'Nordisk Schweizer',
    nrOfRounds: 9,
    roundsPlayed: 0,
    playerCount: 0,
    finished: false,
  },
]

describe('AddGroupDialog name dropdown', () => {
  it('preselects current tournament name', () => {
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={3}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const nameSelect = screen.getByTestId('add-group-name-select') as HTMLSelectElement
    expect(nameSelect.value).toBe('Höstspelen 2026')
  })

  it('lists each unique name once even when multiple groups share the name', () => {
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const nameSelect = screen.getByTestId('add-group-name-select') as HTMLSelectElement
    const optionValues = Array.from(nameSelect.options).map((o) => o.value)
    expect(optionValues).toEqual(['Höstspelen 2026', 'Vårspelen 2026'])
  })

  it('syncs preselect when open transitions from false to true', () => {
    // Simulates AppLayout keeping the dialog always mounted: first render is
    // open=false with no current tournament, then user selects a tournament
    // and opens the dialog. The confirm payload must reflect the newly selected
    // tournament, not the empty state captured at first mount.
    const onConfirm = vi.fn()
    const { rerender } = render(
      <AddGroupDialog
        open={false}
        tournaments={[]}
        currentTournamentId={undefined}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    rerender(
      <AddGroupDialog
        open={true}
        tournaments={tournaments}
        currentTournamentId={3}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByTestId('add-group-confirm'))

    expect(onConfirm).toHaveBeenCalledWith({
      name: 'Höstspelen 2026',
      presetFromId: undefined,
    })
  })
})

describe('AddGroupDialog preset source dropdown', () => {
  it('lists every tournament+group pair with a blank default option first', () => {
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const presetSelect = screen.getByTestId('add-group-preset-select') as HTMLSelectElement
    const options = Array.from(presetSelect.options)

    expect(options[0].value).toBe('')
    expect(options.slice(1).map((o) => ({ value: o.value, label: o.textContent }))).toEqual([
      { value: '3', label: 'Höstspelen 2026 / Öppen' },
      { value: '1', label: 'Vårspelen 2026 / Grupp A' },
      { value: '2', label: 'Vårspelen 2026 / Grupp B' },
    ])
  })

  it('defaults preset source to blank (standard defaults)', () => {
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    )

    const presetSelect = screen.getByTestId('add-group-preset-select') as HTMLSelectElement
    expect(presetSelect.value).toBe('')
  })
})

describe('AddGroupDialog confirm', () => {
  it('fires onConfirm with selected name and preset id when OK is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.change(screen.getByTestId('add-group-name-select'), {
      target: { value: 'Höstspelen 2026' },
    })
    fireEvent.change(screen.getByTestId('add-group-preset-select'), { target: { value: '2' } })
    fireEvent.click(screen.getByTestId('add-group-confirm'))

    expect(onConfirm).toHaveBeenCalledWith({ name: 'Höstspelen 2026', presetFromId: 2 })
  })

  it('passes undefined presetFromId when no preset is selected', () => {
    const onConfirm = vi.fn()
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByTestId('add-group-confirm'))

    expect(onConfirm).toHaveBeenCalledWith({ name: 'Vårspelen 2026', presetFromId: undefined })
  })

  it('fires onClose when Avbryt is clicked', () => {
    const onClose = vi.fn()
    render(
      <AddGroupDialog
        open
        tournaments={tournaments}
        currentTournamentId={1}
        onClose={onClose}
        onConfirm={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('Avbryt'))

    expect(onClose).toHaveBeenCalled()
  })
})
