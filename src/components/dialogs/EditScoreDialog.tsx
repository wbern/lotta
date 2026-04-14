import { useState } from 'react'
import { sv } from '../../lib/swedish-text'
import type { GameDto } from '../../types/api'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  game: GameDto | null
  pointsPerGame?: number
  onSave: (whiteScore: number, blackScore: number) => void
  onClose: () => void
}

export function EditScoreDialog({ open, game, pointsPerGame = 1, onSave, onClose }: Props) {
  const [whiteScore, setWhiteScore] = useState('')
  const [blackScore, setBlackScore] = useState('')
  const [scoreError, setScoreError] = useState('')

  // Reset when game changes
  if (game && whiteScore === '' && blackScore === '') {
    setWhiteScore(String(game.whiteScore))
    setBlackScore(String(game.blackScore))
  }

  const handleSave = () => {
    const ws = parseFloat(whiteScore)
    const bs = parseFloat(blackScore)
    if (!isNaN(ws) && !isNaN(bs)) {
      if (ws + bs > pointsPerGame) {
        setScoreError('Vits och svarts resultat får ej överstiga maxpoängen!')
        return
      }
      setScoreError('')
      onSave(ws, bs)
    }
  }

  const handleClose = () => {
    setWhiteScore('')
    setBlackScore('')
    onClose()
  }

  return (
    <Dialog
      title="Sätt poängresultat"
      open={open}
      onClose={handleClose}
      width={350}
      footer={
        <>
          <button className="btn btn-primary" onClick={handleSave}>
            {sv.common.save}
          </button>
          <button className="btn" onClick={handleClose}>
            {sv.common.cancel}
          </button>
        </>
      }
    >
      {scoreError && (
        <div
          data-testid="score-error"
          style={{
            color: 'var(--color-danger)',
            fontSize: 'var(--font-size-small)',
            marginBottom: 8,
          }}
        >
          {scoreError}
        </div>
      )}
      {game && (
        <>
          <div className="form-row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <strong>{game.whitePlayer?.name || 'Vit'}</strong>
            <span style={{ margin: '0 8px' }}>-</span>
            <strong>{game.blackPlayer?.name || 'Svart'}</strong>
          </div>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>Resultat:</div>
          <div className="form-row" style={{ justifyContent: 'center' }}>
            <input
              type="text"
              value={whiteScore}
              onChange={(e) => setWhiteScore(e.target.value)}
              style={{ width: 60, textAlign: 'center' }}
            />
            <span style={{ margin: '0 8px' }}>-</span>
            <input
              type="text"
              value={blackScore}
              onChange={(e) => setBlackScore(e.target.value)}
              style={{ width: 60, textAlign: 'center' }}
            />
          </div>
        </>
      )}
    </Dialog>
  )
}
