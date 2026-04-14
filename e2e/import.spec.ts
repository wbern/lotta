import { apiClient, waitForApi } from './api-helpers'
import { expect, test } from './fixtures'

async function importTsv(page: any, content: Buffer) {
  // Convert Node Buffer to array of numbers for page.evaluate
  const bytes = Array.from(content)
  const result = await page.evaluate(async (byteArray: number[]) => {
    const uint8 = new Uint8Array(byteArray)
    const file = new File([uint8], 'players.tsv', { type: 'text/tab-separated-values' })
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/players/import', {
      method: 'POST',
      body: formData,
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`POST /api/players/import failed: ${res.status} ${text}`)
    return JSON.parse(text)
  }, bytes)
  return result
}

test.describe('Player import', () => {
  test('UTF-8 import with BOM', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // UTF-8 BOM + Swedish chars in UTF-8
    const bom = Buffer.from([0xef, 0xbb, 0xbf])
    const body = Buffer.from('Ström\tAnna\tSK Sjövalla\n', 'utf-8')
    const tsv = Buffer.concat([bom, body])

    const result1 = await importTsv(page, tsv)
    expect(result1).toEqual({ imported: 1 })

    // Re-import same file → dedup
    const result2 = await importTsv(page, tsv)
    expect(result2).toEqual({ imported: 0 })

    // Verify club was created
    const clubs: any[] = await $.get('/api/clubs')
    const found = clubs.find((c: any) => c.name === 'SK Sjövalla')
    expect(found, 'Club "SK Sjövalla" should exist').toBeTruthy()
  })

  test('Windows-1252 import fallback', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // Windows-1252 encoded: Björk\tÅsa\tSK Ängby\n
    // ö=0xF6, Å=0xC5, ä=0xE4
    const tsv = Buffer.from([
      0x42,
      0x6a,
      0xf6,
      0x72,
      0x6b, // Björk
      0x09, // tab
      0xc5,
      0x73,
      0x61, // Åsa
      0x09, // tab
      0x53,
      0x4b,
      0x20,
      0xc4,
      0x6e,
      0x67,
      0x62,
      0x79, // SK Ängby
      0x0a, // newline
    ])

    const result = await importTsv(page, tsv)
    expect(result).toEqual({ imported: 1 })

    // Verify club was created with correctly decoded name
    const clubs: any[] = await $.get('/api/clubs')
    const found = clubs.find((c: any) => c.name === 'SK Ängby')
    expect(found, 'Club "SK Ängby" should exist').toBeTruthy()
  })

  test('Multi-player import with dedup + club auto-create', async ({ page }) => {
    await page.goto('/')
    await waitForApi(page)
    const $ = apiClient(page)

    // 4 players across 2 clubs (UTF-8, no BOM)
    const tsv4 = Buffer.from(
      'Eriksson\tLars\tSK Norrköping\n' +
        'Gustafsson\tMaria\tSK Norrköping\n' +
        'Holmberg\tPer\tSK Malmö\n' +
        'Jakobsson\tLisa\tSK Malmö\n',
      'utf-8',
    )

    const result1 = await importTsv(page, tsv4)
    expect(result1).toEqual({ imported: 4 })

    // Re-import all 4 → all deduped
    const result2 = await importTsv(page, tsv4)
    expect(result2).toEqual({ imported: 0 })

    // Import file with 2 new + 2 existing
    const tsvMixed = Buffer.from(
      'Eriksson\tLars\tSK Norrköping\n' +
        'Nyström\tAnders\tSK Norrköping\n' +
        'Holmberg\tPer\tSK Malmö\n' +
        'Sandberg\tElsa\tSK Malmö\n',
      'utf-8',
    )
    const result3 = await importTsv(page, tsvMixed)
    expect(result3).toEqual({ imported: 2 })

    // Verify both clubs exist
    const clubs: any[] = await $.get('/api/clubs')
    expect(
      clubs.find((c: any) => c.name === 'SK Norrköping'),
      'Club "SK Norrköping" should exist',
    ).toBeTruthy()
    expect(
      clubs.find((c: any) => c.name === 'SK Malmö'),
      'Club "SK Malmö" should exist',
    ).toBeTruthy()
  })
})
