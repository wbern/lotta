import { useState } from 'react'
import { AlphabeticalOptionsCheckboxes } from './AlphabeticalOptionsCheckboxes'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  hasRound: boolean
  hasTournament: boolean
  chess4: boolean
  category: 'lotta' | 'standings'
  onClose: () => void
  onPrint: (what: string) => void
}

export function PrintDialog({
  open,
  hasRound,
  hasTournament,
  chess4,
  category,
  onClose,
  onPrint,
}: Props) {
  const [alphaGroupByClass, setAlphaGroupByClass] = useState(true)
  const [alphaCompact, setAlphaCompact] = useState(false)
  const [alphaHideOppLast, setAlphaHideOppLast] = useState(false)

  const print = (what: string) => {
    onPrint(what)
    onClose()
  }

  const printAlphabetical = () => {
    const params = new URLSearchParams()
    params.set('groupByClass', alphaGroupByClass ? '1' : '0')
    params.set('compact', alphaCompact ? '1' : '0')
    params.set('hideOppLast', alphaHideOppLast ? '1' : '0')
    print(`alphabetical?${params.toString()}`)
  }

  return (
    <Dialog
      title="Skriv ut"
      open={open}
      onClose={onClose}
      width={400}
      footer={
        <button className="btn" onClick={onClose}>
          Stäng
        </button>
      }
    >
      {category === 'lotta' && (
        <>
          <div className="form-group">
            <button
              className="btn"
              data-testid="print-pairings"
              onClick={() => print('pairings')}
              disabled={!hasRound}
            >
              Lottning
            </button>
          </div>
          <div className="form-group">
            <button
              className="btn"
              data-testid="print-alphabetical"
              onClick={printAlphabetical}
              disabled={!hasRound}
            >
              Alfabetisk lottning
            </button>
          </div>
          <AlphabeticalOptionsCheckboxes
            testIdPrefix="print-alphabetical"
            groupByClass={alphaGroupByClass}
            onGroupByClassChange={setAlphaGroupByClass}
            compact={alphaCompact}
            onCompactChange={setAlphaCompact}
            hideOppLast={alphaHideOppLast}
            onHideOppLastChange={setAlphaHideOppLast}
          />
        </>
      )}
      {category === 'standings' && (
        <>
          <div className="form-group">
            <button
              className="btn"
              data-testid="print-standings"
              onClick={() => print('standings')}
              disabled={!hasTournament}
            >
              Ställning
            </button>
          </div>
          <div className="form-group">
            {chess4 ? (
              <button
                className="btn"
                data-testid="print-chess4-standings"
                onClick={() => print('chess4-standings')}
                disabled={!hasTournament}
              >
                Schack4an-ställning
              </button>
            ) : (
              <button
                className="btn"
                data-testid="print-club-standings"
                onClick={() => print('club-standings')}
                disabled={!hasTournament}
              >
                Klubbställning
              </button>
            )}
          </div>
        </>
      )}
    </Dialog>
  )
}
