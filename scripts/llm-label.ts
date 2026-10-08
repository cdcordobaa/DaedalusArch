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
import { CassetteLLMProvider } from '../src/llm-critic/cassette-provider.js';
import type { Interpretation } from '../src/llm-critic/cassette-provider.js';
import type { LLMProvider } from '../src/shared/interfaces/llm-provider.js';
import type { VCRMode } from '../src/shared/types/llm-config.js';
import { ROOT_CAUSE_CODES } from './lib/matching-rule.js';
import type { RootCauseCode } from './lib/matching-rule.js';
import { allocateBudget, estimateExit } from './lib/label-context.js';
import type { ItemKind, LabelItem, Population, SampledPopulation } from './lib/label-context.js';
import { createRng, shuffle } from './lib/stats.js';
import { knownSecretsOf } from './lib/report-io.js';

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
  const flags = new Set(['--estimate', '--self-test', '--help']);
  const valued = new Set(['--plan', '--mode', '--cassette-dir', '--model', '--provider', '--out']);
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
