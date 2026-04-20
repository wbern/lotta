// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RollbackDialog } from './RollbackDialog'

function renderDialog(props: Partial<React.ComponentProps<typeof RollbackDialog>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <RollbackDialog
        open
        onClose={() => {}}
        onExport={async () => {}}
        onSwitch={() => {}}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('RollbackDialog', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    cleanup()
  })

  it('shows an empty-state message when no versions are available', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ versions: [] }), { status: 200 }),
    )
    renderDialog()
    expect(await screen.findByTestId('rollback-empty')).toBeDefined()
  })

  it('renders a row per available version with the version string', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          versions: [
            { version: '1.2.0', date: '2026-03-01', hash: 'abc' },
            { version: '1.1.0', date: '2026-02-01', hash: 'def' },
          ],
        }),
        { status: 200 },
      ),
    )
    renderDialog()
    expect(await screen.findByTestId('rollback-version-1.2.0')).toBeDefined()
    expect(screen.getByTestId('rollback-version-1.1.0')).toBeDefined()
  })

  it('disables switch buttons until the user triggers a backup export', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ versions: [{ version: '1.0.0', date: null, hash: null }] }), {
        status: 200,
      }),
    )
    renderDialog()
    const switchBtn = (await screen.findByTestId('rollback-switch-1.0.0')) as HTMLButtonElement
    expect(switchBtn.disabled).toBe(true)

    const exportBtn = screen.getByTestId('rollback-export')
    await act(async () => {
      fireEvent.click(exportBtn)
    })

    await waitFor(() => expect(switchBtn.disabled).toBe(false))
  })

  it('invokes onSwitch with the target version when the switch button is clicked', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ versions: [{ version: '1.0.0', date: null, hash: null }] }), {
        status: 200,
      }),
    )
    const onSwitch = vi.fn()
    renderDialog({ onSwitch })
    await screen.findByTestId('rollback-version-1.0.0')

    await act(async () => {
      fireEvent.click(screen.getByTestId('rollback-export'))
    })
    await waitFor(() =>
      expect((screen.getByTestId('rollback-switch-1.0.0') as HTMLButtonElement).disabled).toBe(
        false,
      ),
    )

    fireEvent.click(screen.getByTestId('rollback-switch-1.0.0'))
    expect(onSwitch).toHaveBeenCalledWith('1.0.0')
  })

  it('invokes onExport and surfaces its errors without enabling switch', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ versions: [{ version: '1.0.0', date: null, hash: null }] }), {
        status: 200,
      }),
    )
    const onExport = vi.fn().mockRejectedValue(new Error('export failed'))
    renderDialog({ onExport })
    await screen.findByTestId('rollback-version-1.0.0')

    await act(async () => {
      fireEvent.click(screen.getByTestId('rollback-export'))
    })

    expect(onExport).toHaveBeenCalledOnce()
    expect((screen.getByTestId('rollback-switch-1.0.0') as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByTestId('rollback-export-error')).toBeDefined()
  })
})
