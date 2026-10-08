/**
 * Baseline-selection projection (OI-11; BR-U5b-76; BR-U4-SEL-04, SEL-07; Build and Test Step 15).
 *
 * Projects a full-mode baseline report into the `StoredBaselineSelection` that `scripts/prepare-bases.ts` reads:
 * per neural function, `template` (the function's `functionResults[].name`, one of U5a's two judge templates),
 * `candidateUnitIds` and `selectedUnitIds` (`neuralResults[].selection`) and `unitFiles`, the unit → file mapping
 * taken from `neuralResults[].unitResults[].filePaths` (OI-11 settled as that field of the baseline report).
 *
 * Refusals, each with a code and nothing written:
 * - `SEL_PROJ_INVALID`: not a JSON object, or a `neuralResults[]` row that is not a U4 neural result row;
 * - `SEL_PROJ_NO_NEURAL`: no `neuralResults[]` rows (a symbolic-only report, or a full-mode report whose neural
 *   functions all failed);
 * - `SEL_PROJ_NOT_BASELINE`: a row with `selection.source = 'baseline'` (a variant run reusing another selection,
 *   SEL-07) or a non-empty `judge.seededList`;
 * - `SEL_PROJ_TEMPLATE`: a neural function whose name is not a judge template;
 * - `SEL_PROJ_UNMAPPED`: a selected unit without a `unitResults[]` row (checked through `judgeSelectionOf`).
 *
 * Output is deterministic: functions sorted by id, unit ids and file paths sorted, keys in a fixed order.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neuralResultRowProblem } from '../src/llm-critic/neural-result-rows.js';
import type { NeuralResultRow } from '../src/shared/types/evaluation.js';
import type { JudgeSelection } from './lib/mutation/types.js';
import { judgeSelectionOf } from './prepare-bases.js';
import type { StoredBaselineSelection } from './prepare-bases.js';

export const SEL_PROJ_INVALID = 'SEL_PROJ_INVALID';
export const SEL_PROJ_NO_NEURAL = 'SEL_PROJ_NO_NEURAL';
export const SEL_PROJ_NOT_BASELINE = 'SEL_PROJ_NOT_BASELINE';
export const SEL_PROJ_TEMPLATE = 'SEL_PROJ_TEMPLATE';
export const SEL_PROJ_UNMAPPED = 'SEL_PROJ_UNMAPPED';

export type SelProjCode = typeof SEL_PROJ_INVALID | typeof SEL_PROJ_NO_NEURAL | typeof SEL_PROJ_NOT_BASELINE
  | typeof SEL_PROJ_TEMPLATE | typeof SEL_PROJ_UNMAPPED;

export type SelProjOutcome =
  | { readonly ok: true; readonly value: StoredBaselineSelection }
  | { readonly ok: false; readonly code: SelProjCode; readonly detail: string };

const TEMPLATES: readonly JudgeSelection['template'][] = ['intent-alignment', 'architectural-integrity'];

const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Projects one baseline report (already parsed) for `projectId`. Pure. */
export function projectBaselineSelection(projectId: string, report: unknown): SelProjOutcome {
  const bad = (code: SelProjCode, detail: string): SelProjOutcome => ({ ok: false, code, detail });
  if (!isRecord(report)) return bad(SEL_PROJ_INVALID, 'report is not a JSON object');
  const rows = report.neuralResults;
  if (!Array.isArray(rows) || rows.length === 0) return bad(SEL_PROJ_NO_NEURAL, 'report has no neuralResults[] rows');
  const judge = report.judge;
  if (isRecord(judge) && Array.isArray(judge.seededList) && judge.seededList.length > 0) {
    return bad(SEL_PROJ_NOT_BASELINE, 'judge.seededList is not empty (a seeded variant run)');
  }
  const names = new Map<string, unknown>();
  const fr = report.functionResults;
  if (Array.isArray(fr)) for (const f of fr) if (isRecord(f) && typeof f.functionId === 'string') names.set(f.functionId, f.name);
  const functions: StoredBaselineSelection['functions'][number][] = [];
  for (const [i, raw] of (rows as unknown[]).entries()) {
    const problem = neuralResultRowProblem(raw);
    if (problem !== null) return bad(SEL_PROJ_INVALID, `neuralResults[${String(i)}]: ${problem}`);
    const row = raw as NeuralResultRow;
    if (row.selection.source !== 'own') return bad(SEL_PROJ_NOT_BASELINE, `${row.functionId}: selection.source is ${row.selection.source}`);
    const name = names.get(row.functionId);
    const template = TEMPLATES.find((t) => t === name);
    if (template === undefined) return bad(SEL_PROJ_TEMPLATE, `${row.functionId}: name ${String(name)} is not a judge template`);
    const unitFiles: Record<string, readonly string[]> = {};
    for (const u of [...row.unitResults].sort((a, b) => byString(a.unitId, b.unitId))) {
      unitFiles[u.unitId] = [...new Set(u.filePaths)].sort(byString);
    }
    functions.push({
      template,
      functionId: row.functionId,
      candidateUnitIds: [...row.selection.candidateUnitIds].sort(byString),
      selectedUnitIds: [...row.selection.selectedUnitIds].sort(byString),
      unitFiles,
    });
  }
  functions.sort((a, b) => byString(a.functionId, b.functionId));
  const value: StoredBaselineSelection = { projectId, functions };
  const check = judgeSelectionOf(value);
  if (!check.ok) return bad(SEL_PROJ_UNMAPPED, check.detail);
  return { ok: true, value };
}

/** Canonical text of a projection (two-space JSON, trailing newline). */
export function selectionText(value: StoredBaselineSelection): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

// --- CLI ----------------------------------------------------------------------------------------------------------

export interface SelProjIo {
  readonly out: (t: string) => void;
  readonly err: (t: string) => void;
  readonly readFile?: (path: string) => string;
  readonly writeFile?: (path: string, text: string) => void;
}

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Built-in known-bad input for `--self-test`: a symbolic-only report (no neural rows). */
export const SELF_TEST_REPORT = Object.freeze({ evaluationMode: 'symbolic-only', functionResults: [] });

/** `--report <file> --project <id> [--out <file>]` | `--self-test`. Exit 0 ok, 1 refusal or self-test, 2 usage. */
export function main(argv: readonly string[], io: SelProjIo): number {
  if (argv.includes('--self-test')) {
    const r = projectBaselineSelection('self-test', SELF_TEST_REPORT);
    io.err(r.ok ? 'self-test: a report without neural rows was accepted\n' : `self-test: ${r.code}: ${r.detail}\n`);
    return 1;
  }
  const reportPath = arg(argv, '--report');
  const projectId = arg(argv, '--project');
  if (reportPath === undefined || projectId === undefined) {
    io.err('usage: store-baseline-selection-cli.ts --report <full-mode report.json> --project <id> [--out <file>] | --self-test\n');
    return 2;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse((io.readFile ?? ((p: string) => readFileSync(p, 'utf8')))(reportPath));
  } catch (e) {
    io.err(`${SEL_PROJ_INVALID}: ${reportPath}: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
  const r = projectBaselineSelection(projectId, parsed);
  if (!r.ok) {
    io.err(`${r.code}: ${r.detail}\n`);
    return 1;
  }
  const text = selectionText(r.value);
  const out = arg(argv, '--out');
  if (out !== undefined) (io.writeFile ?? ((p: string, t: string) => { writeFileSync(p, t); }))(out, text);
  else io.out(text);
  return 0;
}
