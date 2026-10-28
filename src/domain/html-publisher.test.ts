import { describe, expect, it } from 'vitest'
import type {
  AlphabeticalPairingsPublishInput,
  Chess4StandingsPublishInput,
  ClubStandingsPublishInput,
  CrossTablePublishInput,
  PairingsPublishInput,
  PlayerListPublishInput,
  RefereePairingsPublishInput,
  StandingsPublishInput,
} from './html-publisher.ts'
import {
  publishAlphabeticalPairings,
  publishChess4Standings,
  publishClubStandings,
  publishCrossTable,
  publishPairings,
  publishPlayerList,
  publishRefereePairings,
  publishStandings,
} from './html-publisher.ts'

describe('publishPairings', () => {
  it('generates HTML with board, players, and result', () => {
    const input: PairingsPublishInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteName: 'Andersson, Anna',
          blackName: 'Björk, Bo',
          resultDisplay: '1-0',
        },
        {
          boardNr: 2,
          whiteName: 'Carlsson, Cilla',
          blackName: null,
          resultDisplay: '',
        },
      ],
    }

    const html = publishPairings(input)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Lottning rond 1')
    expect(html).toContain('Höstturneringen')
    expect(html).toContain('Andersson, Anna')
    expect(html).toContain('Björk, Bo')
    expect(html).toContain('1-0')
    expect(html).toContain('frirond')
    expect(html).toContain('<style')
  })

  it('escapes HTML in player names', () => {
    const input: PairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteName: '<script>alert("xss")</script>',
          blackName: 'Normal',
          resultDisplay: '',
        },
      ],
    }

    const html = publishPairings(input)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes quotes in player names', () => {
    const input: PairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteName: 'O"Brien',
          blackName: "D'Arcy",
          resultDisplay: '',
        },
      ],
    }

    const html = publishPairings(input)
    expect(html).not.toContain('O"Brien')
    expect(html).toContain('O&quot;Brien')
    expect(html).not.toContain("D'Arcy")
    expect(html).toContain('D&#39;Arcy')
  })
})

describe('publishAlphabeticalPairings', () => {
  it('formats each player as "Name boardNrColor, Opponent"', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 3,
      classes: [
        {
          className: '',
          players: [
            {
              firstName: 'Kalle',
              lastName: 'Testsson',
              boardNr: 7,
              color: 'V',
              opponent: {
                firstName: 'Örjan',
                lastName: 'Efternamn',
                color: 'S',
              },
            },
            {
              firstName: 'Örjan',
              lastName: 'Efternamn',
              boardNr: 7,
              color: 'S',
              opponent: {
                firstName: 'Kalle',
                lastName: 'Testsson',
                color: 'V',
              },
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Höstturneringen')
    expect(html).toContain('rond 3')
    // Each player appears as a table row with Name / Board / Opponent columns.
    expect(html).toContain('<td class="CP_Player">Kalle Testsson</td>')
    expect(html).toContain('<td class="CP_Board">7 V</td>')
    expect(html).toContain('<td class="CP_Player">Örjan Efternamn</td>')
    expect(html).toContain('<td class="CP_Board">7 S</td>')
  })

  it('starts each class on its own page when printing', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      classes: [
        {
          className: 'A-klassen',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: { firstName: 'Bo', lastName: 'Björk', color: 'S' },
            },
          ],
        },
        {
          className: 'B-klassen',
          players: [
            {
              firstName: 'Cilla',
              lastName: 'Carlsson',
              boardNr: 2,
              color: 'V',
              opponent: { firstName: 'Dan', lastName: 'Dahl', color: 'S' },
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    expect(html).toContain('A-klassen')
    expect(html).toContain('B-klassen')
    // Each class section must carry a page-break rule so organizers can hand one printout per class.
    // The first class starts naturally at page 1; the rule applies uniformly.
    // Both modern and legacy forms are required — Safari/WebKit print paths ignore the modern-only rule.
    expect(html).toMatch(/\.CP_AlphabeticalClass[^}]*break-before\s*:\s*page/)
    expect(html).toMatch(/\.CP_AlphabeticalClass[^}]*page-break-before\s*:\s*always/)
    expect(html).toMatch(/\.CP_AlphabeticalClass[^}]*break-inside\s*:\s*avoid/)
  })

  it('repeats the title inside every class so each handout stands alone', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 2,
      classes: [
        {
          className: 'A-klassen',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: { firstName: 'Bo', lastName: 'Björk', color: 'S' },
            },
          ],
        },
        {
          className: 'B-klassen',
          players: [
            {
              firstName: 'Cilla',
              lastName: 'Carlsson',
              boardNr: 2,
              color: 'V',
              opponent: { firstName: 'Dan', lastName: 'Dahl', color: 'S' },
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    const titleOccurrences = html.match(/<h2>Höstturneringen - Alfabetisk lottning rond 2<\/h2>/g)
    expect(titleOccurrences).not.toBeNull()
    expect(titleOccurrences).toHaveLength(2)
    // And each occurrence must live inside its own CP_AlphabeticalClass wrapper.
    expect(html).toMatch(
      /<div class="CP_AlphabeticalClass">\s*<h2>Höstturneringen - Alfabetisk lottning rond 2<\/h2>/,
    )
  })

  it('emits a single top-level title in the flat layout', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 2,
      groupByClass: false,
      classes: [
        {
          className: 'A',
          players: [
            { firstName: 'Anna', lastName: 'Andersson', boardNr: 1, color: 'V', opponent: null },
          ],
        },
        {
          className: 'B',
          players: [{ firstName: 'Bo', lastName: 'Björk', boardNr: 2, color: 'V', opponent: null }],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    const titleOccurrences = html.match(/<h2>Höstturneringen - Alfabetisk lottning rond 2<\/h2>/g)
    expect(titleOccurrences).toHaveLength(1)
  })

  it('renders opponents with first name only when hideOpponentLastName is true', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      hideOpponentLastName: true,
      classes: [
        {
          className: '',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: { firstName: 'Bo', lastName: 'Björk', color: 'S' },
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    // Self name keeps both, only opponent loses the last name.
    expect(html).toContain('<td class="CP_Player">Anna Andersson</td>')
    expect(html).toContain('<td class="CP_Player">Bo</td>')
    expect(html).not.toContain('Bo Björk')
  })

  it('still labels byes as "frirond" when hideOpponentLastName is true', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      hideOpponentLastName: true,
      classes: [
        {
          className: '',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: null,
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    expect(html).toContain('frirond')
  })

  it('emits a flat CSS-column layout when groupByClass is false', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      groupByClass: false,
      columns: 3,
      classes: [
        {
          className: 'A-klassen',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: { firstName: 'Bo', lastName: 'Björk', color: 'S' },
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    expect(html).toContain('class="CP_AlphabeticalFlat"')
    expect(html).toContain('column-count: 3')
    expect(html).not.toContain('class="CP_AlphabeticalClass"')
    // Row uses the flat div format, not a table
    expect(html).toContain('class="CP_AlphabeticalRow"')
  })

  it('clamps the column count to the 1..8 range', () => {
    const base: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      groupByClass: false,
      classes: [
        {
          className: '',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: null,
            },
          ],
        },
      ],
    }

    expect(publishAlphabeticalPairings({ ...base, columns: 0 })).toContain('column-count: 1')
    expect(publishAlphabeticalPairings({ ...base, columns: 99 })).toContain('column-count: 8')
  })

  it('adds the CP_compact body class when compact is on', () => {
    const input: AlphabeticalPairingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      compact: true,
      classes: [
        {
          className: '',
          players: [
            {
              firstName: 'Anna',
              lastName: 'Andersson',
              boardNr: 1,
              color: 'V',
              opponent: null,
            },
          ],
        },
      ],
    }

    const html = publishAlphabeticalPairings(input)
    expect(html).toContain('<body class="CP_compact">')
    expect(html).toMatch(/\.CP_compact\s*\{[^}]*font-size/)
  })
})

describe('publishStandings', () => {
  it('generates standings table with place, name, club, score, and tiebreaks', () => {
    const input: StandingsPublishInput = {
      tournamentName: 'Höstturneringen',
      roundNr: 2,
      showELO: true,
      tiebreakNames: ['Buchholz', 'SB'],
      standings: [
        {
          place: 1,
          name: 'Andersson, Anna',
          club: 'SK Lund',
          rating: 1800,
          scoreDisplay: '2',
          tiebreaks: { Buchholz: '3.5', SB: '2.0' },
        },
        {
          place: 2,
          name: 'Björk, Bo',
          club: null,
          rating: 1700,
          scoreDisplay: '1',
          tiebreaks: { Buchholz: '2.0', SB: '1.0' },
        },
      ],
    }

    const html = publishStandings(input)
    expect(html).toContain('Ställning efter rond 2')
    expect(html).toContain('Andersson, Anna')
    expect(html).toContain('SK Lund')
    expect(html).toContain('1800')
    expect(html).toContain('Buchholz')
    expect(html).toContain('3.5')
  })

  it('given tiebreaks keyed by short name (as calculateStandings returns them), when published, then each tiebreak cell is filled', () => {
    const input: StandingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 3,
      showELO: false,
      tiebreakNames: ['Buchholz', 'Prestationsrating LASK'],
      standings: [
        {
          place: 1,
          name: 'Siv Åberg',
          club: null,
          rating: 0,
          scoreDisplay: '2',
          tiebreaks: { Buch: '3.5', Pres: '1725' },
        },
      ],
    }

    const html = publishStandings(input)
    expect(html).toContain('<td class="CP_Tiebreak">3.5</td><td class="CP_Tiebreak">1725</td>')
  })

  it('given the persisted id "Prestationsrating LASK", when published, then the column header reads "Prestationsrating"', () => {
    const html = publishStandings({
      tournamentName: 'Test',
      roundNr: 1,
      showELO: false,
      tiebreakNames: ['Buchholz', 'Prestationsrating LASK'],
      standings: [],
    })
    expect(html).toContain('<td>Buchholz</td><td>Prestationsrating</td>')
    expect(html).not.toContain('LASK')
  })

  it('hides rating column when showELO is false', () => {
    const input: StandingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 1,
      showELO: false,
      tiebreakNames: [],
      standings: [
        {
          place: 1,
          name: 'Andersson, Anna',
          club: null,
          rating: 1800,
          scoreDisplay: '1',
          tiebreaks: {},
        },
      ],
    }

    const html = publishStandings(input)
    expect(html).not.toContain('<td>Rating</td>')
    expect(html).not.toContain('>1800<')
  })
})

describe('publishPlayerList', () => {
  it('generates player list with number, name, club, rating', () => {
    const input: PlayerListPublishInput = {
      tournamentName: 'Höstturneringen',
      players: [
        { name: 'Andersson, Anna', club: 'SK Lund', rating: 1800 },
        { name: 'Björk, Bo', club: null, rating: 1700 },
      ],
    }

    const html = publishPlayerList(input)
    expect(html).toContain('Spelarlista')
    expect(html).toContain('Andersson, Anna')
    expect(html).toContain('SK Lund')
    expect(html).toContain('1800')
  })
})

describe('publishClubStandings', () => {
  it('generates club standings with place, club, score', () => {
    const input: ClubStandingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 3,
      standings: [
        { place: 1, club: 'SK Lund', scoreDisplay: '5½' },
        { place: 2, club: 'SK Malmö', scoreDisplay: '3' },
      ],
    }

    const html = publishClubStandings(input)
    expect(html).toContain('Klubbställning efter rond 3')
    expect(html).toContain('SK Lund')
    expect(html).toContain('5½')
  })
})

describe('publishChess4Standings', () => {
  it('generates Chess4 standings with player count and chess4 members', () => {
    const input: Chess4StandingsPublishInput = {
      tournamentName: 'Test',
      roundNr: 2,
      standings: [
        {
          place: 1,
          club: 'SK Lund',
          playerCount: 4,
          chess4Members: 3,
          score: 8,
        },
      ],
    }

    const html = publishChess4Standings(input)
    expect(html).toContain('Schack4an-ställning efter rond 2')
    expect(html).toContain('SK Lund')
    expect(html).toContain('>4<')
    expect(html).toContain('>3<')
    expect(html).toContain('>8<')
  })
})

describe('publishCrossTable', () => {
  // Hand-computed 4-player example (ppg 1, maxWin 1, tiebreak Manuell).
  // R1: Anna(v)-Dan(s) 1-0, Bo(v)-Cilla(s) ½-½.
  // R2: Cilla(v)-Anna(s) 0-1 WO, Dan(v)-Bo(s) postponed (0 for both in standings).
  // Scores: Anna 2, Bo ½, Cilla ½, Dan 0. Bo ahead of Cilla on Manuell 5 > 3.
  // Rows: 1 Anna, 2 Bo, 3 Cilla, 4 Dan. Round 3 is not paired yet.
  const fourPlayers = (): CrossTablePublishInput => ({
    tournamentName: 'Höstturneringen',
    roundCount: 3,
    showGroup: false,
    showELO: true,
    tiebreakNames: ['Manuell'],
    players: [
      {
        place: 1,
        name: 'Anna Andersson',
        playerGroup: 'A',
        rating: 1800,
        rounds: [
          { opponentPlace: 4, color: 'v', result: '1' },
          { opponentPlace: 3, color: 's', result: 'i' },
          null,
        ],
        scoreDisplay: '2',
        tiebreaks: { Man: '0' },
      },
      {
        place: 2,
        name: 'Bo Björk',
        playerGroup: 'B',
        rating: 1700,
        rounds: [
          { opponentPlace: 3, color: 'v', result: '½' },
          { opponentPlace: 4, color: 's', result: 'u' },
          null,
        ],
        scoreDisplay: '½',
        tiebreaks: { Man: '5' },
      },
      {
        place: 3,
        name: 'Cilla Carlsson',
        playerGroup: 'A',
        rating: 1600,
        rounds: [
          { opponentPlace: 2, color: 's', result: '½' },
          { opponentPlace: 1, color: 'v', result: 'o' },
          null,
        ],
        scoreDisplay: '½',
        tiebreaks: { Man: '3' },
      },
      {
        place: 4,
        name: 'Dan Dahl',
        playerGroup: 'B',
        rating: 1500,
        rounds: [
          { opponentPlace: 1, color: 's', result: '0' },
          { opponentPlace: 2, color: 'v', result: 'u' },
          null,
        ],
        scoreDisplay: '0',
        tiebreaks: { Man: '0' },
      },
    ],
  })

  it('given the 4-player example, when published, then the title and header follow Java', () => {
    const html = publishCrossTable(fourPlayers())
    expect(html).toContain('<h2>Höstturneringen - Korstabell</h2>')
    expect(html).toContain(
      '<tr class="CP_TableHeader"><td>Plac</td><td>Namn</td><td>Rating</td><td>1</td><td>2</td><td>3</td><td>Poäng</td><td>Man</td></tr>',
    )
  })

  it('given the 4-player example, when published, then each row shows opponent row, colour and own result', () => {
    const html = publishCrossTable(fourPlayers())
    const empty = '<td class="CP_Round"></td>'
    expect(html).toContain(
      '<tr class="CP_Row"><td class="CP_Place">1</td><td class="CP_Player">Anna Andersson</td><td class="CP_Rating">1800</td>' +
        '<td class="CP_Round"><div class="CP_White">4v</div>1</td>' +
        '<td class="CP_Round"><div class="CP_Black">3s</div>i</td>' +
        empty +
        '<td class="CP_Score">2</td><td class="CP_Tiebreak">0</td></tr>',
    )
    expect(html).toContain(
      '<tr class="CP_Row"><td class="CP_Place">2</td><td class="CP_Player">Bo Björk</td><td class="CP_Rating">1700</td>' +
        '<td class="CP_Round"><div class="CP_White">3v</div>½</td>' +
        '<td class="CP_Round"><div class="CP_Black">4s</div>u</td>' +
        empty +
        '<td class="CP_Score">½</td><td class="CP_Tiebreak">5</td></tr>',
    )
    expect(html).toContain(
      '<tr class="CP_Row"><td class="CP_Place">3</td><td class="CP_Player">Cilla Carlsson</td><td class="CP_Rating">1600</td>' +
        '<td class="CP_Round"><div class="CP_Black">2s</div>½</td>' +
        '<td class="CP_Round"><div class="CP_White">1v</div>o</td>' +
        empty +
        '<td class="CP_Score">½</td><td class="CP_Tiebreak">3</td></tr>',
    )
    expect(html).toContain(
      '<tr class="CP_Row"><td class="CP_Place">4</td><td class="CP_Player">Dan Dahl</td><td class="CP_Rating">1500</td>' +
        '<td class="CP_Round"><div class="CP_Black">1s</div>0</td>' +
        '<td class="CP_Round"><div class="CP_White">2v</div>u</td>' +
        empty +
        '<td class="CP_Score">0</td><td class="CP_Tiebreak">0</td></tr>',
    )
    expect(html).not.toContain('+/-')
  })

  it('given showGroup, when published, then a Grp column follows Namn', () => {
    const html = publishCrossTable({ ...fourPlayers(), showGroup: true })
    expect(html).toContain('<td>Plac</td><td>Namn</td><td>Grp</td><td>Rating</td>')
    expect(html).toContain(
      '<td class="CP_Player">Bo Björk</td><td class="CP_Group">B</td><td class="CP_Rating">1700</td>',
    )
  })

  it('given showELO false, when published, then there is no Rating column', () => {
    const html = publishCrossTable({ ...fourPlayers(), showELO: false })
    expect(html).toContain('<td>Plac</td><td>Namn</td><td>1</td>')
    expect(html).not.toContain('<td>Rating</td>')
    expect(html).not.toContain('<td class="CP_Rating">')
    expect(html).toContain(
      '<td class="CP_Player">Anna Andersson</td><td class="CP_Round"><div class="CP_White">4v</div>1</td>',
    )
  })

  it('given an unrated player, when published, then the rating cell is blank', () => {
    const input = fourPlayers()
    input.players[3].rating = 0
    const html = publishCrossTable(input)
    expect(html).toContain('<td class="CP_Player">Dan Dahl</td><td class="CP_Rating"></td>')
  })

  it('given a withdrawn player, when published, then the name is shown verbatim and the missing round is empty', () => {
    const input = fourPlayers()
    input.players[3].name = 'Dan Dahl (utgått r2)'
    input.players[3].rounds = [{ opponentPlace: 1, color: 's', result: '0' }, null, null]
    const html = publishCrossTable(input)
    expect(html).toContain(
      '<td class="CP_Player">Dan Dahl (utgått r2)</td><td class="CP_Rating">1500</td>' +
        '<td class="CP_Round"><div class="CP_Black">1s</div>0</td>' +
        '<td class="CP_Round"></td><td class="CP_Round"></td>',
    )
  })

  it('given a chess4 bye, when published, then the cell has no opponent and shows the bye score', () => {
    // Schackfyran ppg 4, maxWin 3. R1: Ada(v)-Bea(s) 3-1, Cid bye (3).
    // Scores Ada 3, Cid 3, Bea 1; Ada ahead of Cid on rating.
    const input: CrossTablePublishInput = {
      tournamentName: 'Schackfyran',
      roundCount: 1,
      showGroup: false,
      showELO: false,
      tiebreakNames: [],
      players: [
        {
          place: 1,
          name: 'Ada',
          playerGroup: '',
          rating: 1800,
          rounds: [{ opponentPlace: 3, color: 'v', result: '3' }],
          scoreDisplay: '3',
          tiebreaks: {},
        },
        {
          place: 2,
          name: 'Cid',
          playerGroup: '',
          rating: 1600,
          rounds: [{ opponentPlace: null, color: 'v', result: '3' }],
          scoreDisplay: '3',
          tiebreaks: {},
        },
        {
          place: 3,
          name: 'Bea',
          playerGroup: '',
          rating: 1700,
          rounds: [{ opponentPlace: 1, color: 's', result: '1' }],
          scoreDisplay: '1',
          tiebreaks: {},
        },
      ],
    }
    const html = publishCrossTable(input)
    expect(html).toContain(
      '<td class="CP_Player">Cid</td><td class="CP_Round"><div class="CP_White">v</div>3</td><td class="CP_Score">3</td>',
    )
    expect(html).toContain(
      '<td class="CP_Player">Bea</td><td class="CP_Round"><div class="CP_Black">1s</div>1</td><td class="CP_Score">1</td>',
    )
  })

  it('given a Buchholz tiebreak, when published, then the header uses the short name and the cell its value', () => {
    const input = fourPlayers()
    input.tiebreakNames = ['Buchholz']
    input.players[0].tiebreaks = { Buch: '4.5' }
    const html = publishCrossTable(input)
    expect(html).toContain('<td>Poäng</td><td>Buch</td></tr>')
    expect(html).toContain('<td class="CP_Score">2</td><td class="CP_Tiebreak">4.5</td></tr>')
  })
})

describe('publishRefereePairings', () => {
  it('generates interactive HTML with result buttons per board', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Spring Open',
      tournamentId: 1,
      roundNr: 2,
      games: [
        {
          boardNr: 1,
          whiteName: 'Alice',
          blackName: 'Bob',
          resultDisplay: '',
        },
        {
          boardNr: 2,
          whiteName: 'Charlie',
          blackName: 'Diana',
          resultDisplay: '1-0',
        },
      ],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Spring Open')
    expect(html).toContain('Alice')
    expect(html).toContain('Bob')
    // Result buttons should exist for boards without results
    expect(html).toContain('1-0')
    expect(html).toContain('½-½')
    expect(html).toContain('0-1')
    // Boards with existing results should show current result
    expect(html).toContain('Charlie')
    // Should contain postMessage script
    expect(html).toContain('postMessage')
    // Should contain data attributes for board identification
    expect(html).toContain('data-board="1"')
    expect(html).toContain('data-board="2"')
  })

  it('includes tournamentId and roundNr in postMessage payload', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Test',
      tournamentId: 42,
      roundNr: 3,
      games: [{ boardNr: 1, whiteName: 'A', blackName: 'B', resultDisplay: '' }],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('42') // tournamentId
    expect(html).toContain('"roundNr":3')
  })

  it('exposes the published-time current result per board so submissions can carry expectedPrior', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'T',
      tournamentId: 1,
      roundNr: 1,
      games: [
        {
          boardNr: 5,
          whiteName: 'A',
          blackName: 'B',
          resultDisplay: '',
          currentResult: 'NO_RESULT',
        },
        {
          boardNr: 6,
          whiteName: 'C',
          blackName: 'D',
          resultDisplay: '1-0',
          currentResult: 'WHITE_WIN',
        },
      ],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('data-current="NO_RESULT"')
    expect(html).toContain('data-current="WHITE_WIN"')
    // The click script must read it and include it as expectedPrior.
    expect(html).toContain('expectedPrior')
  })

  it('escapes HTML in player names', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Test',
      tournamentId: 1,
      roundNr: 1,
      games: [
        {
          boardNr: 1,
          whiteName: '<script>xss</script>',
          blackName: 'Normal',
          resultDisplay: '',
        },
      ],
    }

    const html = publishRefereePairings(input)
    expect(html).not.toContain('<script>xss</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('uses chess4 per-match point labels (3-1/2-2/1-3) when chess4 with pointsPerGame=4', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Schack4an',
      tournamentId: 7,
      roundNr: 1,
      chess4: true,
      pointsPerGame: 4,
      games: [{ boardNr: 1, whiteName: 'Alice', blackName: 'Bob', resultDisplay: '' }],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('>3-1<')
    expect(html).toContain('>2-2<')
    expect(html).toContain('>1-3<')
    expect(html).not.toMatch(/>1-0</)
    expect(html).not.toMatch(/>½-½</)
    expect(html).not.toMatch(/>0-1</)
  })

  it('uses 2-0/1-1/0-2 labels for non-chess4 pointsPerGame=2 (Skollags-DM style)', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Skollags-DM',
      tournamentId: 8,
      roundNr: 1,
      chess4: false,
      pointsPerGame: 2,
      games: [{ boardNr: 1, whiteName: 'Alice', blackName: 'Bob', resultDisplay: '' }],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('>2-0<')
    expect(html).toContain('>1-1<')
    expect(html).toContain('>0-2<')
    expect(html).not.toMatch(/>1-0</)
    expect(html).not.toMatch(/>½-½</)
    expect(html).not.toMatch(/>0-1</)
  })

  it('postMessage payload includes button label as resultDisplay', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Test',
      tournamentId: 1,
      roundNr: 1,
      games: [{ boardNr: 1, whiteName: 'A', blackName: 'B', resultDisplay: '' }],
    }

    const html = publishRefereePairings(input)
    // The iframe script must forward the button's text so chess4 labels (3-1 etc)
    // reach the confirm dialog and audit log instead of the RESULT_LABELS fallback.
    expect(html).toContain('resultDisplay: btn.textContent')
  })

  it('chess4 ppg=4 WO buttons show 3-0 / 0-3 for chess4 WO results', () => {
    const input: RefereePairingsPublishInput = {
      tournamentName: 'Schack4an',
      tournamentId: 7,
      roundNr: 1,
      chess4: true,
      pointsPerGame: 4,
      games: [{ boardNr: 1, whiteName: 'Alice', blackName: 'Bob', resultDisplay: '' }],
    }

    const html = publishRefereePairings(input)
    expect(html).toContain('3-0 WO')
    expect(html).toContain('0-3 WO')
    expect(html).not.toContain('3-1 WO')
    expect(html).not.toContain('1-3 WO')
  })
})
