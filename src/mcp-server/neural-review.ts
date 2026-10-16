/**
 * `review_unit` core (v1.3; Docs/v1.3/neural-arm-agent-tools.md): the judge's prompt for one file or module unit,
 * built without the graph database, and the grounding of its verdict. Pure: no I/O, no provider.
 *
 * The prompt is the judge's own template for the selected version: v1 is the frozen template (`constructPrompt`,
 * frozen rubric, persona and instructions, unchanged), v2 is `constructPromptV2` with the v2 rubric and persona. The
 * on-demand path has no ingested graph, so the graph excerpt is empty, v2's neighbourhood says so, and v2 shows no
 * candidate flags; `evaluate_project` with the judge on remains the measured route.
 *
 * Grounding reuses filter-and-explain's checks (`checkTextReferences`, R19/R20 fixed): every file a violation names
 * must be a shown file, every `path:line` and bare `line N` must exist in the file it refers to (measured on what the
 * prompt rendered), and every code quote (backticks) in the evidence or the violation messages must occur in a shown
 * file. A failing verdict counts only when it is grounded and cites at least one located line.
 */
import { createHash } from 'node:crypto';
import type { LayerDefinition, ParsedSpec } from '../shared/types/spec.js';
import type { JudgeUnitKind } from '../shared/types/enums.js';
import type { CriticVerdict } from '../llm-critic/types.js';
import { constructPrompt, renderLayerModel } from '../llm-critic/context-assembler.js';
import { constructPromptV2, renderCandidateFlags } from '../llm-critic/context-v2.js';
import { EMPTY_EXCERPT, exportedSignatures, fenceFile } from '../llm-critic/source-context.js';
import { FF_N01_ID, FF_N01_RUBRIC, FF_N02_ID, FF_N02_RUBRIC } from '../llm-critic/rubric.js';
import type { RubricText } from '../llm-critic/rubric.js';
import { JUDGE_V2_PERSONA, JUDGE_V2_REVISION, RUBRICS_V2 } from '../llm-critic/judge-v2.js';
import { CHARS_PER_TOKEN, FROZEN_SHA256, JUDGE_TOKEN_BUDGET, TRUNCATION_MARKER } from '../llm-critic/frozen.js';
import { canonicalJSON } from '../llm-critic/canonical-json.js';
import { checkTextReferences, shownFileOf } from '../llm-critic/filter-explain.js';
import type { ShownFile } from '../llm-critic/filter-explain.js';
import { resolveLayer } from './layer-resolver.js';

/** Judge versions an agent may ask for. `v2.2` is accepted only when this build carries it (`JUDGE_PROFILES`). */
export type ReviewJudgeVersion = 'v1' | 'v2' | 'v2.2';
export const REVIEW_JUDGE_VERSIONS: readonly ReviewJudgeVersion[] = ['v1', 'v2', 'v2.2'];
export const DEFAULT_REVIEW_JUDGE_VERSION: ReviewJudgeVersion = 'v1';

export type ReviewFunctionId = typeof FF_N01_ID | typeof FF_N02_ID;

/** One judge version as the on-demand path uses it. */
export interface JudgeProfile {
  readonly version: ReviewJudgeVersion;
  /** Revision label; part of the cache key. */
  readonly revision: string;
  readonly rubric: (functionId: ReviewFunctionId) => RubricText;
  /** Persona sent with the call; `undefined` keeps the provider's default (the frozen persona). */
  readonly systemPrompt: string | undefined;
  readonly render: (packet: Parameters<typeof constructPrompt>[0]) => string;
}

const V1_RUBRICS: Readonly<Record<ReviewFunctionId, RubricText>> = { [FF_N01_ID]: FF_N01_RUBRIC, [FF_N02_ID]: FF_N02_RUBRIC };

/** The on-demand path has no graph: v2's neighbourhood section says so instead of listing edges. */
export const NO_GRAPH_NEIGHBOURHOOD = '(not available: reviewed on demand without the project graph)';

/**
 * Judge versions of this build. v1 is the frozen judge (its revision is the frozen hash) and the default. `v2.2` is
 * developed on branch v1.3-judge-v22-prep; until it merges, asking for it returns `unavailable`.
 */
export const JUDGE_PROFILES: Readonly<Partial<Record<ReviewJudgeVersion, JudgeProfile>>> = Object.freeze({
  v1: {
    version: 'v1',
    revision: `v1@${FROZEN_SHA256.slice(0, 12)}`,
    rubric: (id: ReviewFunctionId) => V1_RUBRICS[id],
    systemPrompt: undefined,
    render: constructPrompt,
  },
  v2: {
    version: 'v2',
    revision: JUDGE_V2_REVISION,
    rubric: (id: ReviewFunctionId) => RUBRICS_V2[id] ?? V1_RUBRICS[id],
    systemPrompt: JUDGE_V2_PERSONA,
    render: (packet) => constructPromptV2(packet, { neighbourhood: NO_GRAPH_NEIGHBOURHOOD, candidateFlags: renderCandidateFlags([]) }),
  },
});

export function judgeProfileOf(version: ReviewJudgeVersion): JudgeProfile | undefined {
  return JUDGE_PROFILES[version];
}

export interface ReviewFile {
  /** Project-relative POSIX path. */
  readonly path: string;
  readonly content: string;
}

export interface ReviewPrompt {
  readonly functionId: ReviewFunctionId;
  readonly unitKind: JudgeUnitKind;
  readonly unitId: string;
  readonly layer: string;
  readonly prompt: string;
  readonly systemPrompt: string | undefined;
  /** Files as the prompt rendered them (a truncated file keeps its complete shown lines; an omitted one is absent). */
  readonly shown: readonly ShownFile[];
  readonly truncated: boolean;
}

function sortStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The layer of a unit: the layer its files share, else `mixed`, else `none`. */
export function unitLayerOf(spec: ParsedSpec, files: readonly string[]): string {
  const layers = new Set(files.map((f) => resolveLayer(spec, f)?.layer ?? 'none'));
  return layers.size === 1 ? [...layers][0] ?? 'none' : 'mixed';
}

/** Default function of a unit: FF-N02 (intent alignment, per file) for one file, FF-N01 (integrity, per module) otherwise. */
export function defaultFunctionOf(files: readonly ReviewFile[]): ReviewFunctionId {
  return files.length === 1 ? FF_N02_ID : FF_N01_ID;
}

/** Fenced sources within the judge's budget (file/class units: codeSnippet; modules: moduleSource). */
function renderSources(files: readonly ReviewFile[], budgetTokens: number): { readonly source: string; readonly shown: ShownFile[]; readonly truncated: boolean } {
  let remaining = budgetTokens * CHARS_PER_TOKEN;
  const blocks: string[] = [];
  const shown: ShownFile[] = [];
  let truncated = false;
  for (const f of files) {
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const content = f.content.replace(/\r\n/g, '\n');
    if (content.length <= remaining) {
      blocks.push(fenceFile(f.path, content));
      shown.push({ path: f.path, content });
      remaining -= content.length;
      continue;
    }
    const head = content.slice(0, remaining);
    const complete = content.charAt(remaining) === '\n' ? head : head.slice(0, Math.max(0, head.lastIndexOf('\n')));
    blocks.push(fenceFile(f.path, `${head}\n${TRUNCATION_MARKER}`));
    if (complete !== '') shown.push({ path: f.path, content: complete });
    truncated = true;
    remaining = 0;
  }
  return { source: blocks.join('\n\n'), shown, truncated };
}

export interface ReviewPromptInput {
  readonly spec: ParsedSpec;
  readonly files: readonly ReviewFile[];
  readonly profile: JudgeProfile;
  readonly functionId?: ReviewFunctionId;
}

/** The judge prompt of one unit (the judge's template, sections and budgets; no graph). */
export function buildReviewPrompt(input: ReviewPromptInput): ReviewPrompt {
  const files = [...input.files].sort((a, b) => sortStrings(a.path, b.path));
  const functionId = input.functionId ?? defaultFunctionOf(files);
  const unitKind: JudgeUnitKind = files.length === 1 && functionId === FF_N02_ID ? 'file' : 'module';
  const unitId = unitKind === 'file' ? (files[0]?.path ?? '') : commonDir(files.map((f) => f.path));
  const layer = unitLayerOf(input.spec, files.map((f) => f.path));
  const layers: readonly LayerDefinition[] = input.spec.layerModel.layers;
  const budget = unitKind === 'module' ? JUDGE_TOKEN_BUDGET.moduleSource : JUDGE_TOKEN_BUDGET.codeSnippet;
  const { source, shown, truncated } = renderSources(files, budget);
  const rubric = input.profile.rubric(functionId);
  const signatures = unitKind === 'module'
    ? files.map((f) => exportedSignatures(f.path, f.content)).filter((s): s is string => s !== null).join('\n') || '(none)'
    : undefined;
  const prompt = input.profile.render({
    rule: rubric.rule,
    rubric: { pass: rubric.pass, fail: rubric.fail, evidenceRequired: rubric.evidenceRequired },
    layerModel: renderLayerModel(layers),
    unitId,
    unitKind,
    unitLayer: layer,
    unitFiles: files.map((f) => f.path),
    source,
    ...(signatures !== undefined ? { signatures } : {}),
    incoming: [],
    outgoing: [],
    apgSubgraph: EMPTY_EXCERPT,
  });
  return { functionId, unitKind, unitId, layer, prompt, systemPrompt: input.profile.systemPrompt, shown, truncated };
}

/** Longest common directory of project-relative paths (the module id of a multi-file unit). */
export function commonDir(paths: readonly string[]): string {
  const split = paths.map((p) => p.split('/').slice(0, -1));
  const first = split[0] ?? [];
  let n = first.length;
  for (const s of split) {
    let i = 0;
    while (i < n && s[i] === first[i]) i++;
    n = i;
  }
  return first.slice(0, n).join('/') || '.';
}

/** Cache key of a review: judge version and revision, function, layer model, provider, and each file's content hash. */
export function reviewCacheKey(input: {
  readonly profile: JudgeProfile;
  readonly functionId: ReviewFunctionId;
  readonly layerModel: string;
  readonly judgeId: string;
  readonly files: readonly ReviewFile[];
}): string {
  const files = [...input.files]
    .sort((a, b) => sortStrings(a.path, b.path))
    .map((f) => ({ path: f.path, sha256: createHash('sha256').update(f.content.replace(/\r\n/g, '\n')).digest('hex') }));
  return createHash('sha256').update(canonicalJSON({
    tool: 'review_unit', version: input.profile.version, revision: input.profile.revision, functionId: input.functionId,
    layerModel: input.layerModel, judge: input.judgeId, files,
  })).digest('hex');
}

// ── Grounding ────────────────────────────────────────────────────────────────────────────

export interface GroundedCitation {
  readonly file: string;
  readonly startLine: number;
  readonly endLine: number;
  /** The cited lines as shown (at most 3 lines). */
  readonly excerpt: string;
  /** `quote`: a backticked code quote found in the file; `reference`: a `path:line` or `line N` in the text. */
  readonly via: 'quote' | 'reference';
}

export interface VerdictGrounding {
  readonly grounded: boolean;
  readonly problems: readonly string[];
  readonly citations: readonly GroundedCitation[];
}

function linesOf(content: string): string[] {
  return content.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
}

function excerptOf(lines: readonly string[], start: number, end: number): string {
  return lines.slice(start - 1, Math.min(end, start + 2)).join('\n');
}

const collapse = (s: string): string => s.replace(/\s+/g, ' ').trim();

/**
 * Where a code quote occurs in the shown files: the first file (shown order) and the tightest line span that holds
 * it, whitespace collapsed. A quote on one line is found on that line; a quote over line breaks on the fewest lines.
 */
export function locateQuote(quote: string, files: readonly ShownFile[]): { readonly file: string; readonly line: number; readonly endLine: number } | undefined {
  const q = collapse(quote);
  if (q === '') return undefined;
  for (const f of files) {
    const lines = linesOf(f.content).map(collapse);
    const single = lines.findIndex((l) => l.includes(q));
    if (single >= 0) return { file: f.path, line: single + 1, endLine: single + 1 };
    const span = (i: number, j: number): string => lines.slice(i, j + 1).join(' ');
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
        if (!span(i, j).includes(q)) continue;
        let start = i;
        while (start < j && span(start + 1, j).includes(q)) start++;
        return { file: f.path, line: start + 1, endLine: j + 1 };
      }
    }
  }
  return undefined;
}

/** Backticked code quotes of a text (single or triple backticks), 2 characters or longer. */
export function codeQuotes(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/```[a-z]*\n?([\s\S]*?)```|`([^`\n]+)`/g)) {
    const q = (m[1] ?? m[2] ?? '').trim();
    if (q.length >= 2) out.push(q);
  }
  return out;
}

/** Grounding of a judge verdict against the files the prompt showed. */
export function groundVerdict(verdict: CriticVerdict, shown: readonly ShownFile[]): VerdictGrounding {
  const problems: string[] = [];
  const citations: GroundedCitation[] = [];
  const seen = new Set<string>();
  const cite = (c: GroundedCitation): void => {
    const key = `${c.file}:${String(c.startLine)}-${String(c.endLine)}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push(c);
    }
  };
  const content = new Map(shown.map((f) => [f.path, linesOf(f.content)]));
  for (const v of verdict.violations) {
    if (shownFileOf(v.filePath.replace(/^\.\//, ''), shown) === undefined) problems.push(`violation names a file not shown: ${v.filePath}`);
  }
  const texts = [verdict.reasoning, ...verdict.evidence, ...verdict.violations.map((v) => v.message)];
  for (const text of texts) {
    problems.push(...checkTextReferences(text, shown));
    for (const m of text.matchAll(/([\w./@-]+\.(?:ts|tsx|js|mjs|cjs)):(\d+)(?:\s*[-–]\s*(\d+))?/g)) {
      const file = shownFileOf(m[1] ?? '', shown);
      const a = Number(m[2]);
      const b = m[3] !== undefined ? Number(m[3]) : a;
      const lines = file === undefined ? undefined : content.get(file);
      if (file !== undefined && lines !== undefined && a >= 1 && b >= a && b <= lines.length) cite({ file, startLine: a, endLine: b, excerpt: excerptOf(lines, a, b), via: 'reference' });
    }
  }
  for (const text of [...verdict.evidence, ...verdict.violations.map((v) => v.message)]) {
    for (const quote of codeQuotes(text)) {
      const at = locateQuote(quote, shown);
      if (at === undefined) {
        problems.push(`quote not found in the shown source: \`${quote.length > 60 ? `${quote.slice(0, 57)}...` : quote}\``);
        continue;
      }
      const lines = content.get(at.file) ?? [];
      cite({ file: at.file, startLine: at.line, endLine: at.endLine, excerpt: excerptOf(lines, at.line, at.endLine), via: 'quote' });
    }
  }
  if (!verdict.pass && citations.length === 0) problems.push('a failing verdict cites no located line (no code quote or line reference found in the shown source)');
  return { grounded: problems.length === 0, problems: [...new Set(problems)], citations };
}
