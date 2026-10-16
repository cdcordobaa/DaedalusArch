/**
 * Handlers of the neural MCP tools (v1.3; Docs/v1.3/neural-arm-agent-tools.md):
 *
 * - `review_unit`: the judge on demand over one file or module unit, with a grounded, structured verdict.
 * - `explain_and_fix`: one actionable message for a symbolic finding: the deterministic fix hint (when the build has
 *   one), the judge's filter-and-explain answer (grounded, or dropped) and the code excerpt.
 *
 * Both are advisory by construction (`blocking: false`), never fail the call for a provider problem (the status says
 * what happened) and answer within their wait budget: a slow judge gives `pending` with a job id to poll.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { ParsedSpec } from '../shared/types/spec.js';
import type { CriticVerdict } from '../llm-critic/types.js';
import { renderLayerModel } from '../llm-critic/context-assembler.js';
import { FE_REVISION, outcomeOf, renderFilterExplainPrompt, RULE_INTENTS } from '../llm-critic/filter-explain.js';
import type { FilterExplainOutcome, ShownFile, SymbolicFinding } from '../llm-critic/filter-explain.js';
import type { EnsembleVerdict } from '../llm-critic/ensemble.js';
import { normalisePath, resolveLayer } from './layer-resolver.js';
import { buildReviewPrompt, groundVerdict, judgeProfileOf, reviewCacheKey, DEFAULT_REVIEW_JUDGE_VERSION } from './neural-review.js';
import type { GroundedCitation, ReviewFile, ReviewFunctionId, ReviewJudgeVersion, VerdictGrounding } from './neural-review.js';
import type { JobView, JudgeAnswer, ExplainAnswer, NeuralService } from './neural-service.js';

// ── Shared ───────────────────────────────────────────────────────────────────────────────

/** Expected wall-clock cost of one judge call per provider (Docs/v1.3/neural-arm-agent-tools.md §Latency). */
export const EXPECTED_LATENCY: Readonly<Record<string, string>> = Object.freeze({
  'cache': '< 5 ms (same content, same judge version)',
  'mock': '< 50 ms',
  'claude-cli': '20-90 s (Opus, effort high; first call adds the isolation pre-flight, about 10-30 s)',
  'agy': '30-240 s (print timeout 240 s)',
  'gemini': '5-40 s',
  'ensemble': 'the slowest rater (raters run in parallel)',
});

export function expectedLatencyOf(provider: string | undefined): string {
  return provider === undefined ? 'n/a' : EXPECTED_LATENCY[provider] ?? 'unknown';
}

/** How the neural arm is switched on, quoted in every `not-configured` answer. */
export const NEURAL_ENABLE_HINT =
  'Start the MCP server with --neural claude-cli (the isolated judge route), or --neural ensemble --ensemble-raters claude-cli,agy[,gemini-api] --ensemble-rule fail-if-both|fail-if-either. See Docs/v1.3/neural-arm-agent-tools.md.';

/** Most files one review reads (a module unit). */
export const REVIEW_MAX_FILES = 12;
const SOURCE_RE = /\.(?:ts|tsx|mts|cts)$/;

export interface JobInfo {
  readonly jobId: string;
  readonly state: 'done' | 'pending' | 'unknown';
  readonly fromCache: boolean;
  readonly elapsedMs: number;
  readonly retryAfterMs?: number;
}

function jobInfo<T>(view: JobView<T>): JobInfo {
  if (view.state === 'done') return { jobId: view.jobId, state: 'done', fromCache: view.fromCache, elapsedMs: view.elapsedMs };
  if (view.state === 'pending') return { jobId: view.jobId, state: 'pending', fromCache: false, elapsedMs: view.elapsedMs, retryAfterMs: view.retryAfterMs };
  return { jobId: view.jobId, state: 'unknown', fromCache: false, elapsedMs: 0 };
}

/** Reads a project file, confined to the real project root (symlinks that leave the root are refused). */
export function readProjectFile(root: string, rel: string): { readonly ok: true; readonly content: string } | { readonly ok: false; readonly message: string } {
  try {
    const rootReal = fs.realpathSync(root);
    const real = fs.realpathSync(path.resolve(rootReal, rel));
    if (real !== rootReal && !real.startsWith(rootReal + path.sep)) return { ok: false, message: `${rel} resolves outside the project root` };
    if (!fs.statSync(real).isFile()) return { ok: false, message: `${rel} is not a file` };
    return { ok: true, content: fs.readFileSync(real, 'utf8') };
  } catch {
    return { ok: false, message: `cannot read ${rel}` };
  }
}

/** The source files of a project-relative directory (sorted, no declarations, tests or node_modules), real-path confined. */
export function sourceFilesUnder(root: string, relDir: string, limit = REVIEW_MAX_FILES + 1): string[] {
  const rootReal = fs.realpathSync(root);
  const start = fs.realpathSync(path.resolve(rootReal, relDir));
  if (start !== rootReal && !start.startsWith(rootReal + path.sep)) return [];
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      if (out.length >= limit) return;
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else if (entry.isFile() && SOURCE_RE.test(entry.name) && !/\.d\.ts$|\.(?:test|spec)\.tsx?$/.test(entry.name)) out.push(normalisePath(path.relative(rootReal, abs)));
    }
  };
  walk(start);
  return out;
}

function isDirectory(root: string, rel: string): boolean {
  try {
    return fs.statSync(path.resolve(root, rel)).isDirectory();
  } catch {
    return false;
  }
}

// ── review_unit ──────────────────────────────────────────────────────────────────────────

export interface ReviewUnitArgs {
  readonly path?: string | undefined;
  readonly paths?: readonly string[] | undefined;
  readonly content?: string | undefined;
  readonly judgeVersion?: ReviewJudgeVersion | undefined;
  readonly function?: ReviewFunctionId | undefined;
  readonly wait?: boolean | undefined;
  readonly waitMs?: number | undefined;
  readonly jobId?: string | undefined;
}

export type ReviewStatus = 'pass' | 'fail' | 'inconclusive' | 'error' | 'pending' | 'not-configured' | 'unavailable';

export interface EnsembleSummary {
  readonly rule: string;
  readonly status: EnsembleVerdict['status'];
  readonly agreement: EnsembleVerdict['agreement'];
  readonly confidence: number;
  readonly validRaters: number;
  readonly totalRaters: number;
  readonly raters: readonly {
    readonly rater: string;
    readonly vendor: string;
    readonly model: string;
    readonly status: string;
    readonly pass?: boolean;
    readonly confidence?: number;
    readonly detail?: string;
  }[];
}

export interface ReviewUnitResult {
  readonly status: ReviewStatus;
  /** Always false: the neural arm advises, the symbolic rules gate. */
  readonly blocking: false;
  readonly tier: 'advisory';
  readonly summary: string;
  readonly judge: {
    readonly version: ReviewJudgeVersion;
    readonly revision?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly expectedLatency: string;
  };
  readonly unit?: {
    readonly id: string;
    readonly kind: string;
    readonly layer: string;
    readonly functionId: ReviewFunctionId;
    readonly files: readonly string[];
    readonly truncated: boolean;
  };
  readonly verdict?: {
    readonly pass: boolean;
    readonly confidence: number;
    readonly reasoning: string;
    readonly evidence: readonly string[];
    readonly violations: readonly { readonly filePath: string; readonly message: string }[];
  };
  readonly grounding?: { readonly grounded: boolean; readonly problems: readonly string[] };
  readonly citations?: readonly GroundedCitation[];
  readonly ensemble?: EnsembleSummary;
  readonly job?: JobInfo;
  readonly error?: { readonly code: string; readonly message: string };
  readonly nextStep: string;
}

/** What the judge task stores per cache key (the prompt-independent part is rebuilt on each answer). */
interface ReviewTaskResult {
  readonly answer: JudgeAnswer;
  readonly shown: readonly ShownFile[];
}

function ensembleSummary(e: EnsembleVerdict): EnsembleSummary {
  return {
    rule: e.rule, status: e.status, agreement: e.agreement, confidence: e.confidence, validRaters: e.validRaters, totalRaters: e.totalRaters,
    raters: e.raters.map((r) => ({
      rater: r.rater, vendor: r.vendor, model: r.model, status: r.status,
      ...(r.status === 'valid' ? { pass: r.verdict.pass, confidence: r.verdict.confidence } : {}),
      ...(r.status === 'invalid' ? { detail: r.cause } : r.status === 'error' ? { detail: `${r.code}: ${r.message}` } : r.status === 'skipped' ? { detail: r.reason } : {}),
    })),
  };
}

function verdictView(v: CriticVerdict): NonNullable<ReviewUnitResult['verdict']> {
  return { pass: v.pass, confidence: v.confidence, reasoning: v.reasoning, evidence: v.evidence, violations: v.violations };
}

/** The answer of a finished judge task as the tool result. */
export function reviewResultOf(
  base: Pick<ReviewUnitResult, 'judge' | 'unit'>,
  task: ReviewTaskResult,
  job: JobInfo,
): ReviewUnitResult {
  const a = task.answer;
  const ensemble = a.status !== 'error' && a.ensemble !== undefined ? { ensemble: ensembleSummary(a.ensemble) } : {};
  if (a.status === 'error') {
    return {
      ...base, status: 'error', blocking: false, tier: 'advisory', job, error: { code: a.code, message: a.message },
      summary: `Judge unavailable (${a.code}); no neural verdict. The symbolic result stands.`,
      nextStep: 'Continue with the symbolic tools; retry review_unit later or check the provider set-up.',
    };
  }
  if (a.status === 'invalid') {
    return {
      ...base, ...ensemble, status: 'inconclusive', blocking: false, tier: 'advisory', job,
      summary: `The judge's answer was invalid (${a.cause}); no verdict.`,
      nextStep: 'Treat the unit as unreviewed; retrying gives the same cached answer unless the code changes.',
    };
  }
  const grounding: VerdictGrounding = groundVerdict(a.verdict, task.shown);
  const verdict = verdictView(a.verdict);
  if (a.verdict.pass) {
    return {
      ...base, ...ensemble, status: 'pass', blocking: false, tier: 'advisory', job, verdict,
      grounding: { grounded: grounding.grounded, problems: grounding.problems }, citations: grounding.citations,
      summary: `PASS (advisory, confidence ${a.verdict.confidence.toFixed(2)}): ${a.verdict.reasoning.slice(0, 200)}`,
      nextStep: 'No semantic issue found in this unit; carry on.',
    };
  }
  if (!grounding.grounded) {
    return {
      ...base, ...ensemble, status: 'inconclusive', blocking: false, tier: 'advisory', job, verdict,
      grounding: { grounded: false, problems: grounding.problems }, citations: grounding.citations,
      summary: `The judge reported a problem but its evidence is not grounded in the shown code (${String(grounding.problems.length)} problem(s)); treat it as unverified.`,
      nextStep: 'Read the cited code yourself before acting; do not change code on an ungrounded verdict alone.',
    };
  }
  const first = a.verdict.violations[0];
  return {
    ...base, ...ensemble, status: 'fail', blocking: false, tier: 'advisory', job, verdict,
    grounding: { grounded: true, problems: [] }, citations: grounding.citations,
    summary: `FAIL (advisory, confidence ${a.verdict.confidence.toFixed(2)}): ${first !== undefined ? `${first.filePath}: ${first.message}` : a.verdict.reasoning.slice(0, 200)}`,
    nextStep: 'Fix the cited lines (move the misplaced responsibility to its layer, or call the single owner of the rule), then re-run check_file and review_unit.',
  };
}

export interface NeuralToolContext {
  readonly neural?: NeuralService | undefined;
  readonly defaultProjectPath?: string | undefined;
  readonly toProjectRelative: (p: string) => string;
}

export type NeuralOutcome<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly message: string };

/** `review_unit`: run (or join, or poll) the judge on one unit. */
export async function reviewUnit(ctx: NeuralToolContext, spec: ParsedSpec, args: ReviewUnitArgs): Promise<NeuralOutcome<ReviewUnitResult>> {
  const version = args.judgeVersion ?? DEFAULT_REVIEW_JUDGE_VERSION;
  const profile = judgeProfileOf(version);
  const judge = ctx.neural?.judge;
  const judgeInfo = {
    version,
    ...(profile !== undefined ? { revision: profile.revision } : {}),
    ...(judge !== undefined ? { provider: judge.description.provider, model: judge.description.model } : {}),
    expectedLatency: expectedLatencyOf(judge?.description.provider),
  };
  if (profile === undefined) {
    return {
      ok: true,
      data: {
        status: 'unavailable', blocking: false, tier: 'advisory', judge: judgeInfo,
        summary: `Judge ${version} is not in this build (it is developed on branch v1.3-judge-v22-prep). Use judgeVersion v1 (default) or v2.`,
        nextStep: 'Call review_unit again with judgeVersion v1 or v2.',
      },
    };
  }
  if (ctx.neural === undefined || judge === undefined) {
    return {
      ok: true,
      data: {
        status: 'not-configured', blocking: false, tier: 'advisory', judge: judgeInfo,
        summary: 'The neural arm is off in this server.', nextStep: NEURAL_ENABLE_HINT,
      },
    };
  }

  // Poll an earlier job.
  if (args.jobId !== undefined) {
    const view = await ctx.neural.poll<ReviewTaskResult & { readonly base: Pick<ReviewUnitResult, 'judge' | 'unit'> }>(args.jobId, args.wait === false ? 0 : Math.min(args.waitMs ?? ctx.neural.waitMs, 120_000));
    if (view.state === 'unknown') return { ok: false, message: `Unknown review job ${args.jobId} (the server keeps finished jobs only for a while): call review_unit with the path again; an unchanged unit is answered from the cache.` };
    if (view.state === 'pending') return { ok: true, data: pendingResult({ judge: judgeInfo }, jobInfo(view)) };
    return { ok: true, data: reviewResultOf(view.result.base, view.result, jobInfo(view)) };
  }

  // Resolve the unit's files.
  const requested = [...(args.paths ?? []), ...(args.path !== undefined ? [args.path] : [])].map((p) => ctx.toProjectRelative(p));
  if (requested.length === 0) return { ok: false, message: 'Pass `path` (a file or a directory), `paths` (the files of a module unit) or `jobId`.' };
  const root = ctx.defaultProjectPath;
  const files: ReviewFile[] = [];
  if (args.content !== undefined) {
    if (requested.length !== 1) return { ok: false, message: '`content` reviews one proposed file: pass it with a single `path`.' };
    files.push({ path: requested[0] ?? '', content: args.content });
  } else {
    if (root === undefined) return { ok: false, message: 'No project root: start the server with --project <path>, or pass `content` with a single `path`.' };
    const expanded: string[] = [];
    for (const rel of requested) {
      if (isDirectory(root, rel)) expanded.push(...sourceFilesUnder(root, rel));
      else expanded.push(rel);
    }
    const unique = [...new Set(expanded)];
    if (unique.length === 0) return { ok: false, message: `No TypeScript source under ${requested.join(', ')}.` };
    if (unique.length > REVIEW_MAX_FILES) return { ok: false, message: `A unit holds at most ${String(REVIEW_MAX_FILES)} files; ${requested.join(', ')} has more. Review a smaller directory or list the files with \`paths\`.` };
    for (const rel of unique) {
      const read = readProjectFile(root, rel);
      if (!read.ok) return { ok: false, message: read.message };
      files.push({ path: rel, content: read.content });
    }
  }

  const prompt = buildReviewPrompt({ spec, files, profile, ...(args.function !== undefined ? { functionId: args.function } : {}) });
  const base: Pick<ReviewUnitResult, 'judge' | 'unit'> = {
    judge: judgeInfo,
    unit: { id: prompt.unitId, kind: prompt.unitKind, layer: prompt.layer, functionId: prompt.functionId, files: files.map((f) => f.path).sort(), truncated: prompt.truncated },
  };
  const key = reviewCacheKey({ profile, functionId: prompt.functionId, layerModel: renderLayerModel(spec.layerModel.layers), judgeId: judge.id, files });
  const view = await ctx.neural.run(
    key,
    async () => ({ base, shown: prompt.shown, answer: await judge.verdict({ prompt: prompt.prompt, systemPrompt: prompt.systemPrompt, functionId: prompt.functionId, unitId: prompt.unitId }) }),
    { waitMs: args.wait === false ? 0 : Math.min(args.waitMs ?? ctx.neural.waitMs, 120_000), cacheable: (r) => r.answer.status !== 'error' },
  );
  if (view.state === 'pending') return { ok: true, data: pendingResult(base, jobInfo(view)) };
  if (view.state === 'unknown') return { ok: false, message: 'review job lost' };
  return { ok: true, data: reviewResultOf(base, view.result, jobInfo(view)) };
}

function pendingResult(base: Pick<ReviewUnitResult, 'judge' | 'unit'>, job: JobInfo): ReviewUnitResult {
  return {
    ...base, status: 'pending', blocking: false, tier: 'advisory', job,
    summary: `The judge is running (job ${job.jobId}, ${String(Math.round(job.elapsedMs / 1000))} s so far).`,
    nextStep: `Keep working; call review_unit with {"jobId": "${job.jobId}"} in about ${String(Math.round((job.retryAfterMs ?? 10_000) / 1000))} s.`,
  };
}

// ── explain_and_fix ──────────────────────────────────────────────────────────────────────

/** A deterministic fix hint as `explain_and_fix` reads it (the fix-hints feature, PR #143, has this shape). */
export interface FixHintLike {
  readonly problem?: string;
  readonly fix: { readonly action: string; readonly text: string };
  readonly target?: { readonly layer: string | null; readonly folder: string | null; readonly path?: string };
  readonly basis?: string;
}

/** Builds a fix hint for a finding; wired when the build carries the fix-hints feature (`buildFixHint`). */
export type FixHintSource = (spec: ParsedSpec, finding: { readonly ruleId: string; readonly filePath: string; readonly target?: string; readonly isTypeOnly?: boolean }) => FixHintLike | undefined;

export interface FindingArg {
  readonly ruleId?: string | undefined;
  readonly rule?: string | undefined;
  readonly ruleName?: string | undefined;
  readonly file?: string | undefined;
  readonly filePath?: string | undefined;
  readonly line?: number | undefined;
  readonly message?: string | undefined;
  readonly reason?: string | undefined;
  readonly subject?: string | undefined;
  readonly target?: string | undefined;
  readonly severity?: string | undefined;
  readonly tier?: string | undefined;
  readonly fix?: string | undefined;
  readonly hint?: unknown;
}

export interface ExplainAndFixArgs {
  readonly finding: FindingArg;
  readonly content?: string | undefined;
  readonly wait?: boolean | undefined;
  readonly waitMs?: number | undefined;
  readonly jobId?: string | undefined;
}

export type ExplainStatus = 'explained' | 'disputed' | 'unexplained' | 'pending';

export interface ExplainAndFixResult {
  readonly status: ExplainStatus;
  readonly blocking: false;
  /** The one actionable message: finding, judge explanation, fix, code. */
  readonly message: string;
  readonly finding: { readonly ruleId: string; readonly file: string; readonly line?: number; readonly target?: string; readonly text: string };
  readonly fixHint: { readonly source: 'finding' | 'fix-hints' | 'none'; readonly text?: string; readonly action?: string; readonly targetPath?: string };
  readonly judge: {
    readonly status: 'confirm' | 'dismiss' | 'rejected' | 'invalid' | 'error' | 'not-configured' | 'pending';
    readonly revision: string;
    readonly provider?: string;
    readonly model?: string;
    readonly explanation?: string;
    readonly fix?: string;
    readonly citations?: readonly { readonly filePath: string; readonly startLine: number; readonly endLine: number }[];
    readonly problems?: readonly string[];
    readonly detail?: string;
  };
  readonly excerpt?: { readonly file: string; readonly startLine: number; readonly endLine: number; readonly text: string };
  readonly job?: JobInfo;
}

function isFixHintLike(v: unknown): v is FixHintLike {
  if (typeof v !== 'object' || v === null) return false;
  const fix = (v as { fix?: unknown }).fix;
  return typeof fix === 'object' && fix !== null && typeof (fix as { text?: unknown }).text === 'string';
}

/** Numbered lines around the finding (the reported line marked `>`), or around the first mention of the target. */
export function excerptAround(file: string, content: string, line: number | undefined, needle: string | undefined, radius = 3): NonNullable<ExplainAndFixResult['excerpt']> {
  const lines = content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  let at = line !== undefined && line >= 1 && line <= lines.length ? line : undefined;
  if (at === undefined && needle !== undefined && needle !== '') {
    const i = lines.findIndex((l) => l.includes(needle));
    if (i >= 0) at = i + 1;
  }
  const start = Math.max(1, (at ?? 1) - radius);
  const end = Math.min(lines.length, (at ?? 1) + radius + (at === undefined ? radius : 0));
  const width = String(end).length;
  const text = lines.slice(start - 1, end).map((l, i) => `${start + i === at ? '>' : ' '}${String(start + i).padStart(width, ' ')}| ${l}`).join('\n');
  return { file, startLine: start, endLine: end, text };
}

interface ExplainTaskResult {
  readonly answer: ExplainAnswer;
  readonly shown: readonly ShownFile[];
}

function judgeView(answer: ExplainAnswer, shown: readonly ShownFile[]): { readonly view: Omit<ExplainAndFixResult['judge'], 'revision' | 'provider' | 'model'>; readonly outcome?: FilterExplainOutcome } {
  if (answer.status === 'error') return { view: { status: 'error', detail: `${answer.code}: ${answer.message}` } };
  if (answer.status === 'invalid') return { view: { status: 'invalid', detail: answer.cause } };
  const outcome = outcomeOf(answer.answer, shown);
  if (outcome.status === 'invalid') return { view: { status: 'invalid', detail: outcome.cause }, outcome };
  if (outcome.status === 'rejected') return { view: { status: 'rejected', problems: outcome.grounding.problems }, outcome };
  return {
    view: { status: outcome.status, explanation: outcome.answer.explanation, fix: outcome.answer.fix, citations: outcome.answer.citations },
    outcome,
  };
}

/** The one actionable message (plain text, newest information first). */
export function composeMessage(r: Omit<ExplainAndFixResult, 'message' | 'status' | 'blocking'>): string {
  const head = `[${r.finding.ruleId}] ${r.finding.file}${r.finding.line !== undefined ? `:${String(r.finding.line)}` : ''}: ${r.finding.text}`;
  const lines = [head];
  const j = r.judge;
  if (j.status === 'confirm') lines.push(`Why (judge, grounded): ${j.explanation ?? ''}`);
  else if (j.status === 'dismiss') lines.push(`Judge disputes this finding (grounded): ${j.explanation ?? ''} The symbolic finding still stands; if you agree it is a false positive, leave the code and report it.`);
  else if (j.status === 'rejected') lines.push('Judge explanation dropped: it cited code that was not shown (ungrounded).');
  else if (j.status === 'pending') lines.push('Judge explanation pending; the fix below does not depend on it.');
  const fix = r.fixHint.text ?? (j.status === 'confirm' ? j.fix : undefined);
  if (fix !== undefined && fix !== '') lines.push(`Fix: ${fix}${r.fixHint.targetPath !== undefined ? ` (target: ${r.fixHint.targetPath})` : ''}`);
  if (r.fixHint.source !== 'none' && j.status === 'confirm' && j.fix !== undefined && j.fix !== '' && j.fix !== fix) lines.push(`Judge's fix: ${j.fix}`);
  if (r.excerpt !== undefined) lines.push(`Code (${r.excerpt.file}:${String(r.excerpt.startLine)}-${String(r.excerpt.endLine)}):\n${r.excerpt.text}`);
  lines.push('Then re-run check_file (or check_diff) on the changed files.');
  return lines.join('\n');
}

function statusOf(judge: ExplainAndFixResult['judge']['status']): ExplainStatus {
  return judge === 'confirm' ? 'explained' : judge === 'dismiss' ? 'disputed' : judge === 'pending' ? 'pending' : 'unexplained';
}

export interface ExplainToolContext extends NeuralToolContext {
  readonly fixHints?: FixHintSource | undefined;
}

/** `explain_and_fix`: fix hint + judge explanation + code excerpt for one symbolic finding. */
export async function explainAndFix(ctx: ExplainToolContext, spec: ParsedSpec, args: ExplainAndFixArgs): Promise<NeuralOutcome<ExplainAndFixResult>> {
  const f = args.finding;
  const ruleId = f.ruleId ?? f.rule;
  const rawFile = f.file ?? f.filePath;
  if (ruleId === undefined || rawFile === undefined) return { ok: false, message: 'The finding needs `ruleId` (or `rule`) and `file` (or `filePath`), as check_file, check_diff or evaluate_project report them.' };
  const file = ctx.toProjectRelative(rawFile.split(',')[0]?.trim() ?? rawFile);
  const target = f.target ?? f.subject?.match(/^import "(.+)"$/)?.[1];
  const text = f.reason ?? f.message ?? f.subject ?? RULE_INTENTS[ruleId] ?? ruleId;

  // The code: the proposed content, else the project file (real-path confined).
  const root = ctx.defaultProjectPath;
  let content: string | undefined = args.content;
  if (content === undefined && root !== undefined) {
    const read = readProjectFile(root, file);
    if (read.ok) content = read.content;
  }
  const targetFile = target !== undefined && root !== undefined && /\.(?:ts|tsx)$/.test(target) ? readProjectFile(root, ctx.toProjectRelative(target)) : undefined;
  const files: ShownFile[] = [
    ...(content !== undefined ? [{ path: file, content }] : []),
    ...(targetFile?.ok === true && target !== undefined ? [{ path: ctx.toProjectRelative(target), content: targetFile.content }] : []),
  ];
  const excerpt = content !== undefined ? excerptAround(file, content, f.line, target) : undefined;

  // The deterministic hint: the finding's own (fix-hints on), else the configured source, else the finding's fix text.
  const built = isFixHintLike(f.hint) ? f.hint : ctx.fixHints?.(spec, { ruleId, filePath: file, ...(target !== undefined ? { target } : {}) });
  const fixHint: ExplainAndFixResult['fixHint'] = built !== undefined
    ? { source: 'fix-hints', text: built.fix.text, action: built.fix.action, ...(built.target?.path !== undefined ? { targetPath: built.target.path } : {}) }
    : f.fix !== undefined && f.fix !== ''
      ? { source: 'finding', text: f.fix }
      : { source: 'none' };

  const findingView = { ruleId, file, ...(f.line !== undefined ? { line: f.line } : {}), ...(target !== undefined ? { target } : {}), text };
  const judge = ctx.neural?.judge;
  const judgeBase = { revision: FE_REVISION, ...(judge !== undefined ? { provider: judge.description.provider, model: judge.description.model } : {}) };
  const finish = (j: ExplainAndFixResult['judge'], job?: JobInfo): ExplainAndFixResult => {
    const partial = { finding: findingView, fixHint, judge: j, ...(excerpt !== undefined ? { excerpt } : {}), ...(job !== undefined ? { job } : {}) };
    return { ...partial, status: statusOf(j.status), blocking: false, message: composeMessage(partial) };
  };

  if (ctx.neural === undefined || judge === undefined) {
    return { ok: true, data: finish({ ...judgeBase, status: 'not-configured', detail: NEURAL_ENABLE_HINT }) };
  }
  if (files.length === 0) {
    return { ok: true, data: finish({ ...judgeBase, status: 'error', detail: `cannot read ${file}: pass \`content\` or start the server with --project` }) };
  }

  const symbolic: SymbolicFinding = {
    functionId: ruleId,
    ...(f.ruleName !== undefined ? { ruleName: f.ruleName } : {}),
    type: 'SYMBOLIC_FINDING',
    severity: f.severity ?? 'unknown',
    ...(f.tier !== undefined ? { tier: f.tier } : {}),
    filePath: file,
    message: text,
    ...(target !== undefined ? { target } : {}),
    ...(f.line !== undefined ? { lines: [f.line] } : {}),
  };
  const layers = Object.fromEntries(files.map((s) => [s.path, resolveLayer(spec, s.path)?.layer ?? null]));
  const rendered = renderFilterExplainPrompt({ finding: symbolic, files, layerModel: renderLayerModel(spec.layerModel.layers), fileLayers: layers });
  const key = createHash('sha256').update(`explain_and_fix\u0000${FE_REVISION}\u0000${judge.id}\u0000${rendered.prompt}`).digest('hex');
  const waitMs = args.wait === false ? 0 : Math.min(args.waitMs ?? ctx.neural.waitMs, 120_000);
  const view = args.jobId !== undefined
    ? await ctx.neural.poll<ExplainTaskResult>(args.jobId, waitMs)
    : await ctx.neural.run<ExplainTaskResult>(
      key,
      async () => ({ shown: rendered.shown, answer: await judge.explain({ prompt: rendered.prompt, functionId: `explain:${ruleId}`, unitId: file }) }),
      { waitMs, cacheable: (r) => r.answer.status !== 'error' },
    );
  if (view.state === 'unknown') return { ok: false, message: `Unknown explain job ${args.jobId ?? ''}: call explain_and_fix with the finding again.` };
  if (view.state === 'pending') return { ok: true, data: finish({ ...judgeBase, status: 'pending' }, jobInfo(view)) };
  const { view: j } = judgeView(view.result.answer, view.result.shown);
  return { ok: true, data: finish({ ...judgeBase, ...j }, jobInfo(view)) };
}
