/**
 * Judge model robustness (ADR-038; `Docs/analysis-plan.md` §17).
 *
 * A fixed, seeded, stratified sample of already-recorded judge units (registered E7 and E1 runs, FF-N01 and FF-N02) is
 * judged again through the same pinned route: the pinned Claude CLI, the ADR-018 config dir and isolation pre-flight,
 * the frozen persona, rubric, schema, effort, token cap and the byte-identical recorded prompt. The only change is the
 * model: `claude-sonnet-5-5` instead of the frozen `claude-opus-5-5`. Each unit gets the registered 3 runs, its own
 * cassettes and U4's unit vote (`voteUnit`). Outcomes: unit-level agreement with the recorded Opus votes, and whether
 * any function, project or cell verdict would change if the sampled Sonnet votes replaced the Opus ones.
 *
 * Steps (CLI `scripts/judge-robustness-cli.ts`): `select` (pure; writes the registered sample), `run` (live calls,
 * resumable, registered usage-limit pause), `score` (no model call).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mulberry32 } from './lib/mutation/rng.js';
import { parseCsv } from './e1-size-analysis.js';
import { buildJudgeRequest, requestHashOf } from '../src/llm-critic/cassette-provider.js';
import type { JudgeRequest } from '../src/llm-critic/cassette-provider.js';
import { voteUnit } from '../src/llm-critic/aggregation.js';
import type { UnitRun, UnitVote } from '../src/llm-critic/aggregation.js';
import type { CassetteEntry } from '../src/llm-critic/types.js';
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL, RUNS_PER_EVALUATION } from '../src/llm-critic/frozen.js';
import { pairAgreement } from './llm-label.js';
import { contributionOf, neuralVerdicts } from './rescore.js';
import type { ConfidenceThresholds, ScoringWeights, VerdictThresholds } from '../src/shared/types/spec.js';
import type { AHSScore, AVRScore } from '../src/shared/types/value-objects.js';
import { avrOf, computeAHS } from '../src/scoring-engine/score-computer.js';
import { determineVerdict } from '../src/scoring-engine/verdict.js';
import type { Dimension } from '../src/shared/types/enums.js';
import { wilson } from './lib/stats.js';

type Json = Record<string, unknown>;

export const ROBUSTNESS_MODEL = 'claude-sonnet-5-5';
export const SAMPLE_FILE = 'experiments/judge-robustness/sample.json';
export const CASSETTE_DIR = 'experiments/judge-robustness/cassettes';
export const RESULTS_DIR = 'results/judge-robustness';
export const SAMPLE_SEED = 9401;
export const BOOTSTRAP_SEED = 9402;
export const PER_STRATUM = 25;
export const KAPPA_FLOOR = 0.6;
export const SOURCES = [
  { source: 'E7', runs: 'results/e7-corpus', units: 'results/e7-corpus/judge-diagnostics/judge_units.csv', cassettes: 'experiments/e7-corpus/cassettes' },
  { source: 'E1', runs: 'results/e1-grid', units: 'results/e1-grid/judge-diagnostics/judge_units.csv', cassettes: 'experiments/e1-grid/cassettes' },
] as const;
export const FUNCTIONS = ['FF-N01', 'FF-N02'] as const;

export interface SampledUnit {
  readonly source: 'E7' | 'E1';
  readonly functionId: string;
  readonly runId: string;
  readonly projectId: string;
  readonly unitId: string;
  /** Report of the registered run (repository-relative). */
  readonly reportPath: string;
  /** Request hash of the recorded Opus runs (repetition 0, runs 0..2). */
  readonly opusRequestHash: string;
  readonly opusVote: 'pass' | 'fail' | 'warning';
  readonly opusConfidence: number;
  readonly sonnetRequestHash: string;
}

export interface Stratum { readonly source: string; readonly functionId: string; readonly eligible: number; readonly drawn: number }

export interface Sample {
  readonly adr: 'ADR-038';
  readonly model: string;
  readonly frozenModel: string;
  readonly effort: string;
  readonly maxTokens: number;
  readonly runsPerUnit: number;
  readonly seed: number;
  readonly bootstrapSeed: number;
  readonly perStratum: number;
  readonly strata: readonly Stratum[];
  readonly exclusions: Readonly<Record<string, number>>;
  readonly units: readonly SampledUnit[];
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function readCassettes(dir: string): CassetteEntry[] {
  const out: CassetteEntry[] = [];
  const walk = (d: string): void => {
    for (const name of fs.readdirSync(d).sort()) {
      const p = path.join(d, name);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json')) out.push(readJson<CassetteEntry>(p));
    }
  };
  walk(dir);
  return out;
}

/** The canonical request of a recorded prompt under the frozen route, for a given model (argv flags as the CLI makes them). */
export function judgeRequestFor(prompt: string, model: string, argvFlags: readonly string[]): JudgeRequest {
  return buildJudgeRequest('claude-cli', prompt, { model, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS }, { runIndex: 0, repetition: 0, functionId: '' }, argvFlags);
}

/** The recorded argv flags are not stored; they are the model-free flags of the request, which equal for every unit. */
export type ArgvFlagsFor = (model: string) => readonly string[];

export function unitRunsOf(entries: readonly CassetteEntry[]): UnitRun[] {
  return entries.map((e) => ({ runIndex: e.runIndex, outcome: e.outcome, verdict: e.parsedVerdict }));
}

/**
 * Eligibility (ADR-038 item 2): a valid unit row of the registered run's judge diagnostics whose vote matches its
 * report; exactly one recorded request of repetition 0 for (project, function, unit) with runs 0..2 and a stored
 * prompt; U4's vote over those runs equals the report's unit row (verdict and confidence); and the request rebuilt
 * from the prompt under the frozen route and model hashes to the recorded request hash (the prompt is replayed
 * byte for byte).
 */
export function eligibleUnits(repoRoot: string, argvFlagsFor: ArgvFlagsFor): { units: SampledUnit[]; exclusions: Record<string, number> } {
  const units: SampledUnit[] = [];
  const exclusions: Record<string, number> = {};
  const exclude = (why: string): void => {
    exclusions[why] = (exclusions[why] ?? 0) + 1;
  };
  for (const src of SOURCES) {
    const rows = parseCsv(fs.readFileSync(path.join(repoRoot, src.units), 'utf8'));
    const byUnit = new Map<string, CassetteEntry[]>();
    for (const e of readCassettes(path.join(repoRoot, src.cassettes))) {
      if (e.repetition !== 0 || e.projectId === undefined || e.unitId === undefined) continue;
      const k = `${e.projectId}\u0000${e.functionId}\u0000${e.unitId}`;
      byUnit.set(k, [...(byUnit.get(k) ?? []), e]);
    }
    const reportOf = new Map<string, string>();
    for (const f of fs.readdirSync(path.join(repoRoot, src.runs, 'runs'))) {
      const r = readJson<{ runId: string; reportPath?: string; status: string }>(path.join(repoRoot, src.runs, 'runs', f));
      if (r.status === 'accepted' && r.reportPath !== undefined) reportOf.set(r.runId, path.posix.join(src.runs, r.reportPath));
    }
    for (const row of rows) {
      if (row.status !== 'valid' || row.vote_matches_report !== 'true') {
        exclude(`${src.source}:invalid-or-vote-mismatch`);
        continue;
      }
      const report = reportOf.get(row.run_id ?? '');
      if (report === undefined) {
        exclude(`${src.source}:no-accepted-report`);
        continue;
      }
      const entries = byUnit.get(`${row.project_id ?? ''}\u0000${row.function_id ?? ''}\u0000${row.unit_id ?? ''}`) ?? [];
      const groups = new Map<string, CassetteEntry[]>();
      for (const e of entries) groups.set(e.requestHash, [...(groups.get(e.requestHash) ?? []), e]);
      const reportUnit = (readJson<{ neuralResults?: { functionId: string; unitResults: { unitId: string; verdict: string; confidence: number; status: string }[] }[] }>(path.join(repoRoot, report)).neuralResults ?? [])
        .find((n) => n.functionId === row.function_id)?.unitResults.find((u) => u.unitId === row.unit_id);
      const matching = [...groups.values()].filter((g) => {
        if (g.length !== RUNS_PER_EVALUATION || g.some((e) => typeof e.prompt !== 'string')) return false;
        if (new Set(g.map((e) => e.runIndex)).size !== RUNS_PER_EVALUATION) return false;
        const v = voteUnit(unitRunsOf(g));
        return reportUnit !== undefined && v.status === 'valid' && v.verdict === reportUnit.verdict && v.confidence.toFixed(6) === Number(reportUnit.confidence).toFixed(6);
      });
      if (matching.length !== 1) {
        exclude(`${src.source}:${matching.length === 0 ? 'no-matching-request' : 'several-matching-requests'}`);
        continue;
      }
      const g = matching[0] as CassetteEntry[];
      const prompt = g[0]?.prompt as string;
      if (requestHashOf(judgeRequestFor(prompt, JUDGE_MODEL, argvFlagsFor(JUDGE_MODEL))) !== g[0]?.requestHash) {
        exclude(`${src.source}:request-not-reproduced`);
        continue;
      }
      const v = voteUnit(unitRunsOf(g));
      units.push({
        source: src.source,
        functionId: row.function_id ?? '',
        runId: row.run_id ?? '',
        projectId: row.project_id ?? '',
        unitId: row.unit_id ?? '',
        reportPath: report,
        opusRequestHash: g[0]?.requestHash ?? '',
        opusVote: v.verdict,
        opusConfidence: v.confidence,
        sonnetRequestHash: requestHashOf(judgeRequestFor(prompt, ROBUSTNESS_MODEL, argvFlagsFor(ROBUSTNESS_MODEL))),
      });
    }
  }
  return { units, exclusions };
}

/** Stratified draw: per (source, function) stratum, `PER_STRATUM` units (all when fewer) by mulberry32(seed), in a sorted frame. */
export function drawSample(units: readonly SampledUnit[], seed: number = SAMPLE_SEED, perStratum: number = PER_STRATUM): { units: SampledUnit[]; strata: Stratum[] } {
  const rng = mulberry32(seed);
  const out: SampledUnit[] = [];
  const strata: Stratum[] = [];
  for (const src of SOURCES) for (const fn of FUNCTIONS) {
    const frame = units.filter((u) => u.source === src.source && u.functionId === fn)
      .sort((a, b) => (a.runId + a.unitId < b.runId + b.unitId ? -1 : a.runId + a.unitId > b.runId + b.unitId ? 1 : 0));
    const drawn = rng.pickDistinct(frame, perStratum);
    strata.push({ source: src.source, functionId: fn, eligible: frame.length, drawn: drawn.length });
    out.push(...drawn);
  }
  return { units: out, strata };
}

/** Calls in the registered order: unit-major in sample order (strata interleaved round-robin), runs 0..2. */
export function callOrder(sample: Pick<Sample, 'units'>): SampledUnit[] {
  const byStratum = new Map<string, SampledUnit[]>();
  for (const u of sample.units) {
    const k = `${u.source}|${u.functionId}`;
    byStratum.set(k, [...(byStratum.get(k) ?? []), u]);
  }
  const lists = [...byStratum.values()];
  const out: SampledUnit[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (i < l.length) out.push(l[i] as SampledUnit);
  return out;
}

// --- scoring -------------------------------------------------------------------------------------------------------

export type Category = 'pass' | 'fail' | 'warning' | 'invalid';

export function sonnetVote(dir: string, unit: SampledUnit): { vote: UnitVote; entries: CassetteEntry[] } | null {
  const entries: CassetteEntry[] = [];
  for (let r = 0; r < RUNS_PER_EVALUATION; r++) {
    const key = `${unit.sonnetRequestHash}-r0-${String(r)}`;
    const f = path.join(dir, key.slice(0, 2), `${key}.json`);
    if (!fs.existsSync(f)) return null;
    entries.push(readJson<CassetteEntry>(f));
  }
  return { vote: voteUnit(unitRunsOf(entries)), entries };
}

interface UnitRow { unitId: string; status: string; verdict: string; confidence: number; confidenceStdDev?: number; flaggedUnstable?: boolean; validRunCount?: number }
interface NeuralRow { functionId: string; unitResults: UnitRow[] }

/** The report with the sampled units' rows replaced by the Sonnet votes (other units keep their Opus rows). */
export function substitute(report: Json, swaps: ReadonlyMap<string, UnitVote>): Json {
  const neural = (report.neuralResults as NeuralRow[] | undefined) ?? [];
  return {
    ...report,
    neuralResults: neural.map((n) => ({
      ...n,
      unitResults: n.unitResults.map((u) => {
        const v = swaps.get(`${n.functionId}\u0000${u.unitId}`);
        return v === undefined ? u : { ...u, status: v.status, verdict: v.verdict, confidence: v.confidence, confidenceStdDev: v.confidenceStdDev, flaggedUnstable: v.flaggedUnstable, validRunCount: v.validRunCount };
      }),
    })),
  };
}

interface StoredScoring { fullModeWeights: ScoringWeights; thresholds: VerdictThresholds; confidenceThresholds: ConfidenceThresholds }
interface StoredDimension { dimension: Dimension; avr: number; violatedWeight: number; functionCount: number }

/**
 * `ahsCombined`, verdict and judged-function verdicts of `original` when its judged unit rows are those of `rows`,
 * under `rule` (`majority` = the registered U4 rule; `any-fail` = BR-U5b-60). Each judge dimension's stored
 * `violatedWeight` is moved by (contribution under `rule` from `rows` - stored `majority` contribution from
 * `original`), with the scorer's own `avrOf`, `computeAHS` and `determineVerdict` (as `judgeDecomposition`).
 */
export function scoreWithRows(original: Json, rows: Json, rule: 'majority' | 'any-fail'): { ahs: number; verdict: string; functions: Map<string, string> } {
  const scoring = original.scoring as StoredScoring;
  const before = neuralVerdicts(original as never, 'majority', scoring.confidenceThresholds);
  const after = neuralVerdicts(rows as never, rule, scoring.confidenceThresholds);
  const dims = new Map(((original.neuralResults as (NeuralRow & { dimension: Dimension })[] | undefined) ?? []).map((n) => [n.functionId, n.dimension] as const));
  const delta = new Map<Dimension, number>();
  for (const f of new Set([...before.keys(), ...after.keys()])) {
    const d = dims.get(f);
    if (d === undefined) continue;
    const b = before.get(f);
    const a = after.get(f);
    delta.set(d, (delta.get(d) ?? 0) + (a === undefined ? 0 : contributionOf(d, a, scoring.confidenceThresholds)) - (b === undefined ? 0 : contributionOf(d, b, scoring.confidenceThresholds)));
  }
  const avrs = new Map<Dimension, AVRScore>();
  for (const p of original.perDimensionScores as StoredDimension[]) {
    const dv = delta.get(p.dimension) ?? 0;
    avrs.set(p.dimension, (dv === 0 ? p.avr : avrOf({ functionCount: p.functionCount, violatedWeight: p.violatedWeight + dv, violationCount: 0 })) as AVRScore);
  }
  const ahs = Number(computeAHS(avrs, scoring.fullModeWeights));
  return { ahs, verdict: determineVerdict(ahs as AHSScore, scoring.thresholds), functions: new Map([...after].map(([f, v]) => [f, v.verdict])) };
}

function scenario(original: Json, rows: Json, id: string): { ahs: number; verdict: string; functions: Map<string, string> } {
  return scoreWithRows(original, rows, id === 'neural:any-fail' ? 'any-fail' : 'majority');
}

function r6(x: number | null | undefined): string {
  return x === null || x === undefined || !Number.isFinite(x) ? '' : x.toFixed(6);
}

function csv(rows: readonly Json[]): string {
  if (rows.length === 0) return '';
  const head = Object.keys(rows[0] as Json);
  const cell = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${[head.join(','), ...rows.map((r) => head.map((h) => cell(r[h])).join(','))].join('\n')}\n`;
}

export function scoreRobustness(repoRoot: string, sample: Sample, outDir: string): Json {
  const dir = path.join(repoRoot, CASSETTE_DIR);
  const unitRows: Json[] = [];
  const sonnet = new Map<SampledUnit, UnitVote>();
  let calls = 0, invalidRuns = 0, retried = 0;
  for (const u of sample.units) {
    const s = sonnetVote(dir, u);
    if (s === null) {
      unitRows.push({ source: u.source, function_id: u.functionId, run_id: u.runId, unit_id: u.unitId, opus_vote: u.opusVote, opus_confidence: r6(u.opusConfidence), sonnet_vote: 'not-run', sonnet_confidence: '', sonnet_valid_runs: '', agree: '' });
      continue;
    }
    calls += s.entries.length;
    invalidRuns += s.entries.filter((e) => e.outcome.kind !== 'valid').length;
    retried += s.entries.filter((e) => e.attempts === 2).length;
    sonnet.set(u, s.vote);
    const cat: Category = s.vote.status === 'valid' ? s.vote.verdict : 'invalid';
    unitRows.push({ source: u.source, function_id: u.functionId, run_id: u.runId, unit_id: u.unitId, opus_vote: u.opusVote, opus_confidence: r6(u.opusConfidence), sonnet_vote: cat, sonnet_confidence: r6(s.vote.status === 'valid' ? s.vote.confidence : null), sonnet_valid_runs: s.vote.validRunCount, sonnet_resolved_models: [...new Set(s.entries.map((e) => e.resolvedModel ?? ''))].join(' '), agree: cat === u.opusVote ? 1 : 0 });
  }

  // agreement rows
  const cats = ['pass', 'fail', 'warning'];
  const weightOf = (u: SampledUnit): number => {
    const st = sample.strata.find((s) => s.source === u.source && s.functionId === u.functionId);
    return st === undefined || st.drawn === 0 ? 1 : st.eligible / st.drawn;
  };
  const agreementRows: Json[] = [];
  const row = (scope: string, units: readonly SampledUnit[], weighted: boolean, invalidAsDisagreement = false): void => {
    const pairs = units.flatMap((u) => {
      const v = sonnet.get(u);
      if (v === undefined) return [];
      if (v.status !== 'valid') return invalidAsDisagreement ? [{ a: u.opusVote as string, b: 'invalid', w: weighted ? weightOf(u) : 1 }] : [];
      return [{ a: u.opusVote as string, b: v.verdict as string, w: weighted ? weightOf(u) : 1 }];
    });
    const st = pairAgreement('judge-repetition', scope, pairs, invalidAsDisagreement ? [...cats, 'invalid'] : cats, weighted, 0, false, { bootstrap: { seed: sample.bootstrapSeed } });
    agreementRows.push({
      scope, weighted, invalid_rule: invalidAsDisagreement ? 'disagreement' : 'excluded', n: pairs.length,
      agreement: r6(st.percentAgreement), ci_low: r6(st.ci?.[0]), ci_high: r6(st.ci?.[1]), ci_method: st.ciMethod,
      kappa: r6(st.cohensKappa), kappa_ci_low: r6(st.kappaCi?.[0]), kappa_ci_high: r6(st.kappaCi?.[1]),
      ac1: r6(st.gwetAc1), ac1_ci_low: r6(st.ac1Ci?.[0]), ac1_ci_high: r6(st.ac1Ci?.[1]),
      reading: scope === 'all' && !weighted && !invalidAsDisagreement ? 'primary' : 'secondary',
    });
  };
  row('all', sample.units, false);
  row('all', sample.units, true);
  row('all', sample.units, false, true);
  for (const s of sample.strata) row(`${s.source}:${s.functionId}`, sample.units.filter((u) => u.source === s.source && u.functionId === s.functionId), false);
  for (const src of ['E7', 'E1']) row(src, sample.units.filter((u) => u.source === src), false);
  for (const fn of FUNCTIONS) row(fn, sample.units.filter((u) => u.functionId === fn), false);

  // transition table and fail rates
  const transition: Json[] = [];
  for (const a of cats) {
    const r: Json = { opus: a };
    for (const b of [...cats, 'invalid', 'not-run']) r[`sonnet_${b}`] = unitRows.filter((x) => x.opus_vote === a && x.sonnet_vote === b).length;
    transition.push(r);
  }
  const scored = sample.units.filter((u) => sonnet.get(u)?.status === 'valid');
  const opusFails = scored.filter((u) => u.opusVote === 'fail').length;
  const sonnetFails = scored.filter((u) => sonnet.get(u)?.verdict === 'fail').length;
  const [ol, oh] = scored.length > 0 ? (({ low, high }) => [low, high])(wilson(opusFails, scored.length)) : [null, null];
  const [sl, sh] = scored.length > 0 ? (({ low, high }) => [low, high])(wilson(sonnetFails, scored.length)) : [null, null];
  const failRates = [
    { model: JUDGE_MODEL, n: scored.length, fail_units: opusFails, fail_rate: r6(scored.length ? opusFails / scored.length : null), ci_low: r6(ol), ci_high: r6(oh), ci_method: 'wilson', mean_confidence: r6(scored.length ? scored.reduce((s, u) => s + u.opusConfidence, 0) / scored.length : null) },
    { model: sample.model, n: scored.length, fail_units: sonnetFails, fail_rate: r6(scored.length ? sonnetFails / scored.length : null), ci_low: r6(sl), ci_high: r6(sh), ci_method: 'wilson', mean_confidence: r6(scored.length ? scored.reduce((s, u) => s + (sonnet.get(u)?.confidence ?? 0), 0) / scored.length : null) },
  ];

  // verdict impact: substitute the sampled Sonnet votes into each affected report and re-score (no model call)
  const impactRows: Json[] = [];
  const byReport = new Map<string, SampledUnit[]>();
  for (const u of sample.units) if (sonnet.has(u)) byReport.set(u.reportPath, [...(byReport.get(u.reportPath) ?? []), u]);
  let functionChanges = 0, verdictChanges = 0, anyFailVerdictChanges = 0;
  for (const [reportPath, units] of [...byReport].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const report = readJson<Json>(path.join(repoRoot, reportPath));
    const swaps = new Map(units.map((u) => [`${u.functionId}\u0000${u.unitId}`, sonnet.get(u) as UnitVote]));
    const swapped = substitute(report, swaps);
    const before = scenario(report, report, 'neural:majority');
    if (before.ahs.toFixed(3) !== Number(report.ahsCombined).toFixed(3) || before.verdict !== report.verdict) {
      throw new Error(`JUDGE_ROBUSTNESS_REPRODUCTION: ${reportPath} ahsCombined ${String(report.ahsCombined)} / ${String(report.verdict)} not reproduced (${before.ahs.toFixed(3)} / ${before.verdict})`);
    }
    const after = scenario(report, swapped, 'neural:majority');
    const beforeAny = scenario(report, report, 'neural:any-fail');
    const afterAny = scenario(report, swapped, 'neural:any-fail');
    const fnChanged = [...after.functions].filter(([f, v]) => before.functions.get(f) !== v).map(([f, v]) => `${f}:${before.functions.get(f) ?? ''}->${v}`);
    functionChanges += fnChanged.length;
    if (before.verdict !== after.verdict) verdictChanges++;
    if (beforeAny.verdict !== afterAny.verdict) anyFailVerdictChanges++;
    impactRows.push({
      report: reportPath, run_id: (report.runId as string | undefined) ?? '', sampled_units: units.length,
      units_changed: units.filter((u) => sonnet.get(u)?.verdict !== u.opusVote || sonnet.get(u)?.status !== 'valid').length,
      stored_verdict: (report.verdict as string | undefined) ?? '', registered_verdict_opus: before.verdict, registered_verdict_sonnet: after.verdict,
      ahs_combined_opus: r6(before.ahs), ahs_combined_sonnet: r6(after.ahs), function_verdicts_changed: fnChanged.join(' '),
      any_fail_verdict_opus: beforeAny.verdict, any_fail_verdict_sonnet: afterAny.verdict,
    });
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'units.csv'), csv(unitRows));
  fs.writeFileSync(path.join(outDir, 'agreement.csv'), csv(agreementRows));
  fs.writeFileSync(path.join(outDir, 'transition.csv'), csv(transition));
  fs.writeFileSync(path.join(outDir, 'fail-rates.csv'), csv(failRates));
  fs.writeFileSync(path.join(outDir, 'verdict-impact.csv'), csv(impactRows));
  const primary = agreementRows[0] as Json;
  const summary: Json = {
    adr: 'ADR-038', model: sample.model, frozenModel: sample.frozenModel, units: sample.units.length,
    unitsJudged: sonnet.size, sonnetInvalidUnits: [...sonnet.values()].filter((v) => v.status !== 'valid').length,
    calls, invalidRuns, retriedRuns: retried,
    primary, kappaFloor: KAPPA_FLOOR,
    interpretation: primary.kappa === '' ? 'undefined' : Number(primary.kappa) >= KAPPA_FLOOR ? 'model-robust (kappa >= 0.60)' : 'model-dependent (kappa < 0.60)',
    failRates, reportsAffected: byReport.size, functionVerdictChanges: functionChanges, registeredVerdictChanges: verdictChanges, anyFailVerdictChanges,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  return summary;
}
