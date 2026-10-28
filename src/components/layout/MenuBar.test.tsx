// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MenuBar } from './MenuBar'

const mockPairMutate = vi.fn()
const mockPair = { isPending: false }

vi.mock('../../hooks/useRounds', () => ({
  usePairNextRound: () => ({ mutate: mockPairMutate, isPending: mockPair.isPending }),
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
  mockPair.isPending = false
})

describe('MenuBar add group item', () => {
  it('fires onAddGroup when clicking "Lägg till grupp" under Turnering', () => {
    const onAddGroup = vi.fn()
    render(<MenuBar tournamentId={1} roundNr={undefined} onAddGroup={onAddGroup} />)

    openMenu('Turnering')
    fireEvent.click(screen.getByText('Lägg till grupp'))

    expect(onAddGroup).toHaveBeenCalled()
  })
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

describe('MenuBar check-updates item', () => {
  it('fires onCheckUpdates when clicking "Sök efter uppdateringar" under Hjälp', () => {
    const onCheckUpdates = vi.fn()
    render(<MenuBar tournamentId={undefined} roundNr={undefined} onCheckUpdates={onCheckUpdates} />)

    openMenu('Hjälp')
    fireEvent.click(screen.getByText('Sök efter uppdateringar'))

    expect(onCheckUpdates).toHaveBeenCalled()
  })

  it('disables "Sök efter uppdateringar" when no handler is provided', () => {
    renderMenuBar()

    openMenu('Hjälp')
    expect(screen.getByText('Sök efter uppdateringar').closest('button')!.disabled).toBe(true)
  })
})

describe('MenuBar pairing progress', () => {
  it('shows a progress dialog with an incrementing seconds counter while pairing is in flight', () => {
    vi.useFakeTimers()
    try {
      mockPair.isPending = true
      renderMenuBar({ tournamentId: 1 })

      expect(screen.getByText('Lottar...')).toBeTruthy()
      expect(screen.getByTestId('pair-progress-elapsed').textContent).toBe('(0 s)')

      act(() => {
        vi.advanceTimersByTime(3000)
      })
      expect(screen.getByTestId('pair-progress-elapsed').textContent).toBe('(3 s)')
    } finally {
      vi.useRealTimers()
    }
  })

  it('hides the dialog and resets the counter when pairing completes', () => {
    vi.useFakeTimers()
    try {
      mockPair.isPending = true
      const { rerender } = render(<MenuBar tournamentId={1} roundNr={undefined} />)

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByTestId('pair-progress-elapsed').textContent).toBe('(2 s)')

      mockPair.isPending = false
      rerender(<MenuBar tournamentId={1} roundNr={undefined} />)
      expect(screen.queryByText('Lottar...')).toBeNull()

      mockPair.isPending = true
      rerender(<MenuBar tournamentId={1} roundNr={undefined} />)
      expect(screen.getByTestId('pair-progress-elapsed').textContent).toBe('(0 s)')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('MenuBar publish and print dialogs', () => {
  it('opens pairing publish dialog from Lotta > Publicera...', () => {
    renderMenuBar({ tournamentId: 1, roundNr: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Publicera...'))

    expect(screen.getByTestId('publish-pairings')).toBeTruthy()
    expect(screen.getByTestId('publish-alphabetical')).toBeTruthy()
    expect(screen.queryByTestId('publish-standings')).toBeNull()
  })

  it('opens pairing print dialog from Lotta > Skriv ut...', () => {
    renderMenuBar({ tournamentId: 1, roundNr: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Skriv ut...'))

    expect(screen.getByTestId('print-pairings')).toBeTruthy()
    expect(screen.getByTestId('print-alphabetical')).toBeTruthy()
  })

  it('opens standings publish dialog from Ställning > Publicera...', () => {
    renderMenuBar({ tournamentId: 1, roundNr: 1 })

    openMenu('Ställning')
    fireEvent.click(screen.getByText('Publicera...'))

    expect(screen.getByTestId('publish-standings')).toBeTruthy()
    expect(screen.queryByTestId('publish-pairings')).toBeNull()
  })

  it('opens standings print dialog from Ställning > Skriv ut...', () => {
    renderMenuBar({ tournamentId: 1, roundNr: 1 })

    openMenu('Ställning')
    fireEvent.click(screen.getByText('Skriv ut...'))

    expect(screen.getByTestId('print-standings')).toBeTruthy()
  })

  it('disables Lotta dialog launchers when there is no round', () => {
    renderMenuBar({ tournamentId: 1 })

    openMenu('Lotta')

    const skrivUt = screen.getByText('Skriv ut...')
    const publicera = screen.getByText('Publicera...')
    expect((skrivUt as HTMLButtonElement).disabled).toBe(true)
    expect((publicera as HTMLButtonElement).disabled).toBe(true)
  })

  it('has no top-level Publicera button', () => {
    renderMenuBar({ tournamentId: 1, roundNr: 1 })

    const menuBar = screen.getByTestId('menu-bar')
    const topButtons = Array.from(menuBar.querySelectorAll(':scope > .menu-item > button'))
    const labels = topButtons.map((b) => b.textContent)
    expect(labels).not.toContain('Publicera')
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

  it('given a multi-line pairing error, when shown, then line breaks are preserved (white-space: pre-line)', () => {
    setupPairError('Lottning är inte möjlig!\nFör att lösa detta, ändra vilka spelare som deltar.')
    renderMenuBar({ tournamentId: 1 })

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))

    const p = screen.getByTestId('pair-error')
    expect(p.style.whiteSpace).toBe('pre-line')
    expect(p.textContent).toBe(
      'Lottning är inte möjlig!\nFör att lösa detta, ändra vilka spelare som deltar.',
    )
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

describe('MenuBar outside-tap dismissal', () => {
  it('closes the open dropdown when a pointerdown fires outside the menu bar', () => {
    renderMenuBar({ tournamentId: 1 })

    openMenu('Turnering')
    expect(screen.getByTestId('menu-dropdown')).toBeTruthy()

    const outside = document.createElement('div')
    document.body.appendChild(outside)
    fireEvent.pointerDown(outside)

    expect(screen.queryByTestId('menu-dropdown')).toBeNull()
  })
})

describe('MenuBar pairing success callback', () => {
  it('invokes onPaired when pairing succeeds', () => {
    let capturedOpts: { onSuccess?: () => void } = {}
    mockPairMutate.mockImplementation((_: unknown, opts: { onSuccess?: () => void }) => {
      capturedOpts = opts
    })
    const onPaired = vi.fn()
    render(<MenuBar tournamentId={1} roundNr={undefined} onPaired={onPaired} />)

    openMenu('Lotta')
    fireEvent.click(screen.getByText('Lotta nästa rond'))
    act(() => capturedOpts.onSuccess?.())

    expect(onPaired).toHaveBeenCalledTimes(1)
  })
})

describe('MenuBar Ångra lottning', () => {
  it('given a tournament with no paired round, when the Lotta menu is opened, then Ångra lottning is disabled with an explanation', async () => {
    const user = userEvent.setup()
    const onUnpair = vi.fn()
    render(<MenuBar tournamentId={1} roundNr={undefined} onUnpair={onUnpair} />)

    await user.click(screen.getByRole('button', { name: 'Lotta' }))
    const item = screen.getByRole('button', { name: 'Ångra lottning' }) as HTMLButtonElement

    expect(item.disabled).toBe(true)
    expect(item.title).toBe('Ingen rond är lottad')
    await user.click(item)
    expect(onUnpair).not.toHaveBeenCalled()
  })

  it('given round 1 is paired, when Ångra lottning is clicked, then onUnpair fires', async () => {
    const user = userEvent.setup()
    const onUnpair = vi.fn()
    render(<MenuBar tournamentId={1} roundNr={1} onUnpair={onUnpair} />)

    await user.click(screen.getByRole('button', { name: 'Lotta' }))
    const item = screen.getByRole('button', { name: 'Ångra lottning' }) as HTMLButtonElement

    expect(item.disabled).toBe(false)
    expect(item.title).toBe('')
    await user.click(item)
    expect(onUnpair).toHaveBeenCalledOnce()
  })
})

describe('MenuBar board actions follow the pairings selection', () => {
  async function openLotta(props: {
    canEditBoard: boolean
    canDeleteBoard: boolean
    onEditBoard?: () => void
    onDeleteBoard?: () => void
  }) {
    const user = userEvent.setup()
    render(<MenuBar tournamentId={1} roundNr={1} {...props} />)
    await user.click(screen.getByRole('button', { name: 'Lotta' }))
    return {
      user,
      edit: screen.getByRole('button', { name: 'Editera bord' }) as HTMLButtonElement,
      remove: screen.getByRole('button', { name: 'Ta bort bord' }) as HTMLButtonElement,
    }
  }

  it('given no board is selected, when the Lotta menu opens, then Editera bord and Ta bort bord are disabled with explanations', async () => {
    const onEditBoard = vi.fn()
    const onDeleteBoard = vi.fn()
    const { user, edit, remove } = await openLotta({
      canEditBoard: false,
      canDeleteBoard: false,
      onEditBoard,
      onDeleteBoard,
    })

    expect(edit.disabled).toBe(true)
    expect(edit.title).toBe('Markera ett bord i lottningen först')
    expect(remove.disabled).toBe(true)
    expect(remove.title).toBe('Markera ett eller flera bord i lottningen först')
    await user.click(edit)
    await user.click(remove)
    expect(onEditBoard).not.toHaveBeenCalled()
    expect(onDeleteBoard).not.toHaveBeenCalled()
  })

  it('given exactly one board is selected, when Editera bord and Ta bort bord are clicked, then both fire', async () => {
    const onEditBoard = vi.fn()
    const onDeleteBoard = vi.fn()
    const { user, edit } = await openLotta({
      canEditBoard: true,
      canDeleteBoard: true,
      onEditBoard,
      onDeleteBoard,
    })

    expect(edit.disabled).toBe(false)
    expect(edit.title).toBe('')
    await user.click(edit)
    expect(onEditBoard).toHaveBeenCalledOnce()

    await user.click(screen.getByRole('button', { name: 'Lotta' }))
    const remove = screen.getByRole('button', { name: 'Ta bort bord' }) as HTMLButtonElement
    expect(remove.disabled).toBe(false)
    expect(remove.title).toBe('')
    await user.click(remove)
    expect(onDeleteBoard).toHaveBeenCalledOnce()
  })

  it('given two boards are selected, when the Lotta menu opens, then only Ta bort bord is enabled and Editera bord asks for exactly one board', async () => {
    const onDeleteBoard = vi.fn()
    const { user, edit, remove } = await openLotta({
      canEditBoard: false,
      canDeleteBoard: true,
      onDeleteBoard,
    })

    expect(edit.disabled).toBe(true)
    expect(edit.title).toBe('Markera exakt ett bord')
    expect(remove.disabled).toBe(false)
    await user.click(remove)
    expect(onDeleteBoard).toHaveBeenCalledOnce()
  })
})

describe('MenuBar when connected to a host as a P2P client', () => {
  const CLIENT_TITLE = 'Inte tillgängligt när du är ansluten till en värd'
  const GATED: [menu: string, item: string][] = [
    ['Redigera', 'Ångra'],
    ['Redigera', 'Gör om'],
    ['Redigera', 'Historik...'],
    ['Lotta', 'Publicera...'],
    ['Ställning', 'Publicera...'],
    ['Spelare', 'Publicera spelarlista'],
    ['Spelare', 'Exportera turneringsspelare'],
    ['Spelare', 'Importera till spelarpool'],
    ['Spelare', 'Skapa testspelare'],
    ['Inställningar', 'Säkerhetskopiera databas'],
    ['Inställningar', 'Återställ databas'],
  ]
  const STILL_ENABLED: [menu: string, item: string][] = [
    ['Lotta', 'Lotta nästa rond'],
    ['Lotta', 'Skriv ut...'],
    ['Ställning', 'Skriv ut...'],
    ['Spelare', 'Turneringsspelare'],
    ['Spelare', 'Skriv ut spelarlista'],
    ['Inställningar', 'Byt till tidigare version…'],
  ]

  function renderClientMenu(isP2PClient: boolean) {
    render(
      <MenuBar
        tournamentId={1}
        roundNr={1}
        canUndo
        canRedo
        isP2PClient={isP2PClient}
        onRollback={vi.fn()}
      />,
    )
  }

  async function menuItem(menu: string, item: string) {
    const user = userEvent.setup()
    await user.click(within(screen.getByTestId('menu-bar')).getByRole('button', { name: menu }))
    const dropdown = screen.getByTestId('menu-dropdown')
    return within(dropdown).getByRole('button', { name: new RegExp(`^${escapeRe(item)}`) })
  }

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  it.each(
    GATED,
  )('given a P2P client, when %s is opened, then %s is disabled with an explanation', async (menu, item) => {
    renderClientMenu(true)
    const button = (await menuItem(menu, item)) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.title).toBe(CLIENT_TITLE)
  })

  it.each(
    STILL_ENABLED,
  )('given a P2P client, when %s is opened, then %s stays enabled', async (menu, item) => {
    renderClientMenu(true)
    const button = (await menuItem(menu, item)) as HTMLButtonElement
    expect(button.disabled).toBe(false)
  })

  it.each(
    GATED,
  )('given the host (not a client), when %s is opened, then %s is enabled', async (menu, item) => {
    renderClientMenu(false)
    const button = (await menuItem(menu, item)) as HTMLButtonElement
    expect(button.disabled).toBe(false)
    expect(button.title).toBe('')
  })
})
