export type BroadcastAffects =
  | { kind: 'results'; tournamentId: number; roundNr: number }
  | { kind: 'pairing'; tournamentId: number; roundNr: number }
  | { kind: 'tournamentDeleted'; tournamentId: number }
  | { kind: 'restore' }

type BroadcastHook = (affects: BroadcastAffects) => Promise<void>

let hook: BroadcastHook | null = null

export function setBroadcastHook(fn: BroadcastHook | null): void {
  hook = fn
}

export async function dispatchBroadcast(affects: BroadcastAffects): Promise<void> {
  if (!hook) return
  await hook(affects)
}
