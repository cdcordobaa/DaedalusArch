/**
 * U4 S2 (v1.5-exp): the model confirms or rejects symbolic candidates (note §2.2, §3 S2-a..d).
 *
 *   npx tsx experiments/v15-u4/s2.ts --pilot-trees <dir> --estimate | --record | --replay
 *
 * Question: the existing `detect02-sem-v1` form, unchanged (`experiments/detect-02/semantic.ts`: its system prompt,
 * `FAMILY_RULE`, `promptOf` with comments blanked, read-only imports); confirm | reject | abstain, every confirm
 * citing file:line with a verbatim quote, checked by its `grounding`. Own ledger and cassettes (`llm.ts`); the
 * DETECT-02 ledger is not touched.
 *
 * Scope (`scope.json`, declared in note revision r1 before any S2 call; candidates from `results/candidates.json`):
 *   S2-a  every D5 candidate (R-D5 and relaxed) on the `d5Trees`;
 *   S2-b  every candidate on the listed precision trees;
 *   S2-c  the rule candidates of the listed `tree#family` pairs;
 *   run 1 (stability) on the D5 candidates of the `stabilityTrees`.
 * Merge: one run, the answer (a confirm counts only when grounded); two runs, confirm only when both confirm
 * grounded, reject only when both reject, else `split` (an abstention). Decision: an R-* candidate is kept unless the
 * merged verdict is reject; a relaxed candidate is added only on a merged grounded confirm.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FAMILY_RULE, grounding, promptOf, PROMPT_VERSION as SEM_VERSION, SYSTEM } from '../detect-02/semantic.js';
import { resolveTree } from './candidates.js';
import type { U4Candidate } from './candidates.js';
import { ask, HARD_CAP, LEDGER, ledgerCount } from './llm.js';
import type { Budget, Mode } from './llm.js';

const HERE = 'experiments/v15-u4';
export const S2_PART_CAP = 52;

export const S2_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['verdict', 'evidence', 'rationale'],
  properties: {
    verdict: { type: 'string', enum: ['confirm', 'reject', 'abstain'] },
    evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['file', 'line', 'quote'], properties: { file: { type: 'string' }, line: { type: 'integer' }, quote: { type: 'string' } } } },
    rationale: { type: 'string' },
  },
} as const;

interface Answer { verdict: 'confirm' | 'reject' | 'abstain'; evidence: { file: string; line: number; quote: string }[]; rationale: string }
export const s2Problem = (a: unknown): string | null => {
  if (typeof a !== 'object' || a === null) return 'not an object';
  const x = a as Record<string, unknown>;
  if (!['confirm', 'reject', 'abstain'].includes(String(x['verdict']))) return 'verdict';
  if (!Array.isArray(x['evidence'])) return 'evidence';
  if (x['verdict'] === 'confirm' && (x['evidence'] as unknown[]).length === 0) return 'confirm without evidence';
  return null;
};

export interface Scope { readonly d5Trees: readonly string[]; readonly other: readonly string[]; readonly precision: readonly string[]; readonly stabilityTrees: readonly string[] }
export const SCOPE = JSON.parse(fs.readFileSync(path.join(HERE, 'scope.json'), 'utf8')) as Scope;

export function inScope(c: U4Candidate): boolean {
  if (c.set === 'precision') return SCOPE.precision.includes(c.label);
  return c.family === 'D5' ? SCOPE.d5Trees.includes(c.label) : SCOPE.other.includes(`${c.label}#${c.family}`);
}

export interface Row {
  id: string; label: string; group: string; set: string; family: string; source: string; rule: string; file: string; line: number | null; expected: string | null;
  runs: { verdict: string; grounded: boolean; cached: boolean; key: string; invalid: string | null; rationale?: string }[]; merged: string; kept: boolean; inScope?: boolean;
}

async function main(argv: readonly string[]): Promise<number> {
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const pilot = arg('pilot-trees');
  if (pilot === undefined) { process.stderr.write('--pilot-trees <dir>\n'); return 2; }
  const mode: Mode = argv.includes('--record') ? 'record' : argv.includes('--replay') ? 'replay' : 'estimate';
  const all = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'candidates.json'), 'utf8')) as U4Candidate[];
  const cands = all.filter(inScope);
  const usedBefore = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.includes('"part":"S2"')).length : 0;
  const budget: Budget = { mode, partCap: S2_PART_CAP, used: usedBefore, stopped: null };
  const rows: Row[] = [];
  const uniq = new Set<string>();
  const fresh = new Set<string>();
  // Run 0 for every candidate first, then run 1 for the stability trees' D5 candidates.
  const order: [U4Candidate, number][] = [...cands.map((c) => [c, 0] as [U4Candidate, number]), ...cands.filter((c) => c.family === 'D5' && SCOPE.stabilityTrees.includes(c.label)).map((c) => [c, 1] as [U4Candidate, number])];
  const byId = new Map<string, Row>();
  for (const [c, run] of order) {
    const rc = { ...c, tree: resolveTree(c.tree, pilot) };
    const { prompt, files } = promptOf(rc);
    if (FAMILY_RULE[c.family] === undefined) throw new Error(`no rule text for ${c.family}`);
    const res = await ask({ part: 'S2', item: c.id, run, promptVersion: SEM_VERSION, system: SYSTEM, schema: S2_SCHEMA, prompt, check: s2Problem }, budget);
    uniq.add(res.key);
    if (!res.cached) fresh.add(res.key);
    const a = res.answer as Answer | null;
    const g = a !== null && res.invalid === null ? grounding(rc.tree, files, a) : { cited: 0, grounded: 0 };
    const verdict = a === null || res.invalid !== null ? 'invalid' : a.verdict;
    const one = { verdict, grounded: verdict !== 'confirm' || (g.cited > 0 && g.grounded === g.cited), cached: res.cached, key: res.key.slice(0, 24), invalid: res.invalid, ...(a?.rationale ? { rationale: a.rationale } : {}) };
    let row = byId.get(c.id);
    if (row === undefined) {
      row = { id: c.id, label: c.label, group: c.group, set: c.set, family: c.family, source: c.source, rule: c.rule, file: c.file, line: c.line, expected: c.expected, runs: [], merged: '', kept: false, ...(c.inScope !== undefined ? { inScope: c.inScope } : {}) };
      byId.set(c.id, row); rows.push(row);
    }
    row.runs.push(one);
  }
  if (mode === 'estimate') {
    process.stdout.write(`S2: ${String(cands.length)} candidates in scope (${String(all.length)} in all), ${String(order.length)} asks, ${String(uniq.size)} distinct prompts; uncached distinct prompts ${String(fresh.size)}; S2 part cap ${String(S2_PART_CAP)}; ledger ${String(ledgerCount())} of ${String(HARD_CAP)}\n`);
    return 0;
  }
  for (const r of rows) {
    const ok = r.runs.map((x) => (x.verdict === 'confirm' && !x.grounded ? 'ungrounded' : x.verdict));
    r.merged = ok.length === 1 ? ok[0]! : ok.every((v) => v === 'confirm') ? 'confirm' : ok.every((v) => v === 'reject') ? 'reject' : ok.every((v) => v === 'abstain') ? 'abstain' : 'split';
    r.kept = r.source === 'rule' ? r.merged !== 'reject' : r.merged === 'confirm';
  }
  fs.mkdirSync(path.join(HERE, 'results'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'results', 's2-answers.json'), `${JSON.stringify({ schema: 'v15-u4-s2-v1', promptVersion: SEM_VERSION, rows }, null, 1)}\n`);
  for (const r of rows) process.stdout.write(`${r.id} [${r.source}, ${String(r.expected)}]: ${r.runs.map((x) => x.verdict).join('/')} → ${r.merged}${r.kept ? ' KEPT' : ''}\n`);
  process.stdout.write(`S2 done; ledger ${String(ledgerCount())} of ${String(HARD_CAP)}${budget.stopped !== null ? `; STOPPED: ${budget.stopped}` : ''}\n`);
  return budget.stopped !== null ? 4 : 0;
}

if (process.argv[1]?.endsWith('s2.ts')) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
