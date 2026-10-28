// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLiveStatus } from '../../hooks/useLiveStatus'
import { ToastProvider } from '../toast/ToastProvider'
import { AppLayout } from './AppLayout'

// Track props passed to TabPanel
let tabPanelProps: Record<string, unknown> = {}

vi.mock('./TabPanel', () => ({
  TabPanel: (props: Record<string, unknown>) => {
    tabPanelProps = props
    return <div data-testid="tab-panel" />
  },
}))

let menuBarProps: Record<string, unknown> = {}
vi.mock('./MenuBar', () => ({
  MenuBar: (props: Record<string, unknown>) => {
    menuBarProps = props
    return <div data-testid="menu-bar" />
  },
}))

vi.mock('./TournamentSelector', () => ({
  TournamentSelector: () => <div data-testid="tournament-selector" />,
}))

vi.mock('./StatusBar', () => ({
  StatusBar: () => <div data-testid="status-bar" />,
}))

// Mock all dialogs to avoid deep dependency chains
vi.mock('../dialogs/TournamentDialog', () => ({ TournamentDialog: () => null }))
vi.mock('../dialogs/SettingsDialog', () => ({ SettingsDialog: () => null }))
vi.mock('../dialogs/PlayerPoolDialog', () => ({ PlayerPoolDialog: () => null }))
vi.mock('../dialogs/TournamentPlayersDialog', () => ({ TournamentPlayersDialog: () => null }))
const confirmDialogProps: Record<string, unknown>[] = []
vi.mock('../dialogs/ConfirmDialog', () => ({
  ConfirmDialog: (props: Record<string, unknown>) => {
    confirmDialogProps.push(props)
    return null
  },
}))
let editBoardDialogProps: Record<string, unknown> = {}
vi.mock('../dialogs/EditBoardDialog', () => ({
  EditBoardDialog: (props: Record<string, unknown>) => {
    editBoardDialogProps = props
    return null
  },
}))
let backupExportDialogProps: Record<string, unknown> = {}
vi.mock('../dialogs/BackupExportDialog', () => ({
  BackupExportDialog: (props: Record<string, unknown>) => {
    backupExportDialogProps = props
    return null
  },
}))
let backupRestoreDialogProps: Record<string, unknown> = {}
vi.mock('../dialogs/BackupRestoreDialog', () => ({
  BackupRestoreDialog: (props: Record<string, unknown>) => {
    backupRestoreDialogProps = props
    return null
  },
}))
vi.mock('../dialogs/SeedPlayersDialog', () => ({ SeedPlayersDialog: () => null }))
vi.mock('../dialogs/RollbackDialog', () => ({ RollbackDialog: () => null }))

// Mock router
const mockSearch: { tournamentId?: number; round?: number; tab?: string } = {
  tournamentId: 1,
}
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useSearch: () => mockSearch,
  useNavigate: () => mockNavigate,
  Outlet: () => null,
}))

const DEFAULT_TOURNAMENT: Record<string, unknown> = { id: 1, name: 'Test' }
let currentTournament: Record<string, unknown> = { ...DEFAULT_TOURNAMENT }
vi.mock('../../hooks/useTournaments', () => ({
  useTournaments: () => ({ data: [currentTournament] }),
  useTournament: () => ({ data: currentTournament }),
  useDeleteTournament: () => ({ mutate: vi.fn() }),
}))

// Games returned for the active round (same query PairingsTab uses).
let activeRoundBoardNrs = [1, 2, 3]
vi.mock('../../hooks/useRounds', () => ({
  useRounds: () => ({
    data: [{ roundNr: 1 }, { roundNr: 2 }, { roundNr: 3 }],
  }),
  useRound: () => ({ data: { games: activeRoundBoardNrs.map((boardNr) => ({ boardNr })) } }),
  useUnpairLastRound: () => ({ mutate: vi.fn() }),
}))

vi.mock('../../hooks/useSettings', () => ({
  useSettings: () => ({ data: {} }),
}))

const mockExportTournamentPlayers = vi.fn()
vi.mock('../../api/tournaments', () => ({
  exportTournamentPlayers: (...args: unknown[]) => mockExportTournamentPlayers(...args),
  importPlayers: vi.fn(),
}))

vi.mock('../../api/backup', () => ({
  downloadBackup: vi.fn(),
  downloadEncryptedBackup: vi.fn(),
  downloadLegacyBackup: vi.fn(),
  restoreBackup: vi.fn(),
  EncryptedBackupError: class extends Error {},
}))

const mockDeleteGame = vi.fn()
const mockDeleteGames = vi.fn()
vi.mock('../../api/results', () => ({
  deleteGame: (...args: unknown[]) => mockDeleteGame(...args),
  deleteGames: (...args: unknown[]) => mockDeleteGames(...args),
}))

const mockPublishFile = vi.fn()
vi.mock('../../api/publish', () => ({
  publishHtml: vi.fn(),
  publishFile: (...args: unknown[]) => mockPublishFile(...args),
}))

const mockDownloadBlob = vi.fn()
vi.mock('../../lib/download-file', () => ({
  downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
}))

vi.mock('../../hooks/useUndo', () => ({
  useUndoState: () => ({ canUndo: false, canRedo: false, undoLabel: null, redoLabel: null }),
  useUndoActions: () => ({
    performUndo: vi.fn(),
    performRedo: vi.fn(),
    restoreToPoint: vi.fn(),
  }),
  useTimeline: () => ({ timeline: [], currentSnapshotIndex: -1 }),
}))

vi.mock('../../hooks/useKeyboardShortcuts', () => ({
  useKeyboardShortcuts: vi.fn(),
}))

afterEach(() => {
  cleanup()
  mockNavigate.mockClear()
  // Reset search params
  mockSearch.round = undefined
  mockSearch.tab = undefined
  mockSearch.tournamentId = 1
  // Reset tournament fixture (fresh object each test, no shared mutable state)
  currentTournament = { ...DEFAULT_TOURNAMENT }
  confirmDialogProps.length = 0
  activeRoundBoardNrs = [1, 2, 3]
  editBoardDialogProps = {}
  backupRestoreDialogProps = {}
  backupExportDialogProps = {}
  mockPublishFile.mockReset()
  mockDownloadBlob.mockReset()
  mockExportTournamentPlayers.mockReset()
  mockDeleteGame.mockReset()
  mockDeleteGames.mockReset()
  vi.restoreAllMocks()
})

describe('AppLayout round prop', () => {
  it('passes latest round to TabPanel when no round URL param is set', () => {
    // No ?round= in URL — currentRound is undefined
    mockSearch.round = undefined
    mockSearch.tournamentId = 1

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    // activeRound should fall back to latest round (3)
    expect(tabPanelProps.round).toBe(3)
  })

  it('passes explicit round to TabPanel when round URL param is set', () => {
    mockSearch.round = 2
    mockSearch.tournamentId = 1

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    expect(tabPanelProps.round).toBe(2)
  })
})

describe('AppLayout pairing focus', () => {
  it('given a successful pairing, then it shows the paired round on the pairings tab', () => {
    mockSearch.tournamentId = 1
    mockSearch.round = 2
    mockSearch.tab = 'standings'

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    const onPaired = menuBarProps.onPaired as (roundNr: number) => void
    expect(onPaired).toBeDefined()
    act(() => {
      onPaired(1)
    })

    // Berger pairs all rounds at once and returns round 1: show that round,
    // not the latest one.
    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/',
      search: { tournamentId: 1, round: 1, tab: 'pairings' },
    })
  })
})

describe('AppLayout delete tournament gate', () => {
  const findDeleteDialog = () =>
    confirmDialogProps.find((p) => p.open === true && p.title === 'Radera turnering')

  it('requires typed name confirmation when tournament is past draft', () => {
    mockSearch.tournamentId = 1
    currentTournament = {
      id: 1,
      name: 'Skol-DM 2026',
      group: 'A',
      roundsPlayed: 1,
      hasRecordedResults: false,
      nrOfRounds: 7,
    }

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    const onDelete = menuBarProps.onDeleteTournament as () => void
    act(() => {
      onDelete()
    })

    const deleteDialog = findDeleteDialog()
    expect(deleteDialog).toBeDefined()
    expect(deleteDialog?.confirmText).toBe('Skol-DM 2026 A')
  })

  it('does not require typed confirmation for draft tournaments', () => {
    mockSearch.tournamentId = 1
    currentTournament = {
      id: 1,
      name: 'Skol-DM 2026',
      group: 'A',
      roundsPlayed: 0,
      hasRecordedResults: false,
      nrOfRounds: 7,
    }

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    const onDelete = menuBarProps.onDeleteTournament as () => void
    act(() => {
      onDelete()
    })

    const deleteDialog = findDeleteDialog()
    expect(deleteDialog).toBeDefined()
    expect(deleteDialog?.confirmText).toBeUndefined()
  })
})

describe('AppLayout action errors', () => {
  it('surfaces the unsupported-browser update check via an error toast', async () => {
    mockSearch.tournamentId = 1
    const swDescriptor = Object.getOwnPropertyDescriptor(navigator, 'serviceWorker')
    // jsdom defines navigator.serviceWorker, so deleting it makes the
    // `'serviceWorker' in navigator` guard fall into the unsupported branch.
    delete (navigator as { serviceWorker?: unknown }).serviceWorker

    try {
      render(
        <ToastProvider>
          <AppLayout />
        </ToastProvider>,
      )

      const onCheckUpdates = menuBarProps.onCheckUpdates as () => Promise<void>
      await act(async () => {
        await onCheckUpdates()
      })

      const toast = await waitFor(() => screen.getByTestId('toast'))
      expect(toast.className).toContain('toast--error')
      expect(toast.textContent).toContain('stöder inte uppdateringar')
    } finally {
      if (swDescriptor) {
        Object.defineProperty(navigator, 'serviceWorker', swDescriptor)
      }
    }
  })

  it('surfaces import success via the global success toast', async () => {
    mockSearch.tournamentId = 1
    const { importPlayers: mockImportPlayers } = await import('../../api/tournaments')
    vi.mocked(mockImportPlayers).mockResolvedValue({ imported: 7, duplicates: 0, unreadable: 0 })

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    const importInput = document.querySelector(
      'input[type="file"][accept*=".tsv"], input[type="file"][accept*="text/tab-separated-values"]',
    ) as HTMLInputElement | null
    const fileInput =
      importInput ?? (document.querySelectorAll('input[type="file"]')[0] as HTMLInputElement)
    const file = new File(['x'], 'players.tsv', { type: 'text/tab-separated-values' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const toast = await waitFor(() => screen.getByTestId('toast'))
    expect(toast.className).toContain('toast--success')
    expect(toast.textContent).toContain('7')
  })

  const runImport = async () => {
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )
    const fileInput = document.querySelector(
      'input[type="file"][accept*=".tsv"]',
    ) as HTMLInputElement
    const file = new File(['x'], 'players.tsv', { type: 'text/tab-separated-values' })
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })
    return waitFor(() => screen.getByTestId('toast'))
  }

  it('warns when some import lines could not be read', async () => {
    mockSearch.tournamentId = 1
    const { importPlayers: mockImportPlayers } = await import('../../api/tournaments')
    vi.mocked(mockImportPlayers).mockResolvedValue({ imported: 2, duplicates: 1, unreadable: 3 })

    const toast = await runImport()

    expect(toast.className).toContain('toast--warning')
    expect(toast.textContent).toContain('2 nya spelare tillagda som tillgängliga spelare.')
    expect(toast.textContent).toContain('1 dubblett hoppades över.')
    expect(toast.textContent).toContain('3 rader kunde inte läsas.')
  })

  it('reports duplicates-only imports as info', async () => {
    mockSearch.tournamentId = 1
    const { importPlayers: mockImportPlayers } = await import('../../api/tournaments')
    vi.mocked(mockImportPlayers).mockResolvedValue({ imported: 0, duplicates: 4, unreadable: 0 })

    const toast = await runImport()

    expect(toast.className).toContain('toast--info')
    expect(toast.textContent).toContain('Inga nya spelare tillagda. 4 dubbletter hoppades över.')
  })

  it('shows the format error when nothing in the file could be read', async () => {
    mockSearch.tournamentId = 1
    const { importPlayers: mockImportPlayers } = await import('../../api/tournaments')
    vi.mocked(mockImportPlayers).mockRejectedValue(
      new Error('Inga spelare kunde läsas. Filen måste vara tabbseparerad.'),
    )

    const toast = await runImport()

    expect(toast.className).toContain('toast--error')
    expect(toast.textContent).toContain('Fel vid import: Inga spelare kunde läsas.')
  })

  it('surfaces export failure via the global error toast', async () => {
    mockSearch.tournamentId = 1
    mockExportTournamentPlayers.mockRejectedValue(new Error('disk full'))

    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    const onExportPlayers = menuBarProps.onExportPlayers as () => Promise<void>
    await act(async () => {
      await onExportPlayers()
    })

    const toast = await waitFor(() => screen.getByTestId('toast'))
    expect(toast.className).toContain('toast--error')
    expect(toast.textContent).toContain('Exportfel')
    expect(toast.textContent).toContain('disk full')
  })
})

describe('AppLayout alphabetical print options', () => {
  it('defers window.print so the options state commits before the snapshot', () => {
    mockSearch.tournamentId = 1
    mockSearch.tab = 'alphabetical'
    const printSpy = vi.fn()
    const originalPrint = window.print
    window.print = printSpy
    vi.useFakeTimers()

    try {
      render(
        <ToastProvider>
          <AppLayout />
        </ToastProvider>,
      )

      const onPrint = menuBarProps.onPrint as (what: string) => void
      act(() => {
        onPrint('alphabetical?groupByClass=0&compact=1')
      })

      // Must NOT print synchronously — React state would not be committed yet,
      // and the preview would reflect the previous run's options.
      expect(printSpy).not.toHaveBeenCalled()

      act(() => {
        vi.runAllTimers()
      })
      expect(printSpy).toHaveBeenCalledTimes(1)
      expect(tabPanelProps.alphaPrintGroupByClass).toBe(false)
      expect(tabPanelProps.alphaPrintCompact).toBe(true)
    } finally {
      vi.useRealTimers()
      window.print = originalPrint
    }
  })
})

describe('AppLayout Ångra lottning confirmation text', () => {
  const findUnpairDialog = () =>
    confirmDialogProps.findLast((p) => p.open === true && p.title === 'Ångra lottning')

  function openUnpairConfirm() {
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )
    const onUnpair = menuBarProps.onUnpair as () => void
    act(() => {
      onUnpair()
    })
    return findUnpairDialog()
  }

  it('given a Berger tournament, when Ångra lottning is chosen, then the confirmation warns that all paired rounds are removed', () => {
    currentTournament = { id: 1, name: 'Allsvenskan', pairingSystem: 'Berger', roundsPlayed: 3 }

    const dialog = openUnpairConfirm()

    expect(dialog).toBeDefined()
    expect(dialog?.message).toContain('alla lottade ronder')
    expect(dialog?.message).not.toContain('senaste ronden')
  })

  it('given a Monrad tournament, when Ångra lottning is chosen, then the confirmation mentions only the latest round', () => {
    currentTournament = { id: 1, name: 'Höstblixten', pairingSystem: 'Monrad', roundsPlayed: 3 }

    const dialog = openUnpairConfirm()

    expect(dialog).toBeDefined()
    expect(dialog?.message).toContain('senaste ronden')
    expect(dialog?.message).not.toContain('alla lottade ronder')
  })
})

describe('AppLayout board selection (single source of truth)', () => {
  type Updater = (prev: Set<number>) => Set<number>

  function renderLayout() {
    const view = render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )
    const rerender = () =>
      view.rerender(
        <ToastProvider>
          <AppLayout />
        </ToastProvider>,
      )
    return { rerender }
  }

  function selectBoards(...boardNrs: number[]) {
    const change = tabPanelProps.onSelectedBoardsChange as (updater: Updater) => void
    act(() => {
      change(() => new Set(boardNrs))
    })
  }

  const selected = () => [...(tabPanelProps.selectedBoards as Set<number>)].sort()

  it('given board 2 is selected in round 1, when the round selector switches to round 2, then the selection is empty and Editera bord is unavailable', () => {
    mockSearch.round = 1
    const { rerender } = renderLayout()
    selectBoards(2)
    expect(menuBarProps.canEditBoard).toBe(true)

    mockSearch.round = 2
    rerender()

    expect(selected()).toEqual([])
    expect(menuBarProps.canEditBoard).toBe(false)
    expect(menuBarProps.canDeleteBoard).toBe(false)
  })

  it('given board 2 is selected, when board 2 disappears from the round (undo/other client), then Ta bort bord is unavailable', () => {
    mockSearch.round = 1
    const { rerender } = renderLayout()
    selectBoards(2)
    expect(menuBarProps.canDeleteBoard).toBe(true)

    activeRoundBoardNrs = [1, 3]
    rerender()

    expect(selected()).toEqual([])
    expect(menuBarProps.canDeleteBoard).toBe(false)
  })

  it('given board 2 is selected, when another tournament with the same round is chosen, then the selection does not carry over', () => {
    mockSearch.round = 1
    const { rerender } = renderLayout()
    selectBoards(2)

    mockSearch.tournamentId = 2
    rerender()

    expect(selected()).toEqual([])
    expect(menuBarProps.canEditBoard).toBe(false)
  })

  it('given boards 1 and 2 are selected, when Ta bort bord is confirmed, then both boards are deleted and the selection cleared', async () => {
    mockSearch.round = 1
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteGames.mockResolvedValue(undefined)
    renderLayout()
    selectBoards(1, 2)

    expect(menuBarProps.canEditBoard).toBe(false)
    expect(menuBarProps.canDeleteBoard).toBe(true)

    await act(async () => {
      await (menuBarProps.onDeleteBoard as () => Promise<void>)()
    })

    expect(confirmSpy).toHaveBeenCalledWith(
      'Är du säker på att du vill ta bort bord 1 och 2 i rond 1?',
    )
    expect(mockDeleteGames).toHaveBeenCalledWith(1, 1, [1, 2])
    expect(mockDeleteGame).not.toHaveBeenCalled()
    expect(selected()).toEqual([])
  })

  it('given boards 1 and 2 are selected, when Delete is pressed in the pairings, then the same delete runs', async () => {
    mockSearch.round = 1
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteGames.mockResolvedValue(undefined)
    renderLayout()
    selectBoards(1, 2)

    await act(async () => {
      await (tabPanelProps.onDeleteSelected as () => Promise<void>)()
    })

    expect(mockDeleteGames).toHaveBeenCalledWith(1, 1, [1, 2])
  })

  it('given one board is selected, when Ta bort bord is confirmed, then that board is deleted', async () => {
    mockSearch.round = 1
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteGame.mockResolvedValue(undefined)
    renderLayout()
    selectBoards(3)

    await act(async () => {
      await (menuBarProps.onDeleteBoard as () => Promise<void>)()
    })

    expect(confirmSpy).toHaveBeenCalledWith('Är du säker på att du vill ta bort bord 3 i rond 1?')
    expect(mockDeleteGame).toHaveBeenCalledWith(1, 1, 3)
  })

  it('given the delete is cancelled in the confirm, when Ta bort bord is chosen, then nothing is deleted and the selection stays', async () => {
    mockSearch.round = 1
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderLayout()
    selectBoards(1, 2)

    await act(async () => {
      await (menuBarProps.onDeleteBoard as () => Promise<void>)()
    })

    expect(mockDeleteGames).not.toHaveBeenCalled()
    expect(selected()).toEqual([1, 2])
  })

  it('given deleting boards is rejected, when Ta bort bord is confirmed, then an error toast shows the reason', async () => {
    mockSearch.round = 1
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteGames.mockRejectedValue(new Error('Borden kunde inte tas bort.'))
    renderLayout()
    selectBoards(1, 2)

    await act(async () => {
      await (menuBarProps.onDeleteBoard as () => Promise<void>)()
    })

    const toast = await screen.findByTestId('toast')
    expect(toast.textContent).toContain('Borden kunde inte tas bort.')
    expect(toast.className).toContain('toast--error')
  })

  it('given exactly one board is selected, when Editera bord is chosen, then the board editor opens for that board', () => {
    mockSearch.round = 1
    renderLayout()
    selectBoards(2)

    act(() => {
      ;(menuBarProps.onEditBoard as () => void)()
    })

    expect(editBoardDialogProps.open).toBe(true)
    expect(editBoardDialogProps.mode).toBe('edit')
    expect(editBoardDialogProps.boardNr).toBe(2)
  })

  it('given round 2 exists, when every board of round 1 is deleted, then the refusal is shown as an error toast', async () => {
    const GAP_MESSAGE =
      'Det går inte att ta bort det sista bordet i rond 1 eftersom senare ronder finns. Ångra lottningen av de senare ronderna först.'
    mockSearch.round = 1
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDeleteGames.mockRejectedValue(new Error(GAP_MESSAGE))
    renderLayout()
    selectBoards(1, 2, 3)

    await act(async () => {
      await (menuBarProps.onDeleteBoard as () => Promise<void>)()
    })

    const toast = await screen.findByTestId('toast')
    expect(toast.textContent).toContain(GAP_MESSAGE)
    // The refused boards stay selected so the arbiter can see what was not deleted.
    expect(selected()).toEqual([1, 2, 3])
  })
})

describe('AppLayout P2P client gating', () => {
  afterEach(() => {
    act(() => setLiveStatus(null))
  })

  it('given this device is connected to a host as a client, when the menu renders, then MenuBar is told it is a P2P client', () => {
    setLiveStatus({ state: 'connected', role: 'client', peerCount: 1 })
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    expect(menuBarProps.isP2PClient).toBe(true)
  })

  it.each([
    ['hosting', { state: 'connected' as const, role: 'host' as const, peerCount: 2 }],
    ['not live', null],
  ])('given this device is %s, when the menu renders, then MenuBar is not in client mode', (_label, status) => {
    setLiveStatus(status)
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

    expect(menuBarProps.isP2PClient).toBe(false)
  })
})

describe('AppLayout restore confirmation', () => {
  const RESTORE_MESSAGE =
    'Återställning ersätter ALLA turneringar, spelare och resultat i den här webbläsaren med innehållet i filen. Ta en säkerhetskopia först om du är osäker. Återställningen kan ångras via Redigera → Historik.'

  const latestRestoreDialog = () =>
    confirmDialogProps.findLast((p) => p.title === 'Återställ databas')

  function renderAndChooseRestore() {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )
    act(() => {
      ;(menuBarProps.onRestore as () => void)()
    })
    return clickSpy
  }

  it('given the arbiter chooses Återställ databas, when the menu action runs, then a warning opens and no file picker or restore happens yet', async () => {
    const { restoreBackup } = await import('../../api/backup')
    vi.mocked(restoreBackup).mockClear()
    const clickSpy = renderAndChooseRestore()

    const dialog = latestRestoreDialog()
    expect(dialog?.open).toBe(true)
    expect(dialog?.message).toBe(RESTORE_MESSAGE)
    expect(dialog?.confirmLabel).toBe('Välj fil…')
    expect(dialog?.cancelLabel).toBe('Avbryt')
    expect(clickSpy).not.toHaveBeenCalled()
    expect(restoreBackup).not.toHaveBeenCalled()
  })

  it('given the restore warning is open, when Avbryt is chosen, then the warning closes and no file picker opens', () => {
    const clickSpy = renderAndChooseRestore()

    act(() => {
      ;(latestRestoreDialog()?.onCancel as () => void)()
    })

    expect(latestRestoreDialog()?.open).toBe(false)
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('given the restore warning is open, when Välj fil… is chosen, then the warning closes and the file picker opens once, synchronously', () => {
    const clickSpy = renderAndChooseRestore()

    act(() => {
      ;(latestRestoreDialog()?.onConfirm as () => void)()
      // Safari only opens the picker inside the user gesture: no deferral allowed.
      expect(clickSpy).toHaveBeenCalledTimes(1)
    })

    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(latestRestoreDialog()?.open).toBe(false)
  })

  it('given an encrypted backup is picked, when the restore needs a password, then the password dialog opens', async () => {
    const backupApi = await import('../../api/backup')
    vi.mocked(backupApi.restoreBackup).mockRejectedValueOnce(new backupApi.EncryptedBackupError())
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )
    const fileInput = document.querySelector(
      'input[type="file"][accept*=".sqlite"]',
    ) as HTMLInputElement
    const file = new File(['x'], 'backup.sqlite.enc')
    Object.defineProperty(fileInput, 'files', { value: [file], configurable: true })

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(backupApi.restoreBackup).toHaveBeenCalledWith(file)
    expect(backupRestoreDialogProps.open).toBe(true)
  })
})

describe('AppLayout saved-file feedback', () => {
  const renderLayout = () =>
    render(
      <ToastProvider>
        <AppLayout />
      </ToastProvider>,
    )

  const toastTexts = () => screen.queryAllByTestId('toast').map((t) => t.textContent ?? '')

  it('given a tournament, when standings are published, then the page is downloaded under its descriptive name and a saved toast names the file', async () => {
    const blob = new Blob(['<html>'])
    mockPublishFile.mockResolvedValue({ blob, filename: 'test-stallning-rond-3.html' })
    renderLayout()

    await act(async () => {
      await (menuBarProps.onPublish as (what: string) => Promise<void>)('standings')
    })

    expect(mockPublishFile).toHaveBeenCalledWith(1, 'standings', 3)
    expect(mockDownloadBlob).toHaveBeenCalledWith(blob, 'test-stallning-rond-3.html')
    const toast = await screen.findByTestId('toast')
    expect(toast.className).toContain('toast--success')
    expect(toast.textContent).toContain('Fil sparad: test-stallning-rond-3.html')
  })

  it('given publishing fails, when a page is published, then nothing is downloaded and only the error toast shows', async () => {
    mockPublishFile.mockRejectedValue(new Error('No rounds available'))
    renderLayout()

    await act(async () => {
      await (menuBarProps.onPublish as (what: string) => Promise<void>)('pairings')
    })

    expect(mockDownloadBlob).not.toHaveBeenCalled()
    const toast = await screen.findByTestId('toast')
    expect(toast.className).toContain('toast--error')
    expect(toast.textContent).toContain('Publiceringsfel:')
    expect(toastTexts().some((t) => t.includes('Fil sparad'))).toBe(false)
  })

  it('given a tournament with a group, when players are exported, then the TSV is named after the tournament and a saved toast shows', async () => {
    currentTournament = { id: 1, name: 'Vårblixten', group: 'B' }
    const blob = new Blob(['tsv'])
    mockExportTournamentPlayers.mockResolvedValue(blob)
    renderLayout()

    await act(async () => {
      await (menuBarProps.onExportPlayers as () => Promise<void>)()
    })

    expect(mockDownloadBlob).toHaveBeenCalledWith(blob, 'varblixten-b-spelare.tsv')
    const toast = await screen.findByTestId('toast')
    expect(toast.className).toContain('toast--success')
    expect(toast.textContent).toContain('Fil sparad: varblixten-b-spelare.tsv')
  })

  it.each([
    [undefined, false, /^lotta-backup-\d{4}-\d{2}-\d{2}-\d{4}\.sqlite$/],
    [undefined, true, /^lotta-backup-gammal-\d{4}-\d{2}-\d{2}-\d{4}\.sqlite$/],
    ['hemligt', false, /^lotta-backup-\d{4}-\d{2}-\d{2}-\d{4}\.sqlite\.enc$/],
  ])('given password %s and legacy %s, when a backup is saved, then it is downloaded with a dated name and a saved toast shows', async (password, legacy, pattern) => {
    const backupApi = await import('../../api/backup')
    const blob = new Blob(['db'])
    vi.mocked(backupApi.downloadBackup).mockResolvedValue(blob)
    vi.mocked(backupApi.downloadLegacyBackup).mockResolvedValue(blob)
    vi.mocked(backupApi.downloadEncryptedBackup).mockResolvedValue(blob)
    renderLayout()

    await act(async () => {
      await (
        backupExportDialogProps.onExport as (
          pw: string | undefined,
          legacy: boolean,
        ) => Promise<void>
      )(password, legacy)
    })

    expect(mockDownloadBlob).toHaveBeenCalledTimes(1)
    const [downloaded, filename] = mockDownloadBlob.mock.calls[0] as [Blob, string]
    expect(downloaded).toBe(blob)
    expect(filename).toMatch(pattern)
    const toast = await screen.findByTestId('toast')
    expect(toast.className).toContain('toast--success')
    expect(toast.textContent).toContain(`Fil sparad: ${filename}`)
  })
})
