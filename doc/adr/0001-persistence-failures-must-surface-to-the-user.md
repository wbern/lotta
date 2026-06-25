---
status: accepted
date: 2026-06-25

# Governs every code path that writes to the database and the UI that triggers
# it: the withSave persistence wrapper, the mutation hooks, and the components
# whose buttons/handlers invoke those mutations.
applies_to:
  - "src/api/service-provider.ts"
  - "src/api/**/*.ts"
  - "src/hooks/**/*.ts"
  - "src/components/**/*.tsx"

pre_filter:
  - "withSave"
  - ".mutate("
  - "mutateAsync"
  - "onError"
  - "deleteGame"
  - "performUndo"

complexity: standard
---

# 1. Persistence failures must surface to the user

> Author: architect · 2026-06-25. Triggered by a frontline report ("pressing
> Spara did nothing" on a locked-down work laptop) that an audit traced to a
> *class* of ~17 actions, not a one-off. Relates to ADR-0003 (validation at the
> boundary).

## Context

Every database write funnels through `withSave()` (`src/api/service-provider.ts`):
it performs the in-memory operation, then `await getDatabaseService().save()`,
which serialises to IndexedDB via `put()`. On a browser where storage is blocked
or out of quota, `put()` throws and the whole promise rejects.

The rejection has nowhere to go. Mutation call sites pass an `onSuccess` and omit
`onError`; imperative writes (`deleteGame`, undo/redo) `void` the promise. So the
work is silently lost: the dialog stays open, no message appears, and the user
concludes "the button does nothing." An audit found this in ~17 actions (create
/update tournament, settings, result entry, pool & tournament-player CRUD, club
rename/delete, delete tournament, undo/redo, chess4 member count, delete board).

This is a single architectural gap — there is no shared place that turns a failed
write into feedback — not 17 independent bugs. Fixing it per-call-site (17 hand-
added `onError`s) would be fragile and would silently regress the moment someone
adds an 18th mutation.

## Decision

We will surface persistence failures from a **single shared layer on the write
path**, so that *any* failed write produces user-visible feedback regardless of
the call site. Individual handlers must not be the only thing standing between a
failed save and the user.

The concrete mechanism (a global React Query `MutationCache.onError`, and/or a
failure signal emitted by `withSave` itself, routed to the toast system) is an
implementation choice, but the invariant is fixed: **a rejected write is never
silent.**

**Forbidden pattern:**
```typescript
// ❌ BAD — onError omitted; a failed save is swallowed and the user sees nothing
createMutation.mutate(form, { onSuccess: (t) => onCreated(t.id) })

// ❌ BAD — imperative write with the rejection void'd
void deleteGame(tid, round, boardNr)
```

**Required pattern:**
```typescript
// ✅ GOOD — failures reach a shared surface. Either rely on the global
// MutationCache.onError (preferred), or, for imperative writes, route the
// rejection to the same feedback channel.
createMutation.mutate(form, { onSuccess: (t) => onCreated(t.id) })
// ...with, configured once:
new QueryClient({
  mutationCache: new MutationCache({ onError: (err) => showSaveError(err) }),
})
```

Acceptance is pinned by the failing e2e specs that force an IndexedDB write
failure and assert feedback appears: `e2e/create-tournament-save-no-feedback.spec.ts`,
`e2e/save-failure-feedback.spec.ts`, `e2e/save-failure-pool.spec.ts`,
`e2e/save-failure-tournament-players.spec.ts`, `e2e/save-failure-actions.spec.ts`.
A correct systemic fix turns all of them green at once.

## Consequences

**Positive:**
- One change covers every current and future write; new mutations are protected by default.
- The data-loss-without-warning failure mode is eliminated, which matters most on the locked-down machines real users run.

**Negative:**
- A shared error surface needs care so a burst of failures does not spam toasts (debounce/coalesce).
- Some flows may want bespoke recovery (e.g. keep the dialog open, offer a backup) on top of the generic toast.

**Neutral:**
- The per-handler `onError` remains available for *flow-specific* handling (e.g. dialog inline errors), layered on top of the global surface, not as a replacement for it.

## References

- `src/api/service-provider.ts` (`withSave`), `src/components/toast/ToastProvider.tsx`
- `e2e/storage-failure.ts` (shared harness)
