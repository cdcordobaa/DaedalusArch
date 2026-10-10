/**
 * Judge diagnostics (ADR-028 item 4; `Docs/analysis-plan.md` §12.4): a registered, exploratory and descriptive
 * explanation analysis of what the judge reports. No judge call is made: the inputs are a harness output directory
 * (`runs/*.run.json`, `reports/*.json`) and the plan's recorded cassette directory.
 *
 * - `judge_units.csv`: one row per judged unit of every accepted judge-mode report: the report's vote, confidence,
 *   its standard deviation, the unstable flag and valid runs; the vote recomputed from the unit's cassette entries
 *   (project id, function id, unit id, repetition 0) with a `vote_matches_report` flag; the carrier run (the valid run
 *   voting with the unit verdict with the highest confidence, ties to the lowest `runIndex`; a split-vote unit: all its
 *   valid runs) and its rationale (`reasoning` and violation messages); the codes of the fixed coding frame
 *   (`scripts/lib/judge-coding-frame.ts`, the analysis-plan machine block).
 * - `judge_criteria.csv`: per function × project (and `*` pooled) × unit verdict × criterion, the coded units, the
 *   units of that group and their share.
 * - `judge_summary.csv`: per function × project (and `*`), units selected, valid, invalid, fail, pass, split vote,
 *   unstable and the mean confidence of the valid units.
 * Every float is `toFixed(6)`; rows are sorted, so two runs over the same inputs give the same bytes.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { EvaluationReport, NeuralUnitRow } from '../src/shared/types/evaluation.js';
import type { CassetteEntry, CriticVerdict } from '../src/llm-critic/types.js';
import { loadRunDir } from './lib/report-io.js';
import type { RunRecord } from './lib/report-io.js';
import { codeRationale, codesOf, loadCodingFrame } from './lib/judge-coding-frame.js';
import type { CodingFrame } from './lib/judge-coding-frame.js';

export const JUDGE_DIAGNOSTICS_INPUT_INVALID = 'JUDGE_DIAGNOSTICS_INPUT_INVALID';

export const UNIT_COLUMNS = [
  'run_id', 'project_id', 'function_id', 'dimension', 'unit_id', 'unit_kind', 'layer', 'status', 'verdict', 'confidence',
  'confidence_sd', 'flagged_unstable', 'valid_runs', 'cassette_runs', 'cassette_fail_runs', 'cassette_pass_runs',
  'vote_matches_report', 'carrier_run_index', 'codes', 'rationale', 'violation_messages',
] as const;
export const CRITERIA_COLUMNS = ['function_id', 'project_id', 'verdict', 'criterion', 'units_coded', 'units_in_group', 'share'] as const;
export const SUMMARY_COLUMNS = [
  'function_id', 'project_id', 'units_selected', 'units_valid', 'units_invalid', 'units_fail', 'units_pass', 'units_split_vote',
  'units_unstable', 'mean_confidence_valid', 'units_uncoded_fail',
] as const;

// ---------------------------------------------------------------------------------------------
// CSV primitives (same rules as aggregate.ts, BR-U5b-63)

const f6 = (x: number | undefined): string => (x === undefined || !Number.isFinite(x) ? '' : x.toFixed(6));
function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
export function csvText(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const oneLine = (t: string): string => t.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------------------------
// Cassettes

/** Cassette entries of repetition 0 by `projectId \0 functionId \0 unitId`, each list in `runIndex` order. */
export type CassetteIndex = ReadonlyMap<string, readonly CassetteEntry[]>;

export const unitKey = (projectId: string, functionId: string, unitId: string): string => `${projectId}\u0000${functionId}\u0000${unitId}`;

export function indexCassettes(entries: readonly CassetteEntry[]): CassetteIndex {
  const out = new Map<string, CassetteEntry[]>();
  for (const e of entries) {
    if (e.repetition !== 0 || e.projectId === undefined || e.unitId === undefined) continue;
    const k = unitKey(e.projectId, e.functionId, e.unitId);
    const list = out.get(k) ?? [];
    list.push(e);
    out.set(k, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.runIndex - b.runIndex);
  return out;
}

/** Reads every `*.json` entry under `dir` (the two-character shard directories of the cassette store). */
export function readCassetteDir(dir: string): CassetteEntry[] {
  if (!existsSync(dir)) throw new Error(`${JUDGE_DIAGNOSTICS_INPUT_INVALID}: cassette directory ${dir} not found`);
  const out: CassetteEntry[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.json')) out.push(JSON.parse(readFileSync(p, 'utf8')) as CassetteEntry);
    }
  };
  walk(dir);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Unit rows

export interface CassetteVote {
  readonly verdict: 'pass' | 'fail' | 'warning' | 'invalid';
  readonly runs: number;
  readonly failRuns: number;
  readonly passRuns: number;
  /** The carrier run (highest confidence among the runs voting with the verdict, ties lowest runIndex). */
  readonly carrier?: { readonly runIndex: number; readonly verdict: CriticVerdict };
}

/** AGG-01 vote over the valid entries (fewer than 2 valid → invalid; no strict majority → warning). */
export function cassetteVote(entries: readonly CassetteEntry[]): CassetteVote {
  const valid = entries.filter((e) => e.outcome.kind === 'valid' && e.parsedVerdict !== null)
    .map((e) => ({ runIndex: e.runIndex, verdict: e.parsedVerdict as CriticVerdict }));
  const fails = valid.filter((r) => !r.verdict.pass);
  const passes = valid.filter((r) => r.verdict.pass);
  const base = { runs: entries.length, failRuns: fails.length, passRuns: passes.length };
  if (valid.length < 2) return { verdict: 'invalid', ...base };
  let verdict: CassetteVote['verdict'];
  let carriers: typeof valid;
  if (fails.length * 2 > valid.length) [verdict, carriers] = ['fail', fails];
  else if (passes.length * 2 > valid.length) [verdict, carriers] = ['pass', passes];
  else [verdict, carriers] = ['warning', valid];
  const carrier = [...carriers].sort((a, b) => b.verdict.confidence - a.verdict.confidence || a.runIndex - b.runIndex)[0];
  return { verdict, ...base, ...(carrier !== undefined && { carrier }) };
}

export interface UnitDiagnostic {
  readonly runId: string;
  readonly projectId: string;
  readonly functionId: string;
  readonly dimension: string;
  readonly unit: NeuralUnitRow;
  readonly vote: CassetteVote;
  readonly voteMatchesReport: boolean;
  readonly rationale: string;
  readonly violationMessages: string;
  readonly codes: readonly string[];
}

export function diagnoseUnits(
  accepted: readonly { readonly record: RunRecord; readonly report: EvaluationReport }[],
  cassettes: CassetteIndex,
  frame: CodingFrame,
): UnitDiagnostic[] {
  const out: UnitDiagnostic[] = [];
  for (const { record, report } of accepted) {
    for (const row of report.neuralResults ?? []) {
      const functionId = String(row.functionId);
      for (const unit of row.unitResults) {
        const vote = cassetteVote(cassettes.get(unitKey(record.projectId, functionId, unit.unitId)) ?? []);
        const reportVerdict = unit.status === 'invalid' ? 'invalid' : unit.verdict;
        const v = vote.carrier?.verdict;
        const rationale = v === undefined ? '' : oneLine(v.reasoning);
        const violationMessages = v === undefined ? '' : v.violations.map((x) => oneLine(x.message)).join(' | ');
        const text = [rationale, violationMessages].filter((t) => t !== '').join('\n');
        out.push({
          runId: record.runId, projectId: record.projectId, functionId, dimension: row.dimension, unit, vote,
          voteMatchesReport: vote.verdict === reportVerdict, rationale, violationMessages,
          codes: unit.status === 'invalid' || text === '' ? [] : codeRationale(frame, functionId, text),
        });
      }
    }
  }
  return out.sort((a, b) => cmp(a.projectId, b.projectId) || cmp(a.functionId, b.functionId) || cmp(a.unit.unitId, b.unit.unitId));
}

// ---------------------------------------------------------------------------------------------
// Tables

export function unitsCsv(units: readonly UnitDiagnostic[]): string {
  return csvText(UNIT_COLUMNS, units.map((d) => [
    d.runId, d.projectId, d.functionId, d.dimension, d.unit.unitId, d.unit.unitKind, d.unit.layer, d.unit.status, d.unit.verdict,
    f6(d.unit.confidence), f6(d.unit.confidenceStdDev), String(d.unit.flaggedUnstable), String(d.unit.validRunCount),
    String(d.vote.runs), String(d.vote.failRuns), String(d.vote.passRuns), String(d.voteMatchesReport),
    d.vote.carrier === undefined ? '' : String(d.vote.carrier.runIndex), d.codes.join(';'), d.rationale, d.violationMessages,
  ]));
}

type Verdict = 'fail' | 'pass' | 'warning';
const VERDICTS: readonly Verdict[] = ['fail', 'pass', 'warning'];

function groups(units: readonly UnitDiagnostic[]): [string, string, UnitDiagnostic[]][] {
  const byKey = new Map<string, UnitDiagnostic[]>();
  for (const d of units) {
    for (const project of [d.projectId, '*']) {
      const k = `${d.functionId}\u0000${project}`;
      byKey.set(k, [...(byKey.get(k) ?? []), d]);
    }
  }
  return [...byKey].map(([k, list]) => {
    const [fn = '', project = ''] = k.split('\u0000');
    return [fn, project, list] as [string, string, UnitDiagnostic[]];
  }).sort((a, b) => cmp(a[0], b[0]) || (a[1] === '*' ? 1 : b[1] === '*' ? -1 : cmp(a[1], b[1])));
}

export function criteriaCsv(units: readonly UnitDiagnostic[], frame: CodingFrame): string {
  const rows: string[][] = [];
  for (const [fn, project, list] of groups(units)) {
    for (const verdict of VERDICTS) {
      const group = list.filter((d) => d.unit.status === 'valid' && d.unit.verdict === verdict);
      if (group.length === 0) continue;
      for (const code of codesOf(frame, fn)) {
        const n = group.filter((d) => d.codes.includes(code)).length;
        rows.push([fn, project, verdict, code, String(n), String(group.length), f6(n / group.length)]);
      }
    }
  }
  return csvText(CRITERIA_COLUMNS, rows);
}

export function summaryCsv(units: readonly UnitDiagnostic[], frame: CodingFrame): string {
  const rows: string[][] = [];
  for (const [fn, project, list] of groups(units)) {
    const valid = list.filter((d) => d.unit.status === 'valid');
    const fails = valid.filter((d) => d.unit.verdict === 'fail');
    const mean = valid.length === 0 ? undefined : valid.reduce((a, d) => a + d.unit.confidence, 0) / valid.length;
    rows.push([
      fn, project, String(list.length), String(valid.length), String(list.length - valid.length), String(fails.length),
      String(valid.filter((d) => d.unit.verdict === 'pass').length), String(valid.filter((d) => d.unit.verdict === 'warning').length),
      String(valid.filter((d) => d.unit.flaggedUnstable).length), f6(mean),
      String(fails.filter((d) => d.codes.includes(frame.uncoded)).length),
    ]);
  }
  return csvText(SUMMARY_COLUMNS, rows);
}

// ---------------------------------------------------------------------------------------------
// Entry point

export interface DiagnosticsOutput {
  readonly files: ReadonlyMap<string, string>;
  readonly units: number;
  readonly voteMismatches: number;
  readonly missingCassettes: number;
}

export function judgeDiagnostics(runDir: string, cassetteDir: string, frame: CodingFrame): DiagnosticsOutput {
  const { records, reports } = loadRunDir(runDir, JUDGE_DIAGNOSTICS_INPUT_INVALID);
  const accepted = records
    .filter((r) => r.status === 'accepted')
    .flatMap((record) => {
      const report = reports.get(record.runId);
      return report !== undefined && report.evaluationMode !== 'symbolic-only' ? [{ record, report }] : [];
    });
  const units = diagnoseUnits(accepted, indexCassettes(readCassetteDir(cassetteDir)), frame);
  return {
    files: new Map([
      ['judge_units.csv', unitsCsv(units)],
      ['judge_criteria.csv', criteriaCsv(units, frame)],
      ['judge_summary.csv', summaryCsv(units, frame)],
    ]),
    units: units.length,
    voteMismatches: units.filter((d) => !d.voteMatchesReport).length,
    missingCassettes: units.filter((d) => d.vote.runs === 0).length,
  };
}

export const DIAGNOSTICS_USAGE = [
  'Usage: npx tsx scripts/judge-diagnostics-cli.ts --runs <run dir> --cassettes <cassette dir> --out <dir>',
  '       npx tsx scripts/judge-diagnostics-cli.ts --self-test',
].join('\n');

export interface DiagnosticsMainIo {
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  readonly writeFile: (path: string, text: string) => void;
}

export function main(argv: readonly string[], repoRoot: string, io: DiagnosticsMainIo): number {
  const opts = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if (a === '--self-test') {
      // Known-bad input: a run directory that does not exist.
      main(['--runs', join(repoRoot, 'does-not-exist'), '--cassettes', join(repoRoot, 'does-not-exist'), '--out', join(repoRoot, 'does-not-exist-out')], repoRoot, io);
      return 1;
    }
    const v = argv[i + 1];
    if (a.startsWith('--') && v !== undefined) {
      opts.set(a.slice(2), v);
      i++;
    } else {
      io.err(`${DIAGNOSTICS_USAGE}\n`);
      return 2;
    }
  }
  const runs = opts.get('runs');
  const cassettes = opts.get('cassettes');
  const out = opts.get('out');
  if (runs === undefined || cassettes === undefined || out === undefined) {
    io.err(`${DIAGNOSTICS_USAGE}\n`);
    return 2;
  }
  const frame = loadCodingFrame(repoRoot);
  if (!frame.ok) {
    io.err(`${frame.code}: ${frame.detail}\n`);
    return 1;
  }
  try {
    const result = judgeDiagnostics(resolve(repoRoot, runs), resolve(repoRoot, cassettes), frame.frame);
    for (const [name, text] of result.files) io.writeFile(join(resolve(repoRoot, out), name), text);
    io.out(`${String(result.units)} judged units (coding frame ${frame.frame.version}); vote mismatches ${String(result.voteMismatches)}; `
      + `units without cassette entries ${String(result.missingCassettes)}; 0 judge calls\n`);
    return result.voteMismatches > 0 || result.missingCassettes > 0 ? 1 : 0;
  } catch (e) {
    io.err(`${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}
