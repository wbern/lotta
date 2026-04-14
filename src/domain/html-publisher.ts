import { formatResultLabel } from './scoring.ts'

const CSS = `
body {
  font-family: Verdana,Arial,Helvetica,sans-serif;
  font-size: 10pt;
  font-weight: bold;
  color: black;
  background-color: white;
}
.CP_Table {
  font-family: Verdana,Arial,Helvetica,sans-serif;
  font-size: 10pt;
  background-color: white;
  border: black solid 2px;
  width: 850px;
  margin-top: 12px;
}
.CP_TableHeader {
  font-family: Verdana, Arial, Helvetica, sans-serif;
  background-color: #F0F0F0;
}
.CP_Row {
  font-family: Verdana, Arial, Helvetica, sans-serif;
  font-weight: bold;
  text-align: center;
  font-size: 12px;
}
.CP_Place {
  text-align: right;
  padding-right: 15px;
  font-size: 14px;
  border-top: #808080 1px solid;
}
.CP_Player {
  text-align: left;
  border-top: #808080 1px solid;
  border-right: #808080 1px solid;
}
.CP_Group {
  border-top: #808080 1px solid;
  border-right: #808080 1px solid;
}
.CP_Rating {
  border-top: #808080 1px solid;
  border-right: #808080 1px solid;
}
.CP_Score {
  border-top: #808080 1px solid;
  border-right: #808080 1px solid;
  font-size: 14px;
}
.CP_Tiebreak {
  border-top: #808080 1px solid;
  border-right: #808080 1px solid;
}
.CP_AlphabeticalClass {
  break-before: page;
}
.CP_AlphabeticalClass:first-of-type {
  break-before: auto;
}
.CP_AlphabeticalRow {
  font-family: Verdana, Arial, Helvetica, sans-serif;
  font-size: 12pt;
  padding: 2px 0;
}
`

function esc(s: string | null | undefined): string {
  if (s == null) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

interface ResultLabels {
  whiteWin: string
  draw: string
  blackWin: string
  whiteWinWo: string
  blackWinWo: string
  doubleWo: string
}

/**
 * Returns the per-match display labels for each result button in a given
 * scoring config. Delegates to domain/scoring so the labels always mirror the
 * actual stored scores — including chess4 (3-2-1 splits), non-chess4
 * pointsPerGame=2 (Skollags-DM style 2-1-0), and standard 1-½-0.
 */
function getResultLabels(config: { chess4?: boolean; pointsPerGame?: number }): ResultLabels {
  return {
    whiteWin: formatResultLabel('WHITE_WIN', config),
    draw: formatResultLabel('DRAW', config),
    blackWin: formatResultLabel('BLACK_WIN', config),
    whiteWinWo: formatResultLabel('WHITE_WIN_WO', config),
    blackWinWo: formatResultLabel('BLACK_WIN_WO', config),
    doubleWo: formatResultLabel('DOUBLE_WO', config),
  }
}

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style type="text/css">
${CSS}
</style>
</head>
<body>
${body}
</body>
</html>`
}

export interface PairingsPublishInput {
  tournamentName: string
  roundNr: number
  games: {
    boardNr: number
    whiteName: string | null
    blackName: string | null
    resultDisplay: string
    currentResult?: string
  }[]
}

export function publishPairings(input: PairingsPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Lottning rond ${input.roundNr}</h2>\n`
  body += '<table class="CP_Table">\n'
  body +=
    '<tr class="CP_TableHeader"><td>Bord</td><td>Vit</td><td>Resultat</td><td>Svart</td></tr>\n'

  for (const g of input.games) {
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${g.boardNr}</td>`
    body += `<td class="CP_Player">${esc(g.whiteName ?? 'frirond')}</td>`
    body += `<td class="CP_Score">${esc(g.resultDisplay)}</td>`
    body += `<td class="CP_Player">${esc(g.blackName ?? 'frirond')}</td>`
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Lottning - ' + input.tournamentName, body)
}

export interface StandingsPublishInput {
  tournamentName: string
  roundNr: number
  showELO: boolean
  tiebreakNames: string[]
  standings: {
    place: number
    name: string
    club: string | null
    rating: number
    scoreDisplay: string
    tiebreaks: Record<string, string>
  }[]
}

export function publishStandings(input: StandingsPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Ställning efter rond ${input.roundNr}</h2>\n`
  body += '<table class="CP_Table">\n'
  body += '<tr class="CP_TableHeader">'
  body += '<td>Plac</td><td>Namn</td><td>Klubb</td>'
  if (input.showELO) body += '<td>Rating</td>'
  body += '<td>Poäng</td>'
  for (const tb of input.tiebreakNames) {
    body += `<td>${esc(tb)}</td>`
  }
  body += '</tr>\n'

  for (const s of input.standings) {
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${s.place}</td>`
    body += `<td class="CP_Player">${esc(s.name)}</td>`
    body += `<td class="CP_Group">${esc(s.club ?? '')}</td>`
    if (input.showELO) {
      body += `<td class="CP_Rating">${s.rating}</td>`
    }
    body += `<td class="CP_Score">${esc(s.scoreDisplay)}</td>`
    for (const tb of input.tiebreakNames) {
      body += `<td class="CP_Tiebreak">${esc(s.tiebreaks[tb] ?? '')}</td>`
    }
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Ställning - ' + input.tournamentName, body)
}

export interface AlphabeticalPairingsPublishInput {
  tournamentName: string
  roundNr: number
  classes: {
    className: string
    players: {
      firstName: string
      lastName: string
      lotNr: number
      color: 'V' | 'S' | ''
      opponent: {
        firstName: string
        lastName: string
        lotNr: number
        color: 'V' | 'S'
      } | null
    }[]
  }[]
}

export function publishAlphabeticalPairings(input: AlphabeticalPairingsPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Alfabetisk lottning rond ${input.roundNr}</h2>\n`

  for (const klass of input.classes) {
    body += '<div class="CP_AlphabeticalClass">\n'
    if (klass.className) {
      body += `<h3>${esc(klass.className)}</h3>\n`
    }
    for (const p of klass.players) {
      const self = `${esc(p.firstName)} ${esc(p.lastName)} ${p.lotNr}${p.color}`
      if (p.opponent) {
        const opp = `${esc(p.opponent.firstName)} ${esc(p.opponent.lastName)} ${p.opponent.lotNr}${p.opponent.color}`
        body += `<div class="CP_AlphabeticalRow">${self}, ${opp}</div>\n`
      } else {
        body += `<div class="CP_AlphabeticalRow">${self}, frirond</div>\n`
      }
    }
    body += '</div>\n'
  }

  return wrap('Alfabetisk lottning - ' + input.tournamentName, body)
}

export interface PlayerListPublishInput {
  tournamentName: string
  players: {
    name: string
    club: string | null
    rating: number
  }[]
}

export function publishPlayerList(input: PlayerListPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Spelarlista</h2>\n`
  body += '<table class="CP_Table">\n'
  body += '<tr class="CP_TableHeader"><td>Nr</td><td>Namn</td><td>Klubb</td><td>Rating</td></tr>\n'

  for (let i = 0; i < input.players.length; i++) {
    const p = input.players[i]
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${i + 1}</td>`
    body += `<td class="CP_Player">${esc(p.name)}</td>`
    body += `<td class="CP_Group">${esc(p.club ?? '')}</td>`
    body += `<td class="CP_Rating">${p.rating}</td>`
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Spelarlista - ' + input.tournamentName, body)
}

export interface ClubStandingsPublishInput {
  tournamentName: string
  roundNr: number
  standings: {
    place: number
    club: string
    scoreDisplay: string
  }[]
}

export function publishClubStandings(input: ClubStandingsPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Klubbställning efter rond ${input.roundNr}</h2>\n`
  body += '<table class="CP_Table">\n'
  body += '<tr class="CP_TableHeader"><td>Plac</td><td>Klubb</td><td>Poäng</td></tr>\n'

  for (const s of input.standings) {
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${s.place}</td>`
    body += `<td class="CP_Player">${esc(s.club)}</td>`
    body += `<td class="CP_Score">${esc(s.scoreDisplay)}</td>`
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Klubbställning - ' + input.tournamentName, body)
}

export interface Chess4StandingsPublishInput {
  tournamentName: string
  roundNr: number
  standings: {
    place: number
    club: string
    playerCount: number
    chess4Members: number
    score: number
  }[]
}

export function publishChess4Standings(input: Chess4StandingsPublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Schack4an-ställning efter rond ${input.roundNr}</h2>\n`
  body += '<table class="CP_Table">\n'
  body +=
    '<tr class="CP_TableHeader"><td>Plac</td><td>Klubb</td><td>Spelare</td><td>Klasstorlek</td><td>Poäng</td></tr>\n'

  for (const s of input.standings) {
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${s.place}</td>`
    body += `<td class="CP_Player">${esc(s.club)}</td>`
    body += `<td class="CP_Rating">${s.playerCount}</td>`
    body += `<td class="CP_Rating">${s.chess4Members}</td>`
    body += `<td class="CP_Score">${s.score}</td>`
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Schack4an-ställning - ' + input.tournamentName, body)
}

export interface RefereePairingsPublishInput {
  tournamentName: string
  tournamentId: number
  roundNr: number
  chess4?: boolean
  pointsPerGame?: number
  games: {
    boardNr: number
    whiteName: string | null
    blackName: string | null
    resultDisplay: string
    currentResult?: string
  }[]
}

const REFEREE_CSS = `
.ref-row { display: grid; grid-template-columns: 28px 1fr auto 1fr; align-items: center;
  padding: 10px 4px; border-bottom: 1px solid #ddd; gap: 6px; }
.ref-board { text-align: right; font-weight: bold; }
.ref-white { text-align: right; }
.ref-black { text-align: left; }
.ref-result { display: flex; gap: 6px; align-items: center; }
.ref-btn { padding: 8px 10px; border: 1px solid #999; border-radius: 4px; background: #f5f5f5;
  font-size: 14px; font-weight: bold; cursor: pointer; min-width: 44px; text-align: center;
  touch-action: manipulation; white-space: nowrap; }
.ref-btn:active { background: #ddd; }
.ref-btn--active { background: #4CAF50; color: white; border-color: #4CAF50; }
.ref-current { padding: 8px 10px; font-size: 14px; font-weight: bold; color: #333; }
.ref-more { padding: 8px; border: 1px solid #999; border-radius: 4px; background: #f5f5f5;
  font-size: 14px; cursor: pointer; touch-action: manipulation; }
.ref-extra { display: none; gap: 6px; padding: 6px 0 6px 34px; flex-wrap: wrap; }
.ref-extra.open { display: flex; }
`

export function publishRefereePairings(input: RefereePairingsPublishInput): string {
  const labels = getResultLabels({
    chess4: input.chess4,
    pointsPerGame: input.pointsPerGame,
  })
  const results = [
    { type: 'WHITE_WIN', label: labels.whiteWin },
    { type: 'DRAW', label: labels.draw },
    { type: 'BLACK_WIN', label: labels.blackWin },
  ]
  const extraResults = [
    { type: 'WHITE_WIN_WO', label: labels.whiteWinWo },
    { type: 'BLACK_WIN_WO', label: labels.blackWinWo },
    { type: 'DOUBLE_WO', label: labels.doubleWo },
  ]

  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Rond ${input.roundNr}</h2>\n`

  for (const g of input.games) {
    body += `<div class="ref-row" data-board="${g.boardNr}">\n`
    body += `  <div class="ref-board">${g.boardNr}</div>\n`
    body += `  <div class="ref-white">${esc(g.whiteName ?? 'frirond')}</div>\n`
    body += `  <div class="ref-result">\n`
    for (const r of results) {
      const active = g.currentResult === r.type ? ' ref-btn--active' : ''
      body += `    <button class="ref-btn${active}" data-result="${r.type}" data-board="${g.boardNr}">${r.label}</button>\n`
    }
    body += `    <button class="ref-more" data-toggle="${g.boardNr}">…</button>\n`
    body += `  </div>\n`
    body += `  <div class="ref-black">${esc(g.blackName ?? 'frirond')}</div>\n`
    body += `</div>\n`
    body += `<div class="ref-extra" id="extra-${g.boardNr}">\n`
    for (const r of extraResults) {
      const active = g.currentResult === r.type ? ' ref-btn--active' : ''
      body += `  <button class="ref-btn${active}" data-result="${r.type}" data-board="${g.boardNr}">${r.label}</button>\n`
    }
    body += `</div>\n`
  }

  const script = `
<script>
(function() {
  var meta = ${JSON.stringify({ tournamentId: input.tournamentId, roundNr: input.roundNr })};
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-result]');
    if (btn) {
      var board = Number(btn.getAttribute('data-board'));
      var result = btn.getAttribute('data-result');
      // Toggle active state visually
      var row = btn.closest('.ref-row') || btn.closest('.ref-extra');
      var boardBtns = document.querySelectorAll('[data-board="' + board + '"]');
      for (var i = 0; i < boardBtns.length; i++) {
        if (boardBtns[i].hasAttribute('data-result')) {
          boardBtns[i].classList.remove('ref-btn--active');
        }
      }
      btn.classList.add('ref-btn--active');
      window.parent.postMessage({
        type: 'referee-result',
        tournamentId: meta.tournamentId,
        roundNr: meta.roundNr,
        boardNr: board,
        resultType: result,
        resultDisplay: btn.textContent
      }, '*');
      return;
    }
    var toggle = e.target.closest('[data-toggle]');
    if (toggle) {
      var id = 'extra-' + toggle.getAttribute('data-toggle');
      var el = document.getElementById(id);
      if (el) el.classList.toggle('open');
    }
  });
})();
</script>`

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Domare - ${esc(input.tournamentName)}</title>
<style type="text/css">
${CSS}
${REFEREE_CSS}
</style>
</head>
<body>
${body}
${script}
</body>
</html>`
}

export interface CrossTablePublishInput {
  tournamentName: string
  roundCount: number
  players: {
    nr: number
    name: string
    rounds: { opponentNr: number | null; color: string }[]
    totalScore: string
  }[]
}

export function publishCrossTable(input: CrossTablePublishInput): string {
  let body = ''
  body += `<h2>${esc(input.tournamentName)} - Korstabell</h2>\n`
  body += '<table class="CP_Table">\n'
  body += '<tr class="CP_TableHeader">'
  body += '<td>Nr</td><td>Namn</td>'
  for (let r = 1; r <= input.roundCount; r++) {
    body += `<td>R${r}</td>`
  }
  body += '<td>Poäng</td>'
  body += '</tr>\n'

  for (const p of input.players) {
    body += '<tr class="CP_Row">'
    body += `<td class="CP_Place">${p.nr}</td>`
    body += `<td class="CP_Player">${esc(p.name)}</td>`

    for (const r of p.rounds) {
      if (r.opponentNr != null) {
        body += `<td class="CP_Tiebreak">${r.opponentNr}${r.color}</td>`
      } else {
        body += '<td class="CP_Tiebreak">-</td>'
      }
    }

    body += `<td class="CP_Score">${esc(p.totalScore)}</td>`
    body += '</tr>\n'
  }

  body += '</table>\n'
  return wrap('Korstabell - ' + input.tournamentName, body)
}
