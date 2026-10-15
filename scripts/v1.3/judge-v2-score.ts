/**
 * Judge v1 vs v2 on one side of the TUNE / CHECK split. DEVELOPMENT SET ONLY; construct sensitivity, not validity.
 *
 * Definitions are the judge-catch rounds' (`judge-catch-score.ts`), at the target level:
 * - Unit verdict: majority of the valid runs. v1 is always its recorded majority of 3 (the round reports keep no
 *   per-run verdict); v2 is the majority of 3 (`--runs majority`, CHECK) or its run 0 (`--runs first`, the TUNE
 *   iterations, which judge one run per unit).
 * - Catch (seed target): one of its target units fails. Paired catch: a failing target unit whose clean control (the
 *   same unit on the same base, same round) passes. (The rounds' construct-flag clause added no catch to v1 and is not
 *   used.)
 * - Twin false fail (twin target): one of its target units fails. Paired: and that unit passes on the clean base.
 * - Clean false fail: per clean-control unit.
 * v1 verdicts: the committed round reports (`results/v1.3-judge-catch/**\/reports`). `--v1-override <verdicts.json>`
 * replaces v1 items re-judged on the current graph (the antipattern-nest units whose v1 prompt changed with the
 * extractor alias fix).
 *
 * Usage: npx tsx scripts/v1.3/judge-v2-score.ts --split TUNE|CHECK --v2 <label> [--runs majority|first]
 *        [--v1-override <label>] [--out <file.md>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wilson } from '../lib/stats.js';
import { ROUNDS, readSplit } from './judge-v2-split.js';
import type { SplitItem } from './judge-v2-split.js';
import { RESULTS } from './judge-v2-run.js';
import type { ItemVerdict } from './judge-v2-run.js';

type V = 'pass' | 'fail' | 'warning' | 'invalid' | 'missing';

interface UnitResult { unitId: string; verdict: string; runs?: { runIndex: number; verdict: string }[] }
interface Report { neuralResults?: { functionId: string; unitResults: UnitResult[] }[] }

const safe = (id: string): string => id.replace(/[/:]/g, '__');
const readJson = <T>(f: string): T => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
function arg(argv: readonly string[], name: string, dflt: string): string {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : dflt;
}

export function fmt(k: number, n: number): string {
  if (n === 0) return '—';
  const w = wilson(k, n);
  return `${String(k)}/${String(n)} = ${(k / n).toFixed(2)} [${w.low.toFixed(2)}, ${w.high.toFixed(2)}]`;
}

function v1Verdict(item: SplitItem, mode: 'majority' | 'first'): V {
  const dir = ROUNDS[item.round] ?? '';
  const file = path.join(dir, 'reports', `${safe(item.targetId)}.json`);
  if (!fs.existsSync(file)) return 'missing';
  const rep = readJson<Report>(file);
  const u = rep.neuralResults?.find((n) => n.functionId === item.functionId)?.unitResults.find((x) => x.unitId === item.unitId);
  if (u === undefined) return 'missing';
  if (mode === 'majority') return u.verdict as V;
  const r0 = (u.runs ?? []).find((r) => r.runIndex === 0);
  return r0 === undefined ? 'invalid' : (r0.verdict as V);
}

function v2VerdictOf(v: ItemVerdict | undefined, mode: 'majority' | 'first'): V {
  if (v === undefined) return 'missing';
  if (mode === 'majority') return v.verdict;
  const r0 = v.runs.find((r) => r.runIndex === 0);
  if (r0 === undefined) return 'missing';
  return r0.valid ? (r0.pass === true ? 'pass' : 'fail') : 'invalid';
}

export interface Metrics {
  readonly seeds: number; readonly caught: number; readonly pairedCaught: number;
  readonly twins: number; readonly twinFail: number; readonly twinPairedFail: number;
  readonly cleanUnits: number; readonly cleanFail: number;
  readonly invalidUnits: number;
}

export function metricsOf(items: readonly SplitItem[], verdict: (i: SplitItem) => V): Metrics {
  const byTarget = new Map<string, SplitItem[]>();
  for (const i of items) if (i.kind !== 'clean') byTarget.set(`${i.round}|${i.targetId}`, [...(byTarget.get(`${i.round}|${i.targetId}`) ?? []), i]);
  const cleanOf = (i: SplitItem): SplitItem | undefined => items.find((c) => c.kind === 'clean' && c.round === i.round && c.baseId === i.baseId && c.unitId === i.unitId && c.functionId === i.functionId);
  let seeds = 0; let caught = 0; let pairedCaught = 0; let twins = 0; let twinFail = 0; let twinPairedFail = 0;
  for (const its of byTarget.values()) {
    const kind = its[0]?.kind;
    const fails = its.filter((i) => verdict(i) === 'fail');
    const paired = fails.filter((i) => {
      const c = cleanOf(i);
      return c === undefined || verdict(c) !== 'fail';
    });
    if (kind === 'seed') { seeds++; if (fails.length > 0) caught++; if (paired.length > 0) pairedCaught++; }
    if (kind === 'twin') { twins++; if (fails.length > 0) twinFail++; if (paired.length > 0) twinPairedFail++; }
  }
  const clean = items.filter((i) => i.kind === 'clean');
  return {
    seeds, caught, pairedCaught, twins, twinFail, twinPairedFail,
    cleanUnits: clean.length, cleanFail: clean.filter((i) => verdict(i) === 'fail').length,
    invalidUnits: items.filter((i) => { const v = verdict(i); return v === 'invalid' || v === 'missing'; }).length,
  };
}

function row(name: string, m: Metrics): string {
  return `| ${name} | ${fmt(m.caught, m.seeds)} | ${fmt(m.pairedCaught, m.seeds)} | ${fmt(m.twinFail, m.twins)} | ${fmt(m.twinPairedFail, m.twins)} | ${fmt(m.cleanFail, m.cleanUnits)} | ${String(m.invalidUnits)} |`;
}

const opFamily = (op: string): string => op.replace(/^HP:.*$/, 'hand-planted').replace(/n$/, '');

export function main(argv: readonly string[]): number {
  const splitName = arg(argv, '--split', 'CHECK');
  const label = arg(argv, '--v2', '');
  const mode = arg(argv, '--runs', 'majority') as 'majority' | 'first';
  const override = arg(argv, '--v1-override', '');
  const out = arg(argv, '--out', '');
  const split = readSplit(path.join(RESULTS, 'split.json'));
  const items = split.items.filter((i) => i.split === splitName);
  const v2 = new Map(readJson<{ verdicts: ItemVerdict[] }>(path.join(RESULTS, label, 'verdicts.json')).verdicts.map((v) => [v.itemId, v]));
  const ov = override === '' ? new Map<string, ItemVerdict>() : new Map(readJson<{ verdicts: ItemVerdict[] }>(path.join(RESULTS, override, 'verdicts.json')).verdicts.map((v) => [v.itemId, v]));
  // v1 is always its recorded majority of 3 (the round reports carry no per-run verdicts); an override is majority too.
  const v1 = (i: SplitItem): V => (ov.has(i.itemId) ? v2VerdictOf(ov.get(i.itemId), 'majority') : v1Verdict(i, 'majority'));
  const v2f = (i: SplitItem): V => v2VerdictOf(v2.get(i.itemId), mode);
  const validTwin = (i: SplitItem): boolean => i.operatorId !== 'AP-DUP-RULEn';
  const lines: string[] = [];
  lines.push(`Split ${splitName}: ${String(items.length)} items; unit verdict: v1 = majority of 3 runs (recorded), v2 = ${mode === 'majority' ? 'majority of 3 runs' : 'run 0 only'}; v2 = ${label}${override !== '' ? `; v1 override = ${override}` : ''}.`);
  lines.push('');
  lines.push('| Judge | Catch | Paired catch | Twin false fail | Paired twin false fail | Clean false fail (units) | Invalid units |');
  lines.push('|---|---|---|---|---|---|---|');
  lines.push(row('v1', metricsOf(items, v1)));
  lines.push(row('v2', metricsOf(items, v2f)));
  const noDupTwin = items.filter((i) => i.kind !== 'twin' || validTwin(i));
  lines.push(row('v1, without the v1 AP-DUP-RULEn twins', metricsOf(noDupTwin, v1)));
  lines.push(row('v2, without the v1 AP-DUP-RULEn twins', metricsOf(noDupTwin, v2f)));
  lines.push('');
  lines.push('| Operator family | Judge | Catch | Twin false fail |');
  lines.push('|---|---|---|---|');
  const fams = [...new Set(items.filter((i) => i.kind !== 'clean').map((i) => opFamily(i.operatorId)))].sort();
  for (const f of fams) {
    const its = items.filter((i) => i.kind === 'clean' || opFamily(i.operatorId) === f);
    const a = metricsOf(its, v1);
    const b = metricsOf(its, v2f);
    lines.push(`| ${f} | v1 | ${fmt(a.caught, a.seeds)} | ${fmt(a.twinFail, a.twins)} |`);
    lines.push(`| ${f} | v2 | ${fmt(b.caught, b.seeds)} | ${fmt(b.twinFail, b.twins)} |`);
  }
  lines.push('');
  lines.push('Items whose verdict differs (v1 → v2):');
  for (const i of items) {
    const a = v1(i);
    const b = v2f(i);
    if (a !== b) lines.push(`- ${i.kind} ${i.operatorId || 'clean'} ${i.round} ${i.targetId} ${i.functionId} ${i.unitId}: ${a} → ${b}`);
  }
  const md = `${lines.join('\n')}\n`;
  if (out !== '') {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, md);
  }
  process.stdout.write(md);
  return 0;
}

if (process.argv[1]?.endsWith('judge-v2-score.ts') === true) process.exitCode = main(process.argv.slice(2));
