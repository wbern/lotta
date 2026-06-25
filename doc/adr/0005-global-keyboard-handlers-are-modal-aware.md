---
status: accepted
date: 2026-06-25

# Governs document-level keyboard handlers and the modal/dialog component that
# should suppress them. Scoped to the dialog primitive, the keybind hooks, and
# the tabs that attach document keydown listeners.
applies_to:
  - "src/components/dialogs/Dialog.tsx"
  - "src/hooks/useKeyboardShortcuts.ts"
  - "src/components/tabs/PairingsTab.tsx"
  - "src/components/**/*.tsx"

pre_filter:
  - "addEventListener('keydown'"
  - "addEventListener(\"keydown\""
  - "document.activeElement"
  - "useKeyboardShortcuts"

complexity: standard
---

# 5. Global keyboard handlers are modal-aware

> Author: architect · 2026-06-25. Triggered by result/Delete keybinds firing
> against the board *behind* an open edit dialog. Relates to CLAUDE.md
> recurring-bug check #8 (document handlers firing in the wrong context).

## Context

`PairingsTab` attaches a `document` `keydown` listener that enters/clears results
and deletes boards. It guards on `document.activeElement.matches('tr[data-board-nr]')`
— element *type* only. The `Dialog` component does no focus management: opening a
dialog (e.g. double-clicking a board row to open the board editor) leaves focus on
the row. So with a modal open over the pairings, pressing a result key (`V`/`R`/`F`/
`Space`) or `Delete` still passes the guard and mutates/deletes the board the user
can no longer even see.

The element-type check is the wrong abstraction: it cannot know a modal is open.
Sprinkling "is a dialog open?" checks into each global handler is the per-case
patch and will be forgotten by the next handler.

## Decision

We will make global keyboard handling **modal-aware at the dialog primitive**: an
open modal owns focus and suppresses document-level shortcuts beneath it. Handlers
do not each re-implement "is something open" — the modal layer guarantees that
keystrokes do not reach the background while a dialog is up (focus trap, and/or a
shared "modal is open" signal that global keybind hooks honour).

**Forbidden pattern:**
```typescript
// ❌ BAD — global handler guards only on element type; fires through an open modal
document.addEventListener('keydown', (e) => {
  if (!document.activeElement?.matches('tr[data-board-nr]')) return
  if (e.key === 'Delete') deleteSelectedBoards()   // runs behind the dialog
})
```

**Required pattern:**
```typescript
// ✅ GOOD — the Dialog traps focus on open, so activeElement is inside the modal
// (or a shared isModalOpen() short-circuits global keybinds).
function Dialog({ open, children }) {
  useFocusTrap(open, ref)        // moves focus into the dialog, restores on close
  ...
}
// Background handlers stay simple; they no longer fire while a modal is open.
```

Acceptance is pinned by `e2e/keybind-modal-context.spec.ts`: with an edit dialog
open over a board, pressing a result key leaves the underlying board unchanged.

## Consequences

**Positive:**
- An entire class of "shortcut mutated something behind the modal" bugs is closed for current and future global handlers.
- Focus-trapping the dialog is also an accessibility win (keyboard users stay inside the modal).

**Negative:**
- Focus management must restore focus correctly on close to avoid losing the user's place.
- Any intentional global shortcut that *should* work while a modal is open (rare) would need an explicit opt-out.

**Neutral:**
- The existing `activeElement` element-type guards can remain as a second line of defence; they are no longer the only thing standing between a modal and the background.

## References

- `src/components/dialogs/Dialog.tsx`, `src/components/tabs/PairingsTab.tsx`, `src/hooks/useKeyboardShortcuts.ts`
- CLAUDE.md recurring-bug check #8
