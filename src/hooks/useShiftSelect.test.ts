// @vitest-environment jsdom

import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useShiftSelect } from './useShiftSelect'

interface Item {
  id: number
}

const items: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]

function clickEvent(shiftKey: boolean): React.MouseEvent {
  return { shiftKey, preventDefault: () => {} } as unknown as React.MouseEvent
}

function renderShiftSelect() {
  let selected = new Set<number>()
  const setSelectedIds = vi.fn((updater: (prev: Set<number>) => Set<number>) => {
    selected = updater(selected)
  })
  const { result } = renderHook(() => useShiftSelect<Item>(items, setSelectedIds))
  return { result, getSelected: () => selected }
}

describe('useShiftSelect', () => {
  it('prevents default on mousedown when shift is held so the browser does not start a text range', () => {
    const { result } = renderHook(() => useShiftSelect<Item>(items, () => {}))
    const preventDefault = vi.fn()

    result.current.handleMouseDown({
      shiftKey: true,
      preventDefault,
    } as unknown as React.MouseEvent)

    expect(preventDefault).toHaveBeenCalledTimes(1)
  })

  it('does not prevent default on mousedown without shift', () => {
    const { result } = renderHook(() => useShiftSelect<Item>(items, () => {}))
    const preventDefault = vi.fn()

    result.current.handleMouseDown({
      shiftKey: false,
      preventDefault,
    } as unknown as React.MouseEvent)

    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('plain click replaces the selection with just the clicked id', () => {
    const { result, getSelected } = renderShiftSelect()

    result.current.handleClick(2, clickEvent(false))
    result.current.handleClick(4, clickEvent(false))

    expect([...getSelected()]).toEqual([4])
  })

  it('shift+click after a plain click adds the inclusive range to the selection', () => {
    const { result, getSelected } = renderShiftSelect()

    result.current.handleClick(2, clickEvent(false))
    result.current.handleClick(4, clickEvent(true))

    expect([...getSelected()].sort()).toEqual([2, 3, 4])
  })

  it('shift+click works the same way when extending backwards', () => {
    const { result, getSelected } = renderShiftSelect()

    result.current.handleClick(4, clickEvent(false))
    result.current.handleClick(2, clickEvent(true))

    expect([...getSelected()].sort()).toEqual([2, 3, 4])
  })

  it('shift+click without a prior click falls back to single-select', () => {
    const { result, getSelected } = renderShiftSelect()

    result.current.handleClick(3, clickEvent(true))

    expect([...getSelected()]).toEqual([3])
  })

  it('shift+click moves the anchor so a follow-up shift+click extends from the latest target', () => {
    const { result, getSelected } = renderShiftSelect()

    result.current.handleClick(1, clickEvent(false))
    result.current.handleClick(3, clickEvent(true))
    result.current.handleClick(5, clickEvent(true))

    expect([...getSelected()].sort()).toEqual([1, 2, 3, 4, 5])
  })
})
