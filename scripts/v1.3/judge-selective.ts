/**
 * Selective prediction for the judge: does 3-run unanimity predict a correct verdict? DEVELOPMENT SET ONLY.
 *
 * No LLM call. Reads committed files only:
 * - items and truth labels: `results/v1.3-judge-v2/split.json` (every judged (target, function, unit) of the three
 *   judge-catch rounds). Truth: seed = should fail, twin = should pass, clean control = should pass.
 * - v1 per-run verdicts: the round cassettes (`tests/fixtures/judge-cassettes-v13/judge-catch*`). The round reports keep
 *   only the unit's majority, so each item is matched to its cassette triple by a fingerprint of the report's unit result
 *   (function, unit id or unit file, valid run count, majority verdict, mean confidence of the majority runs, population
 *   std dev of all valid confidences; `src/llm-critic/aggregation.ts`). An item whose candidates disagree on the vote
 *   split is `unresolved` and left out. The 4 CHECK items re-judged with v1 on the current graph take their runs from
 *   `results/v1.3-judge-v2/check-v1-current-graph` (as in the judge v2 report, §3).
 * - v2.1 per-run verdicts: `results/v1.3-judge-v2/check-v2.1/verdicts.json` (CHECK, 3 runs). TUNE v2 runs judged one run
 *   per unit and cannot show agreement; they are not used.
 *
 * Definitions (fixed before any number was computed):
 * - Item verdict: majority of its valid runs. Agreement: `unanimous` (3 valid runs, all equal), `split` (3 valid runs,
 *   2-1), `incomplete` (fewer than 3 valid runs; counted, never scored).
 * - Correct: seed and the item fails; twin or clean and the item passes.
 * - Coverage: unanimous / (unanimous + split).
 * - Decision rule, per judge, on the CHECK items of all classes pooled: unanimous accuracy >= 0.90, its Wilson 95% lower
 *   bound >= 0.80 and coverage >= 0.60. Met → propose a `confidence` tag (OFF by default) for `review_unit`; not met →
 *   unanimity is not informative enough for the agent-facing tool.
 * - Agent view, per 10 clean-control units: false alarms shown when (a) every verdict is shown = 10 x fail share;
 *   (b) only unanimous verdicts are shown (split ones are reported as `uncertain`) = 10 x unanimous-fail share. The same
 *   for seeds: catches shown per 10 seeded units, all vs unanimous only.
 *
 * Usage (repository root): npx tsx scripts/v1.3/judge-selective.ts [--out results/v1.3-judge-selective]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wilson } from '../lib/stats.js';
import { ROUNDS, readSplit } from './judge-v2-split.js';
import type { SplitItem } from './judge-v2-split.js';

export const RESULTS_V2 = 'results/v1.3-judge-v2';
export const CASSETTES = 'tests/fixtures/judge-cassettes-v13';
export const ROUND_CASSETTES: Readonly<Record<string, string>> = { r1: 'judge-catch', r2: 'judge-catch-round2', dv2: 'judge-catch-duprule-v2' };

export const DECISION = { minAccuracy: 0.9, minWilsonLow: 0.8, minCoverage: 0.6, split: 'CHECK' } as const;

export type Kind = SplitItem['kind'];
export type Agreement = 'unanimous' | 'split' | 'incomplete';
/** One valid run's verdict: `true` = pass. */
export type Vote = boolean;

export interface Classified {
  readonly validRuns: number;
  readonly fails: number;
  readonly verdict: 'pass' | 'fail' | 'none';
  readonly agreement: Agreement;
}

/** Majority and agreement of an item's valid runs. */
export function classify(votes: readonly Vote[]): Classified {
  const fails = votes.filter((v) => !v).length;
  const passes = votes.length - fails;
  const verdict = votes.length === 0 || fails === passes ? 'none' : fails > passes ? 'fail' : 'pass';
  const agreement: Agreement = votes.length < 3 ? 'incomplete' : fails === 0 || passes === 0 ? 'unanimous' : 'split';
  return { validRuns: votes.length, fails, verdict, agreement };
}

export function isCorrect(kind: Kind, verdict: Classified['verdict']): boolean {
  return kind === 'seed' ? verdict === 'fail' : verdict === 'pass';
}

export interface Row {
  readonly judge: 'v1' | 'v2.1';
  readonly itemId: string;
  readonly split: 'TUNE' | 'CHECK';
  readonly kind: Kind;
  readonly operatorId: string;
  /** Where the runs came from: a cassette request hash, `override`, `v2.1`, or `unresolved` (no runs used). */
  readonly source: string;
  readonly votes: readonly Vote[];
}

export interface Cell {
  readonly n: number;
  readonly incomplete: number;
  readonly unanimous: number;
  readonly unanimousCorrect: number;
  readonly splitN: number;
  readonly splitCorrect: number;
  /** Items whose verdict is fail, all and unanimous only (for the agent view). */
  readonly fail: number;
  readonly unanimousFail: number;
}

export function cellOf(rows: readonly Row[]): Cell {
  let incomplete = 0; let unanimous = 0; let unanimousCorrect = 0; let splitN = 0; let splitCorrect = 0; let fail = 0; let unanimousFail = 0;
  for (const r of rows) {
    const c = classify(r.votes);
    if (c.agreement === 'incomplete') { incomplete++; continue; }
    const ok = isCorrect(r.kind, c.verdict);
    if (c.verdict === 'fail') fail++;
    if (c.agreement === 'unanimous') { unanimous++; if (ok) unanimousCorrect++; if (c.verdict === 'fail') unanimousFail++; } else { splitN++; if (ok) splitCorrect++; }
  }
  return { n: rows.length - incomplete, incomplete, unanimous, unanimousCorrect, splitN, splitCorrect, fail, unanimousFail };
}

export interface Decision {
  readonly accuracy: number | null;
  readonly wilsonLow: number | null;
  readonly coverage: number | null;
  readonly passed: boolean;
}

export function decide(c: Cell): Decision {
  if (c.unanimous === 0 || c.n === 0) return { accuracy: null, wilsonLow: null, coverage: c.n === 0 ? null : 0, passed: false };
  const accuracy = c.unanimousCorrect / c.unanimous;
  const wilsonLow = wilson(c.unanimousCorrect, c.unanimous).low;
  const coverage = c.unanimous / c.n;
  return { accuracy, wilsonLow, coverage, passed: accuracy >= DECISION.minAccuracy && wilsonLow >= DECISION.minWilsonLow && coverage >= DECISION.minCoverage };
}

/** Per 10 units: (a) shown when every verdict is shown, (b) shown when only unanimous verdicts are shown. */
export function per10(c: Cell): { all: number; unanimousOnly: number } | null {
  if (c.n === 0) return null;
  return { all: (10 * c.fail) / c.n, unanimousOnly: (10 * c.unanimousFail) / c.n };
}

// ---------------------------------------------------------------------------------------------------------------------
// Inventory (reads the repository)

interface CassetteRun {
  readonly requestHash: string; readonly functionId: string; readonly unitId: string; readonly runIndex: number;
  readonly outcome?: { readonly kind: string }; readonly parsedVerdict?: { readonly pass: boolean; readonly confidence: number } | null;
}
interface ReportUnit {
  readonly unitId: string; readonly filePaths?: readonly string[]; readonly verdict: string; readonly confidence: number;
  readonly confidenceStdDev: number; readonly validRunCount?: number;
}
interface Report { readonly neuralResults?: readonly { readonly functionId: string; readonly unitResults: readonly ReportUnit[] }[] }
interface V2Verdicts { readonly verdicts: readonly { readonly itemId: string; readonly runs: readonly { readonly valid: boolean; readonly pass?: boolean }[] }[] }

const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const safe = (id: string): string => id.replace(/[/:]/g, '__');
const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const pstdev = (xs: readonly number[]): number => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const TOL = 1e-6;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []));
}

/** Cassette triples of one round, by request hash; valid runs only, in run order. */
export function cassetteGroups(dir: string): Map<string, CassetteRun[]> {
  const groups = new Map<string, CassetteRun[]>();
  for (const f of walk(dir)) {
    const c = readJson<CassetteRun>(f);
    groups.set(c.requestHash, [...(groups.get(c.requestHash) ?? []), c]);
  }
  for (const runs of groups.values()) runs.sort((a, b) => a.runIndex - b.runIndex);
  return groups;
}

const validOf = (runs: readonly CassetteRun[]): { pass: boolean; confidence: number }[] =>
  runs.filter((r) => r.outcome?.kind === 'valid' && r.parsedVerdict != null).map((r) => r.parsedVerdict as { pass: boolean; confidence: number });

/** Does a cassette triple reproduce this report unit's aggregate? */
export function fingerprintMatches(u: ReportUnit, fn: string, runs: readonly CassetteRun[]): boolean {
  const first = runs[0];
  if (first?.functionId !== fn) return false;
  if (first.unitId !== u.unitId && !(u.filePaths ?? []).includes(first.unitId)) return false;
  const valid = validOf(runs);
  if (valid.length === 0 || valid.length !== (u.validRunCount ?? valid.length)) return false;
  const c = classify(valid.map((v) => v.pass));
  if (c.verdict !== u.verdict) return false;
  const carriers = valid.filter((v) => (v.pass ? 'pass' : 'fail') === c.verdict).map((v) => v.confidence);
  return Math.abs(mean(carriers) - u.confidence) < TOL && Math.abs(pstdev(valid.map((v) => v.confidence)) - u.confidenceStdDev) < TOL;
}

export interface Inventory { readonly rows: readonly Row[]; readonly matching: Record<string, number> }

export function inventory(repo = '.'): Inventory {
  const split = readSplit(path.join(repo, RESULTS_V2, 'split.json'));
  const override = new Map(readJson<V2Verdicts>(path.join(repo, RESULTS_V2, 'check-v1-current-graph', 'verdicts.json')).verdicts.map((v) => [v.itemId, v]));
  const v21 = new Map(readJson<V2Verdicts>(path.join(repo, RESULTS_V2, 'check-v2.1', 'verdicts.json')).verdicts.map((v) => [v.itemId, v]));
  const groupsByRound = new Map(Object.entries(ROUND_CASSETTES).map(([r, d]) => [r, cassetteGroups(path.join(repo, CASSETTES, d))]));
  const matching: Record<string, number> = { unique: 0, 'ambiguous-same-votes': 0, unresolved: 0, override: 0 };
  const rows: Row[] = [];
  const v2Votes = (v: V2Verdicts['verdicts'][number]): Vote[] => v.runs.filter((r) => r.valid && r.pass !== undefined).map((r) => r.pass === true);
  const base = (i: SplitItem): Omit<Row, 'judge' | 'source' | 'votes'> => ({ itemId: i.itemId, split: i.split, kind: i.kind, operatorId: i.operatorId });
  for (const i of split.items) {
    const ov = override.get(i.itemId);
    if (ov !== undefined) {
      matching.override = (matching.override ?? 0) + 1;
      rows.push({ ...base(i), judge: 'v1', source: 'override', votes: v2Votes(ov) });
    } else {
      const rep = readJson<Report>(path.join(repo, ROUNDS[i.round] ?? '', 'reports', `${safe(i.targetId)}.json`));
      const u = rep.neuralResults?.find((n) => n.functionId === i.functionId)?.unitResults.find((x) => x.unitId === i.unitId);
      const groups = groupsByRound.get(i.round) ?? new Map<string, CassetteRun[]>();
      const cands = u === undefined ? [] : [...groups.entries()].filter(([, runs]) => fingerprintMatches(u, i.functionId, runs));
      const splits = new Set(cands.map(([, runs]) => classify(validOf(runs).map((v) => v.pass)).fails));
      const first = cands[0];
      if (first === undefined || splits.size !== 1) {
        matching.unresolved = (matching.unresolved ?? 0) + 1;
        rows.push({ ...base(i), judge: 'v1', source: 'unresolved', votes: [] });
      } else {
        const key = cands.length === 1 ? 'unique' : 'ambiguous-same-votes';
        matching[key] = (matching[key] ?? 0) + 1;
        rows.push({ ...base(i), judge: 'v1', source: first[0], votes: validOf(first[1]).map((v) => v.pass) });
      }
    }
    const v = v21.get(i.itemId);
    if (v !== undefined && i.split === 'CHECK') rows.push({ ...base(i), judge: 'v2.1', source: 'v2.1', votes: v2Votes(v) });
  }
  return { rows, matching };
}

// ---------------------------------------------------------------------------------------------------------------------
// Report

const CLASSES: readonly { name: string; kinds: readonly Kind[] }[] = [
  { name: 'all', kinds: ['seed', 'twin', 'clean'] },
  { name: 'seed (catch)', kinds: ['seed'] },
  { name: 'twin', kinds: ['twin'] },
  { name: 'clean', kinds: ['clean'] },
  { name: 'twin + clean (false fail)', kinds: ['twin', 'clean'] },
];

export function fmt(k: number, n: number): string {
  if (n === 0) return '—';
  const w = wilson(k, n);
  return `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]`;
}

export function render(inv: Inventory): { md: string; json: unknown } {
  const scopes: readonly { judge: Row['judge']; split: 'CHECK' | 'TUNE' | 'ALL' }[] = [
    { judge: 'v1', split: 'CHECK' }, { judge: 'v2.1', split: 'CHECK' }, { judge: 'v1', split: 'TUNE' }, { judge: 'v1', split: 'ALL' },
  ];
  const lines: string[] = [];
  const cells: unknown[] = [];
  const decisions: Record<string, Decision> = {};
  const json = { decisionRule: DECISION, matching: inv.matching, cells, decisions };
  lines.push('| Judge | Items | Class | Scored | Coverage (unanimous) | Accuracy, unanimous | Accuracy, split (2-1) | Incomplete |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const s of scopes) {
    for (const cl of CLASSES) {
      const rows = inv.rows.filter((r) => r.judge === s.judge && (s.split === 'ALL' || r.split === s.split) && cl.kinds.includes(r.kind) && r.source !== 'unresolved');
      const c = cellOf(rows);
      cells.push({ judge: s.judge, split: s.split, class: cl.name, ...c });
      lines.push(`| ${s.judge} | ${s.split} | ${cl.name} | ${String(c.n)} | ${fmt(c.unanimous, c.n)} | ${fmt(c.unanimousCorrect, c.unanimous)} | ${fmt(c.splitCorrect, c.splitN)} | ${String(c.incomplete)} |`);
    }
  }
  lines.push('');
  lines.push(`Decision rule (fixed before computing; CHECK, all classes): unanimous accuracy >= ${String(DECISION.minAccuracy)}, Wilson lower bound >= ${String(DECISION.minWilsonLow)}, coverage >= ${String(DECISION.minCoverage)}.`);
  lines.push('');
  lines.push('| Judge | Unanimous accuracy | Wilson low | Coverage | Rule met |');
  lines.push('|---|---|---|---|---|');
  for (const judge of ['v1', 'v2.1'] as const) {
    const d = decide(cellOf(inv.rows.filter((r) => r.judge === judge && r.split === 'CHECK' && r.source !== 'unresolved')));
    decisions[judge] = d;
    const f = (x: number | null): string => (x === null ? '—' : x.toFixed(2));
    lines.push(`| ${judge} | ${f(d.accuracy)} | ${f(d.wilsonLow)} | ${f(d.coverage)} | ${d.passed ? 'yes' : 'no'} |`);
  }
  lines.push('');
  lines.push('What an agent would see (CHECK), per 10 units submitted:');
  lines.push('');
  lines.push('| Judge | Clean units: false alarms, all shown | Clean units: false alarms, unanimous only | Twin units: false alarms, all / unanimous only | Seeded units: catches, all shown | Seeded units: catches, unanimous only |');
  lines.push('|---|---|---|---|---|---|');
  for (const judge of ['v1', 'v2.1'] as const) {
    const of = (k: Kind): ReturnType<typeof per10> => per10(cellOf(inv.rows.filter((r) => r.judge === judge && r.split === 'CHECK' && r.kind === k && r.source !== 'unresolved')));
    const f = (x: number | undefined): string => (x === undefined ? '—' : x.toFixed(1));
    const cl = of('clean'); const tw = of('twin'); const se = of('seed');
    lines.push(`| ${judge} | ${f(cl?.all)} | ${f(cl?.unanimousOnly)} | ${f(tw?.all)} / ${f(tw?.unanimousOnly)} | ${f(se?.all)} | ${f(se?.unanimousOnly)} |`);
  }
  lines.push('');
  lines.push(`v1 run matching: ${Object.entries(inv.matching).map(([k, v]) => `${k} ${String(v)}`).join(', ')}.`);
  const wrong = inv.rows.filter((r) => r.split === 'CHECK' && r.source !== 'unresolved' && !isCorrect(r.kind, classify(r.votes).verdict));
  lines.push('');
  lines.push('Wrong CHECK verdicts (judge, class, operator, item, fail votes of valid runs):');
  for (const r of wrong) {
    const c = classify(r.votes);
    lines.push(`- ${r.judge} ${r.kind} ${r.operatorId || 'clean'} \`${r.itemId}\`: ${String(c.fails)}/${String(c.validRuns)} fail (${c.agreement})`);
  }
  return { md: `${lines.join('\n')}\n`, json };
}

export function main(argv: readonly string[]): number {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? (argv[i + 1] ?? '') : 'results/v1.3-judge-selective';
  const inv = inventory('.');
  const { md, json } = render(inv);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'inventory.json'), `${JSON.stringify({ matching: inv.matching, rows: inv.rows }, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'report.json'), `${JSON.stringify(json, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'report.md'), md);
  process.stdout.write(md);
  return 0;
}

if (process.argv[1]?.endsWith('judge-selective.ts') === true) process.exitCode = main(process.argv.slice(2));
