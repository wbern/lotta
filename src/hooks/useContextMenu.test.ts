// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useContextMenu } from './useContextMenu'

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function openAt(result: { current: ReturnType<typeof useContextMenu> }, boardNr: number) {
  act(() => {
    result.current.open(
      { preventDefault: () => {}, clientX: 0, clientY: 0 } as React.MouseEvent,
      boardNr,
    )
  })
}

describe('useContextMenu outside dismissal', () => {
  it('closes the menu when a pointerdown fires anywhere on the document', () => {
    const { result } = renderHook(() => useContextMenu())

    openAt(result, 3)
    expect(result.current.state).not.toBeNull()

    act(() => {
      document.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    })

    expect(result.current.state).toBeNull()
  })

  it('removes the keydown listener when the menu closes', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const { result } = renderHook(() => useContextMenu())

    openAt(result, 1)
    act(() => {
      result.current.close()
    })

    const keydownAdds = addSpy.mock.calls.filter((c) => c[0] === 'keydown').length
    const keydownRemoves = removeSpy.mock.calls.filter((c) => c[0] === 'keydown').length
    expect(keydownAdds).toBe(keydownRemoves)
  })
})
