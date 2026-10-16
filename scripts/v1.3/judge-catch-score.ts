/**
 * v1.3 judge catch test (U-F, FR-V9), step 4: scoring. DEVELOPMENT SET ONLY; reported as construct sensitivity.
 *
 * Definitions (fixed before any judge output was read beyond the first two clean-control units):
 * - Unit fail: the unit's majority verdict over its valid runs is `fail` (the stage's `voteUnit`, from the report).
 * - Construct flag: in a majority of the unit's valid runs (>= 2), the judge lists a violation whose `filePath` is an
 *   edited or created file of the row and whose message matches the operator's construct pattern below.
 * - Catch (seed): a target unit fails, or a construct flag. Also reported: unit fail only, and the paired catch (the
 *   same unit on the clean base does not fail; units holding only created files have no base unit and count as not
 *   failing there).
 * - Twin false fail: a target unit of the twin fails. Sensitivity: unit fail or a construct flag with the positive's
 *   pattern.
 * - Clean-control false fail: a judged unit of an unmodified base fails (per unit), and per base.
 * - Symbolic catch: S1 = a row at the catalogue's expected key (AP-PERSIST-IN-DOMAIN: FF-P01 on the site file);
 *   S2 = any symbolic row on an edited or created file that the base does not have (key: function, file, target).
 *
 * Usage: npx tsx scripts/v1.3/judge-catch-score.ts [--results results/v1.3-judge-catch]
 *   [--cassettes tests/fixtures/judge-cassettes-v13/judge-catch]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { wilson } from '../lib/stats.js';
import type { SeedRow } from './judge-catch-seed.js';
import { PROBED_FUNCTION } from './judge-catch-run.js';
import type { Target } from './judge-catch-run.js';

export const CONSTRUCT: Readonly<Record<string, RegExp>> = {
  'AP-REPO-BYPASS': /getRepository|PrismaClient|service locator|bypass|global (orm|repository|data ?source|accessor)|injected repositor|instead of (the|its) (injected )?repositor/i,
  'AP-FAT-CONTROLLER': /validat|business (rule|logic)|domain (rule|logic)|invariant/i,
  'AP-PERSIST-IN-DOMAIN': /typeorm|@Entity|@Column|\bORM\b|persistence|database mapping/i,
  'AP-DUP-RULE': /duplicat|copied|same (rule|check|validation)|repeat/i,
  'AP-FRAMEWORK-LEAK': /express|\bRequest\b|framework|\bHTTP\b|transport/i,
};

interface Entry {
  readonly functionId: string;
  readonly unitId: string;
  readonly runIndex: number;
  readonly recordedAt: string;
  readonly outcome: { kind: string };
  readonly parsedVerdict?: { pass: boolean; confidence: number; violations: { filePath: string; message: string }[]; reasoning: string };
}

interface UnitRow {
  unitId: string;
  verdict: string;
  validRunCount?: number;
  filePaths?: string[];
}

interface Report {
  readonly violations: { functionId: string; filePath: string; target?: string; message?: string }[];
  readonly neuralResults?: { functionId: string; unitResults: UnitRow[] }[];
  readonly tiers?: { verdict: string };
}

interface LedgerRun {
  id: string;
  at: string;
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function safe(id: string): string {
  return id.replace(/[/:]/g, '__');
}

function allEntries(dir: string): Entry[] {
  const out: Entry[] = [];
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(readJson(path.join(p, f)) as Entry);
  }
  return out.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
}

const fmt = (x: number): string => x.toFixed(2);

export function rate(k: number, n: number): { k: number; n: number; rate: number | null; low: number | null; high: number | null; text: string } {
  if (n === 0) return { k, n, rate: null, low: null, high: null, text: '0/0' };
  const w = wilson(k, n);
  return { k, n, rate: k / n, low: w.low, high: w.high, text: `${String(k)}/${String(n)} = ${fmt(k / n)} [${fmt(w.low)}, ${fmt(w.high)}]` };
}

function symKey(v: { functionId: string; filePath: string; target?: string }): string {
  return `${v.functionId}|${v.filePath}|${v.target ?? ''}`;
}

/** A CSV cell: '' for null and undefined, the primitive's text, else its JSON. */
function cell(x: unknown): string {
  if (x === null || x === undefined) return '';
  return typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean' ? String(x) : JSON.stringify(x);
}

export function main(argv: readonly string[]): number {
  const argOf = (n: string, d: string): string => {
    const i = argv.indexOf(n);
    return (i >= 0 ? argv[i + 1] : undefined) ?? d;
  };
  const results = path.resolve(argOf('--results', 'results/v1.3-judge-catch'));
  const cas = path.resolve(argOf('--cassettes', 'tests/fixtures/judge-cassettes-v13/judge-catch'));
  const { targets, skipped } = readJson(path.join(results, 'plan.json')) as { targets: Target[]; skipped: { id: string; reason: string }[] };
  const rows = (readJson(path.join(results, 'seed-manifest.json')) as { rows: SeedRow[] }).rows;
  const ledger = readJson(path.join(results, 'call-ledger.json')) as { calls: number; runs: LedgerRun[] };
  const entries = allEntries(cas);
  // Entries of a run: recorded after the previous run ended and up to this run's end (runs are sequential).
  const entriesOf = new Map<string, Entry[]>();
  let prev = '';
  for (const r of ledger.runs) {
    entriesOf.set(r.id, [...(entriesOf.get(r.id) ?? []), ...entries.filter((e) => e.recordedAt > prev && e.recordedAt <= r.at)]);
    prev = r.at;
  }
  const reportOf = (id: string): Report | null => {
    const f = path.join(results, 'reports', `${safe(id)}.json`);
    return fs.existsSync(f) ? (readJson(f) as Report) : null;
  };
  const unitVerdict = (rep: Report, fn: string, unit: string): string | null =>
    rep.neuralResults?.find((n) => n.functionId === fn)?.unitResults.find((u) => u.unitId === unit)?.verdict ?? null;

  const flagged = (id: string, fn: string, unit: string, files: readonly string[], re: RegExp | undefined, min: number): boolean => {
    if (re === undefined) return false;
    const runs = (entriesOf.get(id) ?? []).filter((e) => e.functionId === fn && e.unitId === unit && e.outcome.kind === 'valid' && e.parsedVerdict !== undefined);
    const hits = runs.filter((e) => (e.parsedVerdict?.violations ?? []).some((v) => files.some((f) => v.filePath === f || v.filePath.endsWith(`/${f}`) || f.endsWith(v.filePath)) && re.test(v.message)));
    return hits.length >= min;
  };

  const rowScores: Record<string, unknown>[] = [];
  const cleanUnits: { base: string; unit: string; fn: string; verdict: string | null }[] = [];
  for (const t of targets.filter((x) => x.kind === 'clean')) {
    const rep = reportOf(t.id);
    for (const [fn, units] of Object.entries(t.units)) {
      for (const u of units) cleanUnits.push({ base: t.id.slice('base:'.length), unit: u, fn, verdict: rep === null ? null : unitVerdict(rep, fn, u) });
    }
  }
  for (const t of targets.filter((x) => x.kind !== 'clean')) {
    const row = rows.find((r) => r.rowId === t.id);
    if (row === undefined) throw new Error(`no seed row ${t.id}`);
    const rep = reportOf(t.id);
    const baseRep = reportOf(`base:${row.baseId}`);
    const fn = PROBED_FUNCTION[row.positiveId] ?? '';
    const units = t.units[fn] ?? [];
    const files = [...new Set([...row.editedFiles, ...row.createdFiles])];
    const re = CONSTRUCT[row.positiveId];
    if (rep === null) {
      rowScores.push({ rowId: t.id, operatorId: row.operatorId, positiveId: row.positiveId, role: row.role, baseId: row.baseId, judged: false });
      continue;
    }
    const verdicts = units.map((u) => ({ unit: u, verdict: unitVerdict(rep, fn, u), base: baseRep === null ? null : unitVerdict(baseRep, fn, u) }));
    const unitFail = verdicts.some((v) => v.verdict === 'fail');
    const flagMaj = units.some((u) => flagged(t.id, fn, u, files, re, 2));
    const flagAny = units.some((u) => flagged(t.id, fn, u, files, re, 1));
    const pairedFail = verdicts.some((v) => v.verdict === 'fail' && v.base !== 'fail');
    const baseSym = new Set((baseRep?.violations ?? []).filter((v) => !v.functionId.startsWith('FF-N')).map(symKey));
    const newSym = rep.violations.filter((v) => !v.functionId.startsWith('FF-N') && !baseSym.has(symKey(v)));
    const s2 = newSym.filter((v) => files.includes(v.filePath));
    const s1 = row.positiveId === 'AP-PERSIST-IN-DOMAIN' ? newSym.filter((v) => v.functionId === 'FF-P01' && v.filePath === row.site.filePath) : [];
    rowScores.push({
      rowId: t.id, operatorId: row.operatorId, positiveId: row.positiveId, role: row.role, baseId: row.baseId, baseKind: row.baseKind,
      judged: true, probedFunction: fn, units: verdicts, unitFail, constructFlagMajority: flagMaj, constructFlagAnyRun: flagAny,
      catch: unitFail || flagMaj, pairedCatch: pairedFail || (flagMaj && !verdicts.some((v) => v.base === 'fail')),
      symbolicS1: s1.length > 0, symbolicS2: s2.length > 0, symbolicNewRows: newSym.map(symKey),
      blockingVerdict: rep.tiers?.verdict ?? null, baseBlockingVerdict: baseRep?.tiers?.verdict ?? null,
    });
  }

  const positives = Object.keys(PROBED_FUNCTION);
  const judgedRows = rowScores.filter((r) => r.judged === true);
  const perOperator = positives.map((pos) => {
    const seeds = judgedRows.filter((r) => r.positiveId === pos && r.role === 'seed');
    const twins = judgedRows.filter((r) => r.positiveId === pos && r.role === 'twin');
    const c = (xs: Record<string, unknown>[], k: string): number => xs.filter((x) => x[k] === true).length;
    return {
      operator: pos,
      probedFunction: PROBED_FUNCTION[pos],
      seeds: seeds.length,
      twins: twins.length,
      catch: rate(c(seeds, 'catch'), seeds.length),
      unitFailOnly: rate(c(seeds, 'unitFail'), seeds.length),
      pairedCatch: rate(c(seeds, 'pairedCatch'), seeds.length),
      constructFlagAnyRun: rate(c(seeds, 'constructFlagAnyRun'), seeds.length),
      twinFalseFail: rate(c(twins, 'unitFail'), twins.length),
      twinFalseFailWithFlag: rate(twins.filter((x) => x.unitFail === true || x.constructFlagMajority === true).length, twins.length),
      symbolicS1: rate(c(seeds, 'symbolicS1'), seeds.length),
      symbolicS2: rate(c(seeds, 'symbolicS2'), seeds.length),
      judgeOnlyS2: rate(seeds.filter((x) => x.catch === true && x.symbolicS2 !== true).length, seeds.length),
    };
  });
  const allSeeds = judgedRows.filter((r) => r.role === 'seed');
  const allTwins = judgedRows.filter((r) => r.role === 'twin');
  const judgedClean = cleanUnits.filter((u) => u.verdict !== null);
  const macro = perOperator.filter((p) => p.catch.rate !== null);
  const scores = {
    label: 'DEVELOPMENT-SET NUMBERS (construct sensitivity); not validity estimates',
    calls: ledger.calls,
    skipped,
    perOperator,
    pooled: {
      catch: rate(allSeeds.filter((x) => x.catch === true).length, allSeeds.length),
      unitFailOnly: rate(allSeeds.filter((x) => x.unitFail === true).length, allSeeds.length),
      pairedCatch: rate(allSeeds.filter((x) => x.pairedCatch === true).length, allSeeds.length),
      macroCatch: macro.length === 0 ? null : macro.reduce((s, p) => s + (p.catch.rate ?? 0), 0) / macro.length,
      twinFalseFail: rate(allTwins.filter((x) => x.unitFail === true).length, allTwins.length),
      twinFalseFailWithFlag: rate(allTwins.filter((x) => x.unitFail === true || x.constructFlagMajority === true).length, allTwins.length),
      cleanUnitFalseFail: rate(judgedClean.filter((u) => u.verdict === 'fail').length, judgedClean.length),
      cleanBaseFalseFail: rate(
        [...new Set(judgedClean.map((u) => u.base))].filter((b) => judgedClean.some((u) => u.base === b && u.verdict === 'fail')).length,
        new Set(judgedClean.map((u) => u.base)).size,
      ),
      symbolicS2: rate(allSeeds.filter((x) => x.symbolicS2 === true).length, allSeeds.length),
    },
    exitTarget: { rule: 'catch rate >= 0.80', pooledCatch: allSeeds.length === 0 ? null : allSeeds.filter((x) => x.catch === true).length / allSeeds.length },
    cleanUnits,
    rows: rowScores,
  };
  fs.writeFileSync(path.join(results, 'scores.json'), `${JSON.stringify(scores, null, 2)}\n`);
  const csv = ['rowId,operatorId,role,baseId,judged,unitFail,constructFlagMajority,catch,pairedCatch,symbolicS1,symbolicS2,blockingVerdict'];
  for (const r of rowScores) csv.push([r.rowId, r.operatorId, r.role, r.baseId, r.judged, r.unitFail, r.constructFlagMajority, r.catch, r.pairedCatch, r.symbolicS1, r.symbolicS2, r.blockingVerdict].map(cell).join(','));
  fs.writeFileSync(path.join(results, 'rows.csv'), `${csv.join('\n')}\n`);
  const out: string[] = ['| Operator | Fn | Seeds | Catch | Unit fail only | Paired catch | Twins | Twin false fail | Symbolic S1 | Symbolic S2 |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const p of perOperator) out.push(`| ${p.operator} | ${p.probedFunction ?? ''} | ${String(p.seeds)} | ${p.catch.text} | ${p.unitFailOnly.text} | ${p.pairedCatch.text} | ${String(p.twins)} | ${p.twinFalseFail.text} | ${p.symbolicS1.text} | ${p.symbolicS2.text} |`);
  out.push('', `pooled catch ${scores.pooled.catch.text}; unit fail only ${scores.pooled.unitFailOnly.text}; paired ${scores.pooled.pairedCatch.text}; macro ${scores.pooled.macroCatch === null ? 'n/a' : fmt(scores.pooled.macroCatch)}`);
  out.push(`twin false fail ${scores.pooled.twinFalseFail.text} (with flag ${scores.pooled.twinFalseFailWithFlag.text}); clean units ${scores.pooled.cleanUnitFalseFail.text}; clean bases ${scores.pooled.cleanBaseFalseFail.text}; calls ${String(ledger.calls)}`);
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch-score.ts') === true) process.exitCode = main(process.argv.slice(2));
