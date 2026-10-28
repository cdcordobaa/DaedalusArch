/**
 * v1.5 final study: the run's guards (design note §5.1, §5.2, §5.3; §7 steps 7 and 8). No model calls.
 *
 * - `LedgerRunner`: every spawn of the generator binary other than `--version` is written to the call ledger
 *   (`calls.jsonl`; a `started` line first, so a call lost to a container restart is counted) and refused past the
 *   phase cap or the total cap. The harness's own retries are therefore capped too.
 * - `VersionGuard`: `claude --version` is read before every turn; any version other than the first turn's (or the
 *   input's pin) is a stop of the whole run (infrastructure), never a redraw.
 * - `integrityOf`: per session of arm `combined`, the edits the tree shows against the hook events the hub logged,
 *   the fail-open rate and the hub latency. Pre-registration §5: a hub socket loss is an infrastructure failure
 *   (redrawn); fail-open above 5 % or an edit with no hook event is kept (ITT) and `flagged`; p95 over 2 s is
 *   reported; over 5 s is a mechanism stop.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../src/shared/interfaces/process-runner.js';
import type { Caps } from './plan.js';

export type Phase = 'smoke' | 'probes' | 'sessions';

export class LedgerRunner implements ProcessRunner {
  session: string | null = null;
  turn: string | null = null;
  arm: string | null = null;
  constructor(private readonly inner: ProcessRunner, private readonly binary: string, private readonly ledger: string, private readonly phase: Phase, private readonly caps: Caps) {}

  counts(): Record<Phase | 'total', number> {
    const out = { smoke: 0, probes: 0, sessions: 0, total: 0 };
    if (!fs.existsSync(this.ledger)) return out;
    for (const l of fs.readFileSync(this.ledger, 'utf8').split('\n').filter((x) => x.trim() !== '')) {
      out[(JSON.parse(l) as { phase: Phase }).phase]++;
      out.total++;
    }
    return out;
  }

  /** The cap refusal for the next call, or null. */
  refusal(): string | null {
    const c = this.counts();
    if (c.total >= this.caps.total) return `total cap ${String(this.caps.total)} reached`;
    if (c[this.phase] >= this.caps[this.phase]) return `${this.phase} cap ${String(this.caps[this.phase])} reached`;
    return null;
  }

  async run(command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    if (command !== this.binary || args.includes('--version')) return this.inner.run(command, args, options);
    const refusal = this.refusal();
    if (refusal !== null) return DomainResult.fail([{ code: 'V15_STUDY_HARD_CAP', message: refusal }]);
    const at = new Date().toISOString();
    fs.mkdirSync(path.dirname(this.ledger), { recursive: true });
    const pending = `${this.ledger}.pending`;
    fs.writeFileSync(pending, `${JSON.stringify({ phase: this.phase, session: this.session, turn: this.turn, arm: this.arm, at, state: 'started' })}\n`);
    const r = await this.inner.run(command, args, options);
    const line = { phase: this.phase, session: this.session, turn: this.turn, arm: this.arm, at, finishedAt: new Date().toISOString(), exitCode: r.success ? r.data.exitCode : null, timedOut: r.success ? r.data.timedOut : null, spawnFailed: !r.success };
    fs.appendFileSync(this.ledger, `${JSON.stringify(line)}\n`);
    fs.rmSync(pending, { force: true });
    return r;
  }

  /** After a restart: a call that started and never finished is appended as lost (it counts against the cap). */
  recoverPending(): void {
    const pending = `${this.ledger}.pending`;
    if (!fs.existsSync(pending)) return;
    const p = JSON.parse(fs.readFileSync(pending, 'utf8')) as Record<string, unknown>;
    fs.appendFileSync(this.ledger, `${JSON.stringify({ ...p, state: 'lost-in-restart', recoveredAt: new Date().toISOString() })}\n`);
    fs.rmSync(pending, { force: true });
  }
}

export class VersionMismatchStop extends Error {
  constructor(readonly expected: string, readonly found: string | null, readonly where: string) {
    super(`CLI version ${found ?? 'unreadable'} at ${where}, the run started on ${expected}: stop (infrastructure, design §5.1)`);
  }
}

/** The per-turn CLI version check. `pin` (optional) is the input's pinned version; else the first read pins it. */
export class VersionGuard {
  private first: string | null;
  readonly seen: { where: string; version: string | null }[] = [];
  constructor(pin: string | null = null) {
    this.first = pin;
  }
  get pinned(): string | null {
    return this.first;
  }
  /** Records the version read before a turn; throws `VersionMismatchStop` on any change. */
  check(version: string | null, where: string): void {
    this.seen.push({ where, version });
    if (this.first === null) {
      if (version === null) throw new VersionMismatchStop('(none)', null, where);
      this.first = version;
      return;
    }
    if (version !== this.first) throw new VersionMismatchStop(this.first, version, where);
  }
}

// ── integrity monitor ──────────────────────────────────────────────────────────────────────────────────────────

export const INTEGRITY = Object.freeze({ minCoverage: 0.95, maxFailOpenRate: 0.05, p95ReportMs: 2000, p95StopMs: 5000 });

export interface PushLine { readonly turn?: string; readonly event?: string; readonly file?: string | null; readonly refused?: string | null; readonly failOpen?: boolean; readonly ms?: number; readonly replied?: boolean; readonly stopBlock?: boolean; readonly allowOverlay?: boolean }
export interface CallLine { readonly turn?: string; readonly ms?: number; readonly isError?: boolean; readonly tool?: string }
export interface TurnObservation {
  readonly turn: string;
  /** Files (work-tree relative) that differ from the previous snapshot after the turn. */
  readonly changedFiles: readonly string[];
  readonly push: readonly PushLine[];
  readonly calls: readonly CallLine[];
  /** The hub socket answered after the turn. */
  readonly hubAlive: boolean;
}

export interface Integrity {
  readonly edits: number;
  readonly editsWithHookEvent: number;
  readonly coverage: number;
  readonly hookEvents: number;
  readonly stopEvents: number;
  readonly failOpen: number;
  readonly failOpenRate: number;
  readonly refused: number;
  readonly pullCalls: number;
  readonly hubP95Ms: number | null;
  readonly hubMaxMs: number | null;
  readonly hubDeadAfter: readonly string[];
  readonly overlaySeen: boolean;
  readonly uncoveredFiles: readonly { turn: string; file: string }[];
  /** Hub socket lost: the session is redrawn. */
  readonly infrastructure: boolean;
  /** Kept (ITT) and flagged: fail-open above 5 %, or edit count ≠ edits with a hook event. */
  readonly flagged: boolean;
  readonly latencyReported: boolean;
  readonly mechanismStop: boolean;
  readonly reasons: readonly string[];
}

export function p95(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)] as number;
}

export function integrityOf(turns: readonly TurnObservation[]): Integrity {
  let edits = 0;
  let covered = 0;
  const uncovered: { turn: string; file: string }[] = [];
  const ms: number[] = [];
  let hookEvents = 0;
  let stopEvents = 0;
  let failOpen = 0;
  let refused = 0;
  let pullCalls = 0;
  let overlaySeen = false;
  const dead: string[] = [];
  for (const t of turns) {
    const accepted = t.push.filter((l) => (l.refused ?? null) === null);
    const hooked = new Set(accepted.filter((l) => l.event === 'PostToolUse' && typeof l.file === 'string').map((l) => l.file as string));
    for (const f of t.changedFiles) {
      edits++;
      if (hooked.has(f)) covered++;
      else uncovered.push({ turn: t.turn, file: f });
    }
    hookEvents += accepted.filter((l) => l.event === 'PostToolUse').length;
    stopEvents += accepted.filter((l) => l.event === 'Stop').length;
    failOpen += t.push.filter((l) => l.failOpen === true).length;
    refused += t.push.length - accepted.length;
    overlaySeen ||= t.push.some((l) => l.allowOverlay === true);
    for (const l of accepted) if (typeof l.ms === 'number') ms.push(l.ms);
    for (const c of t.calls) if (typeof c.ms === 'number') ms.push(c.ms);
    pullCalls += t.calls.length;
    if (!t.hubAlive) dead.push(t.turn);
  }
  const coverage = edits === 0 ? 1 : covered / edits;
  const denom = hookEvents + stopEvents;
  const failOpenRate = denom === 0 ? 0 : failOpen / denom;
  const hubP95Ms = p95(ms);
  const reasons: string[] = [];
  if (covered !== edits) reasons.push(`edits with a hook event ${String(covered)}/${String(edits)}${coverage < INTEGRITY.minCoverage ? ' < 95 %' : ''}`);
  if (failOpenRate > INTEGRITY.maxFailOpenRate) reasons.push(`fail-open ${String(failOpen)}/${String(denom)} > 5 %`);
  if (dead.length > 0) reasons.push(`hub socket dead after ${dead.join(', ')}`);
  const mechanismStop = hubP95Ms !== null && hubP95Ms > INTEGRITY.p95StopMs;
  if (mechanismStop) reasons.push(`hub p95 ${String(hubP95Ms)} ms > 5 s (mechanism stop)`);
  return {
    edits, editsWithHookEvent: covered, coverage: +coverage.toFixed(4), hookEvents, stopEvents, failOpen, failOpenRate: +failOpenRate.toFixed(4), refused, pullCalls,
    hubP95Ms, hubMaxMs: ms.length === 0 ? null : Math.max(...ms), hubDeadAfter: dead, overlaySeen, uncoveredFiles: uncovered,
    infrastructure: dead.length > 0,
    flagged: covered !== edits || failOpenRate > INTEGRITY.maxFailOpenRate,
    latencyReported: hubP95Ms !== null && hubP95Ms > INTEGRITY.p95ReportMs,
    mechanismStop,
    reasons,
  };
}
