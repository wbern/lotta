// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ChangelogRelease } from '../../domain/changelog'

const mockReleases: ChangelogRelease[] = [
  {
    version: '1.2.0',
    date: '2026-05-01',
    commits: [{ sha: 'c', type: 'feat', scope: null, breaking: false, message: 'new-120' }],
  },
  {
    version: '1.1.0',
    date: '2026-04-25',
    commits: [{ sha: 'b', type: 'feat', scope: null, breaking: false, message: 'new-110' }],
  },
  {
    version: '1.0.0',
    date: '2026-04-20',
    commits: [{ sha: 'a', type: 'fix', scope: null, breaking: false, message: 'current' }],
  },
  {
    version: '0.9.0',
    date: '2026-04-10',
    commits: [{ sha: 'o', type: 'feat', scope: null, breaking: false, message: 'old' }],
  },
]

vi.mock('../../domain/changelog', async () => {
  const actual =
    await vi.importActual<typeof import('../../domain/changelog')>('../../domain/changelog')
  return { ...actual, fetchChangelog: vi.fn(async () => mockReleases) }
})

vi.stubGlobal('__GIT_TAG__', 'v1.0.0')
vi.stubGlobal('__COMMIT_HASH__', 'a')
vi.stubGlobal('__COMMIT_DATE__', '2026-04-20 00:00:00 +0000')

import { WhatsNewDialog } from './WhatsNewDialog'

afterEach(cleanup)
afterAll(() => vi.unstubAllGlobals())

describe('WhatsNewDialog version filtering', () => {
  it('hides releases older than or equal to the current version by default', async () => {
    render(<WhatsNewDialog open onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('new-120')).toBeTruthy())
    expect(screen.getByText('new-110')).toBeTruthy()
    expect(screen.queryByText('current')).toBeNull()
    expect(screen.queryByText('old')).toBeNull()
  })

  it('reveals older releases after clicking the expand link', async () => {
    render(<WhatsNewDialog open onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('new-120')).toBeTruthy())
    fireEvent.click(screen.getByText(/Visa tidigare versioner/))

    expect(screen.getByText('current')).toBeTruthy()
    expect(screen.getByText('old')).toBeTruthy()
  })

  it('renders a heading per release with version and date', async () => {
    render(<WhatsNewDialog open onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText('v1.2.0 (2026-05-01)')).toBeTruthy())
    expect(screen.getByText('v1.1.0 (2026-04-25)')).toBeTruthy()
  })
})

describe('WhatsNewDialog without a known current version', () => {
  // Simulates a dev server / untagged checkout where `git describe` had no
  // tag to return. Without the fallback the dialog would label every past
  // release as "new to you".
  beforeAll(() => vi.stubGlobal('__GIT_TAG__', ''))
  afterAll(() => vi.stubGlobal('__GIT_TAG__', 'v1.0.0'))

  it('hides the release archive by default, exposes it via the toggle', async () => {
    render(<WhatsNewDialog open onClose={() => {}} />)

    await waitFor(() => expect(screen.getByText(/Inga nya ändringar/)).toBeTruthy())
    expect(screen.queryByText('new-120')).toBeNull()

    fireEvent.click(screen.getByText(/Visa tidigare versioner/))
    expect(screen.getByText('new-120')).toBeTruthy()
    expect(screen.getByText('new-110')).toBeTruthy()
  })
})
