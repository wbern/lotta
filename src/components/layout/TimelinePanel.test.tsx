// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AuditEntry } from '../../db/undo-manager'
import { TimelinePanel } from './TimelinePanel'

const ENTRIES: AuditEntry[] = [
  {
    index: 1,
    label: 'Ny klubb',
    detail: 'SK Rockaden',
    timestamp: 1700000000000,
    snapshotIndex: 10,
  },
  {
    index: 2,
    label: 'Ange resultat',
    detail: 'Bord 1: 1-0',
    timestamp: 1700000060000,
    snapshotIndex: 20,
  },
  { index: 3, label: 'Lotta rond', detail: 'Rond 3', timestamp: 1700000120000, snapshotIndex: 30 },
]

describe('TimelinePanel', () => {
  afterEach(cleanup)

  it('renders nothing when closed', () => {
    const { container } = render(
      <TimelinePanel
        open={false}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={vi.fn()}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders entries in reverse order (newest first)', () => {
    render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const labels = screen.getAllByText(/Ny klubb|Ange resultat|Lotta rond/)
    expect(labels[0].textContent).toBe('Lotta rond')
    expect(labels[1].textContent).toBe('Ange resultat')
    expect(labels[2].textContent).toBe('Ny klubb')
  })

  it('highlights the current entry', () => {
    const { container } = render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={20}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const currentEntries = container.querySelectorAll('.timeline-entry--current')
    expect(currentEntries).toHaveLength(1)

    const label = currentEntries[0].querySelector('.timeline-label')
    expect(label?.textContent).toBe('Ange resultat')
  })

  it('renders detail subtitles', () => {
    const { container } = render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const details = container.querySelectorAll('.timeline-detail')
    expect(details).toHaveLength(3)
    expect(details[0].textContent).toBe('Rond 3')
    expect(details[1].textContent).toBe('Bord 1: 1-0')
    expect(details[2].textContent).toBe('SK Rockaden')
  })

  it('omits detail element when detail is empty', () => {
    const entries: AuditEntry[] = [
      { index: 1, label: 'Test', detail: '', timestamp: 1700000000000, snapshotIndex: 10 },
    ]
    const { container } = render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={entries}
        currentSnapshotIndex={10}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const details = container.querySelectorAll('.timeline-detail')
    expect(details).toHaveLength(0)
  })

  it('shows Återställ hit button only for non-current entries', () => {
    render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={20}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const restoreButtons = screen.getAllByText('Återställ hit')
    // Current entry (snapshotIndex=20) has no button, other 2 do
    expect(restoreButtons).toHaveLength(2)
  })

  it('calls onRestoreToPoint with correct snapshotIndex', () => {
    const onRestore = vi.fn()
    render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={onRestore}
      />,
    )

    // Click the first restore button (newest non-current = Ange resultat, snapshotIndex=20)
    const restoreButtons = screen.getAllByText('Återställ hit')
    restoreButtons[0].click()

    expect(onRestore).toHaveBeenCalledWith(20)
  })

  it('shows empty state when no entries', () => {
    render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={[]}
        currentSnapshotIndex={-1}
        onRestoreToPoint={vi.fn()}
      />,
    )

    expect(screen.getByText('Inga ändringar ännu.')).toBeTruthy()
  })

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <TimelinePanel
        open={true}
        onClose={onClose}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={vi.fn()}
      />,
    )

    const overlay = container.querySelector('.timeline-overlay')!
    overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <TimelinePanel
        open={true}
        onClose={onClose}
        entries={ENTRIES}
        currentSnapshotIndex={30}
        onRestoreToPoint={vi.fn()}
      />,
    )

    screen.getByLabelText('Stäng').click()

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('formats timestamps as HH:MM', () => {
    render(
      <TimelinePanel
        open={true}
        onClose={vi.fn()}
        entries={[
          { index: 1, label: 'Test', detail: '', timestamp: 1700000000000, snapshotIndex: 10 },
        ]}
        currentSnapshotIndex={10}
        onRestoreToPoint={vi.fn()}
      />,
    )

    // The timestamp 1700000000000 = 2023-11-14T22:13:20Z
    // In sv-SE locale, toLocaleTimeString with hour/minute should produce HH:MM
    const timeEl = document.querySelector('.timeline-time')
    expect(timeEl?.textContent).toMatch(/^\d{2}:\d{2}$/)
  })
})
