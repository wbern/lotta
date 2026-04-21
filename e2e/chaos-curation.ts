/**
 * Chaos curation log (append-only JSONL).
 *
 * `chaos-findings.jsonl` is the RAW pile — every auto-capture the chaos tests
 * emit lands there. It is noisy by design: the same underlying sync bug will
 * reproduce 15 times in one run with 15 different iteration numbers.
 *
 * `chaos-curation-log.jsonl` is the AUDIT TRAIL of what the curation agent
 * (or a human) did with that pile. Every curation step — reading a raw
 * auto-capture, deciding it's a dup, promoting it to a real finding, dropping
 * it as noise, editing an existing finding — emits one line here so the user
 * can verify the agent's work after the fact.
 *
 * Why an explicit log instead of just `git diff`: dedupe and "read, decided
 * it's noise" leave NO trace in the findings file, but are the bulk of the
 * work. Without a log, "I triaged 50 auto-captures and dropped them as dups"
 * is unverifiable.
 *
 * ── jq recipes ────────────────────────────────────────────────────────────
 *
 *   # Everything the agent named "tj" promoted
 *   jq 'select(.agent=="tj" and .action=="promote")' e2e/chaos-curation-log.jsonl
 *
 *   # All steps that touched finding CM-003 (dupes, edits, etc.)
 *   jq 'select(.finding_id=="CM-003" or .dup_of=="CM-003")' e2e/chaos-curation-log.jsonl
 *
 *   # Per-finding step count — see which findings got the most churn
 *   jq -s 'map(select(.finding_id)) | group_by(.finding_id)
 *          | map({id: .[0].finding_id, steps: length})' e2e/chaos-curation-log.jsonl
 *
 *   # Everything that was dropped, with reasons — catch over-aggressive drops
 *   jq 'select(.action=="drop") | {ts, agent, reason, source_line}' e2e/chaos-curation-log.jsonl
 *
 *   # Timeline for one agent session (sorted chronologically by ts)
 *   jq -s 'sort_by(.ts) | .[] | select(.agent=="tj")' e2e/chaos-curation-log.jsonl
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const thisDir = path.dirname(fileURLToPath(import.meta.url))
const CURATION_LOG_PATH = path.join(thisDir, 'chaos-curation-log.jsonl')

export type CurationAction = 'read' | 'dedupe' | 'promote' | 'drop' | 'edit'

export interface CurationStep {
  /** ISO timestamp. Set automatically if omitted. */
  ts?: string
  /** Curation agent handle — 'tj', 'william', future curation bots, etc. */
  agent: string
  /** What the agent did. See type doc above. */
  action: CurationAction
  /** Curated finding id (CM-NNN). Set on promote, referenced by edit/dedupe. */
  finding_id?: string
  /** For `dedupe`: the existing finding_id this raw capture duplicates. */
  dup_of?: string
  /** 1-based line number in chaos-findings.jsonl that the step acts on. */
  source_line?: number
  /** Human-readable justification. Required — why did you make this call? */
  reason: string
  /**
   * Field-level before/after for edits and promotes. Keys are finding fields
   * (severity, status, title, detail, next, …). Agents SHOULD include this
   * whenever they mutate an existing finding — it's what makes the audit
   * trail useful.
   */
  diff?: Record<string, { before: unknown; after: unknown }>
}

/**
 * Append one curation step. Silent on I/O error — curation logging must never
 * abort a curation pass (same policy as appendFinding in chaos-findings.ts).
 */
export function logCurationStep(entry: CurationStep): void {
  const line = {
    ts: entry.ts ?? new Date().toISOString(),
    ...entry,
  }
  try {
    fs.appendFileSync(CURATION_LOG_PATH, `${JSON.stringify(line)}\n`, 'utf8')
  } catch {
    // Logging must never take down a curation pass
  }
}
