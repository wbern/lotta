import { useEffect, useRef, useState } from 'react'
import { usePairNextRound } from '../../hooks/useRounds'
import { sv } from '../../lib/swedish-text'
import { Dialog } from '../dialogs/Dialog'
import { PrintDialog } from '../dialogs/PrintDialog'
import { PublishDialog } from '../dialogs/PublishDialog'
import { WhatsNewDialog } from '../dialogs/WhatsNewDialog'

interface Props {
  tournamentId: number | undefined
  roundNr: number | undefined
  chess4?: boolean
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onShowTimeline?: () => void
  onNewTournament?: () => void
  onEditTournament?: () => void
  onAddGroup?: () => void
  onDeleteTournament?: () => void
  onPlayerPool?: () => void
  onTournamentPlayers?: () => void
  onSettings?: () => void
  onBackup?: () => void
  onRestore?: () => void
  onAddBoard?: () => void
  onEditBoard?: () => void
  onDeleteBoard?: () => void
  /** Exactly one board is selected in the pairings table. */
  canEditBoard?: boolean
  /** At least one board is selected in the pairings table. */
  canDeleteBoard?: boolean
  /** Connected to a host as a P2P client (positive signal: liveStatus.role === 'client'). */
  isP2PClient?: boolean
  onPrint?: (what: string) => void
  onExportPlayers?: () => void
  onImportPlayers?: () => void
  onSeedPlayers?: () => void
  onPublish?: (what: string) => void
  onUnpair?: () => void
  onCheckUpdates?: () => void
  onRollback?: () => void
  /** Called with the round to show: the new round, or round 1 for Berger. */
  onPaired?: (roundNr: number) => void
}

export function MenuBar({
  tournamentId,
  roundNr,
  chess4,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onShowTimeline,
  onNewTournament,
  onEditTournament,
  onAddGroup,
  onDeleteTournament,
  onPlayerPool,
  onTournamentPlayers,
  onSettings,
  onBackup,
  onRestore,
  onAddBoard,
  onEditBoard,
  onDeleteBoard,
  canEditBoard = false,
  canDeleteBoard = false,
  isP2PClient = false,
  onPrint,
  onExportPlayers,
  onImportPlayers,
  onSeedPlayers,
  onPublish,
  onUnpair,
  onCheckUpdates,
  onRollback,
  onPaired,
}: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [showAbout, setShowAbout] = useState(false)
  const [showWhatsNew, setShowWhatsNew] = useState(false)
  const [showLottaPublish, setShowLottaPublish] = useState(false)
  const [showLottaPrint, setShowLottaPrint] = useState(false)
  const [showStandingsPublish, setShowStandingsPublish] = useState(false)
  const [showStandingsPrint, setShowStandingsPrint] = useState(false)
  const [pairError, setPairError] = useState('')
  const menuRef = useRef<HTMLDivElement>(null)
  const pairMutation = usePairNextRound(tournamentId)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  const toggleMenu = (name: string) => {
    setOpenMenu(openMenu === name ? null : name)
  }

  const action = (fn?: () => void) => {
    setOpenMenu(null)
    fn?.()
  }

  const hasTournament = tournamentId != null
  // Local-only actions (undo history, backup/restore, publish, import/export)
  // would act on this device's database, not the host's.
  const clientTitle = isP2PClient ? sv.disabledReason.p2pClient : undefined
  const hasRound = hasTournament && roundNr != null

  return (
    <div className="menu-bar" data-testid="menu-bar" ref={menuRef}>
      {/* 1. Turnering */}
      <div className="menu-item">
        <button onClick={() => toggleMenu('tournament')} aria-expanded={openMenu === 'tournament'}>
          Turnering
        </button>
        {openMenu === 'tournament' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button onClick={() => action(onNewTournament)}>Ny</button>
            <button onClick={() => action(onAddGroup)} disabled={!hasTournament}>
              Lägg till grupp
            </button>
            <button onClick={() => action(onEditTournament)} disabled={!hasTournament}>
              Editera
            </button>
            <div className="menu-separator" />
            <button onClick={() => action(onDeleteTournament)} disabled={!hasTournament}>
              Ta bort
            </button>
          </div>
        )}
      </div>

      {/* 2. Redigera */}
      <div className="menu-item">
        <button onClick={() => toggleMenu('edit')} aria-expanded={openMenu === 'edit'}>
          Redigera
        </button>
        {openMenu === 'edit' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button
              onClick={() => action(onUndo)}
              disabled={!canUndo || isP2PClient}
              title={clientTitle}
            >
              Ångra
              <span className="menu-shortcut">Ctrl+Z</span>
            </button>
            <button
              onClick={() => action(onRedo)}
              disabled={!canRedo || isP2PClient}
              title={clientTitle}
            >
              Gör om
              <span className="menu-shortcut">Ctrl+Y</span>
            </button>
            <div className="menu-separator" />
            <button
              onClick={() => action(onShowTimeline)}
              disabled={isP2PClient}
              title={clientTitle}
            >
              Historik...
            </button>
          </div>
        )}
      </div>

      {/* 3. Lotta */}
      <div className="menu-item">
        <button
          onClick={() => toggleMenu('pairing')}
          aria-expanded={openMenu === 'pairing'}
          disabled={!hasTournament}
        >
          Lotta
        </button>
        {openMenu === 'pairing' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button
              onClick={() =>
                action(() =>
                  pairMutation.mutate(undefined, {
                    onSuccess: (round) => {
                      setPairError('')
                      onPaired?.(round.roundNr)
                    },
                    onError: (err) => setPairError(err.message),
                  }),
                )
              }
              disabled={!hasTournament}
            >
              Lotta nästa rond
            </button>
            <div className="menu-separator" />
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowLottaPrint(true)
              }}
              disabled={!hasRound}
            >
              Skriv ut...
            </button>
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowLottaPublish(true)
              }}
              disabled={!hasRound || isP2PClient}
              title={clientTitle}
            >
              Publicera...
            </button>
            <div className="menu-separator" />
            <button
              onClick={() => action(onUnpair)}
              disabled={!hasRound}
              title={!hasRound ? sv.disabledReason.noRoundPaired : undefined}
            >
              Ångra lottning
            </button>
            <div className="menu-separator" />
            <button onClick={() => action(onAddBoard)} disabled={!hasRound}>
              Lägg till bord
            </button>
            <button
              onClick={() => action(onEditBoard)}
              disabled={!hasRound || !canEditBoard}
              title={
                !canDeleteBoard
                  ? sv.disabledReason.selectBoardFirst
                  : !canEditBoard
                    ? sv.disabledReason.selectExactlyOneBoard
                    : undefined
              }
            >
              Editera bord
            </button>
            <button
              onClick={() => action(onDeleteBoard)}
              disabled={!hasRound || !canDeleteBoard}
              title={!canDeleteBoard ? sv.disabledReason.selectBoardsFirst : undefined}
            >
              Ta bort bord
            </button>
          </div>
        )}
      </div>

      {/* 4. Ställning */}
      <div className="menu-item">
        <button
          onClick={() => toggleMenu('standings')}
          aria-expanded={openMenu === 'standings'}
          disabled={!hasTournament}
        >
          Ställning
        </button>
        {openMenu === 'standings' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowStandingsPrint(true)
              }}
            >
              Skriv ut...
            </button>
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowStandingsPublish(true)
              }}
              disabled={isP2PClient}
              title={clientTitle}
            >
              Publicera...
            </button>
          </div>
        )}
      </div>

      {/* 5. Spelare */}
      <div className="menu-item">
        <button onClick={() => toggleMenu('players')} aria-expanded={openMenu === 'players'}>
          Spelare
        </button>
        {openMenu === 'players' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button onClick={() => action(onPlayerPool)}>Spelarpool</button>
            <button onClick={() => action(onTournamentPlayers)} disabled={!hasTournament}>
              Turneringsspelare
            </button>
            <div className="menu-separator" />
            <button onClick={() => action(() => onPrint?.('players'))} disabled={!hasTournament}>
              Skriv ut spelarlista
            </button>
            <button
              onClick={() => action(() => onPublish?.('players'))}
              disabled={!hasTournament || isP2PClient}
              title={clientTitle}
            >
              Publicera spelarlista
            </button>
            <div className="menu-separator" />
            <button
              onClick={() => action(onExportPlayers)}
              disabled={!hasTournament || isP2PClient}
              title={clientTitle}
            >
              Exportera turneringsspelare
            </button>
            <button
              onClick={() => action(onImportPlayers)}
              disabled={isP2PClient}
              title={clientTitle}
            >
              Importera till spelarpool
            </button>
            <div className="menu-separator" />
            <button
              onClick={() => action(onSeedPlayers)}
              disabled={isP2PClient}
              title={clientTitle}
            >
              Skapa testspelare
            </button>
          </div>
        )}
      </div>

      {/* 6. Inställningar */}
      <div className="menu-item">
        <button onClick={() => toggleMenu('settings')} aria-expanded={openMenu === 'settings'}>
          Inställningar
        </button>
        {openMenu === 'settings' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button onClick={() => action(onSettings)}>Inställningar</button>
            <div className="menu-separator" />
            <button onClick={() => action(onBackup)} disabled={isP2PClient} title={clientTitle}>
              Säkerhetskopiera databas
            </button>
            <button onClick={() => action(onRestore)} disabled={isP2PClient} title={clientTitle}>
              Återställ databas
            </button>
            <div className="menu-separator" />
            <button onClick={() => action(onRollback)} disabled={!onRollback}>
              Byt till tidigare version…
            </button>
          </div>
        )}
      </div>

      {/* 7. Hjälp */}
      <div className="menu-item">
        <button onClick={() => toggleMenu('help')} aria-expanded={openMenu === 'help'}>
          Hjälp
        </button>
        {openMenu === 'help' && (
          <div className="menu-dropdown" data-testid="menu-dropdown">
            <button onClick={() => action(onCheckUpdates)} disabled={!onCheckUpdates}>
              Sök efter uppdateringar
            </button>
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowWhatsNew(true)
              }}
            >
              Vad är nytt
            </button>
            <button
              onClick={() => {
                setOpenMenu(null)
                setShowAbout(true)
              }}
            >
              Om
            </button>
          </div>
        )}
      </div>

      <PairProgressDialog open={pairMutation.isPending} />

      <Dialog
        title="Kan inte lotta"
        open={!!pairError}
        onClose={() => setPairError('')}
        width={400}
        footer={
          <button className="btn" onClick={() => setPairError('')}>
            OK
          </button>
        }
      >
        <p data-testid="pair-error" style={{ whiteSpace: 'pre-line' }}>
          {pairError}
        </p>
      </Dialog>

      <Dialog
        title="Om Lotta"
        open={showAbout}
        onClose={() => setShowAbout(false)}
        width={400}
        footer={
          <button className="btn" onClick={() => setShowAbout(false)}>
            Stäng
          </button>
        }
      >
        <p>
          Av{' '}
          <a href="https://william.bernting.se" target="_blank" rel="noopener noreferrer">
            William Bernting
          </a>
          <br />
          <a href="mailto:william@bernting.se">william@bernting.se</a>
          {' | '}
          <a href="tel:+46706676047">070-667 60 47</a>
        </p>
        {(__COMMIT_HASH__ || __GIT_TAG__) && (
          <p className="about-version">
            {__GIT_TAG__ && (
              <>
                Version: {__GIT_TAG__}
                <br />
              </>
            )}
            {__COMMIT_HASH__ && (
              <>
                Commit: {__COMMIT_HASH__}
                {__COMMIT_DATE__ && ` (${__COMMIT_DATE__})`}
              </>
            )}
          </p>
        )}
        <p className="about-recovery">
          <a data-testid="about-safe-mode-link" href="/recovery.html">
            Säkert läge / Återställning
          </a>
        </p>
      </Dialog>

      <WhatsNewDialog open={showWhatsNew} onClose={() => setShowWhatsNew(false)} />

      <PublishDialog
        open={showLottaPublish}
        hasRound={hasRound}
        chess4={!!chess4}
        category="lotta"
        onClose={() => setShowLottaPublish(false)}
        onPublish={(what) => onPublish?.(what)}
      />
      <PublishDialog
        open={showStandingsPublish}
        hasRound={hasRound}
        chess4={!!chess4}
        category="standings"
        onClose={() => setShowStandingsPublish(false)}
        onPublish={(what) => onPublish?.(what)}
      />
      <PrintDialog
        open={showLottaPrint}
        hasRound={hasRound}
        chess4={!!chess4}
        category="lotta"
        onClose={() => setShowLottaPrint(false)}
        onPrint={(what) => onPrint?.(what)}
      />
      <PrintDialog
        open={showStandingsPrint}
        hasRound={hasRound}
        chess4={!!chess4}
        category="standings"
        onClose={() => setShowStandingsPrint(false)}
        onPrint={(what) => onPrint?.(what)}
      />
    </div>
  )
}

function PairProgressDialog({ open }: { open: boolean }) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!open) {
      setElapsed(0)
      return
    }
    const id = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [open])

  return (
    <Dialog title="Lottar..." open={open} onClose={() => {}} isDirty={true} width={360}>
      <div className="pair-progress" role="status" aria-live="polite">
        <span className="pair-progress-spinner" aria-hidden="true" />
        <span data-testid="pair-progress-elapsed">({elapsed} s)</span>
      </div>
    </Dialog>
  )
}
