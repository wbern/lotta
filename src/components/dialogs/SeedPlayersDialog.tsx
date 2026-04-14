import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { seedFakePlayers } from '../../api/seed-players'
import { addTournamentPlayers } from '../../api/tournament-players'
import { Dialog } from './Dialog'

interface Props {
  open: boolean
  onClose: () => void
  tournamentId?: number
}

export function SeedPlayersDialog({ open, onClose, tournamentId }: Props) {
  const [count, setCount] = useState(20)
  const [seeding, setSeeding] = useState(false)
  const [autoAdd, setAutoAdd] = useState(true)
  const [createClubs, setCreateClubs] = useState(false)
  const [clubCount, setClubCount] = useState(5)
  const queryClient = useQueryClient()

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const { players, clubs } = await seedFakePlayers(count, {
        clubCount: createClubs ? clubCount : undefined,
      })
      queryClient.invalidateQueries({ queryKey: ['players'] })
      if (clubs.length > 0) {
        queryClient.invalidateQueries({ queryKey: ['clubs'] })
      }
      let addedToTournament = false
      if (autoAdd && tournamentId != null) {
        try {
          await addTournamentPlayers(tournamentId, players)
          queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId, 'players'] })
          queryClient.invalidateQueries({ queryKey: ['tournaments', tournamentId] })
          addedToTournament = true
        } catch {
          alert(
            `${players.length} testspelare tillagda i spelarpoolen, men kunde inte lägga till dem i turneringen.`,
          )
          return
        }
      }
      onClose()
      const msg = addedToTournament
        ? `${players.length} testspelare tillagda i turneringen.`
        : `${players.length} testspelare tillagda i spelarpoolen.`
      alert(msg)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <Dialog
      title="Skapa testspelare"
      open={open}
      onClose={onClose}
      width={360}
      footer={
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose} disabled={seeding}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={handleSeed} disabled={seeding || count < 1}>
            {seeding ? 'Skapar...' : 'Skapa'}
          </button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p>Lägg till slumpmässiga testspelare i spelarpoolen för demosyfte.</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Antal spelare:
          <input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(500, Number(e.target.value))))}
            style={{ width: 80 }}
          />
        </label>
        <label
          data-testid="seed-create-clubs"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <input
            type="checkbox"
            checked={createClubs}
            onChange={(e) => setCreateClubs(e.target.checked)}
          />
          Skapa slumpmässiga klubbar
        </label>
        {createClubs && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 24 }}>
            Antal klubbar:
            <input
              data-testid="seed-club-count"
              type="number"
              min={1}
              max={50}
              value={clubCount}
              onChange={(e) => setClubCount(Math.max(1, Math.min(50, Number(e.target.value))))}
              style={{ width: 80 }}
            />
          </label>
        )}
        {tournamentId != null && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={autoAdd}
              onChange={(e) => setAutoAdd(e.target.checked)}
            />
            Lägg även till i turneringen
          </label>
        )}
      </div>
    </Dialog>
  )
}
