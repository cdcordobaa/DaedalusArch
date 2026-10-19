/**
 * EFF-01 scorer (design SC-1 to SC-12; A1 graph evidence DR-A1-5).
 *
 * The answer line is the last line starting with `ANSWER:`; its JSON is scored against the normalised key with the
 * rubric of the question's template. Normalisation is the same for every condition. Cap hits score 0; invalid
 * sessions are excluded. `items.json` is the whole input of the note's §8 analysis (not in this unit).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../../../src/shared/errors/domain-result.js';
import { TOOL_NAMES } from '../../../../src/mcp-server/server.js';
import { DAEDALUS_MCP_SERVER } from '../../../lib/generators/arms.js';
import { loadEff01Inputs } from './inputs.js';
import type { Eff01Inputs, Eff01Question } from './inputs.js';
import { CAP_STATUSES, SCORE_SCHEMA } from './types.js';
import type { Eff01Condition, ItemRow, ParseOutcome, ScoreRecord, SessionRecord } from './types.js';

// ── SC-1 to SC-3: answer extraction ────────────────────────────────────────────────────────────────────────────────

export interface ExtractedAnswer {
  readonly parse: ParseOutcome;
  readonly payload?: unknown;
  readonly answerLine?: string;
  readonly multipleAnswerLines: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function stripFence(s: string): string {
  const t = s.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence?.[1] !== undefined) return fence[1].trim();
  if (t.length >= 2 && t.startsWith('`') && t.endsWith('`')) return t.slice(1, -1).trim();
  return t;
}

function tryObject(s: string): Record<string, unknown> | undefined {
  try {
    const v = JSON.parse(s) as unknown;
    return isRecord(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** The first balanced `{…}` of `s` (string-aware), if any. */
export function firstBalancedObject(s: string): string | undefined {
  const start = s.indexOf('{');
  if (start < 0) return undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return undefined;
}

export function extractAnswer(text: string | null | undefined): ExtractedAnswer {
  if (typeof text !== 'string') return { parse: 'missing', multipleAnswerLines: false };
  const lines = text.split(/\r?\n/);
  const idx = lines.map((l, i) => (l.trim().startsWith('ANSWER:') ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return { parse: 'missing', multipleAnswerLines: false };
  const at = idx[idx.length - 1] ?? 0;
  const answerLine = (lines[at] ?? '').trim();
  const multipleAnswerLines = idx.length > 1;
  const after = answerLine.slice('ANSWER:'.length);
  const rest = [after, ...lines.slice(at + 1)].join('\n');
  const line = tryObject(stripFence(after));
  if (line !== undefined) return { parse: 'ok', payload: line, answerLine, multipleAnswerLines };
  const whole = tryObject(stripFence(rest));
  if (whole !== undefined) return { parse: 'ok', payload: whole, answerLine, multipleAnswerLines };
  const balanced = firstBalancedObject(rest);
  const obj = balanced === undefined ? undefined : tryObject(balanced);
  if (obj !== undefined) return { parse: 'extracted', payload: obj, answerLine, multipleAnswerLines };
  return { parse: 'unparsable', answerLine, multipleAnswerLines };
}

// ── SC-7: key normalisation ────────────────────────────────────────────────────────────────────────────────────────

export const KNOWN_TEMPLATES: readonly string[] = Object.freeze([
  'layer-of-file',
  'direction-violation-count',
  'files-importing-against-direction-from-layer',
  'top-violating-layer-pair',
  'files-in-import-cycles',
  'max-fan-in-file',
  'cross-context-imports',
  'hypothetical-import-allowed',
  'implementer-of-interface',
  'blocking-verdict',
]);

/** Wraps a bare key answer into its template's `answerFormat` shape. */
export function normaliseKey(template: string, answer: unknown): Record<string, unknown> {
  if (template === 'layer-of-file' && typeof answer === 'string') return { layer: answer };
  if (template === 'direction-violation-count' && typeof answer === 'number') return { count: answer };
  if (template === 'files-importing-against-direction-from-layer' && Array.isArray(answer)) return { files: answer };
  if (template === 'implementer-of-interface' && Array.isArray(answer)) return { implementers: answer };
  return isRecord(answer) ? { ...answer } : { value: answer };
}

// ── SC-8: value normalisation ──────────────────────────────────────────────────────────────────────────────────────

export interface NormContext {
  readonly repoId: string;
  /** The strict variant: no prefix stripping. */
  readonly strict?: boolean;
}

export function normStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim() : undefined;
}

export function normInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return Number.parseInt(v, 10);
  return undefined;
}

export function normBool(v: unknown): boolean | undefined {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const t = v.trim().toLowerCase();
    if (t === 'true') return true;
    if (t === 'false') return false;
  }
  return undefined;
}

export function normVerdict(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim().toLowerCase() : undefined;
}

export function normRule(v: unknown): string | undefined {
  return typeof v === 'string' ? v.trim().toUpperCase() : undefined;
}

export function normPair(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  return v.trim().replace(/→/g, '->').replace(/\s*->\s*/g, '->');
}

function isAbsoluteLike(p: string): boolean {
  return p.startsWith('/') || /^[A-Za-z]:\//.test(p) || /^<[A-Z]+>\//.test(p);
}

/**
 * SC-8 paths: `\` → `/`, then (not in the strict variant) a leading `./` dropped, the known tree prefix, and the
 * anchored `src/` fallback. `stripped` says whether anything beyond `\` → `/` was needed.
 */
export function normPath(v: unknown, ctx: NormContext): { value: string; stripped: boolean } | undefined {
  if (typeof v !== 'string') return undefined;
  let p = v.trim().replace(/\\/g, '/');
  if (ctx.strict === true) return { value: p, stripped: false };
  let dotted = false;
  while (p.startsWith('./')) {
    p = p.slice(2);
    dotted = true;
  }
  const known = `<H>/trees/${ctx.repoId}/`;
  if (p.startsWith(known)) return { value: p.slice(known.length), stripped: true };
  if (!isAbsoluteLike(p)) return { value: p, stripped: dotted };
  const repoSeg = `/${ctx.repoId}/`;
  const repoAt = p.lastIndexOf(repoSeg);
  if (repoAt >= 0) {
    const srcAt = p.indexOf('/src/', repoAt + repoSeg.length - 1);
    if (srcAt >= 0) return { value: p.slice(srcAt + 1), stripped: true };
  }
  const lastSrc = p.lastIndexOf('/src/');
  if (lastSrc >= 0) return { value: p.slice(lastSrc + 1), stripped: true };
  return { value: p, stripped: false };
}

// ── SC-9: rubrics ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface RubricResult {
  readonly score: number;
  readonly parts: Record<string, number>;
  readonly secondary: Record<string, number | boolean>;
  readonly pathPrefixStripped: boolean;
}

type Rubric = (given: Readonly<Record<string, unknown>>, key: Readonly<Record<string, unknown>>, ctx: NormContext) => RubricResult;

export function jaccard<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function setEq<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...a].every((x) => b.has(x));
}

class PathTracker {
  stripped = false;
  constructor(readonly ctx: NormContext) {}
  path(v: unknown): string | undefined {
    const r = normPath(v, this.ctx);
    if (r?.stripped === true) this.stripped = true;
    return r?.value;
  }
  pathSet(v: unknown): Set<string> | undefined {
    if (!Array.isArray(v)) return undefined;
    const out = new Set<string>();
    for (const x of v) {
      const p = this.path(x);
      if (p === undefined) return undefined;
      out.add(p);
    }
    return out;
  }
}

function strSet(v: unknown, norm: (x: unknown) => string | undefined): Set<string> | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = new Set<string>();
  for (const x of v) {
    const s = norm(x);
    if (s === undefined) return undefined;
    out.add(s);
  }
  return out;
}

function result(parts: Record<string, number>, secondary: Record<string, number | boolean>, stripped: boolean): RubricResult {
  const score = Object.values(parts).reduce((a, b) => a + b, 0);
  return { score: Math.round(score * 1e9) / 1e9, parts, secondary, pathPrefixStripped: stripped };
}

function relativeError(a: number, t: number): { value: number; absolute: boolean } {
  return t === 0 ? { value: Math.abs(a), absolute: true } : { value: Math.abs(a - t) / t, absolute: false };
}

const keyPaths = (v: unknown): Set<string> => new Set((Array.isArray(v) ? v : []).map((x) => normPath(x, { repoId: '' })?.value ?? String(x)));

export const RUBRICS: Readonly<Record<string, Rubric>> = Object.freeze({
  'layer-of-file': (g, k) => result({ layer: normStr(g.layer) !== undefined && normStr(g.layer) === normStr(k.layer) ? 1 : 0 }, {}, false),
  'direction-violation-count': (g, k) => {
    const a = normInt(g.count);
    const t = normInt(k.count) ?? Number.NaN;
    const secondary: Record<string, number | boolean> = {};
    if (a !== undefined) {
      const re = relativeError(a, t);
      secondary.relativeError = re.value;
      if (re.absolute) secondary.absoluteErrorUsed = true;
    }
    return result({ count: a === t ? 1 : 0 }, secondary, false);
  },
  'files-importing-against-direction-from-layer': (g, k, ctx) => {
    const tr = new PathTracker(ctx);
    const given = tr.pathSet(g.files);
    const key = keyPaths(k.files);
    return result({ files: given !== undefined && setEq(given, key) ? 1 : 0 }, given !== undefined ? { jaccard: jaccard(given, key) } : {}, tr.stripped);
  },
  'top-violating-layer-pair': (g, k) => {
    const pair = normPair(g.pair);
    return result({ pair: pair !== undefined && pair === normPair(k.pair) ? 0.5 : 0, count: normInt(g.count) !== undefined && normInt(g.count) === normInt(k.count) ? 0.5 : 0 }, {}, false);
  },
  'files-in-import-cycles': (g, k) =>
    result(
      {
        files: normInt(g.files) !== undefined && normInt(g.files) === normInt(k.files) ? 0.5 : 0,
        largestCycleGroup: normInt(g.largestCycleGroup) !== undefined && normInt(g.largestCycleGroup) === normInt(k.largestCycleGroup) ? 0.5 : 0,
      },
      {},
      false,
    ),
  'max-fan-in-file': (g, k, ctx) => {
    const tr = new PathTracker(ctx);
    const given = tr.pathSet(g.files);
    const key = keyPaths(k.files);
    return result(
      { files: given !== undefined && setEq(given, key) ? 0.5 : 0, importers: normInt(g.importers) !== undefined && normInt(g.importers) === normInt(k.importers) ? 0.5 : 0 },
      given !== undefined ? { jaccard: jaccard(given, key) } : {},
      tr.stripped,
    );
  },
  'cross-context-imports': (g, k) => {
    const given = new Map<string, unknown>();
    for (const [name, v] of Object.entries(g)) {
      const n = normPair(name);
      if (n !== undefined) given.set(n, v);
    }
    const parts: Record<string, number> = {};
    for (const [dir, v] of Object.entries(k)) {
      const n = normPair(dir) ?? dir;
      const a = normInt(given.get(n));
      parts[n] = a !== undefined && a === normInt(v) ? 0.5 : 0;
    }
    return result(parts, {}, false);
  },
  'hypothetical-import-allowed': (g, k) => {
    const allowed = normBool(g.allowed);
    const layers = normStr(g.fromLayer) !== undefined && normStr(g.fromLayer) === normStr(k.fromLayer) && normStr(g.toLayer) === normStr(k.toLayer);
    return result({ allowed: allowed !== undefined && allowed === normBool(k.allowed) ? 0.5 : 0, layers: layers ? 0.5 : 0 }, {}, false);
  },
  'implementer-of-interface': (g, k, ctx) => {
    const tr = new PathTracker(ctx);
    const list = Array.isArray(g.implementers) ? (g.implementers as unknown[]) : undefined;
    const keyList = Array.isArray(k.implementers) ? (k.implementers as unknown[]).filter(isRecord) : [];
    const keyClasses = new Set(keyList.map((x) => normStr(x.class) ?? ''));
    const keyFiles = keyPaths(keyList.map((x) => x.file));
    let classes: Set<string> | undefined;
    let files: Set<string> | undefined;
    const records = list?.filter(isRecord);
    if (records !== undefined && records.length === list?.length) {
      classes = strSet(records.map((x) => x.class), normStr);
      files = tr.pathSet(records.map((x) => x.file));
    }
    return result({ classes: classes !== undefined && setEq(classes, keyClasses) ? 0.5 : 0, files: files !== undefined && setEq(files, keyFiles) ? 0.5 : 0 }, {}, tr.stripped);
  },
  'blocking-verdict': (g, k) => {
    const verdict = normVerdict(g.verdict);
    const rules = strSet(g.blockingRules, normRule);
    const keyRules = strSet(k.blockingRules, normRule) ?? new Set<string>();
    return result(
      { verdict: verdict !== undefined && verdict === normVerdict(k.verdict) ? 0.5 : 0, rules: rules !== undefined && setEq(rules, keyRules) ? 0.5 : 0 },
      rules !== undefined ? { jaccard: jaccard(rules, keyRules) } : {},
      false,
    );
  },
});

/** The rubric of a template; unknown templates are refused (SC-9). */
export function rubricFor(template: string): DomainResult<Rubric> {
  const r = RUBRICS[template];
  if (r === undefined || !KNOWN_TEMPLATES.includes(template)) return DomainResult.fail([{ code: 'EFF01_UNKNOWN_TEMPLATE', message: `no rubric for template ${template}` }]);
  return DomainResult.ok(r);
}

/** Every part at 0, with the part names of the key (for cap hits and non-answers). */
function zeroParts(template: string, key: Record<string, unknown>, repoId: string): Record<string, number> {
  const r = rubricFor(template);
  if (!r.success) return {};
  return Object.fromEntries(Object.keys(r.data({}, key, { repoId }).parts).map((p) => [p, 0]));
}

// ── A1: graph evidence (DR-A1-5) ───────────────────────────────────────────────────────────────────────────────────

const OWN_PREFIX = `mcp__${DAEDALUS_MCP_SERVER}__`;

export function graphEvidenceOf(record: Pick<SessionRecord, 'condition' | 'toolCalls' | 'finalText'>): ScoreRecord['graphEvidence'] {
  if (record.condition !== 'G') return null;
  const toolCalls = Object.entries(record.toolCalls.byName)
    .filter(([n]) => n.startsWith(OWN_PREFIX))
    .reduce((a, [, c]) => a + c, 0);
  const text = record.finalText ?? '';
  const cited = text.includes(OWN_PREFIX) || TOOL_NAMES.some((n) => new RegExp(`\\b${n}\\b`).test(text));
  return { toolCalls, cited };
}

// ── SC-10, SC-11: one session ──────────────────────────────────────────────────────────────────────────────────────

export function scoreSession(record: SessionRecord, question: Eff01Question | null, keyAnswer: unknown): DomainResult<ScoreRecord> {
  const base = {
    sessionId: record.sessionId,
    block: record.block,
    repoId: record.repoId,
    questionId: record.questionId,
    condition: record.condition,
    run: record.run,
    valid: record.valid,
    tokens: record.tokens?.processed ?? null,
    tokensUncached: record.tokens?.uncached ?? null,
    tokensAux: record.tokens?.auxProcessed ?? null,
    numTurns: record.numTurns,
    wallMs: record.wallMs,
    toolCalls: record.toolCalls.total,
    graphEvidence: graphEvidenceOf(record),
  };
  const capHit = CAP_STATUSES.includes(record.status) ? record.status : null;
  if (question === null) {
    return DomainResult.ok({ ...base, capHit, parse: null, multipleAnswerLines: false, score: 0, scoreStrict: 0, parts: {}, secondary: {}, pathPrefixStripped: false });
  }
  const rubric = rubricFor(question.template);
  if (!rubric.success) return DomainResult.fail(rubric.errors);
  const key = normaliseKey(question.template, keyAnswer);
  const ex = extractAnswer(record.finalText);
  const zero = { score: 0, scoreStrict: 0, parts: zeroParts(question.template, key, record.repoId), secondary: {}, pathPrefixStripped: false };
  if (!record.valid) return DomainResult.ok({ ...base, capHit, parse: ex.parse, multipleAnswerLines: ex.multipleAnswerLines, ...zero });
  if (capHit !== null || !isRecord(ex.payload)) {
    return DomainResult.ok({ ...base, capHit, parse: ex.parse, multipleAnswerLines: ex.multipleAnswerLines, ...zero });
  }
  const r = rubric.data(ex.payload, key, { repoId: record.repoId });
  const strict = rubric.data(ex.payload, key, { repoId: record.repoId, strict: true });
  return DomainResult.ok({
    ...base,
    capHit,
    parse: ex.parse,
    multipleAnswerLines: ex.multipleAnswerLines,
    score: r.score,
    scoreStrict: strict.score,
    parts: r.parts,
    secondary: r.secondary,
    pathPrefixStripped: r.pathPrefixStripped,
  });
}

/** Scores the key against itself (`--self-test`, T-KEY): every question's normalised key as an `ANSWER:` line. */
export function selfTest(inputs: Eff01Inputs): { readonly total: number; readonly perfect: number; readonly failures: readonly string[] } {
  const failures: string[] = [];
  let perfect = 0;
  for (const q of inputs.questionById.values()) {
    const key = normaliseKey(q.template, inputs.keys.get(q.id)?.answer);
    const ex = extractAnswer(`Reasoning.\nANSWER: ${JSON.stringify(key)}`);
    const rubric = rubricFor(q.template);
    if (!rubric.success || !isRecord(ex.payload)) {
      failures.push(q.id);
      continue;
    }
    const r = rubric.data(ex.payload, key, { repoId: q.repoId });
    if (r.score === 1 && Object.keys(r.parts).length > 0) perfect++;
    else failures.push(q.id);
  }
  return { total: inputs.questionById.size, perfect, failures };
}

// ── SC-12: the item table ──────────────────────────────────────────────────────────────────────────────────────────

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[m] ?? null) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
}

const COND_ORDER: readonly Eff01Condition[] = ['R', 'G', 'N'];

export function itemTable(scores: readonly ScoreRecord[], inputs: Pick<Eff01Inputs, 'questions' | 'repos'>): ItemRow[] {
  const rows: ItemRow[] = [];
  const scored = scores.filter((s) => (s.block === 'main' || s.block === 'n') && s.valid);
  for (const repo of inputs.repos) {
    for (const q of inputs.questions[repo.id] ?? []) {
      for (const c of COND_ORDER) {
        const all = scores.filter((s) => (s.block === 'main' || s.block === 'n') && s.questionId === q.id && s.condition === c);
        if (all.length === 0) continue;
        const v = scored.filter((s) => s.questionId === q.id && s.condition === c);
        const nums = (f: (s: ScoreRecord) => number | null): number[] => v.map(f).filter((x): x is number => x !== null);
        const mean = (xs: readonly number[]): number | null => (xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length);
        rows.push({
          repoId: repo.id,
          questionId: q.id,
          condition: c,
          class: q.class,
          template: q.template,
          nRuns: v.length,
          acc: mean(v.map((s) => s.score)),
          accStrict: mean(v.map((s) => s.scoreStrict)),
          tokMedian: median(nums((s) => s.tokens)),
          tokUncachedMedian: median(nums((s) => s.tokensUncached)),
          tokAuxMedian: median(nums((s) => s.tokensAux)),
          turnsMedian: median(nums((s) => s.numTurns)),
          wallMedianMs: median(v.map((s) => s.wallMs)),
          capHits: v.filter((s) => s.capHit !== null).length,
          formatFailures: v.filter((s) => s.capHit === null && (s.parse === 'missing' || s.parse === 'unparsable')).length,
          toolCallsMedian: median(v.map((s) => s.toolCalls)),
          graphUnusedRuns: c === 'G' ? v.filter((s) => s.graphEvidence?.toolCalls === 0).length : null,
          graphUncitedRuns: c === 'G' ? v.filter((s) => s.graphEvidence?.cited === false).length : null,
        });
      }
    }
  }
  return rows;
}

export const ITEM_COLUMNS: readonly (keyof ItemRow)[] = Object.freeze([
  'repoId', 'questionId', 'condition', 'class', 'template', 'nRuns', 'acc', 'accStrict', 'tokMedian', 'tokUncachedMedian', 'tokAuxMedian',
  'turnsMedian', 'wallMedianMs', 'capHits', 'formatFailures', 'toolCallsMedian', 'graphUnusedRuns', 'graphUncitedRuns',
]);

export function itemsCsv(rows: readonly ItemRow[]): string {
  const cell = (v: ItemRow[keyof ItemRow]): string => (v === null ? '' : String(v));
  return `${[ITEM_COLUMNS.join(','), ...rows.map((r) => ITEM_COLUMNS.map((c) => cell(r[c])).join(','))].join('\n')}\n`;
}

/** The calibration overhead per condition and the tokens per correct answer per condition and repo (SC-12). */
export function secondaryTables(scores: readonly ScoreRecord[]): {
  readonly calibrationOverhead: Record<string, number | null>;
  readonly tokensPerCorrect: Record<string, number | null>;
} {
  const calibrationOverhead: Record<string, number | null> = {};
  for (const c of ['R', 'G'] as const) {
    calibrationOverhead[c] = median(scores.filter((s) => s.block === 'calibration' && s.valid && s.condition === c && s.tokens !== null).map((s) => s.tokens ?? 0));
  }
  const tokensPerCorrect: Record<string, number | null> = {};
  const main = scores.filter((s) => (s.block === 'main' || s.block === 'n') && s.valid);
  for (const key of [...new Set(main.map((s) => `${s.condition}/${s.repoId}`))].sort()) {
    const xs = main.filter((s) => `${s.condition}/${s.repoId}` === key);
    const tok = xs.reduce((a, s) => a + (s.tokens ?? 0), 0);
    const sc = xs.reduce((a, s) => a + s.score, 0);
    tokensPerCorrect[key] = sc === 0 ? null : tok / sc;
  }
  return { calibrationOverhead, tokensPerCorrect };
}

// ── The scorer over a run dir (SC-11) ──────────────────────────────────────────────────────────────────────────────

export interface ScoreRunOptions {
  readonly runDir: string;
  readonly repoRoot: string;
  readonly rescoreWithCurrentKey?: boolean;
}

export interface ScoreRunResult {
  readonly written: readonly string[];
  readonly sessions: number;
  readonly excluded: readonly string[];
  readonly missing: readonly string[];
  readonly items: readonly ItemRow[];
}

interface PlanFile {
  readonly dryRun?: boolean;
  readonly hashes?: Readonly<Record<string, string>>;
  readonly sessions?: readonly { readonly sessionId: string; readonly block: string; readonly questionId: string | null }[];
}

function fail(code: string, message: string): DomainResult<never> {
  const e: DomainError = { code, message };
  return DomainResult.fail([e]);
}

function insideOrEqual(parent: string, child: string): boolean {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export function readRecord(runDir: string, sessionId: string): SessionRecord | undefined {
  const file = path.join(runDir, 'sessions', ...sessionId.split('/'), 'record.json');
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as SessionRecord;
}

/** The record that counts for a planned session: the re-run when one exists, else the original. */
export function effectiveRecord(runDir: string, sessionId: string): SessionRecord | undefined {
  return readRecord(runDir, `${sessionId}-rerun`) ?? readRecord(runDir, sessionId);
}

function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 1)}\n`);
}

export function scoreRun(opts: ScoreRunOptions): DomainResult<ScoreRunResult> {
  const planFile = path.join(opts.runDir, 'plan.json');
  if (!fs.existsSync(planFile)) return fail('EFF01_SCORE', 'the run dir has no plan.json');
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')) as PlanFile;
  const loaded = loadEff01Inputs(opts.repoRoot);
  if (!loaded.success) return DomainResult.fail(loaded.errors);
  const inputs = loaded.data;
  if (plan.hashes?.questions !== inputs.sha256.questions) return fail('EFF01_SCORE_HASH', 'questions.json differs from the run plan; a changed question set is never scored');
  const keyChanged = plan.hashes.answers !== inputs.sha256.answers;
  if (keyChanged && opts.rescoreWithCurrentKey !== true) return fail('EFF01_SCORE_HASH', 'answers.json differs from the run plan (use --rescore-with-current-key for a dated key correction)');
  if (plan.dryRun === true && insideOrEqual(path.join(opts.repoRoot, 'experiments'), opts.runDir)) {
    return fail('EFF01_SCORE_DRY', 'a dry run is never scored into experiments/');
  }
  const suffix = opts.rescoreWithCurrentKey === true ? `-key-${inputs.sha256.answers.slice(0, 8)}` : '';

  const scores: ScoreRecord[] = [];
  const pilot: ScoreRecord[] = [];
  const excluded: string[] = [];
  const missing: string[] = [];
  let usageMismatches = 0;
  for (const s of plan.sessions ?? []) {
    const rec = effectiveRecord(opts.runDir, s.sessionId);
    if (rec === undefined) {
      missing.push(s.sessionId);
      continue;
    }
    if (rec.tokens?.usageMismatch === true) usageMismatches++;
    const q = rec.questionId === null ? null : (inputs.questionById.get(rec.questionId) ?? null);
    if (rec.questionId !== null && q === null) return fail('EFF01_SCORE', `record ${rec.sessionId} names an unknown question`);
    const r = scoreSession(rec, q, rec.questionId === null ? undefined : inputs.keys.get(rec.questionId)?.answer);
    if (!r.success) return DomainResult.fail(r.errors);
    if (!rec.valid) excluded.push(rec.sessionId);
    (rec.block === 'pilot' ? pilot : scores).push(r.data);
  }
  const items = itemTable(scores, inputs);
  const tables = secondaryTables(scores);
  const meta = {
    schema: SCORE_SCHEMA,
    dryRun: plan.dryRun === true,
    answersSha256: inputs.sha256.answers,
    questionsSha256: inputs.sha256.questions,
    planAnswersSha256: plan.hashes.answers ?? null,
    keyCorrected: keyChanged,
  };
  const written: string[] = [];
  const out = (name: string, value: unknown): void => {
    const file = path.join(opts.runDir, name);
    writeJson(file, value);
    written.push(file);
  };
  out(`scores${suffix}.json`, { ...meta, usageMismatches, excluded, missing, sessions: scores, ...tables });
  out(`items${suffix}.json`, { ...meta, rows: items, ...tables });
  const csv = path.join(opts.runDir, `items${suffix}.csv`);
  fs.writeFileSync(csv, itemsCsv(items));
  written.push(csv);
  if (suffix === '') out('pilot-scores.json', { ...meta, sessions: pilot });
  return DomainResult.ok({ written, sessions: scores.length + pilot.length, excluded, missing, items });
}
