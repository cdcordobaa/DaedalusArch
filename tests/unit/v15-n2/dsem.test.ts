/**
 * N2 pilot (D_sem on the audit items). Zero model calls: every answer is a stub.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  CAP, CassetteMiss, askRun, checkCite, finalAnswer, ground, n2Problem, n2Prompt, rubricStepC, score, shownLines, wilson,
} from '../../../experiments/v15-n2/dsem.js';
import type { AuditItem, Budget, Mode, N2Answer } from '../../../experiments/v15-n2/dsem.js';
import type { CallResult } from '../../../experiments/v15-n1/lib.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const ITEMS = (JSON.parse(fs.readFileSync(path.join(REPO, 'experiments', 'v15-n2', 'audit-items.json'), 'utf8')) as { items: AuditItem[] }).items;

const item: AuditItem = {
  id: 'A99', row: 'K11', question: 'Does this code contain: an in-process lock?', session: 'c99', file: 'src/app/S.ts',
  excerpt: [{ line: 10, text: '  run() {' }, { line: 11, text: '    this.busy.add(id);' }, { line: 12, text: '  }' }],
  fieldDeclaration: [{ line: 3, text: '  private busy = new Set<string>();' }],
  domainType: { file: 'src/domain/T.ts', lines: [{ line: 1, text: 'export class T {' }] },
};
const ans = (answer: N2Answer['answer'], cites: string[]): N2Answer => ({ explanation: 'x', answer, severityClass: answer === 'yes' ? 'medium' : null, cites });
const ok = (answer: unknown): CallResult => ({ answer, model: 'claude-sonnet-5-5', error: null, durationMs: 1, inputTokens: 1, outputTokens: 1 });
const budget = (mode: Mode, cap = CAP): Budget => ({ mode, cap, used: 0, planned: 0, stopped: null, truncated: [] });

describe('N2 D_sem pilot', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-n2-test-')); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const store = (): { cassettes: string; ledger: string } => ({ cassettes: path.join(tmp, 'c'), ledger: path.join(tmp, 'ledger.jsonl') });

  it('registers the cap 27 x 2 x 1.5 = 81 and has 27 items', () => {
    expect(CAP).toBe(81);
    expect(ITEMS).toHaveLength(27);
  });

  it('shows the interpreter only the question and the code: no row, session, panel or rule text', () => {
    for (const it of ITEMS) {
      const p = n2Prompt(it);
      expect(p).toContain(it.question);
      expect(p).not.toContain(it.session);
      expect(p).not.toMatch(/\b(K11|K12|H06|FF-[A-Z]|R-[A-Z0-9]+|panel|fable|opus|traprate)\b/i);
    }
    expect(rubricStepC()[0]).toMatch(/^ {3}c\. /);
  });

  it('resolves a cite only to shown lines of a shown path', () => {
    const shown = shownLines(item);
    expect(checkCite('src/app/S.ts:11', shown).resolved).toBe(true);
    expect(checkCite('src/app/S.ts:10-12', shown).resolved).toBe(true);
    expect(checkCite('src/app/S.ts:3', shown).resolved).toBe(true);
    expect(checkCite('src/domain/T.ts:1', shown).resolved).toBe(true);
    expect(checkCite('src/app/S.ts:4', shown).resolved).toBe(false);
    expect(checkCite('src/app/S.ts:3-10', shown).resolved).toBe(false);
    expect(checkCite('S.ts:11', shown).resolved).toBe(false);
    expect(checkCite('line 11', shown).resolved).toBe(false);
  });

  it('turns a yes with no resolved cite into unsure and keeps the cite record', () => {
    const g = ground(0, ans('yes', ['src/app/S.ts:99']), item, { model: null, invalid: null, cached: false });
    expect(g.raw).toBe('yes');
    expect(g.answer).toBe('unsure');
    expect(g.cites[0]?.resolved).toBe(false);
  });

  it('keeps the answer given in both runs, else unsure', () => {
    const y = ground(0, ans('yes', ['src/app/S.ts:11']), item, { model: null, invalid: null, cached: false });
    const n = ground(1, ans('no', ['src/app/S.ts:11']), item, { model: null, invalid: null, cached: false });
    const bad = ground(1, null, item, { model: null, invalid: 'x', cached: false });
    expect(finalAnswer([y, { ...y, run: 1 }])).toBe('yes');
    expect(finalAnswer([y, n])).toBe('unsure');
    expect(finalAnswer([y, bad])).toBe('unsure');
  });

  it('checks the schema', () => {
    expect(n2Problem(ans('no', []))).toBeNull();
    expect(n2Problem({ ...ans('no', []), verdict: 'fail' })).toMatch(/extra/);
    expect(n2Problem({ ...ans('no', []), answer: 'maybe' })).toBe('answer');
  });

  it('records, retries once, stops at the cap and replays from cassettes', async () => {
    let calls = 0;
    const caller = (): Promise<CallResult> => { calls++; return Promise.resolve(calls === 1 ? ok({ bad: 1 }) : ok(ans('yes', ['src/app/S.ts:11']))); };
    const b = budget('record', 3);
    const r0 = await askRun(item, 0, b, { caller, store: store() });
    expect(r0.answer).toBe('yes');
    expect(b.used).toBe(2);
    const r1 = await askRun(item, 1, b, { caller, store: store() });
    expect(r1.answer).toBe('yes');
    expect(b.used).toBe(3);
    const other: AuditItem = { ...item, id: 'A98', question: 'Does this code contain: something else?' };
    const r2 = await askRun(other, 0, b, { caller, store: store() });
    expect(r2.invalid).toBe('cap');
    expect(b.stopped).toMatch(/cap reached/);
    expect(b.truncated).toEqual(['A98 run 0']);
    expect(fs.readFileSync(store().ledger, 'utf8').trim().split('\n')).toHaveLength(3);
    const rb = budget('replay');
    const rep = await askRun(item, 0, rb, { caller: () => Promise.reject(new Error('no')), store: store() });
    expect(rep.cached).toBe(true);
    await expect(askRun(other, 0, rb, { caller: () => Promise.reject(new Error('no')), store: store() })).rejects.toBeInstanceOf(CassetteMiss);
  });

  it('scores agreement on labelled items only, unsure as disagreement, and counts unresolved cites', () => {
    const g = (a: N2Answer['answer'], cite = 'src/app/S.ts:11'): ReturnType<typeof ground> => ground(0, ans(a, [cite]), item, { model: null, invalid: null, cached: false });
    const res = [
      { id: 'A1', row: 'K11', runs: [g('yes')], final: 'yes' as const },
      { id: 'A2', row: 'K12', runs: [g('unsure')], final: 'unsure' as const },
      { id: 'A3', row: 'H06', runs: [g('no', 'x:1')], final: 'no' as const },
    ];
    const s = score(res, { A1: 'yes', A2: 'no' });
    expect(s.labelled).toBe(2);
    expect(s.agree).toBe(1);
    expect(s.unsureOnLabelled).toBe(1);
    expect(s.hallucinatedCitations).toBe(1);
    expect(s.pass).toBe(false);
    const w = wilson(17, 21);
    expect(w?.low).toBeCloseTo(0.5996, 3);
    expect(w?.high).toBeCloseTo(0.9233, 3);
  });
});
