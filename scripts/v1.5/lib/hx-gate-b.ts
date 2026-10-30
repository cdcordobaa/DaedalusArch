/**
 * Hexagonal study, gate (b) "ledger completeness" (pre-registration §5.1; blocking item B10). Zero calls, no I/O.
 *
 * Criterion: every identity the scorer finds on a `combined` step snapshot is in the hub ledger by the next push (or
 * that turn's stop listing): 0 missing. What the hub put in its ledger is what its checks returned, and every check
 * the hub ran is recorded in `session.json` (`deliveryAudit`, PR 452: kind, rule list, file scope, tree digest,
 * findings as `rule|file|line`). The push that ends a turn (Stop) checks the tree the snapshot then records, so a
 * step snapshot is matched to the hub's checks by tree digest (a cache hit runs no check, and the digest finds the
 * check that first answered for that tree; every push or pull on that tree fed those findings to the ledger).
 *
 * Per step snapshot (step-01 onward) of a `combined` session, the scorer's symbolic findings new against the seed
 * (`score-study.ts --counted …`, per step `symbolicNewVsSeed` and `treeDigest`) are looked up in the union of the
 * findings of the error-free checks on that digest, of the same kind (v1.5 Cypher findings in Cypher checks, frozen
 * findings in frozen checks). A counted finding that is not there is **missing** and fails the gate.
 *
 * The documented differences between the hub and the scorer (§5.1), and how this check treats them:
 * - *Evasion files*: a step where the scorer neutralised a spec, overlay, allow or settings file is not the hub's tree;
 *   it is **not comparable**, left out, and listed (with the paths) for the hand read.
 * - *R-MIRROR-SEM*: a model fact (live in the hub, replay in the scorer): left out.
 * - *Frozen rules*: the hub runs `check_diff` on the changed files against the seed copy, the scorer on the whole tree;
 *   a frozen finding matches on `rule|file|line`, or else on `rule|file` (a line keyed differently), which is listed
 *   as `frozenLineDiffers` and is not a mismatch.
 * - *Cache hits*: matched by digest, as above.
 * Findings of delivered rules that are not counted (an exploratory rule; an R-MIRROR2 shape the counted option leaves
 * out) are looked up too and listed as `missingUncounted`; they do not fail the gate. A `combined` session without
 * a delivery audit fails it (nothing to compare).
 */

export const MIRROR_SEM = 'R-MIRROR-SEM';

/** One hub check as `session.json` records it (`experiments/v15-study/lib/delivery-audit.ts`, `CheckRecord`). */
export interface HubCheck {
  readonly n: number;
  readonly turn: string | null;
  readonly kind: 'cypher' | 'frozen';
  readonly ran: readonly string[];
  readonly files: readonly string[] | null;
  readonly treeDigest: string;
  readonly findings: readonly string[];
  readonly error?: string;
}

/** One scorer finding new against the seed (`score-study.ts`, `newHits`). */
export interface ScorerFinding {
  readonly rule: string;
  readonly file: string;
  readonly subject: string;
  readonly line: number | null;
  readonly source: 'v15' | 'frozen';
  readonly counted: boolean;
}

export interface ScoredStep {
  readonly step: string;
  readonly treeDigest: string;
  readonly symbolicNewVsSeed: readonly ScorerFinding[];
  /** `kind path`, as the scorer writes them; non-empty: the scored tree is not the hub's. */
  readonly evasionCandidates: readonly string[];
}

/** One line of the hub's push log (`<hub>/<session>.push.jsonl`), the fields this check reads. */
export interface PushLine { readonly seq?: number; readonly event?: string; readonly turn?: string; readonly treeDigest?: string }

export type StepStatus = 'agree' | 'missing' | 'not comparable' | 'nothing new';

export interface StepGateB {
  readonly step: string;
  readonly treeDigest: string;
  readonly status: StepStatus;
  /** The hub checks (their `n`) on this tree, error-free. */
  readonly checks: readonly number[];
  /** The checks on this tree that failed (their findings never reached the ledger). */
  readonly erroredChecks: readonly number[];
  /** The pushes on this tree (`seq event`), when the push log is given. */
  readonly pushes: readonly string[];
  /** Counted scorer findings compared. */
  readonly compared: number;
  /** Counted scorer findings (`rule|file|line|subject`) not in the hub's checks on this tree: the gate's failures. */
  readonly missing: readonly string[];
  readonly missingUncounted: readonly string[];
  readonly frozenLineDiffers: readonly string[];
  readonly evasion: readonly string[];
  readonly reason: string | null;
}

export interface SessionGateB {
  readonly session: string;
  readonly auditPresent: boolean;
  readonly steps: readonly StepGateB[];
  readonly missing: number;
  readonly notComparable: number;
  readonly pass: boolean;
}

const key = (f: ScorerFinding): string => `${f.rule}|${f.file}|${String(f.line ?? '')}|${f.subject}`;
const rfl = (f: Pick<ScorerFinding, 'rule' | 'file' | 'line'>): string => `${f.rule}|${f.file}|${String(f.line ?? '')}`;
const rf = (k: string): string => k.split('|').slice(0, 2).join('|');

/** Gate (b) on one `combined` session. `pushes` (optional) only labels the steps with the pushes on their tree. */
export function gateBSession(session: string, records: readonly HubCheck[] | undefined, steps: readonly ScoredStep[], pushes: readonly PushLine[] = []): SessionGateB {
  if (records === undefined) return { session, auditPresent: false, steps: [], missing: 0, notComparable: 0, pass: false };
  const out: StepGateB[] = [];
  for (const s of steps) {
    if (s.step === 'step-00') continue;
    const on = records.filter((r) => r.treeDigest === s.treeDigest);
    const ok = on.filter((r) => r.error === undefined);
    const base = {
      step: s.step, treeDigest: s.treeDigest, checks: ok.map((r) => r.n), erroredChecks: on.filter((r) => r.error !== undefined).map((r) => r.n),
      pushes: pushes.filter((p) => p.treeDigest === s.treeDigest).map((p) => `${String(p.seq ?? '?')} ${p.event ?? '?'}`), evasion: [...s.evasionCandidates],
    };
    if (s.evasionCandidates.length > 0) {
      out.push({ ...base, status: 'not comparable', compared: 0, missing: [], missingUncounted: [], frozenLineDiffers: [], reason: 'evasion file neutralised by the scorer: the scored tree is not the hub\'s (hand read)' });
      continue;
    }
    // One entry per `rule|file|line|subject` (the scorer may hold several hits with one identity and line).
    const wanted = [...new Map(s.symbolicNewVsSeed.filter((f) => f.rule !== MIRROR_SEM).map((f) => [`${key(f)}|${f.source}`, f])).values()];
    const hub = { v15: new Set(ok.filter((r) => r.kind === 'cypher').flatMap((r) => r.findings)), frozen: new Set(ok.filter((r) => r.kind === 'frozen').flatMap((r) => r.findings)) };
    const hubRf = new Set([...hub.frozen].map(rf));
    const missing: string[] = [];
    const missingUncounted: string[] = [];
    const frozenLineDiffers: string[] = [];
    for (const f of wanted) {
      if (hub[f.source].has(rfl(f))) continue;
      if (f.source === 'frozen' && hubRf.has(`${f.rule}|${f.file}`)) { frozenLineDiffers.push(key(f)); continue; }
      (f.counted ? missing : missingUncounted).push(key(f));
    }
    const compared = wanted.filter((f) => f.counted).length;
    const status: StepStatus = missing.length > 0 ? 'missing' : compared === 0 ? 'nothing new' : 'agree';
    const reason = missing.length === 0 ? null
      : on.length === 0 ? 'no hub check on this tree (no push or pull saw it)'
        : ok.length === 0 ? 'every hub check on this tree failed'
          : 'counted findings outside the hub checks\' findings on this tree';
    out.push({ ...base, status, compared, missing: missing.sort(), missingUncounted: missingUncounted.sort(), frozenLineDiffers: frozenLineDiffers.sort(), reason });
  }
  const missing = out.reduce((a, s) => a + s.missing.length, 0);
  return { session, auditPresent: true, steps: out, missing, notComparable: out.filter((s) => s.status === 'not comparable').length, pass: missing === 0 };
}

export interface GateBReport {
  readonly schema: 'v15-hx-gate-b/v1';
  readonly modelCalls: 0;
  readonly sessions: readonly SessionGateB[];
  readonly totals: { readonly sessions: number; readonly steps: number; readonly agree: number; readonly nothingNew: number; readonly notComparable: number; readonly missing: number; readonly noAudit: number };
  readonly pass: boolean;
}

export function gateBReport(sessions: readonly SessionGateB[]): GateBReport {
  const steps = sessions.flatMap((s) => s.steps);
  const count = (st: StepStatus): number => steps.filter((s) => s.status === st).length;
  return {
    schema: 'v15-hx-gate-b/v1', modelCalls: 0, sessions,
    totals: { sessions: sessions.length, steps: steps.length, agree: count('agree'), nothingNew: count('nothing new'), notComparable: count('not comparable'), missing: sessions.reduce((a, s) => a + s.missing, 0), noAudit: sessions.filter((s) => !s.auditPresent).length },
    pass: sessions.every((s) => s.pass),
  };
}
