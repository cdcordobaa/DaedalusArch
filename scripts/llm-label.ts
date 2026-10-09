/**
 * Gemini labeller: two runs, cassettes and reconciliation (FR-27; BR-U5b-28, 29, 31, 32, 36, 37, 40, 44; C15.6).
 *
 * - **Model** (BR-U5b-31, 40): one pinned Gemini id, temperature 0, two runs per item. No default id exists: an empty
 *   id is `LABELLER_MODEL_UNPINNED`. The labeller is never a Claude model (the judge and generator family):
 *   `LABELLER_FAMILY_CONFLICT`. `sameFamily` flags a judge cross-check run on the labeller's own model family.
 * - **Run diversity** (BR-U5b-32): run 0 asks in plan order with the canonical option and root-cause order; run 1
 *   asks in a seeded shuffled order and presents both lists in a per-item permutation derived from the stored
 *   permutation seed. Answers are mapped back to the canonical codes before reconciliation.
 * - **Cassettes** (BR-U5b-36, 44): the provider is wrapped in U4's `CassetteLLMProvider`; the key is U4's
 *   canonical-request hash plus `repetition` (0) and `runIndex` (0 / 1); `functionId = label:<kind>:<itemId>` is
 *   entry metadata. Only `record` and `replay` exist; replay answers only from cassettes (`CASSETTE_MISS`).
 * - **Validity and reconciliation** (BR-U5b-29, 37): an invalid answer is re-asked once (a distinct prompt, hence a
 *   distinct key), then recorded invalid; equal labels (and equal root cause where one is required) reconcile to the
 *   label, anything else to `uncertain` (`disagree` or `invalid-run`).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { listCassetteKeys, readCassetteEntry } from '../src/llm-critic/cassette-manager.js';
import { CassetteLLMProvider } from '../src/llm-critic/cassette-provider.js';
import type { Interpretation } from '../src/llm-critic/cassette-provider.js';
import type { LLMProvider } from '../src/shared/interfaces/llm-provider.js';
import type { VCRMode } from '../src/shared/types/llm-config.js';
import { ROOT_CAUSE_CODES } from './lib/matching-rule.js';
import type { RootCauseCode } from './lib/matching-rule.js';
import { allocateBudget, estimateExit } from './lib/label-context.js';
import type { ItemKind, LabelItem, Population, SampledPopulation } from './lib/label-context.js';
import { cohenKappa, createRng, fleissKappa, gwetAC1, shuffle, wilson } from './lib/stats.js';
import { judgeVerdictsFromRuns, missingSource } from './lib/judge-verdicts.js';
import type { JudgeUnitVerdict } from './lib/judge-verdicts.js';
import { knownSecretsOf, loadRunDir } from './lib/report-io.js';

export type { ItemKind, LabelItem, Population, RootCauseCode };

// ---------------------------------------------------------------------------------------------
// Shapes (domain-entities §5)

export type ViolationLabel = 'TP' | 'FP' | 'unseeded-TP';
export type UnitLabel = 'pass' | 'fail';
/** Missed-seed items carry one option; the label's content is the root cause (DV-U5b-22). */
export type MissedSeedLabel = 'FN';
export type AnyLabel = ViolationLabel | UnitLabel | MissedSeedLabel;

export interface LabelRun<L extends string = AnyLabel> {
  readonly runIndex: 0 | 1;
  /** `null` = invalid outcome after the one re-ask. */
  readonly label: L | null;
  readonly rootCause?: RootCauseCode;
  readonly note?: string;
  readonly rationale: string;
  /** Run 1: the per-item permutation seed (derived from the plan seed and the item id). */
  readonly permutationSeed?: number;
  /** U4 canonical-request key of the final call. */
  readonly cassetteKey: string;
  /** 1, or 2 when the first answer was invalid and re-asked. */
  readonly attempts: 1 | 2;
  /** Why the recorded outcome is invalid. */
  readonly invalidReason?: string;
}

export interface ReconciledLabel<L extends string = AnyLabel> {
  readonly itemId: string;
  readonly projectId: string;
  readonly kind: ItemKind;
  readonly population: Population;
  readonly stratum: string;
  readonly inclusionProbability: number;
  /** Judge-unit items: the unit and function (matched to judge verdicts at comparison time only). */
  readonly unitId?: string;
  readonly functionId?: string;
  readonly label: L | 'uncertain';
  readonly uncertainReason?: 'disagree' | 'invalid-run';
  readonly rootCause?: RootCauseCode;
  readonly runs: readonly [LabelRun<L>, LabelRun<L>];
}

export interface LabellerConfig {
  /** The real provider (Gemini; Mock for fixtures); wrapped here in U4's `CassetteLLMProvider`. */
  readonly provider: LLMProvider;
  /** Pinned id shared with U4 (BR-U4-VRD-09); no default. */
  readonly model: string;
  readonly runs: 2;
  readonly mode: VCRMode;
  readonly cassetteDir: string;
  readonly permutationSeed: number;
  readonly budgetCalls: number;
  readonly maxTokens?: number;
  /** Values scrubbed from every cassette (default: `knownSecretsOf(process.env)`). */
  readonly knownSecrets?: readonly string[];
  readonly now?: () => string;
}

export const LABELLER_MODEL_UNPINNED = 'LABELLER_MODEL_UNPINNED';
export const LABELLER_FAMILY_CONFLICT = 'LABELLER_FAMILY_CONFLICT';
export const LABELLER_PROMPT_INVALID = 'LABELLER_PROMPT_INVALID';
export const LABELLER_PLAN_INVALID = 'LABELLER_PLAN_INVALID';
export const LABELLER_STOPPED = 'LABELLER_STOPPED';
export const LABELLER_PROMPT_DIR = 'Docs/labeller-prompts';
export const LABELLER_MAX_TOKENS = 1024;
export const LABELLER_TEMPERATURE = 0;

/** Response schema (canonical JSON text); Gemini receives its supported subset through U4's provider. */
export const LABEL_SCHEMA_TEXT = JSON.stringify({
  type: 'object',
  properties: {
    option: { type: 'integer' },
    rootCause: { type: 'integer', nullable: true },
    note: { type: 'string' },
    rationale: { type: 'string' },
  },
  required: ['option', 'rationale'],
});

// ---------------------------------------------------------------------------------------------
// Model checks (BR-U5b-31, 40)

/** Model family: the id's first dash-separated token (`gemini-…` → `gemini`, `claude-…` → `claude`). */
export function modelFamily(model: string): string {
  return (model.split('-')[0] ?? model).toLowerCase();
}

/** True when a judge (cross-check) model is the labeller's model or of its family (BR-U5b-40). */
export function sameFamily(labellerModel: string, judgeModel: string): boolean {
  return judgeModel === labellerModel || modelFamily(judgeModel) === modelFamily(labellerModel);
}

export function checkLabellerModel(model: string | undefined): { ok: true } | { ok: false; code: string; detail: string } {
  if (model === undefined || model.trim() === '') {
    return { ok: false, code: LABELLER_MODEL_UNPINNED, detail: `${LABELLER_MODEL_UNPINNED}: no pinned labeller model id (BR-U5b-31; BR-U4-VRD-09 has no Gemini default)` };
  }
  if (modelFamily(model) === 'claude') {
    return { ok: false, code: LABELLER_FAMILY_CONFLICT, detail: `${LABELLER_FAMILY_CONFLICT}: ${model} is of the judge / generator family (BR-U5b-40)` };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Prompt documents (Docs/labeller-prompts/*.md)

export interface LabellerPrompt {
  readonly file: string;
  readonly version: string;
  readonly kind: ItemKind;
  readonly persona: string;
  readonly template: string;
  readonly options: readonly string[];
  readonly rootCauseRequired: readonly string[];
  readonly rootCauses: readonly RootCauseCode[];
}

const FENCE = /```yaml labeller-prompt\n([\s\S]*?)\n```/g;

export function parseLabellerPrompt(file: string, doc: string): { ok: true; prompt: LabellerPrompt } | { ok: false; detail: string } {
  const blocks = [...doc.matchAll(FENCE)];
  if (blocks.length !== 1) return { ok: false, detail: `${file}: expected one labeller-prompt block, found ${String(blocks.length)}` };
  let y: Record<string, unknown>;
  try {
    y = parseYaml(blocks[0]?.[1] ?? '') as Record<string, unknown>;
  } catch (e) {
    return { ok: false, detail: `${file}: ${e instanceof Error ? e.message : String(e)}` };
  }
  const strings = (v: unknown): string[] | null => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? v : null);
  const options = strings(y.options);
  const required = strings(y.rootCauseRequired ?? []);
  const rcs = strings(y.rootCauses);
  const kind = y.kind;
  if (kind !== 'violation' && kind !== 'judge-unit' && kind !== 'missed-seed') return { ok: false, detail: `${file}: kind ${String(kind)}` };
  if (typeof y.version !== 'string' || typeof y.persona !== 'string' || typeof y.template !== 'string') return { ok: false, detail: `${file}: version, persona and template are required` };
  if (options === null || options.length === 0 || required === null || rcs === null) return { ok: false, detail: `${file}: options, rootCauseRequired and rootCauses must be string lists` };
  const unknown = rcs.filter((c) => !(ROOT_CAUSE_CODES as readonly string[]).includes(c));
  if (unknown.length > 0) return { ok: false, detail: `${file}: unknown root cause ${unknown.join(', ')}` };
  for (const t of ['{{context}}', '{{options}}', '{{rootCauses}}']) if (!y.template.includes(t)) return { ok: false, detail: `${file}: template lacks ${t}` };
  return {
    ok: true,
    prompt: {
      file, version: y.version, kind, persona: y.persona.trimEnd(), template: y.template.trimEnd(), options,
      rootCauseRequired: required, rootCauses: rcs as RootCauseCode[],
    },
  };
}

export function loadLabellerPrompts(repoRoot: string): { ok: true; prompts: ReadonlyMap<ItemKind, LabellerPrompt> } | { ok: false; code: string; detail: string } {
  const dir = join(repoRoot, LABELLER_PROMPT_DIR);
  if (!existsSync(dir)) return { ok: false, code: LABELLER_PROMPT_INVALID, detail: `${LABELLER_PROMPT_DIR} missing` };
  const out = new Map<ItemKind, LabellerPrompt>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.md')).sort()) {
    const rel = `${LABELLER_PROMPT_DIR}/${f}`;
    const p = parseLabellerPrompt(rel, readFileSync(join(dir, f), 'utf8'));
    if (!p.ok) return { ok: false, code: LABELLER_PROMPT_INVALID, detail: p.detail };
    if (out.has(p.prompt.kind)) return { ok: false, code: LABELLER_PROMPT_INVALID, detail: `${rel}: kind ${p.prompt.kind} defined twice` };
    out.set(p.prompt.kind, p.prompt);
  }
  for (const k of ['violation', 'judge-unit', 'missed-seed'] as const) {
    if (!out.has(k)) return { ok: false, code: LABELLER_PROMPT_INVALID, detail: `${LABELLER_PROMPT_DIR}: no prompt for ${k}` };
  }
  return { ok: true, prompts: out };
}

// ---------------------------------------------------------------------------------------------
// Permutations and rendering (BR-U5b-32)

/** Per-item permutation seed: the first 32 bits of sha256([planSeed, itemId]). */
export function itemPermutationSeed(planSeed: number, itemId: string): number {
  return createHash('sha256').update(JSON.stringify([planSeed, itemId])).digest().readUInt32BE(0);
}

/** `perm[i]` = canonical index shown at presented position i (0-based); identity for run 0. */
export function presentedOrder(n: number, permutationSeed: number | undefined): number[] {
  const identity = Array.from({ length: n }, (_, i) => i);
  return permutationSeed === undefined ? identity : shuffle(identity, createRng(permutationSeed));
}

export interface Presentation {
  readonly options: readonly string[];
  readonly rootCauses: readonly RootCauseCode[];
}

export function presentation(prompt: LabellerPrompt, permutationSeed: number | undefined): Presentation {
  const oPerm = presentedOrder(prompt.options.length, permutationSeed);
  // A second, independent permutation for the root-cause list (seed + 1).
  const rPerm = presentedOrder(prompt.rootCauses.length, permutationSeed === undefined ? undefined : (permutationSeed + 1) >>> 0);
  return {
    options: oPerm.map((i) => prompt.options[i] ?? ''),
    rootCauses: rPerm.map((i) => prompt.rootCauses[i] ?? 'RC-OTHER'),
  };
}

export function renderPrompt(prompt: LabellerPrompt, item: LabelItem, shown: Presentation): string {
  const numbered = (xs: readonly string[]): string => xs.map((x, i) => `${String(i + 1)}. ${x}`).join('\n  ');
  return prompt.template
    .replace('{{context}}', item.context.split('\n').join('\n  '))
    .replace('{{options}}', numbered(shown.options))
    .replace('{{rootCauses}}', numbered(shown.rootCauses));
}

// ---------------------------------------------------------------------------------------------
// Answers and validity (BR-U5b-29)

export interface Answer {
  readonly label: string;
  readonly rootCause?: RootCauseCode;
  readonly note?: string;
  readonly rationale: string;
}

/** Parses the JSON answer and maps the presented option / root-cause numbers back to canonical codes. */
export function parseAnswer(text: string, shown: Presentation): { ok: true; answer: Answer } | { ok: false; reason: string } {
  let v: unknown;
  try {
    v = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch {
    return { ok: false, reason: 'answer is not JSON' };
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return { ok: false, reason: 'answer is not a JSON object' };
  const o = v as Record<string, unknown>;
  if (typeof o.option !== 'number' || !Number.isInteger(o.option)) return { ok: false, reason: 'option must be an integer' };
  const label = shown.options[o.option - 1];
  if (label === undefined) return { ok: false, reason: `option ${String(o.option)} is not offered` };
  let rootCause: RootCauseCode | undefined;
  if (o.rootCause !== undefined && o.rootCause !== null) {
    if (typeof o.rootCause !== 'number' || !Number.isInteger(o.rootCause)) return { ok: false, reason: 'rootCause must be an integer or null' };
    rootCause = shown.rootCauses[o.rootCause - 1];
    if (rootCause === undefined) return { ok: false, reason: `rootCause ${String(o.rootCause)} is not offered` };
  }
  if (o.note !== undefined && typeof o.note !== 'string') return { ok: false, reason: 'note must be a string' };
  if (typeof o.rationale !== 'string') return { ok: false, reason: 'rationale must be a string' };
  return {
    ok: true,
    answer: { label, ...(rootCause !== undefined && { rootCause }), ...(typeof o.note === 'string' && { note: o.note }), rationale: o.rationale },
  };
}

/** BR-U5b-29 validity of a mapped answer; `null` when valid, else the reason. */
export function validateAnswer(prompt: LabellerPrompt, a: Answer): string | null {
  if (!prompt.options.includes(a.label)) return `label ${a.label} is not an option of ${prompt.kind}`;
  if (prompt.rootCauseRequired.includes(a.label) && a.rootCause === undefined) return `${a.label} requires a root cause`;
  if (prompt.kind === 'judge-unit' && a.rootCause !== undefined) return 'judge-unit labels carry no root cause';
  if (a.rootCause === 'RC-GENUINE-UNSEEDED' && a.label !== 'unseeded-TP') return 'RC-GENUINE-UNSEEDED is valid only with unseeded-TP';
  if (a.rootCause === 'RC-OTHER' && (a.note ?? '').trim() === '') return 'RC-OTHER requires a non-empty note';
  if (prompt.kind === 'judge-unit' && a.rationale.trim() === '') return 'judge-unit labels require a rationale';
  return null;
}

// ---------------------------------------------------------------------------------------------
// Reconciliation (BR-U5b-37)

export function reconcile<L extends string>(item: LabelItem, prompt: LabellerPrompt, runs: readonly [LabelRun<L>, LabelRun<L>]): ReconciledLabel<L> {
  const base = {
    itemId: item.itemId, projectId: item.projectId, kind: item.kind, population: item.population, stratum: item.stratum,
    inclusionProbability: item.inclusionProbability, runs,
    ...(item.kind === 'judge-unit' && item.unitId !== undefined && { unitId: item.unitId }),
    ...(item.kind === 'judge-unit' && item.functionId !== undefined && { functionId: item.functionId }),
  };
  const [a, b] = runs;
  if (a.label === null || b.label === null) return { ...base, label: 'uncertain', uncertainReason: 'invalid-run' };
  if (a.label !== b.label) return { ...base, label: 'uncertain', uncertainReason: 'disagree' };
  if (prompt.rootCauseRequired.includes(a.label)) {
    if (a.rootCause !== b.rootCause) return { ...base, label: 'uncertain', uncertainReason: 'disagree' };
    return { ...base, label: a.label, ...(a.rootCause !== undefined && { rootCause: a.rootCause }) };
  }
  // Optional root cause (TP): kept only when both runs agree on it.
  return { ...base, label: a.label, ...(a.rootCause !== undefined && a.rootCause === b.rootCause && { rootCause: a.rootCause }) };
}

// ---------------------------------------------------------------------------------------------
// Labelling (two runs through the cassette decorator)

/** The labeller's interpreter: any answer is stored; validity is the labeller's (BR-U5b-29), not the judge's. */
function interpretLabelAnswer(response: { readonly model: string }): Interpretation {
  return { outcome: { kind: 'valid' }, verdict: null, resolvedModel: response.model };
}

export interface LabelOutcome {
  readonly labels: readonly ReconciledLabel[];
  /** Provider calls made or replayed (one per answer, re-asks included). */
  readonly calls: number;
  /** Prompts sent (record) or keyed (replay), in call order; for the context-exclusion check. */
  readonly prompts: readonly string[];
}

export type LabelResult =
  | ({ readonly ok: true } & LabelOutcome)
  | { readonly ok: false; readonly code: string; readonly detail: string };

const REASK_HEADER = '## Your previous answer was invalid';

export async function labelItems(items: readonly LabelItem[], config: LabellerConfig, prompts: ReadonlyMap<ItemKind, LabellerPrompt>): Promise<LabelResult> {
  const pinned = checkLabellerModel(config.model);
  if (!pinned.ok) return pinned;
  const cassette = new CassetteLLMProvider(config.provider, {
    mode: config.mode, dir: config.cassetteDir, interpret: interpretLabelAnswer,
    knownSecrets: config.knownSecrets ?? knownSecretsOf(process.env),
    ...(config.now !== undefined && { now: config.now }),
  });
  const options = { model: config.model, maxTokens: config.maxTokens ?? LABELLER_MAX_TOKENS, temperature: LABELLER_TEMPERATURE };
  const sent: string[] = [];
  let calls = 0;
  const runsByItem = new Map<string, LabelRun[]>();
  const order1 = shuffle(items, createRng(config.permutationSeed));
  for (const runIndex of [0, 1] as const) {
    for (const item of runIndex === 0 ? items : order1) {
      const prompt = prompts.get(item.kind);
      if (prompt === undefined) return { ok: false, code: LABELLER_PROMPT_INVALID, detail: `no prompt for ${item.kind}` };
      const permutationSeed = runIndex === 1 ? itemPermutationSeed(config.permutationSeed, item.itemId) : undefined;
      const shown = presentation(prompt, permutationSeed);
      const call = {
        runIndex, repetition: 0, functionId: `label:${item.kind}:${item.itemId}`,
        ...(item.unitId !== undefined && { unitId: item.unitId }), systemPrompt: prompt.persona, responseSchema: LABEL_SCHEMA_TEXT,
      };
      let text = renderPrompt(prompt, item, shown);
      let run: LabelRun | null = null;
      for (const attempt of [1, 2] as const) {
        sent.push(text);
        calls += 1;
        const r = await cassette.judge(text, options, call);
        if (r.kind === 'stop') return { ok: false, code: r.stop === 'CASSETTE_MISS' ? 'CASSETTE_MISS' : LABELLER_STOPPED, detail: r.message };
        const parsed = r.outcome.kind === 'valid' ? parseAnswer(r.entry.response, shown) : { ok: false as const, reason: `provider outcome ${r.outcome.cause}` };
        const reason = parsed.ok ? validateAnswer(prompt, parsed.answer) : parsed.reason;
        const common = { runIndex, cassetteKey: r.key, attempts: attempt, ...(permutationSeed !== undefined && { permutationSeed }) };
        if (parsed.ok && reason === null) {
          const a = parsed.answer;
          run = { ...common, label: a.label as AnyLabel, rationale: a.rationale, ...(a.rootCause !== undefined && { rootCause: a.rootCause }), ...(a.note !== undefined && { note: a.note }) };
          break;
        }
        run = { ...common, label: null, rationale: parsed.ok ? parsed.answer.rationale : '', invalidReason: reason ?? 'invalid' };
        text = `${renderPrompt(prompt, item, shown)}\n\n${REASK_HEADER}\n${reason ?? 'invalid'}. Answer again with one valid JSON object.`;
      }
      if (run === null) return { ok: false, code: LABELLER_STOPPED, detail: 'no run outcome' };
      runsByItem.set(item.itemId, [...(runsByItem.get(item.itemId) ?? []), run]);
    }
  }
  const labels: ReconciledLabel[] = [];
  for (const item of items) {
    const prompt = prompts.get(item.kind);
    const runs = runsByItem.get(item.itemId) ?? [];
    const r0 = runs.find((r) => r.runIndex === 0);
    const r1 = runs.find((r) => r.runIndex === 1);
    if (prompt === undefined || r0 === undefined || r1 === undefined) return { ok: false, code: LABELLER_STOPPED, detail: `item ${item.itemId} lacks a run` };
    labels.push(reconcile(item, prompt, [r0, r1]));
  }
  return { ok: true, labels, calls, prompts: sent };
}

// ---------------------------------------------------------------------------------------------
// Plan file and CLI (BR-U5b-34, 44, 73)

export interface LabelPlanStratum {
  readonly population: Population;
  readonly stratum: string;
  readonly size: number;
  readonly cap: number | null;
}
/** The labelling input: registered seed and budget, the stratum sizes and the sampled items (contexts built). */
export interface LabelPlanFile {
  readonly version: 1;
  readonly permutationSeed: number;
  readonly budgetCalls: number;
  readonly strata: readonly LabelPlanStratum[];
  readonly items: readonly LabelItem[];
}

export function checkLabelPlan(v: unknown): string[] {
  const p = v as Partial<LabelPlanFile> | null;
  const errs: string[] = [];
  if (p === null || typeof p !== 'object') return ['plan is not an object'];
  if (p.version !== 1) errs.push('version must be 1');
  if (typeof p.permutationSeed !== 'number' || !Number.isSafeInteger(p.permutationSeed)) errs.push('permutationSeed must be an integer');
  if (typeof p.budgetCalls !== 'number' || p.budgetCalls < 0) errs.push('budgetCalls must be a non-negative number');
  if (!Array.isArray(p.strata)) errs.push('strata must be a list');
  if (!Array.isArray(p.items)) errs.push('items must be a list');
  else if ((p.items as readonly Partial<LabelItem>[]).some((i) => typeof i.itemId !== 'string' || typeof i.context !== 'string')) errs.push('every item needs itemId and context');
  return errs;
}

/** `--estimate`: the plan's call count under its registered budget (BR-U5b-34). */
export function estimatePlan(plan: LabelPlanFile): { exitCode: 0 | 1; line: string } {
  const count = (pop: Population): number => plan.items.filter((i) => i.population === pop).length;
  const sampled = plan.strata.filter((s): s is LabelPlanStratum & { population: SampledPopulation } => s.population === 'P2' || s.population === 'P3' || s.population === 'P4');
  return estimateExit(allocateBudget({ budgetCalls: plan.budgetCalls, p1: count('P1'), missedSeeds: count('MS'), strata: sampled }));
}

export const LABEL_USAGE = [
  'usage: npx tsx scripts/llm-label-cli.ts --plan <label-plan.json> --estimate',
  '       npx tsx scripts/llm-label-cli.ts --plan <label-plan.json> --mode record|replay --cassette-dir <dir> --model <pinned id>',
  '                                        [--provider gemini|mock] --out <labels.json>',
  '       npx tsx scripts/llm-label-cli.ts --allocate-audit --plan <file> --labels <labels.json> --plan-id <id> --seed <n> --out <dir>',
  '       npx tsx scripts/llm-label-cli.ts --agreement --plan <file> --labels <labels.json> --model <pinned id> [--allocation <file>',
  '                                        --audit audit/<plan-id>.json] [--judge-runs <dir>[,<dir>...]] [--judge-verdicts <file>]',
  '                                        [--judge-cassettes <dir>] --out <labelling.json>',
  '       npx tsx scripts/llm-label-cli.ts --self-test',
  '',
].join('\n');

export interface LabelMainIo {
  out(text: string): void;
  err(text: string): void;
  writeFile(path: string, text: string): void;
}
export interface LabelMainDeps {
  /** Builds the live provider for `--provider gemini` (record mode only; never constructed in tests). */
  readonly gemini?: (model: string) => LLMProvider;
  readonly mock?: () => LLMProvider;
}

function parseArgs(argv: readonly string[]): Map<string, string> | string {
  const flags = new Set(['--estimate', '--self-test', '--help', '--allocate-audit', '--agreement']);
  const valued = new Set(['--plan', '--mode', '--cassette-dir', '--model', '--provider', '--out', '--labels', '--plan-id', '--seed', '--allocation', '--audit', '--judge-verdicts', '--judge-runs', '--judge-cassettes']);
  const out = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i] ?? '';
    if (flags.has(a)) {
      out.set(a.slice(2), 'true');
      continue;
    }
    if (!valued.has(a)) return `unknown argument ${a}`;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) return `${a} needs a value`;
    out.set(a.slice(2), v);
    i += 1;
  }
  return out;
}

export async function main(argv: readonly string[], repoRoot: string, io: LabelMainIo, deps: LabelMainDeps = {}): Promise<number> {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    io.err(`${args}\n${LABEL_USAGE}`);
    return 2;
  }
  if (args.has('help')) {
    io.out(LABEL_USAGE);
    return 0;
  }
  if (args.has('self-test')) {
    // Known-bad case: a configuration without a pinned model id must be refused (exit 1).
    const c = checkLabellerModel('');
    io.err(`self-test: ${c.ok ? 'unexpectedly accepted an unpinned model' : c.detail}\n`);
    return 1;
  }
  const planPath = args.get('plan');
  if (planPath === undefined) {
    io.err(`--plan is required\n${LABEL_USAGE}`);
    return 2;
  }
  let plan: LabelPlanFile;
  try {
    plan = JSON.parse(readFileSync(resolve(repoRoot, planPath), 'utf8')) as LabelPlanFile;
  } catch (e) {
    io.err(`input error: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const errs = checkLabelPlan(plan);
  if (errs.length > 0) {
    io.err(`${LABELLER_PLAN_INVALID}: ${errs.join('; ')}\n`);
    return 1;
  }
  if (args.has('allocate-audit')) return allocateAuditMain(args, repoRoot, io, plan);
  if (args.has('agreement')) return agreementMain(args, repoRoot, io, plan);
  if (args.has('estimate')) {
    const e = estimatePlan(plan);
    if (e.exitCode === 0) io.out(`${e.line}\n`);
    else io.err(`${e.line}\n`);
    return e.exitCode;
  }
  const mode = args.get('mode');
  if (mode !== 'record' && mode !== 'replay') {
    io.err(`--mode record or --mode replay is required (BR-U5b-44)\n${LABEL_USAGE}`);
    return 2;
  }
  const cassetteDir = args.get('cassette-dir');
  const out = args.get('out');
  if (cassetteDir === undefined || out === undefined) {
    io.err(`--cassette-dir and --out are required\n${LABEL_USAGE}`);
    return 2;
  }
  const model = args.get('model') ?? '';
  const pinned = checkLabellerModel(model);
  if (!pinned.ok) {
    io.err(`${pinned.detail}\n`);
    return 1;
  }
  const estimate = estimatePlan(plan);
  if (estimate.exitCode !== 0) {
    io.err(`${estimate.line}\n`);
    return 1;
  }
  const providerName = args.get('provider') ?? 'gemini';
  const disabled: LLMProvider = {
    name: 'disabled',
    describe: () => ({ provider: providerName === 'mock' ? 'mock' : 'gemini', model }),
    evaluate: () => Promise.reject(new Error('replay mode: the provider is disabled')),
  };
  let provider: LLMProvider = disabled;
  if (mode === 'record') {
    const made = providerName === 'mock' ? deps.mock?.() : providerName === 'gemini' ? deps.gemini?.(model) : undefined;
    if (made === undefined) {
      io.err(`--provider ${providerName} is not available in record mode\n`);
      return 2;
    }
    provider = made;
  }
  const prompts = loadLabellerPrompts(repoRoot);
  if (!prompts.ok) {
    io.err(`${prompts.detail}\n`);
    return 1;
  }
  const r = await labelItems(plan.items, {
    provider, model, runs: 2, mode, cassetteDir: resolve(repoRoot, cassetteDir), permutationSeed: plan.permutationSeed,
    budgetCalls: plan.budgetCalls,
  }, prompts.prompts);
  if (!r.ok) {
    io.err(`${r.code}: ${r.detail}\n`);
    return 1;
  }
  io.writeFile(resolve(repoRoot, out), `${JSON.stringify(r.labels, null, 2)}\n`);
  io.out(`labelled ${String(r.labels.length)} items in ${String(r.calls)} calls (${mode})\n`);
  return 0;
}

// ---------------------------------------------------------------------------------------------
// Audit allocation and blinding (BR-U5b-41, 42; Docs/matching-rule.md §8)

export const AUDIT_TOTAL = 30;
export const AUDIT_FLOOR = 3;
export const AUDIT_MODIFIED = 'AUDIT_MODIFIED';
export const AUDIT_INVALID = 'AUDIT_INVALID';

export interface AuditStratum {
  readonly kind: ItemKind;
  readonly label: string;
  readonly size: number;
  readonly allocated: number;
  readonly samplingFraction: number;
}
export interface AuditAllocation {
  readonly seed: number;
  readonly total: number;
  readonly strata: readonly AuditStratum[];
  /** Allocated item ids, per stratum in round-robin order. */
  readonly itemIds: readonly string[];
}
export interface AuditRecord {
  readonly itemId: string;
  readonly label: string;
  readonly rootCause?: RootCauseCode;
  readonly note?: string;
  readonly recordedAt: string;
}
/** `audit/<plan-id>.json`: the author's labels, written before any comparison. */
export interface AuditFile {
  readonly version: 1;
  readonly planId: string;
  readonly records: readonly AuditRecord[];
}
/** What the author sees: the labeller's context and the canonical options only (BR-U5b-42). */
export interface AuditViewItem {
  readonly itemId: string;
  readonly kind: ItemKind;
  readonly projectId: string;
  readonly context: string;
  readonly options: readonly string[];
  readonly rootCauses: readonly RootCauseCode[];
}

function stratumName(kind: ItemKind, label: string): string {
  return `${kind}|${label}`;
}

/** Proportional allocation with a floor of `min(3, size)` per non-empty stratum, summing to `total` when possible. */
export function allocateAuditCounts(sizes: ReadonlyMap<string, number>, total: number = AUDIT_TOTAL): Map<string, number> {
  const names = [...sizes.keys()].filter((n) => (sizes.get(n) ?? 0) > 0).sort();
  const n = names.reduce((s, k) => s + (sizes.get(k) ?? 0), 0);
  const target = new Map(names.map((k) => [k, (total * (sizes.get(k) ?? 0)) / Math.max(1, n)]));
  const floor = (k: string): number => Math.min(AUDIT_FLOOR, sizes.get(k) ?? 0);
  const alloc = new Map(names.map((k) => [k, Math.min(sizes.get(k) ?? 0, Math.max(floor(k), Math.floor(target.get(k) ?? 0)))]));
  const sum = (): number => [...alloc.values()].reduce((a, b) => a + b, 0);
  const goal = Math.min(total, n);
  while (sum() > goal) {
    // Take one from the stratum furthest above its target that is still above its floor.
    const cands = names.filter((k) => (alloc.get(k) ?? 0) > floor(k));
    if (cands.length === 0) break;
    cands.sort((a, b) => ((alloc.get(b) ?? 0) - (target.get(b) ?? 0)) - ((alloc.get(a) ?? 0) - (target.get(a) ?? 0)) || (a < b ? -1 : 1));
    const k = cands[0] ?? '';
    alloc.set(k, (alloc.get(k) ?? 0) - 1);
  }
  while (sum() < goal) {
    // Give one to the stratum furthest below its target that has items left.
    const cands = names.filter((k) => (alloc.get(k) ?? 0) < (sizes.get(k) ?? 0));
    if (cands.length === 0) break;
    cands.sort((a, b) => ((target.get(b) ?? 0) - (alloc.get(b) ?? 0)) - ((target.get(a) ?? 0) - (alloc.get(a) ?? 0)) || (a < b ? -1 : 1));
    const k = cands[0] ?? '';
    alloc.set(k, (alloc.get(k) ?? 0) + 1);
  }
  return alloc;
}

/** Round-robin by project in a seeded project order; items within a project in a seeded order. */
export function roundRobinByProject<T extends { readonly itemId: string; readonly projectId: string }>(items: readonly T[], count: number, seed: number): T[] {
  const byProject = new Map<string, T[]>();
  for (const i of [...items].sort((a, b) => (a.itemId < b.itemId ? -1 : 1))) byProject.set(i.projectId, [...(byProject.get(i.projectId) ?? []), i]);
  const rng = createRng(seed);
  const projects = shuffle([...byProject.keys()].sort(), rng);
  const queues = projects.map((p) => shuffle(byProject.get(p) ?? [], rng));
  const out: T[] = [];
  while (out.length < count && queues.some((q) => q.length > 0)) {
    for (const q of queues) {
      const next = q.shift();
      if (next !== undefined && out.length < count) out.push(next);
    }
  }
  return out;
}

/** BR-U5b-41: strata (kind, label) of reconciled labels, `uncertain` excluded. */
export function allocateAudit(labels: readonly ReconciledLabel[], seed: number, total: number = AUDIT_TOTAL): AuditAllocation {
  const certain = labels.filter((l) => l.label !== 'uncertain');
  const groups = new Map<string, ReconciledLabel[]>();
  for (const l of certain) groups.set(stratumName(l.kind, l.label), [...(groups.get(stratumName(l.kind, l.label)) ?? []), l]);
  const counts = allocateAuditCounts(new Map([...groups].map(([k, v]) => [k, v.length])), total);
  const strata: AuditStratum[] = [];
  const itemIds: string[] = [];
  for (const name of [...groups.keys()].sort()) {
    const members = groups.get(name) ?? [];
    const allocated = counts.get(name) ?? 0;
    const [kind, label] = [members[0]?.kind ?? 'violation', members[0]?.label ?? ''];
    strata.push({ kind, label, size: members.length, allocated, samplingFraction: members.length === 0 ? 0 : allocated / members.length });
    const stratumSeed = createHash('sha256').update(JSON.stringify([seed, name])).digest().readUInt32BE(0);
    itemIds.push(...roundRobinByProject(members, allocated, stratumSeed).map((m) => m.itemId));
  }
  return { seed, total, strata, itemIds };
}

/** The blinded audit view (BR-U5b-42): context and canonical options; no panel label, rationale or root cause. */
export function auditView(allocation: AuditAllocation, items: readonly LabelItem[], prompts: ReadonlyMap<ItemKind, LabellerPrompt>): AuditViewItem[] {
  const byId = new Map(items.map((i) => [i.itemId, i]));
  return allocation.itemIds.flatMap((id) => {
    const i = byId.get(id);
    const p = i === undefined ? undefined : prompts.get(i.kind);
    if (i === undefined || p === undefined) return [];
    return [{ itemId: i.itemId, kind: i.kind, projectId: i.projectId, context: i.context, options: [...p.options], rootCauses: [...p.rootCauses] }];
  });
}

export interface AuditLock {
  readonly auditSha256: string;
  readonly firstComparedAt: string;
}

/**
 * Hash lock of the audit file: the first comparison records its sha256; a later comparison refuses
 * (`AUDIT_MODIFIED`) when the file changed. Returns the lock to persist on the first run.
 */
export function checkAuditLock(auditBytes: Buffer, lock: AuditLock | undefined, now: string): { ok: true; lock: AuditLock; first: boolean } | { ok: false; code: string; detail: string } {
  const sha = createHash('sha256').update(auditBytes).digest('hex');
  if (lock === undefined) return { ok: true, lock: { auditSha256: sha, firstComparedAt: now }, first: true };
  if (lock.auditSha256 !== sha) {
    return { ok: false, code: AUDIT_MODIFIED, detail: `${AUDIT_MODIFIED}: the audit file changed after the first comparison (${lock.firstComparedAt}); recorded ${lock.auditSha256}, now ${sha}` };
  }
  return { ok: true, lock, first: false };
}

// ---------------------------------------------------------------------------------------------
// Agreement statistics (BR-U5b-43)

export type AgreementComparison = 'run-vs-run' | 'judge-vs-panel' | 'panel-vs-audit' | 'judge-repetition';
export interface AgreementStats {
  readonly comparison: AgreementComparison;
  /** Judge rows: the judge model compared (cross-check rows carry the Gemini id); reliability rows: the function id. */
  readonly scope: string;
  readonly n: number;
  readonly weighted: boolean;
  readonly percentAgreement: number | null;
  readonly ci: readonly [number, number] | null;
  readonly ciMethod: string;
  readonly cohensKappa: number | null;
  readonly gwetAc1: number | null;
  readonly fleissKappa: number | null;
  readonly uncertain: number;
  readonly sameFamily: boolean;
  /** Judge-vs-panel rows (ADR-020 item 7): the P4 source (`e1`, `fixture`, or `all` pooled); `all` elsewhere. */
  readonly source: AgreementSource;
  /** E1 rows split by generator model; `''` otherwise. */
  readonly generatorModel: string;
  /** True only on the registered headline row: judge vs panel on E1 units, judges of another family. */
  readonly headline: boolean;
  /** True when `uncertain` panel labels are kept as a third category instead of being dropped (B3). */
  readonly uncertainAsCategory: boolean;
}

export type AgreementSource = 'all' | 'e1' | 'fixture';

export type { JudgeUnitVerdict } from './lib/judge-verdicts.js';

/** Row context of `pairAgreement` (ADR-020 item 7, B3); defaults: pooled source, no generator, not headline. */
export interface AgreementRowContext {
  readonly source?: AgreementSource;
  readonly generatorModel?: string;
  readonly headline?: boolean;
  readonly uncertainAsCategory?: boolean;
}

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null);

/** Agreement over weighted pairs on a fixed category list (q >= 2). */
export function pairAgreement(
  comparison: AgreementComparison,
  scope: string,
  pairs: readonly { readonly a: string; readonly b: string; readonly w: number }[],
  categories: readonly string[],
  weighted: boolean,
  uncertain: number,
  sameFamilyFlag = false,
  context: AgreementRowContext = {},
): AgreementStats {
  const cats = [...new Set([...categories, ...pairs.flatMap((p) => [p.a, p.b])])];
  if (cats.length < 2) cats.push('__other__');
  const empty = {
    comparison, scope, n: pairs.length, weighted, uncertain, sameFamily: sameFamilyFlag, fleissKappa: null,
    source: context.source ?? 'all', generatorModel: context.generatorModel ?? '', headline: context.headline ?? false,
    uncertainAsCategory: context.uncertainAsCategory ?? false,
  };
  if (pairs.length === 0) return { ...empty, percentAgreement: null, ci: null, ciMethod: 'none', cohensKappa: null, gwetAc1: null };
  const idx = new Map(cats.map((c, i) => [c, i]));
  const table = cats.map(() => cats.map(() => 0));
  for (const p of pairs) {
    const row = table[idx.get(p.a) ?? 0];
    if (row !== undefined) row[idx.get(p.b) ?? 0] = (row[idx.get(p.b) ?? 0] ?? 0) + p.w;
  }
  const total = pairs.reduce((s, p) => s + p.w, 0);
  const agree = pairs.reduce((s, p) => s + (p.a === p.b ? p.w : 0), 0);
  const po = agree / total;
  const k = Math.round(po * pairs.length);
  const ci = wilson(k, pairs.length);
  return {
    // B3 (ADR-020 item 9): Wilson on a weighted proportion ignores the weight variance, so the CI is approximate.
    ...empty, percentAgreement: po, ci: [ci.low, ci.high], ciMethod: weighted ? 'wilson-weighted-approximate' : 'wilson',
    cohensKappa: finite(cohenKappa(table)), gwetAc1: finite(gwetAC1(table)),
  };
}

export interface AgreementInput {
  readonly labels: readonly ReconciledLabel[];
  readonly prompts: ReadonlyMap<ItemKind, LabellerPrompt>;
  readonly labellerModel: string;
  /** Judge verdicts of the P4 units (headline judge and any Phase-5 cross-check). */
  readonly judgeVerdicts?: readonly JudgeUnitVerdict[];
  readonly allocation?: AuditAllocation;
  readonly audit?: AuditFile;
  /** Committed judge cassette entries (reliability across repetition / run samples). */
  readonly judgeEntries?: readonly { readonly functionId: string; readonly unitId?: string; readonly projectId?: string; readonly outcome: { readonly kind: string }; readonly parsedVerdict: { readonly pass: boolean } | null }[];
}

/**
 * `agreement.csv` rows: run vs run (all items; with one model run twice this is order sensitivity, B3), judge vs panel
 * (P4, weighted by 1 / inclusion probability) over judges of another family: the pooled row, one row per source with
 * the E1 row as the registered headline, one row per E1 generator model, and the headline set with `uncertain` kept
 * as a category (ADR-020 items 7, 9); one row per same-family cross-check model, flagged and never a headline; panel
 * vs audit (weighted by 1 / stratum sampling fraction); judge reliability per judge function from cassettes (Fleiss κ
 * over the valid samples of each unit). No labeller-vs-labeller statistic exists.
 */
export function agreementStats(input: AgreementInput): AgreementStats[] {
  const out: AgreementStats[] = [];
  const uncertain = input.labels.filter((l) => l.label === 'uncertain').length;
  // run vs run
  const allOptions = [...new Set([...input.prompts.values()].flatMap((p) => p.options))];
  const rr = input.labels.flatMap((l) => {
    const [a, b] = l.runs;
    return a.label === null || b.label === null ? [] : [{ a: a.label, b: b.label, w: 1 }];
  });
  out.push(pairAgreement('run-vs-run', 'all', rr, allOptions, false, uncertain));
  // judge vs panel
  const p4 = input.labels.filter((l) => l.kind === 'judge-unit');
  const p4Uncertain = p4.filter((l) => l.label === 'uncertain').length;
  const verdicts = input.judgeVerdicts ?? [];
  const pairsFor = (vs: readonly JudgeUnitVerdict[], keepUncertain = false): { a: string; b: string; w: number }[] => vs.flatMap((v) => {
    const l = p4.find((x) => x.projectId === v.projectId && (keepUncertain || x.label !== 'uncertain') && unitMatches(x, v));
    return l === undefined ? [] : [{ a: v.verdict, b: l.label, w: 1 / Math.max(l.inclusionProbability, Number.EPSILON) }];
  });
  const other = verdicts.filter((v) => !sameFamily(input.labellerModel, v.judgeModel));
  const scopeOf = (vs: readonly JudgeUnitVerdict[]): string => [...new Set(vs.map((v) => v.judgeModel))].sort().join('+') || 'none';
  const judgeRow = (vs: readonly JudgeUnitVerdict[], context: AgreementRowContext): AgreementStats =>
    pairAgreement('judge-vs-panel', scopeOf(vs), pairsFor(vs, context.uncertainAsCategory === true), context.uncertainAsCategory === true ? ['pass', 'fail', 'uncertain'] : ['pass', 'fail'], true, p4Uncertain, false, context);
  out.push(judgeRow(other, { source: 'all' }));
  // ADR-020 item 7: per source, the E1 row being the headline (the fixtures are dev material); per E1 generator model.
  const e1 = other.filter((v) => v.source === 'e1');
  for (const source of ['e1', 'fixture'] as const) {
    const vs = other.filter((v) => v.source === source);
    if (vs.length > 0) out.push(judgeRow(vs, { source, headline: source === 'e1' }));
  }
  for (const g of [...new Set(e1.flatMap((v) => (v.generatorModel === undefined ? [] : [v.generatorModel])))].sort()) {
    out.push(judgeRow(e1.filter((v) => v.generatorModel === g), { source: 'e1', generatorModel: g }));
  }
  // B3: the headline set (E1 when present, else pooled) with `uncertain` kept as a category.
  out.push(judgeRow(e1.length > 0 ? e1 : other, { source: e1.length > 0 ? 'e1' : 'all', uncertainAsCategory: true }));
  for (const model of [...new Set(verdicts.filter((v) => sameFamily(input.labellerModel, v.judgeModel)).map((v) => v.judgeModel))].sort()) {
    out.push(pairAgreement('judge-vs-panel', model, pairsFor(verdicts.filter((v) => v.judgeModel === model)), ['pass', 'fail'], true, p4Uncertain, true));
  }
  // panel vs audit
  const fraction = new Map((input.allocation?.strata ?? []).map((s) => [stratumName(s.kind, s.label), s.samplingFraction]));
  const byId = new Map(input.labels.map((l) => [l.itemId, l]));
  const pa = (input.audit?.records ?? []).flatMap((r) => {
    const l = byId.get(r.itemId);
    if (l === undefined || l.label === 'uncertain') return [];
    const f = fraction.get(stratumName(l.kind, l.label)) ?? 1;
    return [{ a: l.label, b: r.label, w: 1 / Math.max(f, Number.EPSILON) }];
  });
  out.push(pairAgreement('panel-vs-audit', 'author', pa, allOptions, true, uncertain));
  // judge reliability from cassettes
  const subjects = new Map<string, boolean[]>();
  for (const e of input.judgeEntries ?? []) {
    if (e.outcome.kind !== 'valid' || e.parsedVerdict === null) continue;
    const k = JSON.stringify([e.functionId, e.projectId ?? '', e.unitId ?? '']);
    subjects.set(k, [...(subjects.get(k) ?? []), e.parsedVerdict.pass]);
  }
  const byFunction = new Map<string, boolean[][]>();
  for (const [k, ratings] of subjects) {
    const fn = (JSON.parse(k) as string[])[0] ?? '';
    byFunction.set(fn, [...(byFunction.get(fn) ?? []), ratings]);
  }
  for (const fn of [...byFunction.keys()].sort()) {
    const all = byFunction.get(fn) ?? [];
    const m = Math.min(...all.map((r) => r.length));
    const usable = all.filter((r) => r.length >= 2).map((r) => r.slice(0, m));
    if (m < 2 || usable.length === 0) continue;
    const counts = usable.map((r) => [r.filter((x) => x).length, r.filter((x) => !x).length]);
    const pBar = counts.reduce((s, [p, f]) => s + ((p ?? 0) * ((p ?? 0) - 1) + (f ?? 0) * ((f ?? 0) - 1)) / (m * (m - 1)), 0) / counts.length;
    out.push({
      comparison: 'judge-repetition', scope: fn, n: usable.length, weighted: false, percentAgreement: pBar, ci: null, ciMethod: 'none',
      cohensKappa: null, gwetAc1: null, fleissKappa: finite(fleissKappa(counts)), uncertain: 0, sameFamily: false,
      source: 'all', generatorModel: '', headline: false, uncertainAsCategory: false,
    });
  }
  return out;
}

/** A judge verdict refers to a P4 label when its unit and function agree (the project is matched by the caller). */
function unitMatches(l: ReconciledLabel, v: JudgeUnitVerdict): boolean {
  return l.unitId === v.unitId && l.functionId === v.functionId;
}

// ---------------------------------------------------------------------------------------------
// Labeller-fed CSV tables (aggregate.ts writes them; domain-entities §10)

export const AGREEMENT_COLUMNS = [
  'comparison', 'scope', 'n', 'weighted', 'percent_agreement', 'ci_low', 'ci_high', 'ci_method', 'cohens_kappa', 'gwet_ac1', 'fleiss_kappa', 'uncertain', 'same_family',
  'source', 'generator_model', 'headline', 'uncertain_as_category',
] as const;
export const AUDIT_ALLOCATION_COLUMNS = ['kind', 'label', 'size', 'allocated', 'sampling_fraction', 'seed'] as const;
export const LABEL_BUDGET_COLUMNS = ['population', 'stratum', 'size', 'cap', 'sampled', 'inclusion_probability', 'uncertain', 'calls'] as const;
export const TAXONOMY_COLUMNS = ['population', 'root_cause', 'count', 'weighted_count', 'source'] as const;

export interface LabellingOutputs {
  readonly plan?: Pick<LabelPlanFile, 'strata'>;
  readonly labels?: readonly ReconciledLabel[];
  readonly fnCauses?: readonly { readonly seedId: string; readonly rootCause: RootCauseCode; readonly source: 'mechanical' }[];
  readonly allocation?: AuditAllocation;
  readonly agreement?: readonly AgreementStats[];
}
export interface Table {
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

const fx = (x: number | null | undefined): string => (x === null || x === undefined || !Number.isFinite(x) ? '' : x.toFixed(6));

export function labellingTables(o: LabellingOutputs): Record<'agreement.csv' | 'audit_allocation.csv' | 'label_budget.csv' | 'fp_fn_taxonomy.csv', Table> {
  const labels = o.labels ?? [];
  const calls = (l: ReconciledLabel): number => l.runs[0].attempts + l.runs[1].attempts;
  const budgetRows = (o.plan?.strata ?? []).map((s) => {
    const members = labels.filter((l) => l.population === s.population && l.stratum === s.stratum);
    return [s.population, s.stratum, String(s.size), s.cap === null ? '' : String(s.cap), String(members.length),
      fx(members[0]?.inclusionProbability ?? null), String(members.filter((l) => l.label === 'uncertain').length),
      String(members.reduce((a, l) => a + calls(l), 0))];
  });
  const tax = new Map<string, { count: number; weighted: number; population: string; rootCause: string; source: string }>();
  const addTax = (population: string, rootCause: string, source: string, w: number): void => {
    const k = JSON.stringify([population, rootCause, source]);
    const e = tax.get(k) ?? { count: 0, weighted: 0, population, rootCause, source };
    e.count += 1;
    e.weighted += w;
    tax.set(k, e);
  };
  for (const l of labels) {
    if (l.rootCause !== undefined && l.label !== 'uncertain' && l.label !== 'TP') addTax(l.population, l.rootCause, 'labeller', 1 / Math.max(l.inclusionProbability, Number.EPSILON));
  }
  for (const c of o.fnCauses ?? []) addTax('MS', c.rootCause, c.source, 1);
  return {
    'agreement.csv': {
      header: AGREEMENT_COLUMNS,
      rows: (o.agreement ?? []).map((a) => [
        a.comparison, a.scope, String(a.n), String(a.weighted), fx(a.percentAgreement), fx(a.ci?.[0]), fx(a.ci?.[1]), a.ciMethod, fx(a.cohensKappa), fx(a.gwetAc1), fx(a.fleissKappa), String(a.uncertain), String(a.sameFamily),
        a.source, a.generatorModel, String(a.headline), String(a.uncertainAsCategory),
      ]),
    },
    'audit_allocation.csv': {
      header: AUDIT_ALLOCATION_COLUMNS,
      rows: (o.allocation?.strata ?? []).map((s) => [s.kind, s.label, String(s.size), String(s.allocated), fx(s.samplingFraction), String(o.allocation?.seed ?? '')]),
    },
    'label_budget.csv': { header: LABEL_BUDGET_COLUMNS, rows: budgetRows },
    'fp_fn_taxonomy.csv': {
      header: TAXONOMY_COLUMNS,
      rows: [...tax.values()].sort((a, b) => (JSON.stringify([a.population, a.rootCause, a.source]) < JSON.stringify([b.population, b.rootCause, b.source]) ? -1 : 1))
        .map((e) => [e.population, e.rootCause, String(e.count), fx(e.weighted), e.source]),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// CLI: audit allocation and agreement (BR-U5b-41..43)

function readJson(repoRoot: string, path: string): unknown {
  return JSON.parse(readFileSync(resolve(repoRoot, path), 'utf8')) as unknown;
}

function allocateAuditMain(args: Map<string, string>, repoRoot: string, io: LabelMainIo, plan: LabelPlanFile): number {
  const labelsPath = args.get('labels');
  const planId = args.get('plan-id');
  const seed = Number(args.get('seed'));
  const out = args.get('out');
  if (labelsPath === undefined || planId === undefined || out === undefined || !Number.isSafeInteger(seed)) {
    io.err(`--labels, --plan-id, an integer --seed and --out are required\n${LABEL_USAGE}`);
    return 2;
  }
  const prompts = loadLabellerPrompts(repoRoot);
  if (!prompts.ok) {
    io.err(`${prompts.detail}\n`);
    return 1;
  }
  const labels = readJson(repoRoot, labelsPath) as ReconciledLabel[];
  const allocation = allocateAudit(labels, seed);
  const view = auditView(allocation, plan.items, prompts.prompts);
  io.writeFile(resolve(repoRoot, out, `${planId}.allocation.json`), `${JSON.stringify(allocation, null, 2)}\n`);
  io.writeFile(resolve(repoRoot, out, `${planId}.view.json`), `${JSON.stringify(view, null, 2)}\n`);
  io.out(`audit allocation: ${String(allocation.itemIds.length)} items in ${String(allocation.strata.length)} strata\n`);
  return 0;
}

/**
 * The P4 judge verdicts of `--judge-runs` (derived from the stored runs, ADR-020 item 7) and `--judge-verdicts` (a
 * hand-supplied file, refused when any verdict lacks `source`: the E1 headline row needs it); `undefined` when
 * neither flag is given, a refusal message otherwise.
 */
function judgeVerdictsOf(args: Map<string, string>, repoRoot: string): JudgeUnitVerdict[] | string | undefined {
  const runs = args.get('judge-runs');
  const file = args.get('judge-verdicts');
  if (runs === undefined && file === undefined) return undefined;
  const out: JudgeUnitVerdict[] = [];
  for (const dir of (runs ?? '').split(',').filter((d) => d !== '')) {
    const { records, reports } = loadRunDir(resolve(repoRoot, dir), 'LABEL_JUDGE_RUNS_INVALID');
    out.push(...judgeVerdictsFromRuns(records, reports));
  }
  if (file !== undefined) {
    const given = readJson(repoRoot, file) as JudgeUnitVerdict[];
    const missing = missingSource(given);
    if (missing.length > 0) {
      return `LABEL_VERDICT_SOURCE_MISSING: ${file}: ${String(missing.length)} verdict(s) without source (first index ${String(missing[0])}); derive them with --judge-runs (ADR-020 item 7)`;
    }
    out.push(...given);
  }
  return out;
}

function agreementMain(args: Map<string, string>, repoRoot: string, io: LabelMainIo, plan: LabelPlanFile): number {
  const labelsPath = args.get('labels');
  const out = args.get('out');
  const model = args.get('model') ?? '';
  if (labelsPath === undefined || out === undefined) {
    io.err(`--labels and --out are required\n${LABEL_USAGE}`);
    return 2;
  }
  const pinned = checkLabellerModel(model);
  if (!pinned.ok) {
    io.err(`${pinned.detail}\n`);
    return 1;
  }
  const prompts = loadLabellerPrompts(repoRoot);
  if (!prompts.ok) {
    io.err(`${prompts.detail}\n`);
    return 1;
  }
  const labels = readJson(repoRoot, labelsPath) as ReconciledLabel[];
  const allocationPath = args.get('allocation');
  const auditPath = args.get('audit');
  const allocation = allocationPath === undefined ? undefined : readJson(repoRoot, allocationPath) as AuditAllocation;
  let audit: AuditFile | undefined;
  if (auditPath !== undefined) {
    const abs = resolve(repoRoot, auditPath);
    const bytes = readFileSync(abs);
    const lockPath = `${abs.replace(/\.json$/, '')}.lock.json`;
    const lock = existsSync(lockPath) ? (JSON.parse(readFileSync(lockPath, 'utf8')) as AuditLock) : undefined;
    const checked = checkAuditLock(bytes, lock, new Date().toISOString());
    if (!checked.ok) {
      io.err(`${checked.detail}\n`);
      return 1;
    }
    if (checked.first) io.writeFile(lockPath, `${JSON.stringify(checked.lock, null, 2)}\n`);
    audit = JSON.parse(bytes.toString('utf8')) as AuditFile;
  }
  const verdicts = judgeVerdictsOf(args, repoRoot);
  if (typeof verdicts === 'string') {
    io.err(`${verdicts}\n`);
    return 1;
  }
  const cassettes = args.get('judge-cassettes');
  const judgeEntries = cassettes === undefined ? [] : listCassetteKeys(resolve(repoRoot, cassettes)).flatMap((k) => {
    const e = readCassetteEntry(resolve(repoRoot, cassettes), k);
    return e === null ? [] : [e];
  });
  const agreement = agreementStats({
    labels, prompts: prompts.prompts, labellerModel: model, judgeEntries,
    ...(verdicts !== undefined && { judgeVerdicts: verdicts }),
    ...(allocation !== undefined && { allocation }), ...(audit !== undefined && { audit }),
  });
  const outputs: LabellingOutputs = { plan: { strata: plan.strata }, labels, agreement, ...(allocation !== undefined && { allocation }) };
  io.writeFile(resolve(repoRoot, out), `${JSON.stringify(outputs, null, 2)}\n`);
  io.out(`agreement: ${String(agreement.length)} rows\n`);
  return 0;
}
