/**
 * v1.3 judge catch test, round 2: scoring. DEVELOPMENT SET ONLY; reported as construct sensitivity.
 *
 * The definitions are round 1's (`judge-catch-score.ts`), unchanged:
 * - Unit fail: the unit's majority verdict (`voteUnit`, from the report) is `fail`.
 * - Construct flag: in >= 2 valid runs of the unit, a violation on an edited or created file whose message matches the
 *   positive's construct pattern (`CONSTRUCT`; for a hand-planted variant, the pattern of the AP construct it maps to).
 * - Catch (seed): a target unit fails, or a construct flag. Paired catch: a target unit fails and the same unit on
 *   the clean base does not (or a construct flag and no base unit fails).
 * - Twin false fail: a target unit of the twin fails. Clean-control false fail: a judged unit of an unmodified base
 *   fails (per unit; per base).
 * - Symbolic: S2 = a new symbolic row on an edited file (not on the base). S1 (AP-PERSIST-IN-DOMAIN seeds): a new
 *   FF-P01 row on the site file. Hand-planted rows also record `symbolicExpected`: a new row on an edited file whose
 *   function is one of the variant manifest's expected findings.
 * Strata: `operator` (frozen AP operators on E1 cells) and `hand-planted` (reference violation variants), reported
 * apart and combined. `--round1 <dir>` adds the round-1 operator seeds for a round 1 + 2 pooled line per operator.
 *
 * Usage: npx tsx scripts/v1.3/judge-catch2-score.ts [--results results/v1.3-judge-catch/round2]
 *   [--cassettes tests/fixtures/judge-cassettes-v13/judge-catch-round2] [--round1 results/v1.3-judge-catch]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PROBED_FUNCTION } from './judge-catch-run.js';
import type { Target } from './judge-catch-run.js';
import { CONSTRUCT, rate } from './judge-catch-score.js';
import type { Round2Row } from './judge-catch2-seed.js';
import { must } from './lib/must.js';

interface Entry {
  readonly functionId: string;
  readonly unitId: string;
  readonly recordedAt: string;
  readonly outcome: { kind: string };
  readonly parsedVerdict?: { pass: boolean; confidence: number; violations: { filePath: string; message: string }[]; reasoning: string };
}

interface Report {
  readonly violations: { functionId: string; filePath: string; target?: string }[];
  readonly neuralResults?: { functionId: string; unitResults: { unitId: string; verdict: string }[] }[];
  readonly tiers?: { verdict: string };
}

type Scored = Record<string, unknown>;

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

const safe = (id: string): string => id.replace(/[/:]/g, '__');
const symKey = (v: { functionId: string; filePath: string; target?: string }): string => `${v.functionId}|${v.filePath}|${v.target ?? ''}`;

function allEntries(dir: string): Entry[] {
  const out: Entry[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(readJson(path.join(p, f)) as Entry);
  }
  return out.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
}

const count = (xs: readonly Scored[], k: string): number => xs.filter((x) => x[k] === true).length;

function block(seeds: readonly Scored[], twins: readonly Scored[]): Record<string, unknown> {
  return {
    seeds: seeds.length,
    twins: twins.length,
    catch: rate(count(seeds, 'catch'), seeds.length),
    unitFailOnly: rate(count(seeds, 'unitFail'), seeds.length),
    pairedCatch: rate(count(seeds, 'pairedCatch'), seeds.length),
    constructFlagAnyRun: rate(count(seeds, 'constructFlagAnyRun'), seeds.length),
    twinFalseFail: rate(count(twins, 'unitFail'), twins.length),
    twinFalseFailPaired: rate(count(twins, 'pairedFail'), twins.length),
    twinFalseFailWithFlag: rate(twins.filter((x) => x.unitFail === true || x.constructFlagMajority === true).length, twins.length),
    symbolicS2: rate(count(seeds, 'symbolicS2'), seeds.length),
  };
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
  const results = path.resolve(argOf('--results', 'results/v1.3-judge-catch/round2'));
  const cas = path.resolve(argOf('--cassettes', 'tests/fixtures/judge-cassettes-v13/judge-catch-round2'));
  const round1 = path.resolve(argOf('--round1', 'results/v1.3-judge-catch'));
  const { targets, skipped } = readJson(path.join(results, 'plan.json')) as { targets: Target[]; skipped: { id: string; reason: string }[] };
  const manifest = readJson(path.join(results, 'seed-manifest.json')) as { rows: Round2Row[] };
  const rows = manifest.rows;
  const ledger = readJson(path.join(results, 'call-ledger.json')) as { calls: number; runs: { id: string; at: string }[] };
  const entries = allEntries(cas);
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
    return runs.filter((e) => (e.parsedVerdict?.violations ?? []).some((v) => files.some((f) => v.filePath === f || v.filePath.endsWith(`/${f}`) || f.endsWith(v.filePath)) && re.test(v.message))).length >= min;
  };
  const expectedRulesOf = (r: Round2Row): string[] => {
    if (r.handPlanted === undefined) return [];
    const f = path.resolve('tests/fixtures/v1.3-reference', r.handPlanted.style, 'variants', r.handPlanted.variant, 'expected-findings.json');
    return fs.existsSync(f) ? (readJson(f) as { expectedFindings: { ruleId: string }[] }).expectedFindings.map((x) => x.ruleId) : [];
  };

  const stratumOfBase = (baseId: string): Round2Row['stratum'] => (baseId.startsWith('e1/') ? 'operator' : 'hand-planted');
  const cleanUnits: { base: string; stratum: string; unit: string; fn: string; verdict: string | null }[] = [];
  for (const t of targets.filter((x) => x.kind === 'clean')) {
    const rep = reportOf(t.id);
    const base = t.id.slice('base:'.length);
    for (const [fn, units] of Object.entries(t.units)) for (const u of units) cleanUnits.push({ base, stratum: stratumOfBase(base), unit: u, fn, verdict: rep === null ? null : unitVerdict(rep, fn, u) });
  }
  const scored: Scored[] = [];
  for (const t of targets.filter((x) => x.kind !== 'clean')) {
    const row = rows.find((r) => r.rowId === t.id);
    if (row === undefined) throw new Error(`no row ${t.id}`);
    const rep = reportOf(t.id);
    const baseRep = reportOf(`base:${row.baseId}`);
    const fn = PROBED_FUNCTION[row.positiveId] ?? '';
    const units = t.units[fn] ?? [];
    const files = [...new Set([...row.editedFiles, ...row.createdFiles])];
    const re = CONSTRUCT[row.positiveId];
    const common = { rowId: t.id, operatorId: row.operatorId, positiveId: row.positiveId, role: row.role, stratum: row.stratum, baseId: row.baseId, cell: row.cell ?? null, twinOf: row.twinOf ?? null, twinMatch: row.twinMatch ?? null };
    if (rep === null) {
      scored.push({ ...common, judged: false });
      continue;
    }
    const verdicts = units.map((u) => ({ unit: u, verdict: unitVerdict(rep, fn, u), base: baseRep === null ? null : unitVerdict(baseRep, fn, u) }));
    const unitFail = verdicts.some((v) => v.verdict === 'fail');
    const flagMaj = units.some((u) => flagged(t.id, fn, u, files, re, 2));
    const baseSym = new Set((baseRep?.violations ?? []).filter((v) => !v.functionId.startsWith('FF-N')).map(symKey));
    const newSym = rep.violations.filter((v) => !v.functionId.startsWith('FF-N') && !baseSym.has(symKey(v)));
    const expected = expectedRulesOf(row);
    scored.push({
      ...common, judged: true, probedFunction: fn, units: verdicts, unitFail, constructFlagMajority: flagMaj,
      constructFlagAnyRun: units.some((u) => flagged(t.id, fn, u, files, re, 1)),
      catch: unitFail || flagMaj,
      pairedCatch: verdicts.some((v) => v.verdict === 'fail' && v.base !== 'fail') || (flagMaj && !verdicts.some((v) => v.base === 'fail')),
      pairedFail: verdicts.some((v) => v.verdict === 'fail' && v.base !== 'fail'),
      symbolicS1: row.positiveId === 'AP-PERSIST-IN-DOMAIN' && newSym.some((v) => v.functionId === 'FF-P01' && v.filePath === row.site.filePath),
      symbolicS2: newSym.some((v) => files.includes(v.filePath)),
      ...(row.stratum === 'hand-planted' && row.role === 'seed' ? { expectedRules: expected, symbolicExpected: newSym.some((v) => files.includes(v.filePath) && expected.includes(v.functionId)) } : {}),
      symbolicNewRows: newSym.map(symKey),
      blockingVerdict: rep.tiers?.verdict ?? null, baseBlockingVerdict: baseRep?.tiers?.verdict ?? null,
    });
  }

  const judged = scored.filter((r) => r.judged === true);
  const positives = Object.keys(PROBED_FUNCTION);
  const sel = (stratum: string | null, pos: string | null, role: string): Scored[] =>
    judged.filter((r) => (stratum === null || r.stratum === stratum) && (pos === null || r.positiveId === pos) && r.role === role);
  const strata = ['operator', 'hand-planted', null] as const;
  const perOperator = positives.map((pos) => ({
    positive: pos,
    probedFunction: PROBED_FUNCTION[pos],
    ...Object.fromEntries(strata.map((s) => [s ?? 'combined', block(sel(s, pos, 'seed'), sel(s, pos, 'twin'))])),
  }));
  const pooled = Object.fromEntries(strata.map((s) => [s ?? 'combined', block(sel(s, null, 'seed'), sel(s, null, 'twin'))]));
  const judgedClean = cleanUnits.filter((u) => u.verdict !== null);
  const cleanBlock = (xs: typeof judgedClean): Record<string, unknown> => {
    const bases = [...new Set(xs.map((u) => u.base))];
    return {
      unitFalseFail: rate(xs.filter((u) => u.verdict === 'fail').length, xs.length),
      baseFalseFail: rate(bases.filter((b) => xs.some((u) => u.base === b && u.verdict === 'fail')).length, bases.length),
      failingUnits: xs.filter((u) => u.verdict === 'fail').map((u) => `${u.base} ${u.fn} ${u.unit}`),
    };
  };
  const clean = {
    operator: cleanBlock(judgedClean.filter((u) => u.stratum === 'operator')),
    'hand-planted': cleanBlock(judgedClean.filter((u) => u.stratum === 'hand-planted')),
    combined: cleanBlock(judgedClean),
  };

  // Round 1 + round 2 operator seeds (supplementary): round 1's rows from its scores.json.
  let rounds12: Record<string, unknown> | null = null;
  const r1File = path.join(round1, 'scores.json');
  if (fs.existsSync(r1File)) {
    const r1 = (readJson(r1File) as { rows: Scored[] }).rows.filter((r) => r.judged === true && r.role === 'seed');
    const r2 = sel('operator', null, 'seed');
    const entries: [string, ReturnType<typeof rate>][] = [...positives.map((pos): [string, ReturnType<typeof rate>] => {
      const xs = [...r1.filter((r) => r.positiveId === pos), ...r2.filter((r) => r.positiveId === pos)];
      return [pos, rate(count(xs, 'catch'), xs.length)];
    }), ['pooled', rate(count([...r1, ...r2], 'catch'), r1.length + r2.length)]];
    rounds12 = Object.fromEntries(entries);
  }

  const scores = {
    label: 'DEVELOPMENT-SET NUMBERS (construct sensitivity); not validity estimates',
    calls: ledger.calls, skipped, perOperator, pooled, clean, rounds12OperatorSeeds: rounds12, cleanUnits, rows: scored,
  };
  fs.writeFileSync(path.join(results, 'scores.json'), `${JSON.stringify(scores, null, 2)}\n`);
  const csv = ['rowId,stratum,operatorId,positiveId,role,baseId,twinOf,judged,unitFail,constructFlagMajority,catch,pairedCatch,symbolicS1,symbolicS2,blockingVerdict'];
  for (const r of scored) csv.push([r.rowId, r.stratum, r.operatorId, r.positiveId, r.role, r.baseId, r.twinOf, r.judged, r.unitFail, r.constructFlagMajority, r.catch, r.pairedCatch, r.symbolicS1, r.symbolicS2, r.blockingVerdict].map(cell).join(','));
  fs.writeFileSync(path.join(results, 'rows.csv'), `${csv.join('\n')}\n`);
  const txt = (b: Record<string, unknown>, k: string): string => (b[k] as { text: string }).text;
  const out = ['| Operator | Stratum | Seeds | Catch | Unit fail only | Paired catch | Twins | Twin false fail |', '|---|---|---|---|---|---|---|---|'];
  for (const p of perOperator) {
    for (const s of ['operator', 'hand-planted', 'combined']) {
      const b = (p as Record<string, unknown>)[s] as Record<string, unknown>;
      if (b.seeds === 0 && b.twins === 0) continue;
      out.push(`| ${p.positive} | ${s} | ${String(b.seeds)} | ${txt(b, 'catch')} | ${txt(b, 'unitFailOnly')} | ${txt(b, 'pairedCatch')} | ${String(b.twins)} | ${txt(b, 'twinFalseFail')} |`);
    }
  }
  for (const s of ['operator', 'hand-planted', 'combined']) {
    const b = must(pooled[s], `pooled stratum ${s}`);
    out.push(`| pooled | ${s} | ${String(b.seeds)} | ${txt(b, 'catch')} | ${txt(b, 'unitFailOnly')} | ${txt(b, 'pairedCatch')} | ${String(b.twins)} | ${txt(b, 'twinFalseFail')} |`);
  }
  for (const s of ['operator', 'hand-planted', 'combined'] as const) out.push(`clean ${s}: units ${(clean[s].unitFalseFail as { text: string }).text}; bases ${(clean[s].baseFalseFail as { text: string }).text}`);
  if (rounds12 !== null) out.push(`rounds 1+2 operator seeds: ${Object.entries(rounds12).map(([k, v]) => `${k} ${(v as { text: string }).text}`).join('; ')}`);
  out.push(`calls ${String(ledger.calls)}`);
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch2-score.ts') === true) process.exitCode = main(process.argv.slice(2));
