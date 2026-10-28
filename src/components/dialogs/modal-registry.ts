/**
 * Tracks how many modal dialogs are currently open, so document-level keyboard
 * shortcuts (undo/redo, pairings keybinds) can stay inert while a modal owns the
 * screen (ADR-0005). Dialog registers itself while `open`; handlers query
 * `isAnyModalOpen()` instead of each re-implementing "is something open".
 */
let openCount = 0

export function registerOpenModal(): () => void {
  openCount++
  let released = false
  return () => {
    if (released) return
    released = true
    openCount--
  }
}

export function isAnyModalOpen(): boolean {
  return openCount > 0
}
