/**
 * The author's adjudication verdicts (U6 design §6.2) and the adjudicated reference view (§6.3). DEVELOPMENT-SET
 * helpers: the adjudicated key is the rebuilt blind-expanded key minus the rows ruled `spec`. The adjudicator is the
 * tool's author, so the view measures consistency with the declared construct, not independent recall.
 *
 * Verdict file (`results/v1.3-reference/after-member-facts/adjudication-verdicts.csv`, author-made, not a run output):
 *   row_id,style,variant,rule,file,target,question,verdict,verdict_note,author,date
 * Each row is matched against the rebuilt key (not `adjudication.csv` alone: N1 is an agreed row) by style, variant,
 * rule and the `canon` file pair. BR-U6-C1: rows that share a question get the same verdict unless every row of the
 * group carries a `verdict_note`; a `blind` verdict whose question is not answered with the option that recovers it
 * is flagged ("blind right, construct says otherwise").
 */
import * as fs from 'node:fs';
import type { ConstructAnswers } from '../../../src/shared/construct-switches.js';
import type { ConstructOption, ConstructQuestionId } from '../../../src/shared/construct-switch-catalogue.js';
import { canon, fkey, parseCsv } from './blind-key.js';
import type { BlindKey, F } from './blind-key.js';

export type Verdict = 'spec' | 'blind' | 'undecided';

export interface VerdictRow {
  readonly rowId: string;
  readonly style: string;
  readonly variant: string;
  readonly row: F;
  readonly question: ConstructQuestionId;
  readonly verdict: Verdict;
  readonly verdictNote: string;
  readonly author: string;
  readonly date: string;
}

export const VERDICT_HEADER = ['row_id', 'style', 'variant', 'rule', 'file', 'target', 'question', 'verdict', 'verdict_note', 'author', 'date'] as const;

/**
 * The options that recover a row the blind key expects (design §6.2, adjudication sheet "If the blind is right").
 * Q13 C also needs Q25 B. Q20 has none: no switch recovers row #8. N1 (Q6) is kept expected only at Q6 A.
 */
const RECOVERING: Readonly<Partial<Record<ConstructQuestionId, readonly (readonly [ConstructQuestionId, ConstructOption])[]>>> = {
  Q4: [['Q4', 'B']],
  Q6: [['Q6', 'A']],
  Q7: [['Q7', 'B']],
  Q13: [['Q13', 'C'], ['Q25', 'B']],
  Q20: [],
};

export function parseVerdicts(text: string): VerdictRow[] {
  const body = text.split('\n').filter((l) => !l.startsWith('#')).join('\n');
  const rows = parseCsv(body);
  const head = body.split('\n')[0]?.trim().split(',') ?? [];
  if (head.join(',') !== VERDICT_HEADER.join(',')) throw new Error(`verdicts: header must be ${VERDICT_HEADER.join(',')}`);
  return rows.filter((r) => Object.values(r).some((v) => v !== '')).map((r, i) => {
    const verdict = r.verdict ?? '';
    if (verdict !== 'spec' && verdict !== 'blind' && verdict !== 'undecided') throw new Error(`verdicts row ${String(i + 1)}: verdict "${verdict}" is not spec, blind or undecided`);
    const question = r.question ?? '';
    if (!/^Q([1-9]|1\d|2[0-5])$/.test(question)) throw new Error(`verdicts row ${String(i + 1)}: question "${question}" is not Q1..Q25`);
    const rule = r.rule ?? '';
    const file = r.file ?? '';
    if (rule === '' || file === '' || (r.style ?? '') === '' || (r.variant ?? '') === '') throw new Error(`verdicts row ${String(i + 1)}: style, variant, rule and file are required`);
    return {
      rowId: r.row_id ?? '', style: r.style ?? '', variant: r.variant ?? '',
      row: canon({ ruleId: rule, file, ...(r.target ? { target: r.target } : {}) }),
      question: question as ConstructQuestionId, verdict, verdictNote: r.verdict_note ?? '', author: r.author ?? '', date: r.date ?? '',
    };
  });
}

/** The verdict file, or `undefined` when it does not exist (no adjudicated view). */
export function readVerdicts(file: string): VerdictRow[] | undefined {
  if (!fs.existsSync(file)) return undefined;
  return parseVerdicts(fs.readFileSync(file, 'utf8'));
}

export interface VerdictCheck {
  /** style/variant -> canonical row keys ruled `spec`. */
  readonly removed: ReadonlyMap<string, ReadonlySet<string>>;
  readonly removedLabels: readonly string[];
  readonly kept: readonly string[];
  /** BR-U6-C1 flags (not errors): a `blind` verdict the answers do not recover. */
  readonly inconsistencies: readonly string[];
}

const label = (v: VerdictRow): string => `${v.rowId} ${v.style}/${v.variant} ${v.row.ruleId} ${v.row.file}${v.row.target !== undefined ? ` -> ${v.row.target}` : ''}`;

/**
 * Matches the verdicts to the key and enforces BR-U6-C1. Throws on an unknown row, a duplicate row, or a split
 * verdict within one question group without a note on every row of that group.
 */
export function checkVerdicts(rows: readonly VerdictRow[], key: BlindKey, answers: ConstructAnswers): VerdictCheck {
  const seen = new Set<string>();
  for (const v of rows) {
    const k = `${v.style}/${v.variant}|${fkey(v.row)}`;
    if (seen.has(k)) throw new Error(`verdicts: duplicate row ${label(v)}`);
    seen.add(k);
    const expected = key.get(`${v.style}/${v.variant}`);
    if (expected?.some((e) => fkey(e) === fkey(v.row)) !== true) throw new Error(`verdicts: row ${label(v)} is not in the blind-expanded key`);
  }
  const groups = new Map<ConstructQuestionId, VerdictRow[]>();
  for (const v of rows) groups.set(v.question, [...(groups.get(v.question) ?? []), v]);
  for (const [q, g] of groups) {
    if (new Set(g.map((v) => v.verdict)).size > 1 && g.some((v) => v.verdictNote.trim() === '')) {
      throw new Error(`verdicts: split verdict in the ${q} group without a construct reason on every row (BR-U6-C1): ${g.map((v) => `${v.rowId}=${v.verdict}`).join(', ')}`);
    }
  }
  const removed = new Map<string, Set<string>>();
  const removedLabels: string[] = [];
  const kept: string[] = [];
  const inconsistencies: string[] = [];
  for (const v of rows) {
    if (v.verdict === 'spec') {
      const sv = `${v.style}/${v.variant}`;
      removed.set(sv, new Set([...(removed.get(sv) ?? []), fkey(v.row)]));
      removedLabels.push(label(v));
      continue;
    }
    kept.push(`${label(v)} (${v.verdict})`);
    if (v.verdict === 'blind') {
      const need = RECOVERING[v.question] ?? [];
      if (need.length === 0 || !need.every(([q, o]) => answers[q] === o)) {
        inconsistencies.push(`${label(v)}: blind right, construct says otherwise (${v.question} = ${answers[v.question]}${need.length > 0 ? `; recovered only by ${need.map(([q, o]) => `${q} ${o}`).join(' + ')}` : '; no option recovers it'})`);
      }
    }
  }
  return { removed, removedLabels, kept, inconsistencies };
}

/** The adjudicated key: the blind-expanded key minus the rows ruled `spec`. */
export function adjudicatedKey(key: BlindKey, check: VerdictCheck): BlindKey {
  const out: BlindKey = new Map();
  for (const [sv, rows] of key) {
    const gone = check.removed.get(sv);
    out.set(sv, gone === undefined ? rows : rows.filter((f) => !gone.has(fkey(f))));
  }
  return out;
}
