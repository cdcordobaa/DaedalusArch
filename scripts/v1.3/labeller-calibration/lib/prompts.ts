/**
 * v1.3 labeller calibration: the two prompt arms, built from OUR frozen procedures with only the task swapped
 * (Docs/v1.3/labeller-calibration-plan.md §4).
 *
 * - **judge** arm: the judge v1 route. Persona `JUDGE_PERSONA`, the frozen v1 template `constructPrompt` (sections
 *   Rule, Rubric, Layer model, Unit, Source, Graph excerpt, Instructions; `PROMPT_INSTRUCTIONS` and the rubric's
 *   out-of-scope line unchanged), the frozen `VERDICT_SCHEMA_TEXT`, the v1 decision rule (`voteUnit`: majority of the valid
 *   runs, fewer than 2 valid runs invalid, a 1-1 split a warning). Source fenced with `fenceFile`, cut at the v1 `codeSnippet` budget.
 * - **labeller** arm: the meaningful labeller. Its `SYSTEM_PROMPT`, its four sections, `QUESTION`, the option letters
 *   and the seeded run-1 permutation (`optionOrder`), `RESPONSE_SCHEMA_TEXT`, `parseAnswer`, `REASK_SUFFIX`, the
 *   comment scrubber, and its reconcile rule (two runs; agree → that label, else `uncertain`).
 *
 * Swapped, and nothing else:
 * - the task text (`tasks.ts`): the judge's rule and rubric, the labeller's definition and the finding's claim;
 * - the language noun in both personas ("TypeScript" → the dataset's language) and the labeller's task noun
 *   ("architectural style" → "design rule", in the persona, the section heading and the question), because both
 *   would otherwise misdescribe the input. `swapOnce` fails if a frozen text no longer contains the noun, so a change
 *   to our persona surfaces here;
 * - the labeller's excerpt is the whole unit (numbered, comments removed) instead of ±15 lines around a finding line,
 *   because the datasets label whole classes and methods; both arms cut at the same character budget.
 * The layer model is `(none)` and the graph excerpt is the v1 empty excerpt: the datasets give neither.
 */
import { voteUnit } from '../../../../src/llm-critic/aggregation.js';
import type { UnitRun } from '../../../../src/llm-critic/aggregation.js';
import { constructPrompt } from '../../../../src/llm-critic/context-assembler.js';
import { CHARS_PER_TOKEN, JUDGE_PERSONA, RUNS_PER_EVALUATION, JUDGE_TOKEN_BUDGET, TRUNCATION_MARKER } from '../../../../src/llm-critic/frozen.js';
import { EMPTY_EXCERPT, fenceFile } from '../../../../src/llm-critic/source-context.js';
import { VERDICT_SCHEMA_TEXT } from '../../../../src/llm-critic/verdict-schema.js';
import type { ContextPacket } from '../../../../src/llm-critic/types.js';
import type { JudgeUnitKind } from '../../../../src/shared/types/enums.js';
import { stripComments } from '../../lib/labelling/excerpt-scrub.js';
import {
  LETTERS, QUESTION, REASK_SUFFIX, RESPONSE_SCHEMA_TEXT, SYSTEM_PROMPT, optionOrder, parseAnswer,
} from '../../lib/labelling/meaningful-prompt.js';
import type { MeaningfulLabel } from '../../lib/labelling/meaningful-prompt.js';
import type { Arm, Binary, RaterId, ResolvedItem } from './types.js';
import { taskOf } from './tasks.js';

/** The v1 code-snippet budget in characters, used by both arms. */
export const CODE_BUDGET_CHARS = JUDGE_TOKEN_BUDGET.codeSnippet * CHARS_PER_TOKEN;
/**
 * Runs per item. Judge: Claude 3 (the v1 `RUNS_PER_EVALUATION`, decided by `voteUnit`); Gemini 1 (as the v2.2 CHECK-2
 * second-vendor rater, decided by its one valid run). Labeller: 2 for both (its own rule).
 */
export function runsFor(arm: Arm, rater: RaterId): number {
  if (arm === 'labeller') return 2;
  return rater === 'claude' || rater === 'fake-claude' ? RUNS_PER_EVALUATION : 1;
}

const LANGUAGE_NOUN: Readonly<Record<ResolvedItem['language'], string>> = Object.freeze({ java: 'Java', javascript: 'JavaScript' });

/** Replaces the single occurrence of `from` in `text`; throws when it is absent or repeated. */
export function swapOnce(text: string, from: string, to: string): string {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error(`frozen text drifted: expected exactly one '${from}', found ${String(parts.length - 1)}`);
  return parts.join(to);
}

export function cutToBudget(text: string, maxChars = CODE_BUDGET_CHARS): { text: string; truncated: boolean } {
  return text.length <= maxChars ? { text, truncated: false } : { text: `${text.slice(0, maxChars)}\n${TRUNCATION_MARKER}`, truncated: true };
}

// ── Judge arm ───────────────────────────────────────────────────────────────

export function judgePersona(language: ResolvedItem['language']): string {
  return swapOnce(JUDGE_PERSONA, 'TypeScript projects', `${LANGUAGE_NOUN[language]} projects`);
}

export function judgePrompt(item: ResolvedItem): string {
  const t = taskOf(item.task);
  const body = cutToBudget(item.code).text;
  const packet: ContextPacket = {
    rule: t.rule,
    rubric: { pass: t.pass, fail: t.fail, evidenceRequired: t.evidenceRequired },
    layerModel: '(none)',
    unitId: `${item.displayPath}#${item.unitName}`,
    // The v1 template prints the kind verbatim and branches only on 'module'; 'method' is shown as such.
    unitKind: item.unitKind as JudgeUnitKind,
    unitLayer: '(none)',
    unitFiles: [item.displayPath],
    source: fenceFile(item.displayPath, body),
    incoming: [], outgoing: [],
    apgSubgraph: EMPTY_EXCERPT,
  };
  return constructPrompt(packet);
}

export type JudgeRun = { readonly valid: true; readonly pass: boolean; readonly confidence: number } | { readonly valid: false; readonly why: string };

/** Reads one verdict: the schema's `pass` (boolean) and `confidence` (0..1) are required; a fenced block is tolerated. */
export function parseJudgeVerdict(text: string): JudgeRun {
  const m = /\{[\s\S]*\}/.exec(text);
  if (m === null) return { valid: false, why: 'no JSON object' };
  let v: unknown;
  try { v = JSON.parse(m[0]); } catch { return { valid: false, why: 'malformed JSON' }; }
  if (typeof v !== 'object' || v === null) return { valid: false, why: 'not an object' };
  const o = v as Record<string, unknown>;
  if (typeof o.pass !== 'boolean') return { valid: false, why: 'pass is not a boolean' };
  const c = typeof o.confidence === 'number' && o.confidence >= 0 && o.confidence <= 1 ? o.confidence : null;
  if (c === null) return { valid: false, why: 'confidence missing or out of range' };
  return { valid: true, pass: o.pass, confidence: c };
}

/**
 * One run (the Gemini judge): that run's verdict, or invalid. Several runs (the Claude judge): the v1 decision rule, by
 * the judge's own `voteUnit`: majority of the valid runs; fewer than 2 valid runs is
 * invalid; a 1-1 split is a warning. Invalid and warning units carry no binary label (they are counted).
 */
export function judgeMajority(runs: readonly JudgeRun[]): { label: Binary | null; raw: 'fail' | 'pass' | 'warning' | 'invalid'; confidence?: number } {
  if (runs.length === 1) {
    const r = runs[0] as JudgeRun;
    return r.valid ? { label: r.pass ? 'pass' : 'fail', raw: r.pass ? 'pass' : 'fail', confidence: r.confidence } : { label: null, raw: 'invalid' };
  }
  const unitRuns: UnitRun[] = runs.map((r, runIndex) => (r.valid
    ? { runIndex, outcome: { kind: 'valid' }, verdict: { pass: r.pass, confidence: r.confidence, reasoning: '', evidence: [], violations: [] } }
    : { runIndex, outcome: { kind: 'invalid', cause: 'PARSE_FAILURE' }, verdict: null }));
  const v = voteUnit(unitRuns);
  if (v.status === 'invalid') return { label: null, raw: 'invalid' };
  if (v.verdict === 'warning') return { label: null, raw: 'warning' };
  return { label: v.verdict, raw: v.verdict, confidence: v.confidence };
}

// ── Labeller arm ────────────────────────────────────────────────────────────

export function labellerSystem(language: ResolvedItem['language']): string {
  const lang = swapOnce(SYSTEM_PROMPT, 'a TypeScript code base', `a ${LANGUAGE_NOUN[language]} code base`);
  const task = swapOnce(lang, 'against an architectural style', 'against a design rule');
  return swapOnce(task, 'the style definition', 'the rule definition');
}

export const LABELLER_QUESTION = swapOnce(QUESTION, 'this style', 'this rule');

/** The whole unit, comments removed, numbered from the unit's first line in its file. */
export function numberedUnit(code: string, firstLine = 1): string {
  const lines = cutToBudget(stripComments(code)).text.split('\n');
  return lines.map((l, i) => `${String(firstLine + i).padStart(5)} | ${l}`).join('\n');
}

export function claim(item: ResolvedItem): string {
  const t = taskOf(item.task);
  const kind = item.unitKind === 'class' ? 'Class' : 'Method';
  return `${kind} ${item.unitName} in ${item.displayPath} is reported to show ${t.name}.`;
}

export function labellerPrompt(item: ResolvedItem, order: readonly MeaningfulLabel[]): string {
  const t = taskOf(item.task);
  const fence = item.language === 'java' ? 'java' : 'js';
  return [
    '## Design rule',
    t.definition,
    '',
    '## Code excerpt',
    `File: ${item.displayPath}`,
    `\`\`\`${fence}`,
    numberedUnit(item.code, item.location?.startLine ?? 1),
    '```',
    '',
    '## Reported finding',
    claim(item),
    '',
    '## Question',
    LABELLER_QUESTION,
    ...order.map((o, i) => `${LETTERS[i] ?? '?'}. ${o}`),
    '',
    'Reply with JSON only: {"choice": "<letter>", "reason": "<one sentence>"}',
  ].join('\n');
}

export function labellerOrder(runIndex: 0 | 1, seed: number, itemId: string): MeaningfulLabel[] {
  return optionOrder(runIndex, seed, itemId);
}

export function labellerToBinary(l: MeaningfulLabel | null): Binary | null {
  return l === 'yes' ? 'fail' : l === 'no' ? 'pass' : null;
}

export { REASK_SUFFIX, RESPONSE_SCHEMA_TEXT, VERDICT_SCHEMA_TEXT, parseAnswer };

// ── One request per (arm, run) ──────────────────────────────────────────────

export interface CallSpec {
  readonly arm: Arm;
  readonly runIndex: number;
  readonly system: string;
  readonly prompt: string;
  readonly schema: string;
  /** Labeller option order of this run (absent for the judge). */
  readonly order?: readonly MeaningfulLabel[];
}

export function callsFor(item: ResolvedItem, arm: Arm, rater: RaterId, seed: number): CallSpec[] {
  if (arm === 'judge') {
    const system = judgePersona(item.language);
    const prompt = judgePrompt(item);
    return Array.from({ length: runsFor(arm, rater) }, (_, runIndex) => ({ arm, runIndex, system, prompt, schema: VERDICT_SCHEMA_TEXT }));
  }
  const system = labellerSystem(item.language);
  return ([0, 1] as const).map((runIndex) => {
    const order = labellerOrder(runIndex, seed, item.id);
    return { arm, runIndex, system, prompt: labellerPrompt(item, order), schema: RESPONSE_SCHEMA_TEXT, order };
  });
}
