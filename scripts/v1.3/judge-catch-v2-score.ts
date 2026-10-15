/**
 * AP-DUP-RULE v2: judge scoring. DEVELOPMENT SET ONLY; reported as construct sensitivity. Committed before any v2
 * judge call; the definitions are rounds 1 and 2's (`judge-catch-score.ts`, `judge-catch2-score.ts`), unchanged:
 * - Unit fail: the unit's majority verdict (from the report) is `fail`.
 * - Construct flag: in >= 2 valid runs of the unit, a violation on an edited or created file whose message matches
 *   `CONSTRUCT['AP-DUP-RULE']` (/duplicat|copied|same (rule|check|validation)|repeat/i).
 * - Catch (seed): a target unit fails, or a construct flag. Paired catch: a target unit fails and the same unit on the
 *   clean base does not (or a construct flag and no base unit fails).
 * - Twin false fail: a target unit of the twin fails; paired: and that unit passes on the base.
 * - Clean false fail: a judged unit of an unmodified base fails (per unit; per base).
 * Added for v2 (descriptive, not a catch criterion): `duplicationCited` = in >= 2 valid runs of a target unit, the
 * reasoning or a violation message matches the construct pattern, on any file.
 *
 * Strata: `fixture` (antipattern-nest) and `e1`, reported apart and combined.
 * Pooled across rounds (seeds and twins of round 1 `results/v1.3-judge-catch/scores.json` and round 2
 * `results/v1.3-judge-catch/round2/scores.json`), two ways: as recorded (with v1 AP-DUP-RULE) and with the v1
 * AP-DUP-RULE rows replaced by these v2 rows.
 *
 * Usage: npx tsx scripts/v1.3/judge-catch-v2-score.ts [--results results/v1.3-judge-catch/duprule-v2]
 *   [--cassettes tests/fixtures/judge-cassettes-v13/judge-catch-duprule-v2]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { PROBED_FUNCTION } from './judge-catch-run.js';
import type { Target } from './judge-catch-run.js';
import { CONSTRUCT, rate } from './judge-catch-score.js';
import type { V2Row } from './judge-catch-v2-seed.js';

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

const readJson = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const safe = (id: string): string => id.replace(/[/:]/g, '__');
const symKey = (v: { functionId: string; filePath: string; target?: string }): string => `${v.functionId}|${v.filePath}|${v.target ?? ''}`;
const count = (xs: readonly Scored[], k: string): number => xs.filter((x) => x[k] === true).length;
const DUP = CONSTRUCT['AP-DUP-RULE'] ?? /duplicat/i;

function allEntries(dir: string): Entry[] {
  const out: Entry[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const sub of fs.readdirSync(dir)) {
    const p = path.join(dir, sub);
    if (sub === '_incomplete' || !fs.statSync(p).isDirectory()) continue;
    for (const f of fs.readdirSync(p).filter((x) => x.endsWith('.json'))) out.push(readJson<Entry>(path.join(p, f)));
  }
  return out.sort((a, b) => (a.recordedAt < b.recordedAt ? -1 : 1));
}

function block(seeds: readonly Scored[], twins: readonly Scored[]): Record<string, unknown> {
  return {
    seeds: seeds.length,
    twins: twins.length,
    catch: rate(count(seeds, 'catch'), seeds.length),
    unitFailOnly: rate(count(seeds, 'unitFail'), seeds.length),
    pairedCatch: rate(count(seeds, 'pairedCatch'), seeds.length),
    seedDuplicationCited: rate(count(seeds, 'duplicationCited'), seeds.length),
    twinFalseFail: rate(count(twins, 'unitFail'), twins.length),
    twinFalseFailPaired: rate(count(twins, 'pairedFail'), twins.length),
    twinDuplicationCited: rate(count(twins, 'duplicationCited'), twins.length),
    symbolicS2: rate(count(seeds, 'symbolicS2'), seeds.length),
  };
}

export function main(argv: readonly string[]): number {
  const argOf = (n: string, d: string): string => {
    const i = argv.indexOf(n);
    return i >= 0 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : d;
  };
  const results = path.resolve(argOf('--results', 'results/v1.3-judge-catch/duprule-v2'));
  const cas = path.resolve(argOf('--cassettes', 'tests/fixtures/judge-cassettes-v13/judge-catch-duprule-v2'));
  const { targets } = readJson<{ targets: Target[] }>(path.join(results, 'plan.json'));
  const rows = readJson<{ rows: V2Row[] }>(path.join(results, 'seed-manifest.json')).rows;
  const ledger = readJson<{ calls: number; runs: { id: string; at: string }[] }>(path.join(results, 'call-ledger.json'));
  const entries = allEntries(cas);
  const entriesOf = new Map<string, Entry[]>();
  let prev = '';
  for (const r of ledger.runs) {
    entriesOf.set(r.id, [...(entriesOf.get(r.id) ?? []), ...entries.filter((e) => e.recordedAt > prev && e.recordedAt <= r.at)]);
    prev = r.at;
  }
  const reportOf = (id: string): Report | null => {
    const f = path.join(results, 'reports', `${safe(id)}.json`);
    return fs.existsSync(f) ? readJson<Report>(f) : null;
  };
  const unitVerdict = (rep: Report, fn: string, unit: string): string | null =>
    rep.neuralResults?.find((n) => n.functionId === fn)?.unitResults.find((u) => u.unitId === unit)?.verdict ?? null;
  const validRuns = (id: string, fn: string, unit: string): Entry[] =>
    (entriesOf.get(id) ?? []).filter((e) => e.functionId === fn && e.unitId === unit && e.outcome.kind === 'valid' && e.parsedVerdict !== undefined);
  const flagged = (id: string, fn: string, unit: string, files: readonly string[], min: number): boolean =>
    validRuns(id, fn, unit).filter((e) => (e.parsedVerdict?.violations ?? []).some((v) => files.some((f) => v.filePath === f || v.filePath.endsWith(`/${f}`) || f.endsWith(v.filePath)) && DUP.test(v.message))).length >= min;
  const cited = (id: string, fn: string, unit: string): boolean =>
    validRuns(id, fn, unit).filter((e) => DUP.test(e.parsedVerdict?.reasoning ?? '') || (e.parsedVerdict?.violations ?? []).some((v) => DUP.test(v.message))).length >= 2;

  const cleanUnits: { base: string; stratum: string; unit: string; fn: string; verdict: string | null; duplicationCited: boolean }[] = [];
  for (const t of targets.filter((x) => x.kind === 'clean')) {
    const rep = reportOf(t.id);
    const base = t.id.slice('base:'.length);
    for (const [fn, units] of Object.entries(t.units)) {
      for (const u of units) cleanUnits.push({ base, stratum: base.startsWith('e1/') ? 'e1' : 'fixture', unit: u, fn, verdict: rep === null ? null : unitVerdict(rep, fn, u), duplicationCited: cited(t.id, fn, u) });
    }
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
    const common = { rowId: t.id, operatorId: row.operatorId, positiveId: row.positiveId, role: row.role, stratum: row.stratum, baseId: row.baseId, cell: row.cell ?? null, twinOf: row.twinOf ?? null, hostKind: row.role === 'twin' ? row.hostKind ?? null : null };
    if (rep === null) {
      scored.push({ ...common, judged: false });
      continue;
    }
    const verdicts = units.map((u) => ({ unit: u, verdict: unitVerdict(rep, fn, u), base: baseRep === null ? null : unitVerdict(baseRep, fn, u) }));
    const unitFail = verdicts.some((v) => v.verdict === 'fail');
    const flagMaj = units.some((u) => flagged(t.id, fn, u, files, 2));
    const baseSym = new Set((baseRep?.violations ?? []).filter((v) => !v.functionId.startsWith('FF-N')).map(symKey));
    const newSym = rep.violations.filter((v) => !v.functionId.startsWith('FF-N') && !baseSym.has(symKey(v)));
    scored.push({
      ...common, judged: true, probedFunction: fn, units: verdicts, unitFail, constructFlagMajority: flagMaj,
      constructFlagAnyRun: units.some((u) => flagged(t.id, fn, u, files, 1)),
      duplicationCited: units.some((u) => cited(t.id, fn, u)),
      catch: unitFail || flagMaj,
      pairedCatch: verdicts.some((v) => v.verdict === 'fail' && v.base !== 'fail') || (flagMaj && !verdicts.some((v) => v.base === 'fail')),
      pairedFail: verdicts.some((v) => v.verdict === 'fail' && v.base !== 'fail'),
      symbolicS2: newSym.some((v) => files.includes(v.filePath)),
      symbolicNewRows: newSym.map(symKey),
      blockingVerdict: rep.tiers?.verdict ?? null, baseBlockingVerdict: baseRep?.tiers?.verdict ?? null,
    });
  }
  const judged = scored.filter((r) => r['judged'] === true);
  const sel = (stratum: string | null, role: string, host?: string): Scored[] =>
    judged.filter((r) => (stratum === null || r['stratum'] === stratum) && r['role'] === role && (host === undefined || r['hostKind'] === host));
  const strata = { fixture: block(sel('fixture', 'seed'), sel('fixture', 'twin')), e1: block(sel('e1', 'seed'), sel('e1', 'twin')), combined: block(sel(null, 'seed'), sel(null, 'twin')) };
  const twinsByHost = { domain: block([], sel(null, 'twin', 'domain')), own: block([], sel(null, 'twin', 'own')) };
  const judgedClean = cleanUnits.filter((u) => u.verdict !== null);
  const cleanBlock = (xs: typeof judgedClean): Record<string, unknown> => {
    const bases = [...new Set(xs.map((u) => u.base))];
    return {
      unitFalseFail: rate(xs.filter((u) => u.verdict === 'fail').length, xs.length),
      baseFalseFail: rate(bases.filter((b) => xs.some((u) => u.base === b && u.verdict === 'fail')).length, bases.length),
      duplicationCited: rate(xs.filter((u) => u.duplicationCited).length, xs.length),
      failingUnits: xs.filter((u) => u.verdict === 'fail').map((u) => `${u.base} ${u.fn} ${u.unit}`),
    };
  };
  const clean = { fixture: cleanBlock(judgedClean.filter((u) => u.stratum === 'fixture')), e1: cleanBlock(judgedClean.filter((u) => u.stratum === 'e1')), combined: cleanBlock(judgedClean) };

  // ── Pooled across rounds, with v1 DUP-RULE and with v2 in its place ──
  const prior = (f: string, round: number): Scored[] =>
    fs.existsSync(f) ? readJson<{ rows: Scored[] }>(f).rows.filter((r) => r['judged'] === true).map((r) => ({ ...r, round, stratum: r['stratum'] ?? 'operator' })) : [];
  const r12 = [...prior(path.resolve('results/v1.3-judge-catch/scores.json'), 1), ...prior(path.resolve('results/v1.3-judge-catch/round2/scores.json'), 2)];
  const v2 = judged.map((r) => ({ ...r, round: 'v2', stratum: 'operator' }));
  const withV1 = r12;
  const withV2 = [...r12.filter((r) => r['positiveId'] !== 'AP-DUP-RULE'), ...v2];
  const poolOf = (xs: readonly Scored[]): Record<string, unknown> => {
    const seeds = xs.filter((r) => r['role'] === 'seed');
    const twins = xs.filter((r) => r['role'] === 'twin');
    const opSeeds = seeds.filter((r) => r['stratum'] === 'operator');
    const byPos = Object.fromEntries([...new Set(seeds.map((r) => String(r['positiveId'])))].sort().map((p) => [p, rate(count(seeds.filter((r) => r['positiveId'] === p), 'catch'), seeds.filter((r) => r['positiveId'] === p).length)]));
    return {
      seedsAll: rate(count(seeds, 'catch'), seeds.length),
      seedsOperatorOnly: rate(count(opSeeds, 'catch'), opSeeds.length),
      twinFalseFail: rate(count(twins, 'unitFail'), twins.length),
      perPositive: byPos,
    };
  };
  const pooledAcrossRounds = { withV1DupRule: poolOf(withV1), withV2DupRule: poolOf(withV2) };

  const scores = { label: 'DEVELOPMENT-SET NUMBERS (construct sensitivity); not validity estimates', calls: ledger.calls, strata, twinsByHost, clean, pooledAcrossRounds, cleanUnits, rows: scored };
  fs.writeFileSync(path.join(results, 'scores.json'), `${JSON.stringify(scores, null, 2)}\n`);
  const csv = ['rowId,stratum,operatorId,role,hostKind,baseId,twinOf,judged,unitFail,pairedFail,constructFlagMajority,duplicationCited,catch,pairedCatch,symbolicS2,blockingVerdict'];
  for (const r of scored) csv.push([r['rowId'], r['stratum'], r['operatorId'], r['role'], r['hostKind'], r['baseId'], r['twinOf'], r['judged'], r['unitFail'], r['pairedFail'], r['constructFlagMajority'], r['duplicationCited'], r['catch'], r['pairedCatch'], r['symbolicS2'], r['blockingVerdict']].map((x) => String(x ?? '')).join(','));
  fs.writeFileSync(path.join(results, 'rows.csv'), `${csv.join('\n')}\n`);
  const txt = (b: Record<string, unknown>, k: string): string => (b[k] as { text: string }).text;
  const out = ['| Stratum | Seeds | Catch | Paired catch | Dup cited (seeds) | Twins | Twin false fail | Paired | Dup cited (twins) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const [s, b] of Object.entries(strata)) out.push(`| ${s} | ${String(b['seeds'])} | ${txt(b, 'catch')} | ${txt(b, 'pairedCatch')} | ${txt(b, 'seedDuplicationCited')} | ${String(b['twins'])} | ${txt(b, 'twinFalseFail')} | ${txt(b, 'twinFalseFailPaired')} | ${txt(b, 'twinDuplicationCited')} |`);
  for (const [h, b] of Object.entries(twinsByHost)) out.push(`twins ${h} host: ${txt(b, 'twinFalseFail')} (paired ${txt(b, 'twinFalseFailPaired')})`);
  for (const [s, b] of Object.entries(clean)) out.push(`clean ${s}: units ${(b.unitFalseFail as { text: string }).text}; bases ${(b.baseFalseFail as { text: string }).text}`);
  for (const [k, b] of Object.entries(pooledAcrossRounds)) out.push(`pooled ${k}: seeds ${txt(b, 'seedsAll')}; operator seeds ${txt(b, 'seedsOperatorOnly')}; twin false fail ${txt(b, 'twinFalseFail')}`);
  out.push(`calls ${String(ledger.calls)}`);
  process.stdout.write(`${out.join('\n')}\n`);
  return 0;
}

if (process.argv[1]?.endsWith('judge-catch-v2-score.ts') === true) process.exitCode = main(process.argv.slice(2));
