/**
 * v1.5 combined delivery (push + pull), the pure part: one finding ledger per session that both channels share.
 * Design: `ops/notes/v15-combined-delivery-design-2026-10-26.md` §1.2 (one identity) and §4 (logs, attribution).
 * No I/O. The hub (`hub.ts`) owns one ledger per session and calls it in arrival order.
 *
 * - Every key gets a per-session number at its first exposure, by either channel, and keeps it.
 * - Push shows a key at most once while it stays open. A key already shown by pull is withheld from push.
 * - A shown key that disappears from a push check is resolved, with one `resolved:` line; if it comes back it is new
 *   again (same number, `cameBack`).
 * - Pull answers in full; each key it returns is marked `new` or `already reported`. A pull of a scope (files, or the
 *   whole project) also resolves shown keys of that scope that are no longer returned (recorded, no pushed line).
 * - Stop lists every open key once per turn, whichever channel showed it.
 * - A double report is a push of a key that was shown and has not changed state since. `push` never re-pushes an
 *   open key, so the count stays 0 by construction; the hub's log keeps `withheld` so the claim can be checked.
 */
import type { KeyedFinding } from '../edit-gate/gate.js';

export type Channel = 'push' | 'pull';

export interface Exposure { readonly channel: Channel; readonly seq: number }

export interface LedgerRow {
  readonly key: string;
  readonly number: number;
  readonly rule: string;
  readonly file: string;
  readonly first: Exposure;
  readonly exposures: readonly Exposure[];
  /** seq of the event after which the key was observed absent; null while open or never shown. */
  readonly resolvedAt: number | null;
  readonly resolvedBy: Channel | null;
  readonly cameBack: boolean;
  /** true while shown and not resolved since. */
  readonly open: boolean;
}

export interface PushResult {
  readonly fresh: readonly (KeyedFinding & { readonly number: number })[];
  readonly resolved: readonly (KeyedFinding & { readonly number: number })[];
  /** Keys in this check that were not pushed because a channel already showed them. */
  readonly withheld: readonly { readonly key: string; readonly number: number; readonly shownBy: Channel }[];
  readonly open: readonly (KeyedFinding & { readonly number: number })[];
}

export interface PullScope { readonly files: readonly string[] | null; readonly covers: (rule: string) => boolean }

export interface PullAnnotation { readonly key: string; readonly number: number; readonly status: 'new' | 'already reported' }

interface Row {
  key: string; number: number; rule: string; file: string; first: Exposure; exposures: Exposure[];
  resolvedAt: number | null; resolvedBy: Channel | null; cameBack: boolean; open: boolean; shownBy: Channel | null;
  last: KeyedFinding;
}

export class FindingLedger {
  private readonly rows = new Map<string, Row>();
  private next = 1;
  private seq = 0;
  /** Keys present in the last push check (the gate's scope: findings that involve a file changed since the seed). */
  private pushCurrent = new Set<string>();
  private readonly stopTurns = new Set<string>();

  /** The shared clock: every event of either channel takes the next value. */
  tick(): number {
    return ++this.seq;
  }

  private row(f: KeyedFinding, seq: number, channel: Channel): Row {
    let r = this.rows.get(f.key);
    if (r === undefined) {
      r = { key: f.key, number: this.next++, rule: f.rule, file: f.file, first: { channel, seq }, exposures: [], resolvedAt: null, resolvedBy: null, cameBack: false, open: false, shownBy: null, last: f };
      this.rows.set(f.key, r);
    }
    r.last = f;
    return r;
  }

  private show(r: Row, channel: Channel, seq: number): void {
    if (r.resolvedAt !== null && !r.open) { r.cameBack = true; r.resolvedAt = null; r.resolvedBy = null; }
    r.exposures.push({ channel, seq });
    r.open = true;
    r.shownBy = channel;
  }

  private resolve(r: Row, channel: Channel, seq: number): void {
    r.open = false;
    r.resolvedAt = seq;
    r.resolvedBy = channel;
    r.shownBy = null;
  }

  /** One gate check (PostToolUse or Stop): the keyed findings in the gate's scope, now. */
  push(current: readonly KeyedFinding[], seq: number = this.tick()): PushResult {
    const now = new Map(current.map((f) => [f.key, f]));
    const resolved: PushResult['resolved'][number][] = [];
    for (const key of this.pushCurrent) {
      if (now.has(key)) continue;
      const r = this.rows.get(key);
      if (r !== undefined && r.open) { this.resolve(r, 'push', seq); resolved.push({ ...r.last, number: r.number }); }
    }
    const fresh: PushResult['fresh'][number][] = [];
    const withheld: { key: string; number: number; shownBy: Channel }[] = [];
    for (const f of now.values()) {
      const wasOpen = this.rows.get(f.key)?.open === true;
      const r = this.row(f, seq, 'push');
      if (wasOpen) {
        withheld.push({ key: r.key, number: r.number, shownBy: r.shownBy ?? 'push' });
        continue;
      }
      this.show(r, 'push', seq);
      fresh.push({ ...f, number: r.number });
    }
    this.pushCurrent = new Set(now.keys());
    return { fresh, resolved, withheld, open: this.openFindings() };
  }

  /**
   * One pull answer. `scope.files` is the files the call asked about (project-relative), or null for the whole
   * project; `scope.covers` says which rules the tool checks (check_consistency: R-D4, R-XCTX; check_file and
   * check_diff: FF-S01–S03), so a call never resolves a key of a rule it does not check.
   * Returns one annotation per finding, in order.
   */
  pull(findings: readonly KeyedFinding[], scope: PullScope, seq: number = this.tick()): PullAnnotation[] {
    const returned = new Set(findings.map((f) => f.key));
    const inScope = (r: Row): boolean => scope.covers(r.rule) && (scope.files === null || scope.files.includes(r.file));
    for (const r of this.rows.values()) {
      if (r.open && !returned.has(r.key) && inScope(r)) this.resolve(r, 'pull', seq);
    }
    const out: PullAnnotation[] = [];
    for (const f of findings) {
      const wasOpen = this.rows.get(f.key)?.open === true;
      const r = this.row(f, seq, 'pull');
      if (wasOpen) { r.exposures.push({ channel: 'pull', seq }); out.push({ key: r.key, number: r.number, status: 'already reported' }); continue; }
      this.show(r, 'pull', seq);
      out.push({ key: r.key, number: r.number, status: 'new' });
    }
    return out;
  }

  openFindings(): (KeyedFinding & { readonly number: number })[] {
    return [...this.rows.values()].filter((r) => r.open).sort((a, b) => a.number - b.number).map((r) => ({ ...r.last, number: r.number }));
  }

  /** The Stop hook blocks at most once per turn. */
  claimStop(turn: string): boolean {
    if (this.stopTurns.has(turn)) return false;
    this.stopTurns.add(turn);
    return true;
  }

  numberOf(key: string): number | null {
    return this.rows.get(key)?.number ?? null;
  }

  /** The finding ledger of §4 item 3. `finalKeys`: the keys present on the final tree (both scopes), if known. */
  table(finalKeys?: ReadonlySet<string>): (LedgerRow & { readonly onFinalTree: boolean | null })[] {
    return [...this.rows.values()].sort((a, b) => a.number - b.number).map((r) => ({
      key: r.key, number: r.number, rule: r.rule, file: r.file, first: r.first, exposures: [...r.exposures],
      resolvedAt: r.resolvedAt, resolvedBy: r.resolvedBy, cameBack: r.cameBack, open: r.open,
      onFinalTree: finalKeys === undefined ? null : finalKeys.has(r.key),
    }));
  }
}

export type Attribution = 'push only' | 'pull only' | 'push first, then pull' | 'pull first, then push' | 'unexposed';

/**
 * §4 attribution rule, fixed before Stage 1: a resolved key is attributed by its exposures before the resolving
 * event. A key absent from the final tree that was never shown is `unexposed` (avoidance, not a fix). Keys still
 * present on the final tree are not attributed (null).
 */
export function attribute(row: Pick<LedgerRow, 'exposures' | 'resolvedAt'>, onFinalTree: boolean): Attribution | null {
  if (onFinalTree) return null;
  const before = row.exposures.filter((e) => row.resolvedAt === null || e.seq < row.resolvedAt);
  if (before.length === 0) return 'unexposed';
  const push = before.some((e) => e.channel === 'push');
  const pull = before.some((e) => e.channel === 'pull');
  if (push && !pull) return 'push only';
  if (pull && !push) return 'pull only';
  return before[0]!.channel === 'push' ? 'push first, then pull' : 'pull first, then push';
}
