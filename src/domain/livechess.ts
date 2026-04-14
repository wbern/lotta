import type { ResultType } from '../types/api.ts'

export interface LiveChessGameInput {
  boardNr: number
  whiteLastName: string | null
  whiteFirstName: string | null
  blackLastName: string | null
  blackFirstName: string | null
  whiteRating: number
  blackRating: number
  resultType: ResultType
}

export interface LiveChessInput {
  tournamentName: string
  roundNr: number
  games: LiveChessGameInput[]
}

export function generateLiveChessPgn(input: LiveChessInput): string {
  let pgn = ''

  for (const g of input.games) {
    if (g.whiteLastName == null || g.blackLastName == null || g.resultType !== 'NO_RESULT') {
      continue
    }

    pgn += `[Event "${input.tournamentName}"]`
    pgn += `[Round "${input.roundNr}"]`
    pgn += `[White "${g.whiteLastName}, ${g.whiteFirstName}"]`
    pgn += `[Black "${g.blackLastName}, ${g.blackFirstName}"]`
    pgn += `[Board "${g.boardNr}"]`
    pgn += `[WhiteElo "${g.whiteRating}"]`
    pgn += `[BlackElo "${g.blackRating}"]`
    pgn += '*\r\n'
  }

  return pgn
}
