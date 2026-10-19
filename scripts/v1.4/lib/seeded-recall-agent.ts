/**
 * Seeded recall on agent snapshots (REV-05 §5 item 1; v1.4 U10). Pure helpers of `scripts/v1.4/seeded-recall-agent.ts`.
 * DEVELOPMENT DATA ONLY: not a registered SO4 estimate, no pre-registration.
 *
 * - `operatorsFor(style)`: which existing operators are applied to a snapshot of a style. The U5a catalogue operators
 *   (`scripts/lib/mutation/operators`, written against the Clean layer kinds) whose coverage is `in`, on every style
 *   (an operator whose templates the style's spec does not enable shows as `no-expected-key`, a feasibility finding,
 *   never as a miss); the hexagonal/DDD operators (`scripts/lib/mutation/hexddd`) on the styles `stylesOf` gives them.
 *   Positives and their twins; the outside-coverage operators (MO-X01..X03) and the judge probes are left out (they
 *   have no symbolic key by design).
 * - `classifyRow`: a positive is `detected` when every expected key is matched by a violation the unmutated snapshot
 *   does not have (`operators-hexddd.ts` `newViolations` / `matchesKey`, the hex/DDD run's rule), `missed` otherwise;
 *   a twin is a `false-fire` when it adds a blocking violation, else `silent`.
 * - `summariseRecall`: per style × operator and per style, the detection rate with a Wilson 95 % interval, over the
 *   rows that compiled and were evaluated; whether the operator's expected templates are blocking under the style.
 */
import { ruleTier } from '../../../src/scoring-engine/rule-tiers.js';
import { CATALOGUE_OPERATORS } from '../../lib/mutation/operators/index.js';
import { HEXDDD_OPERATORS, stylesOf } from '../../lib/mutation/hexddd/index.js';
import type { MutationOperator, MutationSite } from '../../lib/mutation/types.js';
import { wilson } from '../../lib/stats.js';
import { matchesKey, newViolations } from '../../v1.3/lib/operators-hexddd.js';
import type { ExpectedKey, Violation } from '../../v1.3/lib/operators-hexddd.js';

export type RecallStyle = 'layered' | 'clean' | 'hexagonal' | 'ddd';

/** The positive id of an operator (`MO-S01n` → `MO-S01`). */
export function positiveOf(op: MutationOperator): string {
  return op.twinOf ?? op.id;
}

export function operatorsFor(style: string): MutationOperator[] {
  const cat = CATALOGUE_OPERATORS.filter((o) => o.coverage === 'in' && o.role !== 'probe' && o.judgeProbe === undefined);
  const hd = HEXDDD_OPERATORS.filter((o) => (stylesOf(o) as readonly string[]).includes(style));
  return [...cat, ...hd];
}

/**
 * Operators whose positive encodes a direction the style's spec permits (found in the 2026-10-19 run, not assumed):
 * the U5a catalogue was written against the Clean layer kinds, where an import from the domain kind into the
 * infrastructure kind is the violation. The Layered preset maps `business` to the domain kind and `persistence` to the
 * infrastructure kind, and closed layering allows exactly that step down (`presets/layered.yaml` header). So under
 * Layered the MO-S01 and MO-DF01 positives add a legal edge, and their twins add the reverse (illegal) one. Their rows
 * are kept and shown; the per-style total is also given without them.
 */
export const DIRECTION_MISMATCH: Readonly<Record<string, readonly string[]>> = Object.freeze({ layered: ['MO-S01', 'MO-S01n', 'MO-DF01', 'MO-DF01n'] });

export function isMismatched(style: string, operatorId: string): boolean {
  return (DIRECTION_MISMATCH[style] ?? []).includes(operatorId);
}

export type RecallStatus = 'detected' | 'missed' | 'silent' | 'false-fire' | 'no-expected-key' | 'apply-error' | 'typecheck' | 'evaluate-error';

export interface RecallRow {
  readonly rowId: string;
  readonly snapshotId: string;
  readonly generator: string;
  readonly task: string;
  readonly arm: string;
  readonly style: string;
  readonly operatorId: string;
  readonly positiveId: string;
  readonly role: 'positive' | 'twin';
  readonly site: MutationSite;
  readonly status: RecallStatus;
  readonly expected: readonly ExpectedKey[];
  readonly absentTemplates: readonly string[];
  readonly hits: readonly boolean[];
  readonly newBlocking: readonly Violation[];
  /** Type-check: error count of the mutant and of its unmutated snapshot (both stubbed alike). */
  readonly typecheck: { readonly base: number; readonly mutant: number | null };
  readonly detail?: string;
  readonly diff: string;
}

/** Detected / missed / false-fire / silent from the evaluated violations (module header). */
export function classifyRow(
  role: 'positive' | 'twin',
  keys: readonly ExpectedKey[],
  baseline: readonly Violation[],
  mutant: readonly Violation[],
  style: string,
): { readonly status: RecallStatus; readonly hits: boolean[]; readonly newBlocking: Violation[] } {
  const fresh = newViolations(baseline, mutant);
  const newBlocking = fresh.filter((v) => ruleTier(v.functionId, style).tier === 'blocking');
  if (role === 'twin') return { status: newBlocking.length > 0 ? 'false-fire' : 'silent', hits: [], newBlocking };
  if (keys.length === 0) return { status: 'no-expected-key', hits: [], newBlocking };
  const hits = keys.map((k) => fresh.some((v) => matchesKey(v, k)));
  return { status: hits.every(Boolean) ? 'detected' : 'missed', hits, newBlocking };
}

/** Whether the operator's expected keys are blocking under the style (any key's function id). */
export function blockingKeys(keys: readonly ExpectedKey[], style: string): boolean {
  return keys.some((k) => ruleTier(k.functionId, style).tier === 'blocking');
}

export interface FeasibilityCell {
  readonly snapshotId: string;
  readonly style: string;
  readonly operatorId: string;
  readonly candidates: number;
  readonly eligible: number;
  readonly sampled: number;
  readonly rejected: Readonly<Record<string, number>>;
}

export interface RecallSummary {
  readonly style: string;
  /** `*` for the per-style total over positives with a key; `*-matched` without the `DIRECTION_MISMATCH` operators. */
  readonly operatorId: string;
  readonly snapshots: number;
  readonly candidates: number;
  readonly eligible: number;
  readonly applied: number;
  readonly compiled: number;
  readonly evaluated: number;
  readonly hits: number;
  readonly rate: number | null;
  readonly low: number | null;
  readonly high: number | null;
  /** Twins only: blocking false fires over evaluated twins. */
  readonly falseFires: number;
  readonly noKey: number;
  readonly blocking: boolean | null;
}

function rateOf(hits: number, n: number): Pick<RecallSummary, 'rate' | 'low' | 'high'> {
  if (n === 0) return { rate: null, low: null, high: null };
  const iv = wilson(hits, n);
  return { rate: hits / n, low: iv.low, high: iv.high };
}

export function summariseRecall(rows: readonly RecallRow[], cells: readonly FeasibilityCell[]): RecallSummary[] {
  const out: RecallSummary[] = [];
  const styles = [...new Set(cells.map((c) => c.style))].sort();
  for (const style of styles) {
    const ops = [...new Set(cells.filter((c) => c.style === style).map((c) => c.operatorId))];
    let totHits = 0;
    let totN = 0;
    let okHits = 0;
    let okN = 0;
    for (const op of ops) {
      const cs = cells.filter((c) => c.style === style && c.operatorId === op);
      const rs = rows.filter((r) => r.style === style && r.operatorId === op);
      const evaluated = rs.filter((r) => r.status === 'detected' || r.status === 'missed' || r.status === 'silent' || r.status === 'false-fire');
      const hits = rs.filter((r) => r.status === 'detected').length;
      const nPos = rs.filter((r) => r.status === 'detected' || r.status === 'missed').length;
      const keyed = rs.filter((r) => r.expected.length > 0);
      totHits += hits;
      totN += nPos;
      if (!isMismatched(style, op)) {
        okHits += hits;
        okN += nPos;
      }
      out.push({
        style,
        operatorId: op,
        snapshots: cs.length,
        candidates: cs.reduce((a, c) => a + c.candidates, 0),
        eligible: cs.reduce((a, c) => a + c.eligible, 0),
        applied: rs.filter((r) => r.status !== 'apply-error').length,
        compiled: rs.filter((r) => r.status !== 'apply-error' && r.status !== 'typecheck').length,
        evaluated: evaluated.length,
        hits,
        ...rateOf(hits, nPos),
        falseFires: rs.filter((r) => r.status === 'false-fire').length,
        noKey: rs.filter((r) => r.status === 'no-expected-key').length,
        blocking: keyed.length === 0 ? null : keyed.some((r) => blockingKeys(r.expected, style)),
      });
    }
    out.push({
      style, operatorId: '*', snapshots: new Set(cells.filter((c) => c.style === style).map((c) => c.snapshotId)).size,
      candidates: 0, eligible: 0, applied: 0, compiled: 0, evaluated: totN, hits: totHits, ...rateOf(totHits, totN), falseFires: 0, noKey: 0, blocking: null,
    });
    if (ops.some((op) => isMismatched(style, op))) {
      out.push({
        style, operatorId: '*-matched', snapshots: new Set(cells.filter((c) => c.style === style).map((c) => c.snapshotId)).size,
        candidates: 0, eligible: 0, applied: 0, compiled: 0, evaluated: okN, hits: okHits, ...rateOf(okHits, okN), falseFires: 0, noKey: 0, blocking: null,
      });
    }
  }
  return out;
}

const fr = (s: RecallSummary): string => (s.rate === null ? 'n/a' : `${s.rate.toFixed(2)} [${(s.low ?? 0).toFixed(2)}, ${(s.high ?? 0).toFixed(2)}]`);

export function renderRecall(summary: readonly RecallSummary[]): string {
  const lines = [
    '| Style | Operator | Blocking key | Snapshots | Sites eligible/candidates | Applied | Compiled | Evaluated | Detected | Rate [95 % Wilson] | Twin false fires | No key |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const s of summary) {
    if (s.operatorId === '*-matched') {
      lines.push(`| **${s.style}** | **without the direction-mismatched operators** | | ${String(s.snapshots)} | | | | ${String(s.evaluated)} | ${String(s.hits)} | **${fr(s)}** | | |`);
      continue;
    }
    if (s.operatorId === '*') {
      lines.push(`| **${s.style}** | **all positives with a key** | | ${String(s.snapshots)} | | | | ${String(s.evaluated)} | ${String(s.hits)} | **${fr(s)}** | | |`);
      continue;
    }
    const b = s.blocking === null ? '–' : s.blocking ? 'yes' : 'no';
    lines.push(`| ${s.style} | ${s.operatorId}${isMismatched(s.style, s.operatorId) ? ' (direction mismatch)' : ''} | ${b} | ${String(s.snapshots)} | ${String(s.eligible)}/${String(s.candidates)} | ${String(s.applied)} | ${String(s.compiled)} | ${String(s.evaluated)} | ${String(s.hits)} | ${fr(s)} | ${String(s.falseFires)} | ${String(s.noKey)} |`);
  }
  return lines.join('\n');
}
