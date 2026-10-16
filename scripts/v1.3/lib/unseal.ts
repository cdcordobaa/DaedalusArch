/**
 * One-shot unsealing of a loop task list (Study 2 readiness lines D2 and S14). Tooling, not a pre-registration.
 * Procedure and pass criteria: Docs/v1.3/unsealing-procedure.md; term list: scripts/v1.3/schemas/unseal-terms.json.
 *
 * Built and tested only on the pilot tasks (Docs/v1.3/pilot-tasks.md §2) and on made-up fixtures. The tool verifies
 * the file's sha256 before reading it as tasks, audits every step for structure words, converts the list into a
 * `LoopTasksFile`, and reports to stdout only counts, indices and hashes: never a task id, title or request text.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateTasks } from '../../lib/loop/plan.js';
import type { LoopTasksFile } from '../../lib/loop/types.js';

export const sha256 = (t: string | Buffer): string => crypto.createHash('sha256').update(t).digest('hex');

export interface TermList {
  readonly revision: string;
  readonly banned: readonly string[];
  readonly review: readonly string[];
  readonly allow: readonly string[];
}

export type Tier = 'banned' | 'review';
export type StepVerdict = 'PASS' | 'REVIEW' | 'FAIL';

export interface TermHit {
  readonly tier: Tier;
  readonly term: string;
  readonly start: number;
  readonly end: number;
  /** The hit with at most three words either side; everything further away is cut. */
  readonly context: string;
}

export function validateTermList(raw: unknown): TermList {
  const r = raw as Record<string, unknown> | null;
  const list = (k: string): string[] => {
    const v = r?.[k];
    if (!Array.isArray(v) || !v.every((x) => typeof x === 'string' && x.trim() !== '')) throw new Error(`term list: ${k} must be a list of non-empty strings`);
    return v as string[];
  };
  if (typeof r?.revision !== 'string') throw new Error('term list: revision must be a string');
  return { revision: r.revision, banned: list('banned'), review: list('review'), allow: list('allow') };
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word, case-insensitive; words joined by space, hyphen, underscore or nothing; the last word may be plural. */
export function termRegex(term: string): RegExp {
  const words = term.toLowerCase().split(/[\s_-]+/).filter((w) => w !== '');
  const last = words[words.length - 1] ?? '';
  const lastRe = /[^aeiou]y$/.test(last) ? `${escapeRe(last.slice(0, -1))}(?:y|ies)` : `${escapeRe(last)}(?:s|es)?`;
  const body = [...words.slice(0, -1).map(escapeRe), lastRe].join('[\\s_-]*');
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, 'gi');
}

function spans(text: string, term: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of text.matchAll(termRegex(term))) out.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  return out;
}

/** The hit and up to three words either side (`…` marks a cut). */
export function maskedContext(text: string, start: number, end: number): string {
  const before = text.slice(0, start).split(/\s+/).filter((w) => w !== '');
  const after = text.slice(end).split(/\s+/).filter((w) => w !== '');
  // A hit that starts or ends inside a word (punctuation around it) keeps that word fragment attached.
  const glueBefore = start > 0 && !/\s/.test(text[start - 1] ?? ' ');
  const glueAfter = end < text.length && !/\s/.test(text[end] ?? ' ');
  const lead = glueBefore ? before.pop() ?? '' : '';
  const trail = glueAfter ? after.shift() ?? '' : '';
  const b = before.slice(-3);
  const a = after.slice(0, 3);
  return [
    before.length > 3 ? '…' : '',
    ...b,
    `${lead}[${text.slice(start, end)}]${trail}`,
    ...a,
    after.length > 3 ? '…' : '',
  ].filter((w) => w !== '').join(' ');
}

export function auditText(text: string, terms: TermList): TermHit[] {
  const allowed = terms.allow.flatMap((t) => spans(text, t));
  const inside = (s: number, e: number, [as, ae]: [number, number]): boolean => s >= as && e <= ae;
  const raw: { tier: Tier; term: string; start: number; end: number }[] = [];
  for (const tier of ['banned', 'review'] as const) {
    for (const term of terms[tier]) {
      for (const [s, e] of spans(text, term)) {
        if (!allowed.some((a) => inside(s, e, a))) raw.push({ tier, term, start: s, end: e });
      }
    }
  }
  // Longest first at each start, banned before review on a tie; a hit inside a kept hit is folded into it.
  raw.sort((x, y) => x.start - y.start || (y.end - y.start) - (x.end - x.start) || (x.tier === y.tier ? 0 : x.tier === 'banned' ? -1 : 1));
  const kept: typeof raw = [];
  for (const h of raw) if (!kept.some((k) => inside(h.start, h.end, [k.start, k.end]))) kept.push(h);
  return kept.map((h) => ({ ...h, context: maskedContext(text, h.start, h.end) }));
}

export function stepVerdict(hits: readonly TermHit[]): StepVerdict {
  if (hits.some((h) => h.tier === 'banned')) return 'FAIL';
  return hits.length > 0 ? 'REVIEW' : 'PASS';
}

const JSON_BLOCK_RE = /```json\n([\s\S]*?)```/g;

export type Source =
  | { readonly ok: true; readonly kind: 'markdown' | 'json'; readonly jsonText: string; readonly blockSha256: string | null }
  | { readonly ok: false; readonly reason: string };

/** A markdown file with exactly one ```json block (pilot-tasks.md §2 layout), or a plain JSON file. */
export function extractSource(fileText: string, fileName: string): Source {
  if (/\.json$/i.test(fileName)) return { ok: true, kind: 'json', jsonText: fileText, blockSha256: null };
  const blocks = [...fileText.matchAll(JSON_BLOCK_RE)].map((m) => m[1] ?? '');
  if (blocks.length !== 1) return { ok: false, reason: `the markdown file has ${blocks.length} json blocks; exactly one is required` };
  const block = blocks[0] ?? '';
  return { ok: true, kind: 'markdown', jsonText: block, blockSha256: sha256(Buffer.from(block, 'utf8')) };
}

const csvCell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;

export interface StepAudit {
  readonly taskIndex: number;
  readonly taskId: string;
  readonly stepIndex: number;
  readonly stepId: string;
  readonly stepSha256: string;
  readonly verdict: StepVerdict;
  readonly hits: readonly TermHit[];
}

export function auditTasks(tasks: LoopTasksFile, terms: TermList): StepAudit[] {
  const out: StepAudit[] = [];
  tasks.tasks.forEach((t, ti) => t.steps.forEach((s, si) => {
    const hits = auditText(s.request, terms);
    out.push({ taskIndex: ti + 1, taskId: t.id, stepIndex: si + 1, stepId: s.id, stepSha256: sha256(JSON.stringify(s)), verdict: stepVerdict(hits), hits });
  }));
  return out;
}

export interface AuditSheetMeta {
  readonly fileSha256: string;
  readonly termsRevision: string;
  readonly termsSha256: string;
  readonly titleHits: readonly { taskIndex: number; hits: readonly TermHit[] }[];
}

/** The sheet the unsealer signs. It holds task text fragments: it is stored outside the repository, only its sha256 is committed. */
export function renderAuditSheet(audit: readonly StepAudit[], meta: AuditSheetMeta): string {
  const rows: (string | number)[][] = [
    ['row', 'task_index', 'task_id', 'step_index', 'step_id', 'step_sha256', 'tier', 'term', 'context', 'verdict', 'unsealer_mark', 'unsealer_note'],
    ['meta', '', '', '', '', '', '', '', `file_sha256=${meta.fileSha256}; terms=${meta.termsRevision} ${meta.termsSha256}`, '', '', ''],
  ];
  for (const s of audit) {
    rows.push(['step', s.taskIndex, s.taskId, s.stepIndex, s.stepId, s.stepSha256, '', '', '', s.verdict, '', '']);
    for (const h of s.hits) {
      rows.push(['hit', s.taskIndex, s.taskId, s.stepIndex, s.stepId, s.stepSha256, h.tier, h.term, h.context, h.tier === 'banned' ? 'FAIL' : 'REVIEW', '', '']);
    }
  }
  for (const t of meta.titleHits) {
    for (const h of t.hits) rows.push(['title-hit', t.taskIndex, '', '', '', '', h.tier, h.term, h.context, h.tier === 'banned' ? 'FAIL' : 'REVIEW', '', '']);
  }
  rows.push(['signature', '', '', '', '', '', '', '', 'unsealer name, date, and: every REVIEW hit marked product or structure; no FAIL left', '', '', '']);
  return rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
}

export interface UnsealOptions {
  readonly file: string;
  readonly expectedSha256: string;
  readonly out: string;
  readonly audit: string;
  readonly termsFile: string;
  /** Outputs must not land inside this directory (the repository). */
  readonly repoRoot: string;
}

export interface UnsealResult {
  readonly exitCode: 0 | 2 | 3;
  /** Counts, indices and hashes only. */
  readonly lines: readonly string[];
}

const isInside = (child: string, parent: string): boolean => {
  const rel = path.relative(path.resolve(parent), path.resolve(child));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
};

export function parseArgs(argv: readonly string[], defaults: { termsFile: string; repoRoot: string }): UnsealOptions | string {
  const opt = (name: string): string => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] ?? '' : '';
  };
  const o = { file: opt('--file'), expectedSha256: opt('--expected-sha256').toLowerCase(), out: opt('--out'), audit: opt('--audit') };
  for (const [k, v] of Object.entries(o)) if (v === '') return `missing --${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
  if (!/^[0-9a-f]{64}$/.test(o.expectedSha256)) return '--expected-sha256 must be 64 hex characters';
  return { ...o, termsFile: opt('--terms') || defaults.termsFile, repoRoot: defaults.repoRoot };
}

export function unseal(o: UnsealOptions): UnsealResult {
  const lines: string[] = [];
  const refuse = (why: string): UnsealResult => ({ exitCode: 2, lines: [...lines, `REFUSED: ${why}`] });
  for (const [flag, p] of [['--out', o.out], ['--audit', o.audit]] as const) {
    if (isInside(p, o.repoRoot)) return refuse(`${flag} is inside the repository; the tasks file and the audit sheet stay outside it`);
  }
  if (path.resolve(o.out) === path.resolve(o.audit)) return refuse('--out and --audit are the same file');
  const termsText = fs.readFileSync(o.termsFile);
  const terms = validateTermList(JSON.parse(termsText.toString('utf8')));
  const termsSha = sha256(termsText);
  lines.push(`terms ${terms.revision} sha256 ${termsSha}`);

  let bytes: Buffer;
  try {
    bytes = fs.readFileSync(o.file);
  } catch {
    return refuse('the file cannot be read');
  }
  const fileSha = sha256(bytes);
  lines.push(`file sha256 ${fileSha}`);
  if (fileSha !== o.expectedSha256) return refuse(`sha256 mismatch (expected ${o.expectedSha256}); nothing was parsed or written`);
  lines.push('file sha256 matches the expected value');

  const src = extractSource(bytes.toString('utf8'), o.file);
  if (!src.ok) return refuse(src.reason);
  if (src.blockSha256 !== null) lines.push(`block sha256 ${src.blockSha256}`);
  let raw: unknown;
  try {
    raw = JSON.parse(src.jsonText);
  } catch {
    // The parser's message can quote the text; it is not printed.
    return refuse('the task list is not valid JSON');
  }
  const v = validateTasks(raw);
  if (!v.success) return refuse(`the task list is not a valid LoopTasksFile (${v.errors.length} problem(s); messages withheld because they name tasks)`);
  const tasks = v.data;
  const rawTasks = (raw as { tasks: unknown[] }).tasks;
  const sameAsSource = JSON.stringify(rawTasks) === JSON.stringify(tasks.tasks) && (raw as { description: unknown }).description === tasks.description;

  lines.push(`tasks ${tasks.tasks.length}, steps ${tasks.tasks.reduce((n, t) => n + t.steps.length, 0)} (${tasks.tasks.map((t) => t.steps.length).join(', ')} per task)`);
  rawTasks.forEach((t, i) => lines.push(`task ${i + 1} sha256 ${sha256(JSON.stringify(t))}`));
  tasks.tasks.forEach((t, ti) => t.steps.forEach((s, si) => lines.push(`task ${ti + 1} step ${si + 1} sha256 ${sha256(JSON.stringify(s))}`)));

  const audit = auditTasks(tasks, terms);
  // The title reaches the agent (prompts.ts TASK_TITLE); ids are audited too, separately, since an id can carry a word.
  const titleHits = tasks.tasks.map((t, i) => ({ taskIndex: i + 1, hits: [...auditText(t.title, terms), ...auditText(t.id, terms)] })).filter((t) => t.hits.length > 0);
  const count = (verdict: StepVerdict): number => audit.filter((s) => s.verdict === verdict).length;
  const hits = audit.flatMap((s) => s.hits);
  lines.push(`audit steps PASS ${count('PASS')}, REVIEW ${count('REVIEW')}, FAIL ${count('FAIL')}; hits banned ${hits.filter((h) => h.tier === 'banned').length}, review ${hits.filter((h) => h.tier === 'review').length}; title or id hits ${titleHits.reduce((n, t) => n + t.hits.length, 0)}`);
  for (const s of audit) if (s.verdict !== 'PASS') lines.push(`  task ${s.taskIndex} step ${s.stepIndex}: ${s.verdict} (banned ${s.hits.filter((h) => h.tier === 'banned').length}, review ${s.hits.filter((h) => h.tier === 'review').length})`);

  const sheet = renderAuditSheet(audit, { fileSha256: fileSha, termsRevision: terms.revision, termsSha256: termsSha, titleHits });
  const tasksJson = JSON.stringify(tasks, null, 2) + '\n';
  for (const [p, text] of [[o.audit, sheet], [o.out, tasksJson]] as const) {
    fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
    fs.writeFileSync(p, text, { mode: 0o600 });
  }
  lines.push(`tasks file written, sha256 ${sha256(tasksJson)}; same tasks as the source: ${sameAsSource ? 'yes' : 'NO (extra fields dropped)'}`);
  lines.push(`audit sheet written, sha256 ${sha256(sheet)}`);
  const fail = count('FAIL') > 0 || titleHits.some((t) => t.hits.some((h) => h.tier === 'banned'));
  lines.push(fail ? 'VERDICT: FAIL (banned terms present; reword or replace before any run)' : `VERDICT: ${count('REVIEW') > 0 || titleHits.length > 0 ? 'PASS pending the unsealer\'s marks on REVIEW hits' : 'PASS'}`);
  return { exitCode: fail ? 3 : 0, lines };
}
