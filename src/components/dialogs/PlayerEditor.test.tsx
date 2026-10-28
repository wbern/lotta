// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClubDto } from '../../types/api'
import { PlayerEditor } from './PlayerEditor'

const clubs: ClubDto[] = [
  { id: 1, name: 'SK Alfa', chess4Members: 0 },
  { id: 2, name: 'SK Beta', chess4Members: 0 },
]

type EditorProps = Partial<Parameters<typeof PlayerEditor>[0]>

function renderEditor(overrides: EditorProps = {}) {
  const onChange = overrides.onChange ?? vi.fn()
  return {
    onChange,
    ...render(
      <PlayerEditor
        player={overrides.player ?? {}}
        clubs={overrides.clubs ?? clubs}
        onChange={onChange}
        nameError={overrides.nameError}
        showTournamentFields={overrides.showTournamentFields}
        onAddClub={overrides.onAddClub}
        onRenameClub={overrides.onRenameClub}
        onDeleteClub={overrides.onDeleteClub}
        defaultWithdrawRound={overrides.defaultWithdrawRound}
      />,
    ),
  }
}

describe('PlayerEditor sub-tabs', () => {
  afterEach(() => cleanup())

  it('renders all three sub-tabs', () => {
    renderEditor()
    expect(screen.getByTestId('editor-tab-main')).toBeTruthy()
    expect(screen.getByTestId('editor-tab-fide')).toBeTruthy()
    expect(screen.getByTestId('editor-tab-other')).toBeTruthy()
  })

  it('always shows name and club fields regardless of active tab', () => {
    renderEditor()

    for (const tab of ['editor-tab-fide', 'editor-tab-other'] as const) {
      fireEvent.click(screen.getByTestId(tab))
      expect(screen.getByTestId('first-name-input')).toBeTruthy()
      expect(screen.getByTestId('last-name-input')).toBeTruthy()
    }
  })

  it('shows main tab fields and hides FIDE fields by default', () => {
    renderEditor()
    expect(screen.getByText('Titel')).toBeTruthy()
    expect(screen.getByText('Grupp')).toBeTruthy()
    expect(screen.queryByText('FIDE-information')).toBeNull()
    expect(screen.queryByText('Federation')).toBeNull()
  })

  it('shows FIDE fields when FIDE tab is clicked', () => {
    renderEditor()
    fireEvent.click(screen.getByTestId('editor-tab-fide'))
    expect(screen.getByText('FIDE-information')).toBeTruthy()
    expect(screen.queryByText('Titel')).toBeNull()
  })

  it('shows Federation, FIDE ID, and SSF ID on Övrigt tab', () => {
    renderEditor()
    fireEvent.click(screen.getByTestId('editor-tab-other'))
    expect(screen.getByText('Federation')).toBeTruthy()
    expect(screen.getByText('FIDE id')).toBeTruthy()
    expect(screen.getByText('SSF id')).toBeTruthy()
  })

  it('switches back to main tab', () => {
    renderEditor()
    fireEvent.click(screen.getByTestId('editor-tab-fide'))
    fireEvent.click(screen.getByTestId('editor-tab-main'))
    expect(screen.getByText('Titel')).toBeTruthy()
    expect(screen.queryByText('FIDE-information')).toBeNull()
  })

  it('shows name error on all tabs', () => {
    renderEditor({ nameError: 'Spelare måste ha förnamn eller efternamn' })
    for (const tab of ['editor-tab-fide', 'editor-tab-other'] as const) {
      fireEvent.click(screen.getByTestId(tab))
      expect(screen.getByTestId('name-error')).toBeTruthy()
    }
  })

  it('shows tournament settings on all tabs when showTournamentFields is true', () => {
    renderEditor({ showTournamentFields: true })
    for (const tab of ['editor-tab-fide', 'editor-tab-other'] as const) {
      fireEvent.click(screen.getByTestId(tab))
      expect(screen.getByText('Spelarinställningar i turneringen')).toBeTruthy()
    }
  })
})

describe('PlayerEditor withdrawn checkbox', () => {
  afterEach(() => cleanup())

  it('is unchecked when withdrawnFromRound is -1', () => {
    renderEditor({ player: { withdrawnFromRound: -1 }, showTournamentFields: true })
    expect((screen.getByTestId('withdrawn-checkbox') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByTestId('withdrawn-round-input')).toBeNull()
  })

  it('is unchecked when withdrawnFromRound is undefined', () => {
    renderEditor({ showTournamentFields: true })
    expect((screen.getByTestId('withdrawn-checkbox') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByTestId('withdrawn-round-input')).toBeNull()
  })

  it('is checked and shows round input when withdrawnFromRound >= 1', () => {
    renderEditor({ player: { withdrawnFromRound: 3 }, showTournamentFields: true })
    expect((screen.getByTestId('withdrawn-checkbox') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('withdrawn-round-input') as HTMLInputElement).value).toBe('3')
  })

  it('checking the checkbox sets withdrawnFromRound to 1', () => {
    const { onChange } = renderEditor({
      player: { withdrawnFromRound: -1 },
      showTournamentFields: true,
    })
    fireEvent.click(screen.getByTestId('withdrawn-checkbox'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ withdrawnFromRound: 1 }))
  })

  it('unchecking the checkbox resets withdrawnFromRound to -1', () => {
    const { onChange } = renderEditor({
      player: { withdrawnFromRound: 3 },
      showTournamentFields: true,
    })
    fireEvent.click(screen.getByTestId('withdrawn-checkbox'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ withdrawnFromRound: -1 }))
  })

  it('changing the round input updates withdrawnFromRound', () => {
    const { onChange } = renderEditor({
      player: { withdrawnFromRound: 3 },
      showTournamentFields: true,
    })
    fireEvent.change(screen.getByTestId('withdrawn-round-input'), { target: { value: '5' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ withdrawnFromRound: 5 }))
  })
})

describe('PlayerEditor manual tiebreak checkbox', () => {
  afterEach(() => cleanup())

  it('is unchecked when manualTiebreak is 0', () => {
    renderEditor({ player: { manualTiebreak: 0 }, showTournamentFields: true })
    expect((screen.getByTestId('tiebreak-checkbox') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByTestId('tiebreak-value-input')).toBeNull()
  })

  it('is unchecked when manualTiebreak is undefined', () => {
    renderEditor({ showTournamentFields: true })
    expect((screen.getByTestId('tiebreak-checkbox') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByTestId('tiebreak-value-input')).toBeNull()
  })

  it('is checked and shows value input when manualTiebreak is non-zero', () => {
    renderEditor({ player: { manualTiebreak: 5 }, showTournamentFields: true })
    expect((screen.getByTestId('tiebreak-checkbox') as HTMLInputElement).checked).toBe(true)
    expect((screen.getByTestId('tiebreak-value-input') as HTMLInputElement).value).toBe('5')
  })

  it('checking the checkbox sets manualTiebreak to 1', () => {
    const { onChange } = renderEditor({
      player: { manualTiebreak: 0 },
      showTournamentFields: true,
    })
    fireEvent.click(screen.getByTestId('tiebreak-checkbox'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ manualTiebreak: 1 }))
  })

  it('unchecking the checkbox resets manualTiebreak to 0', () => {
    const { onChange } = renderEditor({
      player: { manualTiebreak: 5 },
      showTournamentFields: true,
    })
    fireEvent.click(screen.getByTestId('tiebreak-checkbox'))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ manualTiebreak: 0 }))
  })

  it('changing the value input updates manualTiebreak', () => {
    const { onChange } = renderEditor({
      player: { manualTiebreak: 5 },
      showTournamentFields: true,
    })
    fireEvent.change(screen.getByTestId('tiebreak-value-input'), { target: { value: '10' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ manualTiebreak: 10 }))
  })
})

describe('PlayerEditor club auto-select', () => {
  let promptSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    promptSpy = vi.spyOn(window, 'prompt')
  })

  afterEach(() => {
    cleanup()
    promptSpy.mockRestore()
  })

  it('does not auto-select newly added club when a club is already selected', async () => {
    const onAddClub = vi.fn().mockResolvedValue(3)
    promptSpy.mockReturnValue('SK Gamma')
    const { onChange } = renderEditor({ player: { clubIndex: 1 }, onAddClub })

    fireEvent.click(screen.getByText('Lägg till'))
    await waitFor(() => expect(onAddClub).toHaveBeenCalledWith('SK Gamma'))
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ clubIndex: 3 }))
  })

  it('displays name error when provided', () => {
    renderEditor({ nameError: 'Spelare måste ha förnamn eller efternamn' })
    expect(screen.getByTestId('name-error').textContent).toBe(
      'Spelare måste ha förnamn eller efternamn',
    )
  })

  it('does not display name error when not provided', () => {
    renderEditor()
    expect(screen.queryByTestId('name-error')).toBeNull()
  })

  it('auto-selects newly added club when no club was selected', async () => {
    const onAddClub = vi.fn().mockResolvedValue(3)
    promptSpy.mockReturnValue('SK Gamma')
    const { onChange } = renderEditor({ player: { clubIndex: 0 }, onAddClub })

    fireEvent.click(screen.getByText('Lägg till'))
    await waitFor(() => {
      expect(onAddClub).toHaveBeenCalledWith('SK Gamma')
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clubIndex: 3 }))
    })
  })
})

describe('PlayerEditor delete club', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
  })

  afterEach(() => {
    confirmSpy.mockRestore()
    cleanup()
  })

  it('given the club delete is refused, when Ta bort is confirmed, then the player keeps their club', async () => {
    const user = userEvent.setup()
    const onDeleteClub = vi.fn().mockResolvedValue(false)
    const { onChange } = renderEditor({
      player: { firstName: 'Anna', lastName: 'Berg', clubIndex: 1 },
      onAddClub: vi.fn(),
      onDeleteClub,
    })

    await user.click(screen.getByTestId('club-delete'))

    expect(onDeleteClub).toHaveBeenCalledWith(1)
    expect(onChange).not.toHaveBeenCalledWith(expect.objectContaining({ clubIndex: 0 }))
  })

  it('given the club delete succeeds, when Ta bort is confirmed, then the player club is cleared', async () => {
    const user = userEvent.setup()
    const onDeleteClub = vi.fn().mockResolvedValue(true)
    const { onChange } = renderEditor({
      player: { firstName: 'Anna', lastName: 'Berg', clubIndex: 1 },
      onAddClub: vi.fn(),
      onDeleteClub,
    })

    await user.click(screen.getByTestId('club-delete'))

    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ clubIndex: 0 })),
    )
  })

  it('given the delete is cancelled in the confirm, when Ta bort is clicked, then nothing is deleted', async () => {
    confirmSpy.mockReturnValue(false)
    const user = userEvent.setup()
    const onDeleteClub = vi.fn().mockResolvedValue(true)
    const { onChange } = renderEditor({
      player: { firstName: 'Anna', lastName: 'Berg', clubIndex: 1 },
      onAddClub: vi.fn(),
      onDeleteClub,
    })

    await user.click(screen.getByTestId('club-delete'))

    expect(onDeleteClub).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('PlayerEditor withdrawal default', () => {
  afterEach(() => cleanup())

  // "Utgå från rond N" means the player is not paired from round N on, so the
  // safe default is the next round to be paired; round 1 would erase every game.
  it('given the next round to pair is 4, when the arbiter ticks "Utgå från rond", then withdrawnFromRound is 4', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor({ showTournamentFields: true, defaultWithdrawRound: 4 })

    await user.click(screen.getByTestId('withdrawn-checkbox'))

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ withdrawnFromRound: 4 }))
  })

  it('given no tournament context, when the arbiter ticks "Utgå från rond", then withdrawnFromRound defaults to 1', async () => {
    const user = userEvent.setup()
    const { onChange } = renderEditor({ showTournamentFields: true })

    await user.click(screen.getByTestId('withdrawn-checkbox'))

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ withdrawnFromRound: 1 }))
  })
})
