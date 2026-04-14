export interface PairingPlayerInfo {
  id: number
  rating: number
  withdrawnFromRound: number
  lotNr: number
}

export interface PairingInput {
  nrOfRounds: number
  roundsPlayed: number
  nextRoundNr: number
  initialPairing: string
  allResultsEntered: boolean
  players: PairingPlayerInfo[]
}

export interface PairingGame {
  whitePlayerId: number | null
  blackPlayerId: number | null
}

export function preparePairing(input: PairingInput): PairingPlayerInfo[] {
  const { nrOfRounds, roundsPlayed, nextRoundNr, players } = input

  // Filter out withdrawn players
  const activePlayers = players.filter(
    (p) => p.withdrawnFromRound === -1 || nextRoundNr < p.withdrawnFromRound,
  )

  if (activePlayers.length < 2) {
    throw new Error('Lägg till några spelare först!')
  }

  if (roundsPlayed >= nrOfRounds) {
    throw new Error('Alla ronder är spelade!')
  }

  if (roundsPlayed > 0 && !input.allResultsEntered) {
    throw new Error('Alla matcher måste ha resultat innan ny rond kan lottas!')
  }

  return activePlayers
}

/**
 * Simple sequential pairing: pairs players in order (1v2, 3v4, ...).
 */
export function pairSequential(
  players: PairingPlayerInfo[],
  bye?: PairingPlayerInfo | null,
): PairingGame[] {
  const games: PairingGame[] = []
  for (let i = 0; i < players.length; i += 2) {
    games.push({
      whitePlayerId: players[i].id,
      blackPlayerId: players[i + 1].id,
    })
  }
  if (bye) {
    games.push({
      whitePlayerId: bye.id,
      blackPlayerId: null,
    })
  }
  return games
}
