/**
 * Labeller populations, context builder, mechanical FN causes and budget (FR-27; BR-U5b-33..35, 38, 39; C15.6).
 *
 * - **Populations** (BR-U5b-33): P1 every FP-strict and twin-FP violation (exhaustive), P2 corpus baseline violations
 *   per (project, function) capped at 20, P3 E1 generated-project violations per (cell, function) capped at 20, P4
 *   judge units per (cell, dimension) capped at 10, and the `missed-seed` population (MS, exhaustive) of seeds no
 *   mechanical rule explains. Sampling is seeded; every item carries its inclusion probability.
 * - **Context exclusion** (BR-U5b-35, 39): a context is built from the project source tree and the item's own fields
 *   only (function description, file, line window +/- 15 lines, target; for P4 the unit source through U4's
 *   `assembleUnitSourceFromView` and the dimension rubric). The candidate builders copy named fields out of a report
 *   and never read its neural sections, judge rationale, judge verdict or any cassette.
 * - **Mechanical FN causes** (BR-U5b-38): rules (1)..(6) of `Docs/matching-rule.md` §7 in order, the first match wins;
 *   routed extractor warnings only corroborate (`corroborated`); aggregate `importResolution` counters are never read.
 * - **Budget** (BR-U5b-34): P1 and MS are always labelled; the remaining capacity goes to P2..P4 by lowering their
 *   caps uniformly (one common scale factor); an estimate above the registered budget is refused.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Node, Project, SyntaxKind, ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { assembleUnitSourceFromView } from '../../src/llm-critic/source-context.js';
import type { JudgeGraphView } from '../../src/llm-critic/judge-graph.js';
import type { JudgeUnit } from '../../src/llm-critic/judge-unit-selector.js';
import { JUDGE_TOKEN_BUDGET } from '../../src/llm-critic/frozen.js';
import { FF_N01_RUBRIC, FF_N02_RUBRIC, RUBRIC_OUT_OF_SCOPE } from '../../src/llm-critic/rubric.js';
import type { RubricText } from '../../src/llm-critic/rubric.js';
import type { RootCauseCode } from './matching-rule.js';
import type { ManifestRow } from './manifest.js';
import { readTsconfig } from './mutation/stubs.js';
import { createRng, shuffle } from './stats.js';

// ---------------------------------------------------------------------------------------------
// Shapes (domain-entities §5)

export type ItemKind = 'violation' | 'judge-unit' | 'missed-seed';
export type Population = 'P1' | 'P2' | 'P3' | 'P4' | 'MS';
export type SampledPopulation = 'P2' | 'P3' | 'P4';
export const SAMPLED_POPULATIONS: readonly SampledPopulation[] = ['P2', 'P3', 'P4'];
/** Registered per-stratum caps (BR-U5b-33). */
export const POPULATION_CAPS: Readonly<Record<SampledPopulation, number>> = Object.freeze({ P2: 20, P3: 20, P4: 10 });
/** Lines of source either side of a violation line (BR-U5b-35). */
export const LINE_WINDOW = 15;
/** Two labeller runs per item (BR-U5b-31). */
export const RUNS_PER_ITEM = 2;

export const LABEL_BUDGET_EXCEEDED = 'LABEL_BUDGET_EXCEEDED';
export const LABEL_CONTEXT_FAILED = 'LABEL_CONTEXT_FAILED';

export interface LabelItem<K extends ItemKind = ItemKind> {
  /** sha256 over stable content (BR-U5b-36, `labelItemId`). */
  readonly itemId: string;
  readonly kind: K;
  readonly population: Population;
  readonly projectId: string;
  /** `'<project|cell>, <function|dimension>'`. */
  readonly stratum: string;
  /** 1 for exhaustive populations. */
  readonly inclusionProbability: number;
  /** Violation and missed-seed items. */
  readonly key?: string;
  /** Judge-unit items. */
  readonly unitId?: string;
  readonly functionId?: string;
  readonly dimension?: string;
  readonly seedId?: string;
  /** Built by `buildContext`; never judge output (BR-U5b-35). */
  readonly context: string;
}

/** `itemId = sha256(JSON.stringify([kind, projectId, baseTreeSha ?? specSha, baselineMatchKey | unitId]))`. */
export function labelItemId(kind: ItemKind, projectId: string, treeOrSpecSha: string, keyOrUnit: string): string {
  return createHash('sha256').update(JSON.stringify([kind, projectId, treeOrSpecSha, keyOrUnit])).digest('hex');
}

/** The fields a violation or missed-seed context needs, and nothing else. */
export interface ViolationFields {
  readonly functionId: string;
  readonly functionDescription: string;
  readonly filePath: string;
  readonly line?: number;
  readonly target?: string;
}

interface CandidateBase {
  readonly population: Population;
  readonly projectId: string;
  /** `baseTreeSha`, else the spec sha (BR-U5b-36). */
  readonly treeSha: string;
  /** Project id (P1, P2, MS) or generation cell id (P3, P4). */
  readonly stratumOwner: string;
  /** Root of the source tree the context is read from. */
  readonly sourceRoot: string;
}
export interface ViolationCandidate extends CandidateBase {
  readonly kind: 'violation';
  readonly population: 'P1' | 'P2' | 'P3';
  readonly key: string;
  readonly fields: ViolationFields;
}
export interface JudgeUnitCandidate extends CandidateBase {
  readonly kind: 'judge-unit';
  readonly population: 'P4';
  readonly functionId: string;
  readonly dimension: 'semantic' | 'integrity';
  readonly unit: JudgeUnit;
  readonly view: JudgeGraphView;
}
export interface MissedSeedCandidate extends CandidateBase {
  readonly kind: 'missed-seed';
  readonly population: 'MS';
  readonly seedId: string;
  readonly key: string;
  readonly fields: ViolationFields;
}
export type Candidate = ViolationCandidate | JudgeUnitCandidate | MissedSeedCandidate;

export function candidateItemId(c: Candidate): string {
  return labelItemId(c.kind, c.projectId, c.treeSha, c.kind === 'judge-unit' ? `${c.functionId}|${c.unit.id}` : c.key);
}

export function candidateStratum(c: Candidate): string {
  if (c.kind === 'judge-unit') return `${c.stratumOwner}, ${c.dimension}`;
  return `${c.stratumOwner}, ${c.fields.functionId}`;
}

// ---------------------------------------------------------------------------------------------
// Candidate builders: named fields only (BR-U5b-35)

/** The report fields a violation candidate reads. Any other report content is never touched. */
interface ReportViolationView {
  readonly functionId: string;
  readonly filePath: string;
  readonly target?: string;
  readonly discriminator?: readonly string[];
  readonly line?: number;
  readonly unitId?: string;
}

/** `JSON.stringify([functionId, filePath, target ?? "", [...discriminator]])` (BR-U5b-02, as `baselineMatchKey`). */
function violationKey(v: ReportViolationView): string {
  return JSON.stringify([v.functionId, v.filePath, v.target ?? '', [...(v.discriminator ?? [])]]);
}

function asViolations(report: unknown): readonly ReportViolationView[] {
  const list = (report as { readonly violations?: unknown }).violations;
  if (!Array.isArray(list)) return [];
  const out: ReportViolationView[] = [];
  for (const raw of list as readonly Record<string, unknown>[]) {
    if (typeof raw.functionId !== 'string' || typeof raw.filePath !== 'string') continue;
    if (typeof raw.unitId === 'string' || raw.route === 'neuronal') continue; // neural rows are P4 units, not violations
    out.push({
      functionId: raw.functionId,
      filePath: raw.filePath,
      ...(typeof raw.target === 'string' && { target: raw.target }),
      ...(Array.isArray(raw.discriminator) && { discriminator: (raw.discriminator as unknown[]).map(String) }),
      ...(typeof raw.line === 'number' && { line: raw.line }),
    });
  }
  return out;
}

export interface ReportSource {
  readonly population: 'P2' | 'P3';
  readonly projectId: string;
  readonly treeSha: string;
  /** Project id (P2) or cell id (P3). */
  readonly stratumOwner: string;
  readonly sourceRoot: string;
  /** Function id → description (from the compiled spec, never from the report). */
  readonly describe: (functionId: string) => string;
}

/**
 * P2 / P3 candidates from one report's symbolic violations (one per distinct key, the smallest line kept).
 * Reads `violations[].{functionId, filePath, target, discriminator, line}` only.
 */
export function violationCandidates(report: unknown, source: ReportSource): ViolationCandidate[] {
  const byKey = new Map<string, ReportViolationView>();
  for (const v of asViolations(report)) {
    const key = violationKey(v);
    const prev = byKey.get(key);
    if (prev === undefined || (v.line !== undefined && (prev.line === undefined || v.line < prev.line))) byKey.set(key, v);
  }
  return [...byKey.entries()].map(([key, v]) => ({
    kind: 'violation', population: source.population, projectId: source.projectId, treeSha: source.treeSha,
    stratumOwner: source.stratumOwner, sourceRoot: source.sourceRoot, key,
    fields: {
      functionId: v.functionId, functionDescription: source.describe(v.functionId), filePath: v.filePath,
      ...(v.line !== undefined && { line: v.line }), ...(v.target !== undefined && v.target !== '' && { target: v.target }),
    },
  }));
}

/** A P1 item of the scorer (`score-golden.ts` `P1Item`): the key carries the file and target. */
export interface P1Source {
  readonly itemKey: string;
  readonly projectId: string;
  readonly treeSha: string;
  readonly sourceRoot: string;
  readonly line?: number;
  readonly describe: (functionId: string) => string;
}

export function p1Candidate(p: P1Source): ViolationCandidate {
  const parsed = JSON.parse(p.itemKey) as unknown;
  if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') {
    throw new Error(`label-context: P1 key ${p.itemKey} is not a match key`);
  }
  const [functionId, filePath, target] = parsed as [string, string, unknown];
  return {
    kind: 'violation', population: 'P1', projectId: p.projectId, treeSha: p.treeSha, stratumOwner: p.projectId,
    sourceRoot: p.sourceRoot, key: p.itemKey,
    fields: {
      functionId, functionDescription: p.describe(functionId), filePath,
      ...(p.line !== undefined && { line: p.line }), ...(typeof target === 'string' && target !== '' && { target }),
    },
  };
}

export interface JudgeUnitSource {
  readonly projectId: string;
  readonly treeSha: string;
  /** Generation cell id (E1) or fixture id. */
  readonly stratumOwner: string;
  readonly sourceRoot: string;
  readonly view: JudgeGraphView;
}

/**
 * P4 candidates from one report's `neuralResults[]`: per function, `{functionId, dimension}` and per unit
 * `{unitId, unitKind, layer, filePaths}` only. Verdicts, confidences, rationale and evidence are never read.
 */
export function judgeUnitCandidates(report: unknown, source: JudgeUnitSource): JudgeUnitCandidate[] {
  const rows = (report as { readonly neuralResults?: unknown }).neuralResults;
  if (!Array.isArray(rows)) return [];
  const out: JudgeUnitCandidate[] = [];
  for (const row of rows as readonly Record<string, unknown>[]) {
    const functionId = row.functionId;
    const dimension = row.dimension;
    if (typeof functionId !== 'string' || (dimension !== 'semantic' && dimension !== 'integrity')) continue;
    const units = Array.isArray(row.unitResults) ? (row.unitResults as readonly Record<string, unknown>[]) : [];
    for (const u of units) {
      if (typeof u.unitId !== 'string' || !Array.isArray(u.filePaths)) continue;
      const filePaths = (u.filePaths as unknown[]).map(String).sort();
      const kind = u.unitKind === 'class' || u.unitKind === 'module' ? u.unitKind : 'file';
      out.push({
        kind: 'judge-unit', population: 'P4', projectId: source.projectId, treeSha: source.treeSha,
        stratumOwner: source.stratumOwner, sourceRoot: source.sourceRoot, functionId, dimension, view: source.view,
        unit: {
          id: u.unitId, kind, layer: typeof u.layer === 'string' ? u.layer : '', filePaths,
          sizeTokens: 0, singleFile: filePaths.length === 1,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Context builder (BR-U5b-35, 39)

function readUnderRoot(root: string, rel: string): string | null {
  try {
    const rootReal = fs.realpathSync(root);
    const real = fs.realpathSync(path.join(rootReal, rel));
    if (real !== rootReal && !real.startsWith(rootReal + path.sep)) return null;
    return fs.readFileSync(real, 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

/** Numbered source lines `line - 15 .. line + 15` (the whole file, capped at 31 lines, when the line is unknown). */
export function lineWindow(content: string, line: number | undefined): string {
  const lines = content.split('\n');
  const centre = line ?? 1;
  const from = Math.max(1, line === undefined ? 1 : centre - LINE_WINDOW);
  const to = Math.min(lines.length, line === undefined ? 1 + 2 * LINE_WINDOW : centre + LINE_WINDOW);
  const out: string[] = [];
  for (let n = from; n <= to; n += 1) out.push(`${String(n).padStart(5)} | ${lines[n - 1] ?? ''}`);
  return out.join('\n');
}

function violationContext(f: ViolationFields, root: string, heading: string): string | null {
  const content = readUnderRoot(root, f.filePath);
  const parts = [
    `## ${heading}`,
    `Function: ${f.functionId}`,
    `Description: ${f.functionDescription}`,
    `File: ${f.filePath}`,
    `Line: ${f.line === undefined ? 'n/a' : String(f.line)}`,
    `Target: ${f.target ?? 'n/a'}`,
    '',
    '## Source',
    content === null ? '(file not present in the source tree)' : lineWindow(content, f.line),
  ];
  return parts.join('\n');
}

export function rubricOf(dimension: 'semantic' | 'integrity'): RubricText {
  return dimension === 'integrity' ? FF_N01_RUBRIC : FF_N02_RUBRIC;
}

function judgeUnitContext(c: JudgeUnitCandidate): string | null {
  const assembled = assembleUnitSourceFromView(c.unit, c.sourceRoot, c.view, JUDGE_TOKEN_BUDGET);
  if (!assembled.success) return null;
  const r = rubricOf(c.dimension);
  const a = assembled.data;
  return [
    '## Judge unit',
    `Function: ${c.functionId} (${c.dimension})`,
    `Unit: ${c.unit.id} (${c.unit.kind}, layer ${c.unit.layer === '' ? 'n/a' : c.unit.layer})`,
    '',
    '## Rubric',
    `Rule: ${r.rule}`,
    `Pass: ${r.pass}`,
    `Fail: ${r.fail}`,
    `Evidence required: ${r.evidenceRequired}`,
    RUBRIC_OUT_OF_SCOPE,
    '',
    '## Source',
    a.signatures === undefined ? a.source : `${a.signatures}\n\n${a.source}`,
  ].join('\n');
}

/** The labeller context of one candidate, from the source tree and the candidate's own fields only. */
export function buildContext(c: Candidate): { ok: true; context: string } | { ok: false; code: typeof LABEL_CONTEXT_FAILED; detail: string } {
  const text = c.kind === 'judge-unit'
    ? judgeUnitContext(c)
    : violationContext(c.fields, c.sourceRoot, c.kind === 'violation' ? 'Violation' : 'Seeded construct (expected, not reported)');
  return text === null
    ? { ok: false, code: LABEL_CONTEXT_FAILED, detail: `${c.kind} ${c.kind === 'judge-unit' ? c.unit.id : c.key}: source not readable under ${c.projectId}` }
    : { ok: true, context: text };
}

// ---------------------------------------------------------------------------------------------
// Seeded sampling (BR-U5b-33, 63)

export interface StratumSample<C extends Candidate = Candidate> {
  readonly population: Population;
  readonly stratum: string;
  readonly size: number;
  /** `null` for exhaustive populations. */
  readonly cap: number | null;
  readonly sampled: readonly { readonly candidate: C; readonly itemId: string; readonly inclusionProbability: number }[];
}

/**
 * Groups candidates by stratum and samples each: exhaustive (P1, MS) or up to `caps[population]` items drawn by a
 * seeded shuffle of the candidates sorted by item id. Inclusion probability = `min(1, cap / size)`.
 */
export function sampleCandidates<C extends Candidate>(
  candidates: readonly C[],
  caps: Readonly<Record<SampledPopulation, number>>,
  seed: number,
): StratumSample<C>[] {
  const groups = new Map<string, { population: Population; stratum: string; items: { candidate: C; itemId: string }[] }>();
  for (const c of candidates) {
    const stratum = candidateStratum(c);
    const g = `${c.population}\u0000${stratum}`;
    const entry = groups.get(g) ?? { population: c.population, stratum, items: [] };
    entry.items.push({ candidate: c, itemId: candidateItemId(c) });
    groups.set(g, entry);
  }
  const out: StratumSample<C>[] = [];
  for (const g of [...groups.keys()].sort()) {
    const entry = groups.get(g);
    if (entry === undefined) continue;
    const unique = [...new Map(entry.items.map((i) => [i.itemId, i])).values()].sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
    const pop = entry.population;
    const cap = pop === 'P1' || pop === 'MS' ? null : caps[pop];
    let chosen = unique;
    if (cap !== null && unique.length > cap) {
      const rng = createRng(strataSeed(seed, pop, entry.stratum));
      chosen = shuffle(unique, rng).slice(0, cap).sort((a, b) => (a.itemId < b.itemId ? -1 : 1));
    }
    const p = cap === null || unique.length === 0 ? 1 : Math.min(1, cap / unique.length);
    out.push({
      population: pop, stratum: entry.stratum, size: unique.length, cap,
      sampled: chosen.map((i) => ({ candidate: i.candidate, itemId: i.itemId, inclusionProbability: p })),
    });
  }
  return out;
}

/** Per-stratum seed derived from the plan seed, so adding a stratum never reshuffles another. */
export function strataSeed(seed: number, population: Population, stratum: string): number {
  const h = createHash('sha256').update(JSON.stringify([seed, population, stratum])).digest();
  return h.readUInt32BE(0);
}

/** Builds the label items of a sample (contexts included); refuses when any context cannot be read. */
export function buildItems(samples: readonly StratumSample[]): { ok: true; items: LabelItem[] } | { ok: false; code: string; detail: string } {
  const items: LabelItem[] = [];
  for (const s of samples) {
    for (const { candidate: c, itemId, inclusionProbability } of s.sampled) {
      const ctx = buildContext(c);
      if (!ctx.ok) return { ok: false, code: ctx.code, detail: ctx.detail };
      items.push({
        itemId, kind: c.kind, population: c.population, projectId: c.projectId, stratum: s.stratum, inclusionProbability,
        ...(c.kind === 'judge-unit'
          ? { unitId: c.unit.id, functionId: c.functionId, dimension: c.dimension }
          : { key: c.key, functionId: c.fields.functionId }),
        ...(c.kind === 'missed-seed' && { seedId: c.seedId }),
        context: ctx.context,
      });
    }
  }
  return { ok: true, items };
}

// ---------------------------------------------------------------------------------------------
// Budget (BR-U5b-34)

export interface BudgetInput {
  /** Registered budget in calls (items x 2 runs). */
  readonly budgetCalls: number;
  /** Exhaustive item counts. */
  readonly p1: number;
  readonly missedSeeds: number;
  /** Stratum sizes of the sampled populations. */
  readonly strata: readonly { readonly population: SampledPopulation; readonly stratum: string; readonly size: number }[];
  readonly caps?: Readonly<Record<SampledPopulation, number>>;
}

export interface BudgetAllocation {
  readonly ok: boolean;
  readonly budgetCalls: number;
  /** Items the budget pays for (`floor(budgetCalls / 2)`). */
  readonly capacityItems: number;
  /** Capacity left for P2..P4 after P1 and MS (negative when P1 + MS alone exceed the budget). */
  readonly sampledCapacity: number;
  /** Caps after the uniform lowering (equal to the registered caps when everything fits). */
  readonly caps: Readonly<Record<SampledPopulation, number>>;
  /** Common scale factor applied to the registered caps. */
  readonly scale: number;
  readonly allocatedSampled: number;
  readonly estimatedCalls: number;
  readonly detail?: string;
}

function allocated(strata: BudgetInput['strata'], caps: Readonly<Record<SampledPopulation, number>>): number {
  return strata.reduce((s, x) => s + Math.min(x.size, caps[x.population]), 0);
}

/**
 * Allocates the budget: P1 and MS first; P2..P4 caps are lowered by one common factor `k / K` (K = the largest
 * registered cap, k = K .. 0) until the sampled total fits. `ok = false` when P1 + MS alone exceed the budget.
 */
export function allocateBudget(input: BudgetInput): BudgetAllocation {
  const registered = input.caps ?? POPULATION_CAPS;
  const capacityItems = Math.floor(input.budgetCalls / RUNS_PER_ITEM);
  const exhaustive = input.p1 + input.missedSeeds;
  const sampledCapacity = capacityItems - exhaustive;
  if (sampledCapacity < 0) {
    return {
      ok: false, budgetCalls: input.budgetCalls, capacityItems, sampledCapacity, caps: { P2: 0, P3: 0, P4: 0 }, scale: 0,
      allocatedSampled: 0, estimatedCalls: exhaustive * RUNS_PER_ITEM,
      detail: `${LABEL_BUDGET_EXCEEDED}: P1 ${String(input.p1)} + missed seeds ${String(input.missedSeeds)} = ${String(exhaustive)} items need ${String(exhaustive * RUNS_PER_ITEM)} calls > budget ${String(input.budgetCalls)}`,
    };
  }
  const top = Math.max(...SAMPLED_POPULATIONS.map((p) => registered[p]));
  for (let k = top; k >= 0; k -= 1) {
    const scale = top === 0 ? 0 : k / top;
    const caps = {
      P2: Math.floor(registered.P2 * scale), P3: Math.floor(registered.P3 * scale), P4: Math.floor(registered.P4 * scale),
    };
    const total = allocated(input.strata, caps);
    if (total <= sampledCapacity) {
      return {
        ok: true, budgetCalls: input.budgetCalls, capacityItems, sampledCapacity, caps, scale, allocatedSampled: total,
        estimatedCalls: (exhaustive + total) * RUNS_PER_ITEM,
      };
    }
  }
  /* c8 ignore next 2 -- k = 0 always fits once sampledCapacity >= 0 */
  throw new Error('label-context: unreachable budget state');
}

/** `--estimate`: the call count and the refusal exit code (1 when above budget, else 0). */
export function estimateExit(a: BudgetAllocation): { exitCode: 0 | 1; line: string } {
  return a.ok
    ? { exitCode: 0, line: `estimate: ${String(a.estimatedCalls)} calls <= budget ${String(a.budgetCalls)} (caps P2 ${String(a.caps.P2)}, P3 ${String(a.caps.P3)}, P4 ${String(a.caps.P4)})` }
    : { exitCode: 1, line: a.detail ?? LABEL_BUDGET_EXCEEDED };
}

// ---------------------------------------------------------------------------------------------
// Mechanical FN causes (BR-U5b-38; Docs/matching-rule.md §7)

export type FnCauseSource = 'mechanical' | 'labeller' | 'audit';
export interface FnCause {
  readonly seedId: string;
  readonly rootCause: RootCauseCode;
  /** 1..6, the matching-rule §7 rule that assigned the cause. */
  readonly rule: 1 | 2 | 3 | 4 | 5 | 6;
  readonly source: 'mechanical';
  /** A routed extractor warning supports the cause (rules 2 and 3 only; otherwise false). */
  readonly corroborated: boolean;
}

export interface RoutedWarning {
  readonly code: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface MissedSeedEvidence {
  readonly row: ManifestRow;
  /** Root of the seeded copy (site file read from here, BR-U5b-38). */
  readonly seededRoot: string;
  /** The base's `tsconfigPath`, relative to the copy root (U5a `PreparedBase.tsconfigPath`). */
  readonly tsconfigPath: string;
  /** The seeded report's routed warnings (corroboration only). */
  readonly warnings: readonly RoutedWarning[];
  /** Function ids the seeded report lists in `disabledFunctions`. */
  readonly reportDisabled: readonly string[];
}

interface SiteImport {
  readonly specifier: string;
  readonly dynamic: boolean;
  readonly typeOnly: boolean;
}

/** The import-like statement at the site line of the seeded file (line mapped through the row's line shifts). */
function siteImport(sf: SourceFile, line: number): SiteImport | null {
  for (const stmt of sf.getStatements()) {
    if (line < stmt.getStartLineNumber() || line > stmt.getEndLineNumber()) continue;
    if (Node.isImportDeclaration(stmt)) {
      const named = stmt.getNamedImports();
      const typeOnly = stmt.isTypeOnly()
        || (named.length > 0 && stmt.getDefaultImport() === undefined && stmt.getNamespaceImport() === undefined && named.every((n) => n.isTypeOnly()));
      return { specifier: stmt.getModuleSpecifierValue(), dynamic: false, typeOnly };
    }
    for (const call of stmt.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const callee = call.getExpression();
      const isImport = callee.getKind() === SyntaxKind.ImportKeyword;
      const isRequire = Node.isIdentifier(callee) && callee.getText() === 'require';
      if (!isImport && !isRequire) continue;
      const arg = call.getArguments()[0];
      const specifier = arg !== undefined && Node.isStringLiteral(arg) ? arg.getLiteralValue() : '';
      return { specifier, dynamic: true, typeOnly: false };
    }
  }
  return null;
}

function hasWarning(warnings: readonly RoutedWarning[], code: string, filePath: string): boolean {
  return warnings.some((w) => w.code === code && w.context?.filePath === filePath);
}

function isRelative(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../') || specifier === '.' || specifier === '..' || specifier.startsWith('/');
}

function insideRoot(root: string, file: string): boolean {
  const rel = path.relative(root, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && !rel.split(path.sep).includes('node_modules');
}

function aliasPatternMatches(options: ts.CompilerOptions, specifier: string): boolean {
  if (options.baseUrl !== undefined) return true;
  return Object.keys(options.paths ?? {}).some((p) => {
    const star = p.indexOf('*');
    return star < 0 ? p === specifier : specifier.startsWith(p.slice(0, star)) && specifier.endsWith(p.slice(star + 1));
  });
}

function relPosix(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

/** True when the module file re-exports (`export ... from`), i.e. is a barrel hop. */
function isBarrel(file: string): boolean {
  try {
    const text = fs.readFileSync(file, 'utf8');
    return /^\s*export\s+(\*|\{[^}]*\}|type\s+\{[^}]*\})\s+from\s+['"]/m.test(text);
  } catch {
    return false;
  }
}

/**
 * Applies rules (1)..(6) in order to one missed seed; `null` when none applies (the seed becomes a `missed-seed`
 * item). Reads the manifest site, the seeded site file, the base tsconfig and the routed warnings; never the
 * aggregate `importResolution` counters.
 */
export function mechanicalFnCause(e: MissedSeedEvidence): FnCause | null {
  const row = e.row;
  const site = row.site;
  const at = (rule: FnCause['rule'], rootCause: RootCauseCode, corroborated = false): FnCause => ({
    seedId: row.seedId, rootCause, rule, source: 'mechanical', corroborated,
  });
  // (1) outside coverage and the site kind uses import()
  if (row.expected.coverage === 'outside' && site.kind === 'dynamic-import') {
    return at(1, 'RC-DYNAMIC-IMPORT', hasWarning(e.warnings, 'EXTRACTOR_009', site.filePath));
  }
  let shiftedLine = site.line;
  for (const s of row.lineShifts) if (s.filePath === site.filePath && shiftedLine > s.afterLine) shiftedLine += s.delta;
  const siteAbs = path.join(e.seededRoot, site.filePath);
  let imp: SiteImport | null = null;
  if (fs.existsSync(siteAbs)) {
    const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true });
    imp = siteImport(project.createSourceFile('/site.ts', fs.readFileSync(siteAbs, 'utf8')), shiftedLine);
  }
  // (2) the site statement is a dynamic import or a CommonJS require call
  if (imp?.dynamic === true) return at(2, 'RC-DYNAMIC-IMPORT', hasWarning(e.warnings, 'EXTRACTOR_009', site.filePath));
  // (3) a non-relative alias the base's compiler options do not resolve inside the project root
  let resolved: string | undefined;
  if (imp !== null && imp.specifier !== '') {
    const cfg = readTsconfig(e.seededRoot, e.tsconfigPath);
    const options = cfg.success ? cfg.data.options : {};
    resolved = ts.resolveModuleName(imp.specifier, siteAbs, options, ts.sys).resolvedModule?.resolvedFileName;
    const rootReal = fs.realpathSync(e.seededRoot);
    const resolvedInside = resolved !== undefined && insideRoot(rootReal, fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved);
    if (!isRelative(imp.specifier) && aliasPatternMatches(options, imp.specifier) && !resolvedInside) {
      return at(3, 'RC-EXTRACT-ALIAS', hasWarning(e.warnings, 'EXTRACTOR_002', site.filePath));
    }
  }
  // (4) every expected function disabled
  if (row.expected.negative !== true) {
    const expected = new Set([...row.expected.functionIds, ...row.expected.disabledFunctionIds.map((d) => d.functionId)]);
    const disabled = new Set([...row.expected.disabledFunctionIds.map((d) => d.functionId), ...e.reportDisabled]);
    if (expected.size > 0 && [...expected].every((f) => disabled.has(f))) return at(4, 'RC-STYLE-INAPPLICABLE');
  }
  // (5) the site import is type-only
  if (imp?.typeOnly === true) return at(5, 'RC-TYPE-ONLY');
  // (6) the import reaches its target only through a barrel (RE_EXPORTS hop)
  const targetFile = site.detail.targetFile;
  if (imp !== null && resolved !== undefined && targetFile !== undefined) {
    const rootReal = fs.realpathSync(e.seededRoot);
    const real = fs.existsSync(resolved) ? fs.realpathSync(resolved) : resolved;
    if (insideRoot(rootReal, real) && relPosix(rootReal, real) !== targetFile && isBarrel(real)) return at(6, 'RC-EXTRACT-BARREL');
  }
  return null;
}

/**
 * Missed seeds → mechanical causes first; the remainder become MS candidates (one per seed, keyed by its first
 * expected key). The context reads the seeded copy at the expected key's file and line.
 */
export function classifyMissedSeeds(
  missed: readonly MissedSeedEvidence[],
  describe: (functionId: string) => string,
): { causes: FnCause[]; candidates: MissedSeedCandidate[] } {
  const causes: FnCause[] = [];
  const candidates: MissedSeedCandidate[] = [];
  for (const e of missed) {
    const cause = mechanicalFnCause(e);
    if (cause !== null) {
      causes.push(cause);
      continue;
    }
    const row = e.row;
    const k = row.expected.keys[0];
    const key = k === undefined
      ? JSON.stringify(['', row.site.filePath, '', []])
      : JSON.stringify([k.functionId, k.filePath, k.target, [...k.discriminator]]);
    const functionId = k?.functionId ?? row.expected.functionIds[0] ?? '';
    const filePath = k !== undefined && k.filePath !== '<project>' ? k.filePath : row.site.filePath;
    candidates.push({
      kind: 'missed-seed', population: 'MS', projectId: row.projectId, treeSha: row.baseTreeSha, stratumOwner: row.projectId,
      sourceRoot: e.seededRoot, seedId: row.seedId, key,
      fields: {
        functionId, functionDescription: describe(functionId), filePath,
        ...(k?.line !== undefined && { line: k.line }), ...(k !== undefined && k.target !== '' && { target: k.target }),
      },
    });
  }
  return { causes, candidates };
}
