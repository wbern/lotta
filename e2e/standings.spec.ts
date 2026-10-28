/**
 * Standings end to end through the real UI: results are entered with the
 * result menu, round 2 is paired from the Lotta menu and the Ställning tab is
 * read back. Players are identified by (lastName, firstName), never by the
 * formatted name, so the test does not depend on the name-presentation setting.
 *
 * Every expected value is computed by hand (see comments).
 */

import { apiClient, createTournament, pairRound, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'
import { selectTournament } from './helpers'

type Key = [lastName: string, firstName: string]

const PLAYERS = [
  { lastName: 'Berg', firstName: 'Bo', ratingI: 1600 },
  { lastName: 'Äberg', firstName: 'Ärla', ratingI: 1500 },
  { lastName: 'Åberg', firstName: 'Åsa', ratingI: 1500 },
  { lastName: 'Cedh', firstName: 'Cilla', ratingI: 1400 },
]

test('standings tab: shared places, Swedish tie order and tiebreak values after two rounds', async ({
  page,
}) => {
  await page.goto('/')
  await waitForApi(page)
  const $ = apiClient(page)
  const { tid } = await createTournament(
    $,
    {
      name: 'Ställningstest',
      pairingSystem: 'Monrad',
      nrOfRounds: 3,
      showELO: false,
      showGroup: false,
      selectedTiebreaks: ['Buchholz', 'Prestationsrating LASK'],
    },
    PLAYERS,
  )
  const keyById = new Map<number, Key>(
    (await $.get(`/api/tournaments/${tid}/players`)).map(
      (p: { id: number; lastName: string; firstName: string }) => [p.id, [p.lastName, p.firstName]],
    ),
  )
  const boardsOf = async (roundNr: number): Promise<[Key, Key][]> => {
    const round = await $.get(`/api/tournaments/${tid}/rounds/${roundNr}`)
    return round.games.map((g: { whitePlayer: { id: number }; blackPlayer: { id: number } }) => [
      keyById.get(g.whitePlayer.id),
      keyById.get(g.blackPlayer.id),
    ])
  }

  // Round 1 seeding: rating, equal ratings in Swedish order (Å before Ä):
  // lots Berg 1, Åberg 2, Äberg 3, Cedh 4 → Åberg–Berg, Cedh–Äberg (lower lot white).
  await pairRound($, tid)
  expect(await boardsOf(1)).toEqual([
    [
      ['Åberg', 'Åsa'],
      ['Berg', 'Bo'],
    ],
    [
      ['Cedh', 'Cilla'],
      ['Äberg', 'Ärla'],
    ],
  ])

  await page.reload()
  await waitForApi(page)
  await selectTournament(page, 'Ställningstest')

  const drawAll = async (roundNr: number) => {
    for (const board of [1, 2]) {
      await page.getByTestId(`result-dropdown-${board}`).click()
      await page.getByTestId('result-context-menu').getByRole('button', { name: /^Remi/ }).click()
      await expect
        .poll(async () => {
          const round = await $.get(`/api/tournaments/${tid}/rounds/${roundNr}`)
          return round.games.find((g: { boardNr: number }) => g.boardNr === board).resultType
        })
        .toBe('DRAW')
    }
  }

  await drawAll(1)

  // Round 2 from the menu. All on ½ → order by lots: Berg, Åberg, Äberg, Cedh.
  // Berg–Åberg met → Berg–Äberg (0 whites each → Äberg white);
  // Åberg–Cedh (1 white each → Cedh white).
  await page.getByTestId('menu-bar').getByRole('button', { name: 'Lotta' }).click()
  await page.getByTestId('menu-dropdown').getByText('Lotta nästa rond').click()
  await expect.poll(async () => (await $.get(`/api/tournaments/${tid}`)).roundsPlayed).toBe(2)
  // The pairings view follows the new round before results are entered.
  await expect(page.getByTestId('tournament-selector').locator('select').nth(2)).toHaveValue('2')
  expect(await boardsOf(2)).toEqual([
    [
      ['Äberg', 'Ärla'],
      ['Berg', 'Bo'],
    ],
    [
      ['Cedh', 'Cilla'],
      ['Åberg', 'Åsa'],
    ],
  ])

  await drawAll(2)

  await page.getByTestId('tab-headers').getByText('Ställning', { exact: true }).click()
  const table = page.getByTestId('data-table')
  await expect(table.locator('th', { hasText: 'Plac' })).toBeVisible()

  // After two rounds everyone has 1 point (two draws).
  // Buchholz: both opponents have 1 → 2 for everyone.
  // Prestationsrating (played games, p = ½ → +0):
  //   Berg (1500 + 1500)/2 = 1500, Åberg (1600 + 1400)/2 = 1500,
  //   Äberg (1400 + 1600)/2 = 1500, Cedh (1500 + 1500)/2 = 1500.
  // All tied → shared place 1 (shown on the first row only); listed by
  // rating, then Swedish name order: Berg 1600, Åberg, Äberg, Cedh 1400.
  const expected: { key: Key; place: string }[] = [
    { key: ['Berg', 'Bo'], place: '1' },
    { key: ['Åberg', 'Åsa'], place: '' },
    { key: ['Äberg', 'Ärla'], place: '' },
    { key: ['Cedh', 'Cilla'], place: '' },
  ]
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(expected.length)
  // Columns with showELO/showGroup off: Plac, Namn, Klubb, Poäng, Buch, Pres.
  for (let i = 0; i < expected.length; i++) {
    const cells = await rows.nth(i).locator('td').allTextContents()
    const [lastName, firstName] = expected[i].key
    const nameWords = cells[1].trim().split(/\s+/)
    expect(nameWords.sort(), `row ${i + 1}`).toEqual([lastName, firstName].sort())
    expect([cells[0], cells[3], cells[4], cells[5]], `row ${i + 1}`).toEqual([
      expected[i].place,
      '1',
      '2',
      '1500',
    ])
  }
})
