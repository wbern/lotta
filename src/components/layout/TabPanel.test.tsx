// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { sv } from '../../lib/swedish-text'
import { TabPanel } from './TabPanel'

afterEach(() => cleanup())

describe('TabPanel getting-started steps', () => {
  // Step 2 must name the menu item that actually puts players in the
  // tournament. Spelarpool cannot, so following the old hint ended in
  // "Lägg till några spelare först!" at step 3.
  it('given no tournament is selected, then step 2 points to Spelare → Turneringsspelare', () => {
    render(
      <TabPanel
        activeTab="pairings"
        onTabChange={vi.fn()}
        tournamentId={undefined}
        round={undefined}
        rounds={[]}
        selectedBoards={new Set()}
        onSelectedBoardsChange={vi.fn()}
      />,
    )

    expect(screen.getByText(`Spelare → ${sv.menu.tournamentPlayers}`)).toBeTruthy()
    expect(screen.queryByText('Spelare → Spelarpool')).toBeNull()
  })
})
