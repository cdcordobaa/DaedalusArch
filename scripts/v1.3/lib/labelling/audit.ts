/**
 * v1.3 labelling: the AUTHOR AUDIT sheet and the agreement calculator (Docs/v1.3/validation-protocol.md §3).
 *
 * Sheet: at least 30 sampled findings, drawn round-robin over the rules (each rule's items in a seeded order) so
 * every rule is represented, then shuffled. The author sees each item as the labeller does (style, excerpt, claim,
 * question) with no rule id, template or violation type, and no labeller answer. The key that maps audit ids back to
 * findings and rules is written to a separate file.
 *
 * Agreement: Cohen's κ, Gwet's AC1 and the observed agreement with its Wilson interval, on the three-way label and
 * on the binary split (yes vs. not yes). The labeller is valid when κ ≥ 0.60 on *meaningful* (three-way).
 */
import { cohenKappa, createRng, gwetAC1, shuffle, wilson } from '../../../lib/stats.js';
import type { SampledFinding } from './sampler.js';
import { derivedSeed } from './sampler.js';
import { QUESTION, claimText, excerpt } from './meaningful-prompt.js';

export const AUDIT_MIN = 30;
export const KAPPA_GATE = 0.6;

export interface AuditKeyRow {
  readonly auditId: string;
  readonly key: string;
  readonly rule: string;
  readonly ruleId: string;
  readonly projectId: string;
}

export function selectAudit(items: readonly SampledFinding[], n: number, seed: number): SampledFinding[] {
  if (n < AUDIT_MIN) throw new Error(`the author audit needs at least ${String(AUDIT_MIN)} items (asked for ${String(n)})`);
  if (items.length < n) throw new Error(`only ${String(items.length)} sampled items; the audit needs ${String(n)}`);
  const byRule = new Map<string, SampledFinding[]>();
  for (const it of [...items].sort((a, b) => (a.key < b.key ? -1 : 1))) byRule.set(it.rule, [...(byRule.get(it.rule) ?? []), it]);
  const queues = shuffle([...byRule.keys()].sort(), createRng(derivedSeed(seed, 'audit-rules')))
    .map((r) => shuffle(byRule.get(r) ?? [], createRng(derivedSeed(seed, 'audit', r))));
  const chosen: SampledFinding[] = [];
  while (chosen.length < n) {
    for (const q of queues) {
      const next = q.shift();
      if (next !== undefined && chosen.length < n) chosen.push(next);
    }
  }
  return shuffle(chosen, createRng(derivedSeed(seed, 'audit-order')));
}

/**
 * The audit draw stratified by rule AND by the labeller's label (U-F live run): strata are `rule × label` over the
 * labelled items, visited round-robin in a seeded order, each stratum in a seeded order, then the draw is shuffled.
 * Every rule and every label the labeller gave is represented, so κ is not computed on a one-label sheet. Items with
 * no label are left out.
 */
export function selectAuditStratified(items: readonly SampledFinding[], n: number, seed: number, labelOf: ReadonlyMap<string, string>): SampledFinding[] {
  if (n < AUDIT_MIN) throw new Error(`the author audit needs at least ${String(AUDIT_MIN)} items (asked for ${String(n)})`);
  const labelled = [...items].filter((it) => labelOf.has(it.key)).sort((a, b) => (a.key < b.key ? -1 : 1));
  if (labelled.length < n) throw new Error(`only ${String(labelled.length)} labelled items; the audit needs ${String(n)}`);
  const strata = new Map<string, SampledFinding[]>();
  for (const it of labelled) {
    const k = `${it.rule}\u0000${labelOf.get(it.key) ?? ''}`;
    strata.set(k, [...(strata.get(k) ?? []), it]);
  }
  const queues = shuffle([...strata.keys()].sort(), createRng(derivedSeed(seed, 'audit-strata')))
    .map((k) => shuffle(strata.get(k) ?? [], createRng(derivedSeed(seed, 'audit', k))));
  const chosen: SampledFinding[] = [];
  while (chosen.length < n) {
    for (const q of queues) {
      const next = q.shift();
      if (next !== undefined && chosen.length < n) chosen.push(next);
    }
  }
  return shuffle(chosen, createRng(derivedSeed(seed, 'audit-order')));
}

const cell = (t: string): string => t.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

/**
 * The blind sheet as one Markdown table with an `[Answer]` column (yes / no / uncertain), followed by each item's
 * code excerpt. No rule id, template, type or labeller answer.
 */
export function auditTable(chosen: readonly SampledFinding[], sourceOf: (f: SampledFinding) => string | null): string {
  const parts = [
    '# v1.3 author audit (blind)',
    '',
    `Question for every item: **${QUESTION}**`,
    '',
    'Write `yes`, `no` or `uncertain` in the `[Answer]` column of each row. Each item\'s code excerpt is under the table',
    '(section of the same id). The rule, the template and the labeller\'s answer are not shown; do not open the key file',
    'before every row is answered.',
    '',
    '| ID | Style | Location | Finding | [Answer] |',
    '|---|---|---|---|---|',
  ];
  chosen.forEach((f, i) => {
    const loc = `${f.file}${f.line !== undefined ? `:${String(f.line)}` : ''}`;
    parts.push(`| ${auditId(i)} | ${f.style} | \`${cell(loc)}\` | ${cell(claimText(f))} |  |`);
  });
  parts.push('', '## Excerpts', '');
  chosen.forEach((f, i) => {
    const src = sourceOf(f);
    parts.push(`### ${auditId(i)}`, '', `${f.style}, \`${f.file}\``, '', '```ts', src === null ? '(file not readable)' : excerpt(src, f.line), '```', '');
  });
  return parts.join('\n');
}

/** The `[Answer]` column of a filled `auditTable` sheet, as answer rows (`auditId`, `meaningful`). */
export function parseAnswerTable(md: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  for (const line of md.split('\n')) {
    const m = /^\|\s*(A\d{3})\s*\|.*\|\s*([^|]*?)\s*\|\s*$/.exec(line);
    if (m !== null) out.push({ auditId: m[1] ?? '', meaningful: (m[2] ?? '').replace(/[`*[\]]/g, '').trim() });
  }
  return out;
}

export function auditId(i: number): string {
  return `A${String(i + 1).padStart(3, '0')}`;
}

export function auditKey(chosen: readonly SampledFinding[]): AuditKeyRow[] {
  return chosen.map((f, i) => ({ auditId: auditId(i), key: f.key, rule: f.rule, ruleId: f.ruleId, projectId: f.projectId }));
}

/** The blind sheet (Markdown): no rule id, template, type or labeller answer. */
export function auditSheet(chosen: readonly SampledFinding[], sourceOf: (f: SampledFinding) => string | null): string {
  const parts = [
    '# v1.3 author audit (blind)',
    '',
    'For each item, answer in `audit-answers.csv`: **meaningful** = yes / no / uncertain to the question below, and,',
    'if you check it, **correct** = yes / no (does the stated condition hold in the code).',
    'Do not open `audit-key.json` before every answer is entered.',
    '',
    `Question: ${QUESTION}`,
    '',
  ];
  chosen.forEach((f, i) => {
    const src = sourceOf(f);
    parts.push(`## ${auditId(i)}`, '', `Style: ${f.style}`, `File: ${f.file}`, '', `Finding: ${claimText(f)}`, '', '```ts',
      src === null ? '(file not readable)' : excerpt(src, f.line), '```', '');
  });
  return parts.join('\n');
}

export function answersTemplate(chosen: readonly SampledFinding[]): string {
  return ['auditId,meaningful,correct,note', ...chosen.map((_, i) => `${auditId(i)},,,`)].join('\n') + '\n';
}

// ── CSV ──────────────────────────────────────────────────────────────────────

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i] ?? '';
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (header === undefined) return [];
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

// ── Agreement ───────────────────────────────────────────────────────────────

export interface Agreement {
  readonly categories: readonly string[];
  readonly n: number;
  /** Rows: rater A (author), columns: rater B (labeller). */
  readonly table: readonly (readonly number[])[];
  readonly observed: number | null;
  readonly observedLow: number | null;
  readonly observedHigh: number | null;
  readonly kappa: number | null;
  readonly ac1: number | null;
}

const finite = (x: number): number | null => (Number.isFinite(x) ? x : null);

export function agreement(pairs: readonly (readonly [string, string])[], categories: readonly string[]): Agreement {
  const idx = new Map(categories.map((c, i) => [c, i]));
  const table = categories.map(() => categories.map(() => 0));
  let n = 0;
  for (const [a, b] of pairs) {
    const i = idx.get(a);
    const j = idx.get(b);
    if (i === undefined || j === undefined) continue;
    const r = table[i];
    if (r !== undefined) r[j] = (r[j] ?? 0) + 1;
    n += 1;
  }
  if (n === 0) return { categories, n, table, observed: null, observedLow: null, observedHigh: null, kappa: null, ac1: null };
  const agree = categories.reduce((s, _, i) => s + (table[i]?.[i] ?? 0), 0);
  const ci = wilson(agree, n);
  return {
    categories, n, table, observed: agree / n, observedLow: ci.low, observedHigh: ci.high,
    kappa: finite(cohenKappa(table)), ac1: finite(gwetAC1(table)),
  };
}

export interface AuditAgreementReport {
  readonly meaningful: Agreement;
  readonly meaningfulBinary: Agreement;
  readonly gate: { readonly threshold: number; readonly kappa: number | null; readonly pass: boolean };
  readonly correctness?: Agreement;
  readonly unanswered: readonly string[];
  readonly unmatched: readonly string[];
}

const norm = (s: string | undefined): string => (s ?? '').trim().toLowerCase();

/**
 * Agreement between the author's answers and the labeller (meaningful) and, when given, the correctness checker
 * (checkable items only; `correct` yes/no against correct/incorrect).
 */
export function auditAgreement(
  key: readonly AuditKeyRow[],
  answers: readonly Record<string, string>[],
  labelOf: ReadonlyMap<string, string>,
  correctnessOf?: ReadonlyMap<string, string>,
): AuditAgreementReport {
  const byId = new Map(answers.map((a) => [a.auditId ?? '', a]));
  const meaningful: [string, string][] = [];
  const correctness: [string, string][] = [];
  const unanswered: string[] = [];
  const unmatched: string[] = [];
  for (const k of key) {
    const a = byId.get(k.auditId);
    const m = norm(a?.meaningful);
    if (m === '') { unanswered.push(k.auditId); continue; }
    const l = labelOf.get(k.key);
    if (l === undefined) unmatched.push(k.auditId); else meaningful.push([m, l]);
    const c = norm(a?.correct);
    const v = correctnessOf?.get(k.key);
    if (c !== '' && (v === 'correct' || v === 'incorrect')) correctness.push([c === 'yes' ? 'correct' : 'incorrect', v]);
  }
  const m3 = agreement(meaningful, ['yes', 'no', 'uncertain']);
  const binary = meaningful.map(([a, b]): [string, string] => [a === 'yes' ? 'yes' : 'not-yes', b === 'yes' ? 'yes' : 'not-yes']);
  return {
    meaningful: m3,
    meaningfulBinary: agreement(binary, ['yes', 'not-yes']),
    gate: { threshold: KAPPA_GATE, kappa: m3.kappa, pass: m3.kappa !== null && m3.kappa >= KAPPA_GATE && m3.n >= AUDIT_MIN },
    ...(correctnessOf !== undefined && { correctness: agreement(correctness, ['correct', 'incorrect']) }),
    unanswered, unmatched,
  };
}
