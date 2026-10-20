/**
 * Study 2b confirmatory analysis: every §4 table of the pre-registration (`Docs/v1.4/study2b-preregistration.md`;
 * Fable review 2026-10-20 finding 1). Entry file: no exports. Helpers: `scripts/v1.4/lib/study2b-analyse.ts`. Additive:
 * it changes no frozen path. Zero model calls, no Neo4j, no network, CPU only.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/study2b-analyse.ts --runs <rescore>/runs.json --out <dir>
 *     [--analysis <rescore>/analysis.json]                     counted identities (V4 part A, concentration)
 *     [--recall <cell>=<seeded-recall run.json> ...]           seeded recall per cell (V4 part B)
 *     [--scores results/v1.3-reference/after-construct-answers/scores.json]   r_f under F-RF
 *     [--dagger <d-dagger>/runs.json]                          D† (finding 2) and the evasion bar
 *     [--telemetry <mcp-telemetry>/telemetry.json ...]         evasion item 6 (mechanism); repeatable
 *     [--acceptance <acceptance.json>]                         evasion item 1: [{cell, block, step, passed}]
 *     [--order <order.jsonl>]                                  run-order covariates (runbook §5: {cell, replicate, lane, start|end})
 *     [--drop-blocks <block,block>]                            the unmapped-flag sensitivity (§5)
 *     [--family H1,H2,H3] [--seed 20261021] [--draws 99999] [--resamples 10000]
 *     [--reproduce-2a]                                         add the 2a report §3 tables (seed 20261019)
 *     [--plant effect|null] [--plant-keep 0.25] [--plant-reps 10] [--plant-tasks 4]   D9: a planted data set from --runs
 *
 * Reads runs.json in the Stage C format (`scripts/v1.4/stage-c-rescore.ts`): `registered.D`, `Y1`, `Yk` per run.
 * Writes <out>/analysis.json and <out>/tables.md. Exit 0 ok, 1 an input is inconsistent, 2 usage error.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONSTRUCT_COMPOSITION_ROOT_GLOBS, globMatcher } from '../../src/construct-switches/overlays.js';
import { cellEvasion, evasionFlag, type RunEvasion } from './lib/d-dagger.js';
import {
  ANALYSIS_SEED, BOOT_RESAMPLES, CELLS, CONCENTRATION_SHARE, CONTRASTS, DELTA, DELTA2, FWER, MC_DRAWS, V4_A_MARGIN, V4_B_MARGIN,
  analyseContrast, cellDistribution, equivalence, familyDecision, halves, isComplete, partA, partB, plantedBlocks, recallByFamily,
  supportedUnderBoth, taskClusterBootstrap, zeroTable,
  type Block, type Cell, type ContrastResult, type FamilyDecision, type HypothesisId, type RecallSite,
} from './lib/study2b-analyse.js';
import { momentTheta, sampleVariance } from './lib/stage-c.js';

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const args = (name: string): string[] => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] !== undefined ? [argv[i + 1] ?? ''] : []));
const readJson = <T>(p: string): T => JSON.parse(fs.readFileSync(p, 'utf8')) as T;
const sha = (p: string): string => createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const isCell = (c: string): c is Cell => (CELLS as readonly string[]).includes(c);
const isExempt = globMatcher(CONSTRUCT_COMPOSITION_ROOT_GLOBS);

interface RunRow { cell: string; task: string; rep: number; block: string; registered: { D: number | null; Y1: number | null; Yk: number | null; incomplete?: boolean } }
interface Counted { cell: string; block: string; step: number; ruleId: string; file: string }

function blocksFrom(runs: readonly RunRow[], value: (r: RunRow) => number | null = (r) => r.registered.D): Block[] {
  const ids = [...new Set(runs.map((r) => r.block))].sort();
  return ids.map((id) => {
    const rs = runs.filter((r) => r.block === id);
    const at = (c: Cell): RunRow | undefined => rs.find((r) => r.cell === c);
    const D = Object.fromEntries(CELLS.map((c) => { const r = at(c); return [c, r === undefined || r.registered.incomplete === true ? null : value(r)]; })) as Record<Cell, number | null>;
    const Yk = Object.fromEntries(CELLS.map((c) => [c, at(c)?.registered.Yk ?? null])) as Record<Cell, number | null>;
    const first = rs[0] as RunRow;
    return { block: id, task: first.task, rep: first.rep, Y1: at('none@L2')?.registered.Y1 ?? first.registered.Y1, D, Yk };
  });
}

const f = (x: number | null | undefined, dp = 2): string => (x === null || x === undefined || !Number.isFinite(x) ? 'undefined' : x.toFixed(dp));
const iv = (b: { low: number; high: number } | null | undefined, dp = 2): string => (b === null || b === undefined || !Number.isFinite(b.low) ? '[undefined]' : `[${f(b.low, dp)}, ${f(b.high, dp)}]`);
const pf = (p: number): string => (p < 0.0001 ? p.toExponential(2) : p.toFixed(4));

function contrastRows(results: readonly ContrastResult[]): string[] {
  return [
    '| Contrast | Blocks | Non-zero d | T | MC p | exact p | d̄ [95 % within-task] [95 % task-cluster] | RR [95 % within-task] [95 % task-cluster] | sign test (+/−, p) | signed-rank p | task-level exact p (smallest possible) |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...results.map((r) => `| ${r.id}: ${r.reference} − ${r.other} | ${String(r.blocks)} | ${String(r.nonZero)} | ${String(r.T)} | ${pf(r.mcP)} | ${pf(r.exactP)} | ${f(r.dbar)} ${iv(r.dbarWithinTask)} ${iv(r.dbarTaskCluster)} | ${f(r.rr)} ${iv(r.rrWithinTask)} ${iv(r.rrTaskCluster)} | ${String(r.signTest.positive)}/${String(r.signTest.negative)}, ${pf(r.signTest.p)} | ${pf(r.signedRankP)} | ${pf(r.taskLevel.exactP)} (${pf(r.taskLevel.smallestPossibleP)}) |`),
  ];
}

function holmRows(d: FamilyDecision): string[] {
  return [
    `Holm over {${d.family.join(', ')}} at FWER ${String(FWER)}. MC and exact decisions ${d.disagree ? '**disagree: the exact decisions govern**' : 'agree'}.`, '',
    '| Contrast | α′ (MC order) | reject (MC) | α′ (exact order) | reject (exact) | governing reject | predicted sign | supported under this outcome |',
    '|---|---|---|---|---|---|---|---|',
    ...d.family.map((id) => {
      const m = d.holmMc.find((h) => h.id === id);
      const e = d.holmExact.find((h) => h.id === id);
      const x = d.decisions[id];
      return `| ${id} | ${f(m?.alphaStep, 4)} | ${String(m?.reject)} | ${f(e?.alphaStep, 4)} | ${String(e?.reject)} | ${String(x?.reject)} | ${x?.predictedSign === null ? '—' : String(x?.predictedSign)} | ${x?.supportedUnderThisOutcome === null ? '—' : String(x?.supportedUnderThisOutcome)} |`;
    }),
  ];
}

function main(): number {
  const runsFile = arg('runs');
  const out = arg('out');
  if (runsFile === undefined || out === undefined) {
    process.stderr.write('usage: study2b-analyse.ts --runs <runs.json> --out <dir> [options; see the header]\n');
    return 2;
  }
  const seed = Number(arg('seed') ?? String(ANALYSIS_SEED));
  const draws = Number(arg('draws') ?? String(MC_DRAWS));
  const resamples = Number(arg('resamples') ?? String(BOOT_RESAMPLES));
  const family = (arg('family') ?? 'H1,H2,H3').split(',') as HypothesisId[];
  const runs = readJson<RunRow[]>(runsFile);
  const bad = runs.filter((r) => !isCell(r.cell));
  if (bad.length > 0) {
    process.stderr.write(`unknown cells: ${[...new Set(bad.map((r) => r.cell))].join(', ')}\n`);
    return 1;
  }
  const inputs: Record<string, string> = { runs: `${path.basename(runsFile)} sha256 ${sha(runsFile)}` };
  const plant = arg('plant');
  let blocksAll = blocksFrom(runs);
  if (plant !== undefined) {
    if (plant !== 'effect' && plant !== 'null') { process.stderr.write('--plant effect|null\n'); return 2; }
    const pilot = blocksAll.flatMap((b) => (b.D['none@L2'] !== null ? [{ D: b.D['none@L2'], Y1: b.Y1 ?? 0 }] : []));
    const keep = Number(arg('plant-keep') ?? '0.25');
    blocksAll = plantedBlocks(pilot, { tasks: Number(arg('plant-tasks') ?? '4'), reps: Number(arg('plant-reps') ?? '10'), keep: { 'none@L3': keep, 'mcp@L2': keep }, nullRedraw: plant === 'null', seed });
    inputs.plant = `${plant}: none@L2 (D, Y1) drawn from the --runs none@L2 blocks; treated cells ${plant === 'effect' ? `binomial thinning, keep ${String(keep)} (RR about ${String(keep)})` : 'independent redraws from the same none@L2 values (no effect)'}`;
  }
  const dropped = (arg('drop-blocks') ?? '').split(',').filter((x) => x !== '');
  const incomplete = blocksAll.filter((b) => !isComplete(b));
  const blocks = blocksAll.filter(isComplete);
  const opts = { seed, draws, resamples };

  // ── primary ──
  const primary = CONTRASTS.map((c) => analyseContrast(blocks, c, opts));
  const decision = familyDecision(primary, family);
  const eq = equivalence(blocks, { seed, resamples });
  const dists = CELLS.map((c) => cellDistribution(blocks, c));
  const zero = CONTRASTS.map((c) => ({ id: c.id, ...zeroTable(blocks, c) }));
  const y1Zero = blocks.filter((b) => b.Y1 === 0).length;

  // ── D† ──
  const daggerFile = arg('dagger');
  let dagger: { results: ContrastResult[]; decision: FamilyDecision } | null = null;
  let evasionBar: Record<string, unknown> | null = null;
  if (daggerFile !== undefined && plant === undefined) {
    inputs.dagger = `${path.basename(daggerFile)} sha256 ${sha(daggerFile)}`;
    const dr = readJson<{ cell: string; block: string; dagger: { D: number | null }; evasion: RunEvasion }[]>(daggerFile);
    const dv = (b: Block, cell: Cell): number | null => dr.find((r) => r.cell === cell && r.block === b.block)?.dagger.D ?? null;
    const results = CONTRASTS.map((c) => analyseContrast(blocks, c, { ...opts, value: dv }));
    dagger = { results, decision: familyDecision(results, family) };
    const ev = Object.fromEntries(CELLS.map((c) => [c, cellEvasion(c, dr.filter((r) => r.cell === c && blocks.some((b) => b.block === r.block)).map((r) => r.evasion))]));
    evasionBar = { cells: ev, contrasts: CONTRASTS.map((c) => ({ id: c.id, ...evasionFlag(ev[c.reference] as ReturnType<typeof cellEvasion>, ev[c.other] as ReturnType<typeof cellEvasion>) })) };
  } else if (plant !== undefined) {
    // A planted data set has no composition-root channel: D† = D by construction, so the agreement rule runs end to end.
    inputs.dagger = 'planted: D† = D by construction';
    dagger = { results: primary, decision };
  }
  const support = supportedUnderBoth(decision, dagger?.decision ?? null);

  // ── sensitivity ──
  const rerun = (bs: readonly Block[]): { results: ContrastResult[]; decision: FamilyDecision } => {
    const results = CONTRASTS.map((c) => analyseContrast(bs, c, opts));
    return { results, decision: familyDecision(results, family) };
  };
  const y1Pos = rerun(blocks.filter((b) => b.Y1 !== 0));
  const dropFlagged = dropped.length === 0 ? null : rerun(blocks.filter((b) => !dropped.includes(b.block)));
  const h = halves(blocks);
  const halfLine = (bs: readonly Block[]): Record<string, unknown> => ({
    blocks: bs.length, meanDnoneL2: cellDistribution(bs, 'none@L2').mean,
    dbar: Object.fromEntries(CONTRASTS.map((c) => [c.id, bs.length === 0 ? null : bs.reduce((a, b) => a + ((b.D[c.reference] as number) - (b.D[c.other] as number)), 0) / bs.length])),
  });
  const first = halfLine(h.first);
  const second = halfLine(h.second);
  const reversal = Object.fromEntries(CONTRASTS.map((c) => {
    const a = (first.dbar as Record<string, number | null>)[c.id] ?? null;
    const b = (second.dbar as Record<string, number | null>)[c.id] ?? null;
    return [c.id, a !== null && b !== null && a !== 0 && b !== 0 && Math.sign(a) !== Math.sign(b)];
  }));
  const orderFile = arg('order');
  let byLane: Record<string, unknown> | null = null;
  if (orderFile !== undefined) {
    inputs.order = `${path.basename(orderFile)} sha256 ${sha(orderFile)}`;
    // The runbook's order.jsonl (one line per cell, replicate and lane event), or a JSON array of { cell, block, lane }.
    const text = fs.readFileSync(orderFile, 'utf8').trim();
    const order = (text.startsWith('[') ? JSON.parse(text) : text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))) as { cell: string; lane: string; block?: string; replicate?: number }[];
    const hit = (o: { block?: string; replicate?: number }, b: Block): boolean => o.block === b.block || o.replicate === b.rep;
    byLane = Object.fromEntries(CELLS.map((cell) => {
      const lanes = [...new Set(order.filter((o) => o.cell === cell).map((o) => o.lane))].sort();
      return [cell, lanes.map((lane) => {
        const bs = blocks.filter((b) => order.some((o) => o.cell === cell && o.lane === lane && hit(o, b)));
        return { lane, blocks: bs.length, meanD: cellDistribution(bs, cell).mean };
      })];
    }));
  }

  // ── V4 part A and concentration ──
  const analysisFile = arg('analysis');
  const scoresFile = arg('scores') ?? 'results/v1.3-reference/after-construct-answers/scores.json';
  const v4Pairs = CONTRASTS.map((c) => [c.reference, c.other] as const);
  let v4A: ReturnType<typeof partA> | null = null;
  let concentration: Record<string, unknown> | null = null;
  let rfInfo: ReturnType<typeof recallByFamily> | null = null;
  if (fs.existsSync(scoresFile)) {
    inputs.scores = `${path.basename(scoresFile)} sha256 ${sha(scoresFile)}`;
    const sc = readJson<{ views: { style: string; view: string; perRule: { ruleId: string; blocking: boolean; counts: { tp: number; fn: number } }[] }[] }>(scoresFile);
    const view = sc.views.find((v) => v.style === 'layered' && v.view === 'blind-primary');
    if (view !== undefined) rfInfo = recallByFamily(view.perRule);
  }
  if (analysisFile !== undefined) {
    inputs.analysis = `${path.basename(analysisFile)} sha256 ${sha(analysisFile)}`;
    const counted = readJson<{ countedIdentities: Counted[] }>(analysisFile).countedIdentities;
    const keep = (c: Counted): boolean => blocks.some((b) => b.block === c.block);
    const idsByCell = Object.fromEntries(CELLS.map((cell) => [cell, counted.filter((c) => c.cell === cell && keep(c)).map((c) => c.ruleId)])) as Record<Cell, string[]>;
    if (rfInfo !== null && plant === undefined) v4A = partA(idsByCell, rfInfo.rf, rfInfo.pooled, v4Pairs);
    const all = Object.values(idsByCell).flat();
    const fams = [...new Set(all)].sort();
    const dominant = fams.map((fam) => ({ fam, share: all.filter((x) => x === fam).length / Math.max(1, all.length) })).sort((a, b) => b.share - a.share)[0] ?? null;
    const wiring = counted.filter((c) => keep(c) && c.ruleId === 'FF-S03' && /^src\/presentation\//.test(c.file)).length;
    let without: { results: ContrastResult[]; decision: FamilyDecision } | null = null;
    if (dominant !== null && plant === undefined) {
      const dv = (b: Block, cell: Cell): number | null => (b.D[cell] === null ? null : (b.D[cell] as number) - counted.filter((c) => c.cell === cell && c.block === b.block && c.ruleId === dominant.fam).length);
      const results = CONTRASTS.map((c) => analyseContrast(blocks, c, { ...opts, value: dv }));
      without = { results, decision: familyDecision(results, family) };
    }
    concentration = {
      identities: all.length, dominantFamily: dominant?.fam ?? null, dominantShare: dominant?.share ?? null,
      presentationFF_S03Share: all.length === 0 ? null : wiring / all.length,
      scoped: dominant !== null && dominant.share >= CONCENTRATION_SHARE,
      scopeSentence: dominant !== null && dominant.share >= CONCENTRATION_SHARE ? `${(dominant.share * 100).toFixed(0)} % of counted identities are ${dominant.fam}: the claim is scoped to that family${dominant.fam === 'FF-S03' ? ' (composition-root wiring, G12)' : ''}` : 'no family carries >= 90 % of counted identities',
      withoutDominant: without === null ? null : { decisions: without.decision.decisions, exactP: Object.fromEntries(without.results.map((r) => [r.id, r.exactP])), dbar: Object.fromEntries(without.results.map((r) => [r.id, Number.isFinite(r.dbar) ? r.dbar : null])) },
    };
  }

  // ── V4 part B ──
  const recallArgs = args('recall');
  let v4B: ReturnType<typeof partB> | null = null;
  if (recallArgs.length > 0 && plant === undefined) {
    const firing = new Set<string>();
    if (analysisFile !== undefined) for (const c of readJson<{ countedIdentities: Counted[] }>(analysisFile).countedIdentities) firing.add(c.ruleId);
    const sites: RecallSite[] = [];
    for (const a of recallArgs) {
      const i = a.indexOf('=');
      const cell = a.slice(0, i);
      const file = a.slice(i + 1);
      if (!isCell(cell)) { process.stderr.write(`--recall ${a}: unknown cell\n`); return 2; }
      inputs[`recall ${cell}`] = `${path.basename(path.dirname(file))}/${path.basename(file)} sha256 ${sha(file)}`;
      const rows = readJson<{ rows: { snapshotId: string; role: string; status: string; site: { filePath: string }; expected: { functionId: string }[] }[] }>(file).rows;
      for (const r of rows) {
        if (r.role !== 'positive' || !['detected', 'missed'].includes(r.status)) continue;
        if (!r.expected.some((e) => firing.has(e.functionId))) continue;
        sites.push({ cell, snapshotId: r.snapshotId, file: r.site.filePath, detected: r.status === 'detected', exempt: isExempt(r.site.filePath) });
      }
    }
    v4B = partB(sites, v4Pairs, seed, resamples);
  }
  const v4 = {
    partA: v4A, partB: v4B,
    layeredConfirmatory: v4B === null ? null : v4B.pass && (v4A === null || v4A.pass || v4A.uninformative),
    reading: v4B === null ? 'part B not computed (no seeded-recall input)' : v4B.pass ? (v4A !== null && v4A.uninformative ? 'part A uninformative (one family >= 90 % in every cell; reported); part B passes: Layered confirmatory, conditional on part B' : 'parts A and B pass: Layered confirmatory') : 'part B fails: 2b is reported under the fallback, labelled exploratory',
  };

  // ── evasion items computed here ──
  const telemetryFiles = args('telemetry');
  let mechanism: Record<string, unknown> | null = null;
  if (telemetryFiles.length > 0 && plant === undefined) {
    telemetryFiles.forEach((t, i) => { inputs[`telemetry ${String(i + 1)}`] = `${path.basename(t)} sha256 ${sha(t)}`; });
    const steps = telemetryFiles.flatMap((t) => readJson<{ perStep: { calls: number; callsByTool: Record<string, number> }[] }>(t).perStep);
    const used = steps.filter((s) => s.calls > 0).length;
    const checked = steps.filter((s) => Object.keys(s.callsByTool).some((t) => t.startsWith('check_'))).length;
    mechanism = { steps: steps.length, withToolUse: used, shareToolUse: steps.length === 0 ? null : used / steps.length, withCheck: checked, shareCheck: steps.length === 0 ? null : checked / steps.length, bar: 0.8, pass: steps.length > 0 && used / steps.length >= 0.8 };
  }
  const accFile = arg('acceptance');
  let acceptance: Record<string, unknown> | null = null;
  if (accFile !== undefined && plant === undefined) {
    inputs.acceptance = `${path.basename(accFile)} sha256 ${sha(accFile)}`;
    const rows = readJson<{ cell: string; block: string; step: number; passed: boolean }[]>(accFile);
    const rate = (cell: Cell, bs: readonly string[]): number | null => { const r = rows.filter((x) => x.cell === cell && bs.includes(x.block)); return r.length === 0 ? null : r.filter((x) => x.passed).length / r.length; };
    const ids = blocks.map((b) => b.block);
    acceptance = {
      rates: Object.fromEntries(CELLS.map((c) => [c, rate(c, ids)])),
      gaps: (['none@L3', 'mcp@L2'] as const).map((c) => { const a = rate('none@L2', ids); const b = rate(c, ids); const gap = a === null || b === null ? null : 100 * (a - b); return { cell: c, gapPoints: gap, oneSidedPass: gap !== null && gap <= 10, twoSidedPass: gap !== null && Math.abs(gap) <= 10 }; }),
    };
  }

  // ── 2a reproduction (report §3) ──
  let repro: Record<string, unknown> | null = null;
  if (argv.includes('--reproduce-2a')) {
    const s2a = 20261019;
    const order = [...blocks].sort((a, b) => (a.task === b.task ? a.rep - b.rep : a.task < b.task ? -1 : 1));
    repro = {
      seed: s2a, resamples,
      cells: CELLS.map((cell) => {
        const v = order.map((b) => b.D[cell] as number);
        const items = order.map((b) => ({ task: b.task, d: b.D[cell] as number }));
        return {
          cell, D: v, sum: v.reduce((a, b) => a + b, 0), mean: v.reduce((a, b) => a + b, 0) / v.length,
          meanInterval: taskClusterBootstrap(items, (s) => s.reduce((a, x) => a + x.d, 0) / s.length, s2a, resamples),
          variance: sampleVariance(v), theta: momentTheta(v), distribution: cellDistribution(order, cell).histogram,
          Yk: order.map((b) => b.Yk[cell]), endStateZero: order.filter((b) => b.Yk[cell] === 0).length,
        };
      }),
      Y1: order.map((b) => b.Y1),
      ratios: (['none@L3', 'mcp@L2'] as const).map((cell) => {
        const items = order.map((b) => ({ task: b.task, a: b.D[cell] as number, r: b.D['none@L2'] as number }));
        const ratio = taskClusterBootstrap(items, (s) => { const den = s.reduce((x, p) => x + p.r, 0); return den === 0 ? Number.NaN : s.reduce((x, p) => x + p.a, 0) / den; }, s2a, resamples);
        const diff = taskClusterBootstrap(items, (s) => s.reduce((x, p) => x + p.a - p.r, 0) / s.length, s2a, resamples);
        return { cell, sumCell: items.reduce((x, p) => x + p.a, 0), sumReference: items.reduce((x, p) => x + p.r, 0), ratio, differenceCellMinusReference: diff };
      }),
    };
  }

  const json = {
    schema: 'study2b-analysis/v1',
    params: { seed, draws, resamples, fwer: FWER, family, delta: DELTA, delta2: DELTA2, v4AMargin: V4_A_MARGIN, v4BMargin: V4_B_MARGIN, concentration: CONCENTRATION_SHARE, test: 'paired two-sided sign-flip on T = sum d_b; MC p (1 + #{|T*| >= |T|}) / (1 + draws) and exact p; Holm on each; exact governs on disagreement', intervals: '95 % percentile bootstrap, within-task and task-cluster', equivalence: '90 % within-task interval of mean(none@L3 - mcp@L2) inside (-delta, delta); not established when the pooled treated mean D < delta' },
    inputs,
    blocks: { complete: blocks.length, incomplete: incomplete.map((b) => b.block), y1Zero, perBlock: blocks },
    primary: { contrasts: primary, decision, supported: support },
    equivalence: eq,
    distributions: { cells: dists, zeroTables: zero },
    sensitivity: {
      dagger: dagger === null ? null : { decisions: dagger.decision, contrasts: dagger.results.map((r) => ({ id: r.id, T: r.T, mcP: r.mcP, exactP: r.exactP, dbar: r.dbar, rr: r.rr })) },
      evasionBar,
      y1PositiveOnly: { blocks: blocks.filter((b) => b.Y1 !== 0).length, decisions: y1Pos.decision.decisions, exactP: Object.fromEntries(y1Pos.results.map((r) => [r.id, r.exactP])) },
      robustness: primary.map((r) => ({ id: r.id, signTestP: r.signTest.p, signedRankP: r.signedRankP, taskLevelExactP: r.taskLevel.exactP })),
      halves: { cut: h.cut, first, second, signReversal: reversal },
      byLane,
      droppedFlagged: dropFlagged === null ? null : { dropped, decisions: dropFlagged.decision.decisions },
    },
    v4,
    evasion: { mechanism, acceptance, concentration, computedElsewhere: { coverage: 'scripts/v1.4/snapshot-coverage.ts', literalView: 'stage-c-rescore at the literal view', movedOnly: 'Docs/v1.4/evasion-check.md A2 + the blind read' } },
    reproduction2a: repro,
  };

  // ── tables ──
  const md: string[] = [
    `# Study 2b analysis (seed ${String(seed)}, MC draws ${String(draws)}, bootstrap ${String(resamples)})`, '',
    `Inputs: ${Object.entries(inputs).map(([k, v]) => `${k}: ${v}`).join('; ')}.`, '',
    `Complete blocks: ${String(blocks.length)}; incomplete (left out of every paired test): ${incomplete.length === 0 ? 'none' : incomplete.map((b) => b.block).join(', ')}. Blocks with Y₁ = 0: ${String(y1Zero)}.`, '',
    '## 1. Per-block table', '',
    '| Block | Y₁ | D none@L2 | D none@L3 | D mcp@L2 | Yₖ none@L2 | Yₖ none@L3 | Yₖ mcp@L2 |', '|---|---|---|---|---|---|---|---|',
    ...blocks.map((b) => `| ${b.block} | ${String(b.Y1)} | ${String(b.D['none@L2'])} | ${String(b.D['none@L3'])} | ${String(b.D['mcp@L2'])} | ${String(b.Yk['none@L2'])} | ${String(b.Yk['none@L3'])} | ${String(b.Yk['mcp@L2'])} |`),
    '', '## 2. Distributions', '',
    '| Cell | n | ΣD | mean D | histogram of D | P(D = 0) [95 % Wilson] |', '|---|---|---|---|---|---|',
    ...dists.map((d) => `| ${d.cell} | ${String(d.n)} | ${String(d.sum)} | ${f(d.mean)} | ${Object.entries(d.histogram).map(([k, v]) => `${k}: ${String(v)}`).join(', ')} | ${f(d.pZero)} ${iv(d.pZeroWilson)} |`),
    '', '| Contrast | both D = 0 | reference 0 only | other 0 only | neither 0 |', '|---|---|---|---|---|',
    ...zero.map((z) => `| ${z.id} | ${String(z.bothZero)} | ${String(z.refZeroOnly)} | ${String(z.otherZeroOnly)} | ${String(z.neitherZero)} |`),
    '', '## 3. Confirmatory tests (D)', '', ...contrastRows(primary), '', ...holmRows(decision), '',
    '**The finding 2 rule (D and D† must agree):**', '',
    ...Object.entries(support).map(([id, s]) => `- ${id}: ${s.reading}.`),
    '', '## 4. Equivalence E (none@L3 vs mcp@L2)', '',
    `d̄ = ${f(eq.dbar)}; 90 % within-task interval ${iv(eq.interval90)}; Δ = ${String(eq.delta)} → within: ${String(eq.withinDelta)}; Δ₂ = ${String(eq.delta2)} (secondary, descriptive) → within: ${String(eq.withinDelta2)}; pooled treated mean D ${f(eq.pooledTreatedMeanD)}. **${eq.reading}.**`,
    '', '## 5. Sensitivity', '',
    dagger === null ? '- **D†:** not given.' : `- **D†** (no composition-root exemption):`, ...(dagger === null ? [] : ['', ...contrastRows(dagger.results), '', ...holmRows(dagger.decision), '']),
    evasionBar === null ? '- **Evasion bar:** not given (needs D†).' : `- **Evasion bar** (exempt-file share of presentation → persistence edges at step 5; share of runs with a rename to an exempt name; flag above 0.20): ${(evasionBar.contrasts as { id: string; exemptShareDiff: number | null; renameShareDiff: number; flagged: boolean }[]).map((x) => `${x.id} exempt-share diff ${f(x.exemptShareDiff)}, rename-share diff ${f(x.renameShareDiff)}, flagged ${String(x.flagged)}`).join('; ')}. Cells: ${Object.values(evasionBar.cells as Record<string, ReturnType<typeof cellEvasion>>).map((c) => `${c.cell} ${String(c.lastStepExempt)}/${String(c.lastStepEdges)} exempt, ${String(c.runsWithRenameToExempt)}/${String(c.runs)} runs renamed`).join('; ')}.`,
    `- **Y₁ = 0 blocks dropped** (${String(blocks.filter((b) => b.Y1 !== 0).length)} blocks): ${Object.entries(y1Pos.decision.decisions).map(([id, x]) => `${id} reject ${String(x.reject)}`).join(', ')}; exact p ${y1Pos.results.map((r) => `${r.id} ${pf(r.exactP)}`).join(', ')}.`,
    `- **Robustness:** ${primary.map((r) => `${r.id} sign test p ${pf(r.signTest.p)}, signed-rank p ${pf(r.signedRankP)}`).join('; ')}.`,
    `- **Run-index halves** (replicates ≤ ${String(h.cut)} vs the rest): first half ${String(first.blocks)} blocks, mean D none@L2 ${f(first.meanDnoneL2 as number)}, d̄ ${JSON.stringify(first.dbar)}; second half ${String(second.blocks)} blocks, mean D none@L2 ${f(second.meanDnoneL2 as number)}, d̄ ${JSON.stringify(second.dbar)}; sign reversal ${JSON.stringify(reversal)}.`,
    byLane === null ? '- **By lane:** no order file given.' : `- **By lane:** ${JSON.stringify(byLane)}.`,
    dropFlagged === null ? '- **Unmapped-flag drop:** no flagged block given.' : `- **Unmapped-flag drop** (${dropped.join(', ')}): ${JSON.stringify(dropFlagged.decision.decisions)}.`,
    '', '## 6. V4 (ADR-V14-04 §4 as amended)', '',
    v4A === null ? '- Part A: not computed (needs --analysis and the F-RF scores).' : `- **Part A** (r_f under F-RF: ${Object.entries(rfInfo?.rf ?? {}).map(([k, v]) => `${k} ${f(v)}`).join(', ')}; pooled ${f(rfInfo?.pooled)}): m_c ${v4A.cells.map((c) => `${c.cell} ${f(c.m, 3)}${c.vacuous ? ' (no identity: s_c = 0, vacuous)' : ''}`).join(', ')}; pairs ${v4A.pairs.map((p) => `${p.a}/${p.b} |Δm| ${f(p.diff, 3)} ${p.pass ? 'pass' : 'FAIL'}`).join('; ')}. ${v4A.uninformative ? `**Uninformative:** ${String(v4A.dominantFamily)} carries ≥ 90 % of counted identities in every cell.` : ''}`,
    v4B === null ? '- Part B: not computed (no --recall).' : `- **Part B** (non-exempt sites): ${v4B.cells.map((c) => `${c.cell} ${String(c.detected)}/${String(c.evaluated)} (${f(c.rate)}), exempt share ${f(c.exemptShare)} (${String(c.exemptSites)}/${String(c.allSites)})`).join('; ')}; pairs ${v4B.pairs.map((p) => `${p.a} − ${p.b} ${f(p.diff)} ${iv(p.interval)} ${p.pass ? 'pass' : 'FAIL'}`).join('; ')}.`,
    `- **Reading:** ${v4.reading}.`,
    '', '## 7. Evasion items computed here', '',
    mechanism === null ? '- Item 6 (mechanism): no telemetry given.' : `- **Item 6 (mechanism):** tool use in ${String(mechanism.withToolUse)}/${String(mechanism.steps)} mcp@L2 steps (${f(mechanism.shareToolUse as number)}), a check_* call in ${String(mechanism.withCheck)} (${f(mechanism.shareCheck as number)}); bar 0.80 → ${mechanism.pass === true ? 'pass' : '"no mechanism"'}.`,
    acceptance === null ? '- Item 1 (acceptance): no acceptance file given.' : `- **Item 1 (acceptance):** ${JSON.stringify(acceptance)}.`,
    concentration === null ? '- Item 7 (concentration): no --analysis given.' : `- **Item 7 (concentration):** ${String(concentration.scopeSentence)}. Without the dominant family: ${JSON.stringify(concentration.withoutDominant)}.`,
    '- Items 2–5 come from their own tools (size and coverage: `snapshot-coverage.ts`; literal view: the literal re-score; moved-only: the blind read).',
  ];
  if (repro !== null) {
    const r = repro as { cells: { cell: string; D: number[]; sum: number; mean: number; meanInterval: { low: number; high: number }; variance: number; theta: number | null; distribution: Record<string, number>; Yk: (number | null)[]; endStateZero: number }[]; Y1: (number | null)[]; ratios: { cell: string; sumCell: number; sumReference: number; ratio: { estimate: number; low: number; high: number }; differenceCellMinusReference: { estimate: number; low: number; high: number } }[] };
    md.push('', '## 8. 2a report §3 reproduction (seed 20261019, task-clustered bootstrap)', '',
      '| Cell | D per block (tasks sorted, rep 1, 2) | ΣD | Mean D [95 % task-clustered] | Variance | Distribution | NB θ | Yₖ | Runs at 0 at step 5 |', '|---|---|---|---|---|---|---|---|---|',
      ...r.cells.map((c) => `| ${c.cell} | ${c.D.join(', ')} | ${String(c.sum)} | ${f(c.mean)} ${iv(c.meanInterval)} | ${f(c.variance)} | ${Object.entries(c.distribution).map(([k, v]) => `${k}: ${String(v)}`).join(', ')} | ${f(c.theta)} | ${c.Yk.join(', ')} | ${String(c.endStateZero)} |`),
      '', `Y₁: ${r.Y1.join(', ')}.`, '',
      '| Cell | ΣD cell / ΣD none@L2 | Ratio [95 %] | Mean paired difference (cell − none@L2) [95 %] |', '|---|---|---|---|',
      ...r.ratios.map((x) => `| ${x.cell} | ${String(x.sumCell)} / ${String(x.sumReference)} | ${f(x.ratio.estimate)} ${iv(x.ratio)} | ${f(x.differenceCellMinusReference.estimate)} ${iv(x.differenceCellMinusReference)} |`));
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'analysis.json'), `${JSON.stringify(json, null, 1)}\n`);
  fs.writeFileSync(path.join(out, 'tables.md'), `${md.join('\n')}\n`);
  process.stdout.write(`${md.join('\n')}\n`);
  return 0;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
}
