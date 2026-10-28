/**
 * N1 (v1.5 final study, neuro-symbolic secondary, registered): the deterministic part of the runner. Everything here is
 * testable with stub answers: the two-run root intersection, the call budget and cassettes, the S3 pass over one tree,
 * and the agreement statistics. The model route itself is in `route.ts`; the CLI is `n1.ts`.
 *
 * S3 is reused unchanged from `src/v15-instrument/s3-ownership.ts` (prompt `u4-s3-facts-v1`): listing, system prompt,
 * schema, answer check and grounding. Nothing under `src/v15-instrument` is changed (rule hash frozen).
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeTsconfig } from '../../src/v15-instrument/graph.js';
import {
  S3_SCHEMA, S3_SYSTEM, S3_VERSION, groundAnswer, listingBatches, readmeHead, s3Problem, writeSpecWithAggregates,
} from '../../src/v15-instrument/s3-ownership.js';
import type { AggregateEntry, Batch, S3Answer, TypeVerdict } from '../../src/v15-instrument/s3-ownership.js';

export const N1_VERSION = 'v15-n1-v1';
export const RUNS = 2;
/** The model S3 was validated with (U4 S3 PASS, `experiments/v15-u4/llm.ts`). Fixed: no flag changes it. */
export const N1_MODEL = 'claude-sonnet-5-5';

/**
 * The admitted DDD rows of CAL-03 (`Docs/DiagnosticRuns/v15-cal03-admission-2026-10-28.md`) and the rules that score
 * them. Same ids as `ROW_RULES` in `experiments/cal-01/score.ts`, except K10, which is scored by R-D5S alone (the
 * registration choice in the admission report; R-D5 stays exploratory with K08 and K09).
 */
export const ADMITTED: Readonly<Record<string, readonly string[]>> = Object.freeze({
  K01: ['FF-DS02'], K02: ['FF-DT04', 'FF-S01', 'FF-S03', 'R-H5', 'R-PURE'], K03: ['R-D4'], K05: ['R-XCTX', 'R-D4'],
  K10: ['R-D5S'], K13: ['R-H5'], K14: ['R-D9'], K15: ['R-INJ'], K16: ['R-REF'],
});
export const ADMITTED_RULES: readonly string[] = [...new Set(Object.values(ADMITTED).flat())].sort();
export const matches = (rule: string, ids: readonly string[]): boolean => ids.some((i) => (i.endsWith('*') ? rule.startsWith(i.slice(0, -1)) : rule === i));

/** The registered call cap: 2 runs × trees × 1.5 (pre-registration §9), rounded up. */
export const capFor = (trees: number): number => Math.ceil(RUNS * trees * 1.5);

export const sha = (s: string): string => createHash('sha256').update(s).digest('hex');

// ── Calls, cassettes, ledger and the cap ─────────────────────────────────────────────────────────────────────────

export interface CallRequest { readonly model: string; readonly system: string; readonly schema: object; readonly prompt: string }
export interface CallResult {
  readonly answer: unknown; readonly model: string | null; readonly error: string | null;
  readonly durationMs: number; readonly inputTokens: number | null; readonly outputTokens: number | null;
}
/** The model route (`route.ts` in a real run; a stub in the tests). */
export type Caller = (req: CallRequest) => Promise<CallResult>;

export type Mode = 'estimate' | 'record' | 'replay';
export class CassetteMiss extends Error {
  constructor(readonly item: string, readonly key: string) { super(`cassette miss in replay: ${item} (${key.slice(0, 24)})`); }
}

export interface Budget {
  readonly mode: Mode;
  /** Which run the cap belongs to (`cal03`, or `snapshots:<name>`). */
  readonly target: string;
  readonly cap: number;
  /** Calls counted against the cap: ledger lines of this target (every attempt and retry is one). */
  used: number;
  /** Estimate mode: the calls a record run would make (cassette misses). */
  planned: number;
  stopped: string | null;
  /** Answers not obtained because the cap stopped the run. */
  truncated: string[];
}

export interface Store { readonly cassettes: string; readonly ledger: string }
export interface AskSpec { readonly item: string; readonly run: number; readonly prompt: string }
export interface Asked { readonly answer: S3Answer | null; readonly cached: boolean; readonly key: string; readonly model: string | null; readonly invalid: string | null }

/** Same recipe as the U4 prototype's `keyOf` (part, prompt version, model, run, system, schema, prompt). */
export const keyOf = (s: AskSpec, model: string = N1_MODEL): string => sha(['S3', S3_VERSION, model, String(s.run), S3_SYSTEM, JSON.stringify(S3_SCHEMA), s.prompt].join('\n'));
export const cassetteOf = (store: Store, key: string): string => path.join(store.cassettes, `${key.slice(0, 24)}.json`);

export function ledgerCount(ledger: string, target: string): number {
  if (!fs.existsSync(ledger)) return 0;
  return fs.readFileSync(ledger, 'utf8').split('\n').filter((l) => l.trim() !== '').filter((l) => (JSON.parse(l) as { target?: string }).target === target).length;
}

export interface AskDeps {
  readonly caller: Caller;
  readonly store: Store;
  /** Called before every real call; a non-null return stops the run (e.g. a CLI version change). */
  readonly preCall?: (() => string | null) | undefined;
  /** Recorded on the ledger and the cassette. */
  readonly route?: Record<string, unknown>;
}

/**
 * One S3 question: a cassette hit costs nothing; replay never calls (a miss throws); estimate counts the miss; record
 * calls with one retry on an invalid answer and never passes the cap. Every attempt is a ledger line.
 */
export async function ask(s: AskSpec, b: Budget, deps: AskDeps): Promise<Asked> {
  const key = keyOf(s);
  const cp = cassetteOf(deps.store, key);
  if (fs.existsSync(cp)) {
    const c = JSON.parse(fs.readFileSync(cp, 'utf8')) as { answer: unknown; model: string | null };
    const problem = c.answer === null ? 'recorded-invalid' : s3Problem(c.answer);
    return { answer: problem === null ? (c.answer as S3Answer) : null, cached: true, key, model: c.model, invalid: problem };
  }
  if (b.mode === 'replay') throw new CassetteMiss(s.item, key);
  if (b.mode === 'estimate') { b.planned++; return { answer: null, cached: false, key, model: null, invalid: 'not-asked' }; }
  if (b.stopped !== null) { b.truncated.push(`${s.item} run ${String(s.run)}`); return { answer: null, cached: false, key, model: null, invalid: 'stopped' }; }
  let answer: unknown = null; let reason: string | null = null; let model: string | null = null;
  for (let attempt = 0; attempt < 2 && answer === null; attempt++) {
    if (b.used >= b.cap) { b.stopped = `cap reached (${String(b.used)} of ${String(b.cap)} calls, target ${b.target})`; reason = 'cap'; break; }
    const pre = deps.preCall?.() ?? null;
    if (pre !== null) { b.stopped = pre; reason = 'stopped'; break; }
    const res = await deps.caller({ model: N1_MODEL, system: S3_SYSTEM, schema: S3_SCHEMA, prompt: s.prompt });
    const problem = res.error ?? s3Problem(res.answer);
    model = res.model;
    b.used++;
    fs.mkdirSync(path.dirname(deps.store.ledger), { recursive: true });
    fs.appendFileSync(deps.store.ledger, `${JSON.stringify({
      n: b.used, at: new Date().toISOString(), target: b.target, item: s.item, run: s.run, attempt, requestedModel: N1_MODEL, model: res.model,
      promptVersion: S3_VERSION, key: key.slice(0, 24), durationMs: res.durationMs, inputTokens: res.inputTokens, outputTokens: res.outputTokens,
      ok: problem === null, problem, route: deps.route ?? null,
    })}\n`);
    if (problem === null) answer = res.answer; else reason = problem;
  }
  if (answer === null && (reason === 'cap' || reason === 'stopped')) {
    b.truncated.push(`${s.item} run ${String(s.run)}`);
    return { answer: null, cached: false, key, model, invalid: reason };
  }
  fs.mkdirSync(path.dirname(cp), { recursive: true });
  fs.writeFileSync(cp, `${JSON.stringify({
    key, n1Version: N1_VERSION, target: b.target, item: s.item, run: s.run, promptVersion: S3_VERSION, requestedModel: N1_MODEL, model,
    route: deps.route ?? null, date: new Date().toISOString(), answer, invalidReason: answer === null ? reason : null,
  }, null, 1)}\n`);
  return { answer: answer as S3Answer | null, cached: false, key, model, invalid: answer === null ? reason : null };
}

// ── Roots named in both runs ─────────────────────────────────────────────────────────────────────────────────────

export const rootId = (a: Pick<AggregateEntry, 'name' | 'root'>): string => `${a.root}#${a.name}`;

/**
 * A root counts only when it is named and grounded in both runs (same type name, same file). The kept entry is run 0's;
 * a context that differs between the runs is reported, not resolved.
 */
export function rootsInBoth(run0: readonly AggregateEntry[], run1: readonly AggregateEntry[]): { kept: AggregateEntry[]; dropped: { id: string; run: number }[]; contextDiffers: string[] } {
  const ids1 = new Map(run1.map((a) => [rootId(a), a]));
  const ids0 = new Set(run0.map(rootId));
  const kept: AggregateEntry[] = [];
  const seen = new Set<string>();
  const contextDiffers: string[] = [];
  for (const a of run0) {
    const id = rootId(a);
    const b = ids1.get(id);
    if (b === undefined || seen.has(id)) continue;
    seen.add(id);
    kept.push(a);
    if (a.context !== b.context) contextDiffers.push(id);
  }
  const dropped = [
    ...run0.filter((a) => !ids1.has(rootId(a))).map((a) => ({ id: rootId(a), run: 0 })),
    ...run1.filter((a) => !ids0.has(rootId(a))).map((a) => ({ id: rootId(a), run: 1 })),
  ];
  return { kept: kept.sort((x, y) => rootId(x).localeCompare(rootId(y))), dropped, contextDiffers };
}

// ── S3 over one tree ─────────────────────────────────────────────────────────────────────────────────────────────

export interface TreeInput {
  /** An id for the tree (cassette item, report). */
  readonly id: string;
  readonly tree: string;
  /** The tree's declared spec (its `aggregates` block is hidden from the reader). */
  readonly spec: string;
  readonly scratch: string;
}

export interface RunRecord { readonly run: number; readonly complete: boolean; readonly roots: AggregateEntry[]; readonly verdicts: TypeVerdict[]; readonly answers: { context: string; key: string; cached: boolean; model: string | null; invalid: string | null }[] }
export interface TreeS3 {
  readonly id: string;
  readonly batches: number;
  readonly listedTypes: number;
  /** True when both runs answered every batch with a valid answer. */
  readonly complete: boolean;
  readonly runs: RunRecord[];
  readonly kept: AggregateEntry[];
  readonly dropped: { id: string; run: number }[];
  readonly contextDiffers: string[];
}

/** The reader's listing for a tree (deterministic, zero calls). */
export function batchesFor(t: TreeInput): Batch[] {
  const hidden = writeSpecWithAggregates(t.spec, path.join(t.scratch, `${t.id.replace(/[^\w.-]+/g, '_')}.hidden.yaml`), null);
  return listingBatches({ repo: t.id, tree: t.tree, tsconfig: writeTsconfig(t.tree, t.scratch), hiddenSpec: hidden });
}

/** S3 twice over the tree; the grounded roots named in both runs. */
export async function s3Roots(t: TreeInput, b: Budget, deps: AskDeps): Promise<TreeS3> {
  const batches = batchesFor(t);
  const readme = readmeHead(t.tree)?.name ?? null;
  const runs: RunRecord[] = [];
  for (let run = 0; run < RUNS; run++) {
    const roots: AggregateEntry[] = [];
    const verdicts: TypeVerdict[] = [];
    const answers: RunRecord['answers'] = [];
    let complete = true;
    for (const batch of batches) {
      const res = await ask({ item: `${t.id}/${batch.context}`, run, prompt: batch.prompt }, b, deps);
      answers.push({ context: batch.context, key: res.key.slice(0, 24), cached: res.cached, model: res.model, invalid: res.invalid });
      if (res.answer === null) { complete = false; continue; }
      const facts = groundAnswer(t.tree, batch, res.answer, readme);
      roots.push(...facts.aggregates);
      verdicts.push(...facts.verdicts);
    }
    runs.push({ run, complete, roots, verdicts, answers });
  }
  const both = rootsInBoth(runs[0]!.roots, runs[1]!.roots);
  return {
    id: t.id, batches: batches.length, listedTypes: batches.reduce((a, x) => a + x.listed.length, 0),
    complete: runs.every((r) => r.complete), runs, ...both,
  };
}

// ── Statistics ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Wilson score lower bound (95%, z = 1.96); null when n = 0. */
export function wilsonLower(k: number, n: number, z = 1.96): number | null {
  if (n === 0) return null;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const half = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return (centre - half) / den;
}

/** Cohen's κ for two binary raters; null when chance agreement is 1 (κ undefined). */
export function cohenKappa(pairs: readonly (readonly [boolean, boolean])[]): number | null {
  const n = pairs.length;
  if (n === 0) return null;
  let a = 0; let b = 0; let c = 0; let d = 0;
  for (const [x, y] of pairs) { if (x && y) a++; else if (x && !y) b++; else if (!x && y) c++; else d++; }
  const po = (a + d) / n;
  const pe = ((a + b) / n) * ((a + c) / n) + ((c + d) / n) * ((b + d) / n);
  if (Math.abs(1 - pe) < 1e-12) return null;
  return (po - pe) / (1 - pe);
}

export interface Agreement {
  readonly declared: number; readonly s3: number; readonly union: number; readonly identical: number;
  readonly onlyDeclared: string[]; readonly onlyS3: string[];
  /** identical / union; 1 when both sides are empty (vacuous, flagged). */
  readonly share: number; readonly vacuous: boolean;
  /**
   * κ over the union of identities, as registered. Every identity is present on at least one side, so there is no
   * both-absent cell: κ ≤ 0 unless the sides are identical, where it is undefined (null). Reported, with the cell κ.
   */
  readonly kappaUnion: number | null;
}

/** Agreement between the findings with declared roots and with S3 roots (identities as strings). */
export function agreement(declared: readonly string[], s3: readonly string[]): Agreement {
  const D = new Set(declared); const S = new Set(s3);
  const union = [...new Set([...D, ...S])].sort();
  const identical = union.filter((i) => D.has(i) && S.has(i)).length;
  return {
    declared: D.size, s3: S.size, union: union.length, identical,
    onlyDeclared: union.filter((i) => D.has(i) && !S.has(i)), onlyS3: union.filter((i) => !D.has(i) && S.has(i)),
    share: union.length === 0 ? 1 : identical / union.length, vacuous: union.length === 0,
    kappaUnion: cohenKappa(union.map((i) => [D.has(i), S.has(i)] as const)),
  };
}

export const identityOf = (tree: string, h: { rule: string; file: string; line: number | null }): string => `${tree}|${h.rule}|${h.file}|${String(h.line)}`;
