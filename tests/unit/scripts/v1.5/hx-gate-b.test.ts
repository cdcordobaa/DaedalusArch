/**
 * Hexagonal study gate (b), ledger completeness (`scripts/v1.5/hx-gate-b.ts`, `lib/hx-gate-b.ts`), on synthetic
 * sessions: zero model calls, no hub, no scorer run.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { gateBReport, gateBSession, type HubCheck, type ScoredStep, type ScorerFinding } from '../../../../scripts/v1.5/lib/hx-gate-b';
import { main } from '../../../../scripts/v1.5/hx-gate-b';

const rec = (n: number, kind: 'cypher' | 'frozen', treeDigest: string, findings: string[], extra: Partial<HubCheck> = {}): HubCheck => ({ n, turn: 'step-01', kind, ran: [], files: null, treeDigest, findings, ...extra });
const f = (rule: string, file: string, line: number | null, extra: Partial<ScorerFinding> = {}): ScorerFinding => ({ rule, file, subject: `${rule}@${file}`, line, source: rule.startsWith('FF-') ? 'frozen' : 'v15', counted: true, ...extra });
const step = (k: number, treeDigest: string, found: ScorerFinding[], evasion: string[] = []): ScoredStep => ({ step: `step-0${String(k)}`, treeDigest, symbolicNewVsSeed: found, evasionCandidates: evasion });

describe('hx gate (b): every scorer identity is in the hub ledger by the push on that tree', () => {
  it('agrees when every counted finding is in a hub check on the same tree, of its kind', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', ['R-AXA|src/a.ts|3']), rec(2, 'frozen', 'd1', ['FF-S01|src/b.ts|1'])], [step(0, 'd0', []), step(1, 'd1', [f('R-AXA', 'src/a.ts', 3), f('FF-S01', 'src/b.ts', 1)])], [{ seq: 4, event: 'Stop', treeDigest: 'd1' }, { seq: 2, event: 'PostToolUse', treeDigest: 'dx' }]);
    expect(g.pass).toBe(true);
    expect(g.steps).toHaveLength(1);
    expect(g.steps[0]).toMatchObject({ step: 'step-01', status: 'agree', checks: [1, 2], pushes: ['4 Stop'], compared: 2, missing: [] });
  });

  it('fails on a counted finding the hub never checked (a file outside the push scope), and names it', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', ['R-AXA|src/a.ts|3'])], [step(1, 'd1', [f('R-AXA', 'src/a.ts', 3), f('R-INJ', 'src/c.ts', 9), f('R-INJ', 'src/c.ts', 9)])]);
    expect(g.pass).toBe(false);
    expect(g.missing).toBe(1);
    expect(g.steps[0]).toMatchObject({ status: 'missing', missing: ['R-INJ|src/c.ts|9|R-INJ@src/c.ts'] });
  });

  it('fails when no hub check saw the step tree at all', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', [])], [step(1, 'd2', [f('R-AXA', 'src/a.ts', 3)])]);
    expect(g.steps[0]).toMatchObject({ status: 'missing', reason: 'no hub check on this tree (no push or pull saw it)' });
  });

  it('does not count findings of an errored hub check', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', ['R-AXA|src/a.ts|3'], { error: 'boom' })], [step(1, 'd1', [f('R-AXA', 'src/a.ts', 3)])]);
    expect(g.steps[0]).toMatchObject({ status: 'missing', erroredChecks: [1], reason: 'every hub check on this tree failed' });
  });

  it('a v1.5 finding is not found in a frozen check (kinds stay apart)', () => {
    const g = gateBSession('s1', [rec(1, 'frozen', 'd1', ['R-AXA|src/a.ts|3'])], [step(1, 'd1', [f('R-AXA', 'src/a.ts', 3)])]);
    expect(g.pass).toBe(false);
  });

  it('documented differences: evasion steps are not comparable, R-MIRROR-SEM is left out, frozen lines may differ', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', []), rec(2, 'frozen', 'd2', ['FF-S01|src/b.ts|4'])], [
      step(1, 'd1', [f('R-AXA', 'src/a.ts', 3), f('R-MIRROR-SEM', 'src/a.ts', 1)], ['created detect02.allow.yaml']),
      step(2, 'd2', [f('R-MIRROR-SEM', 'src/a.ts', 1), f('FF-S01', 'src/b.ts', 7)]),
    ]);
    expect(g.pass).toBe(true);
    expect(g.notComparable).toBe(1);
    expect(g.steps[0]).toMatchObject({ status: 'not comparable', evasion: ['created detect02.allow.yaml'], compared: 0 });
    expect(g.steps[1]).toMatchObject({ status: 'agree', compared: 1, frozenLineDiffers: ['FF-S01|src/b.ts|7|FF-S01@src/b.ts'] });
  });

  it('uncounted findings not in the hub are listed but do not fail; a step with nothing new is "nothing new"', () => {
    const g = gateBSession('s1', [], [step(1, 'd1', [f('R-MIRROR2', 'src/a.ts', 2, { counted: false })]), step(2, 'd0', [])]);
    expect(g.pass).toBe(true);
    expect(g.steps.map((s) => s.status)).toEqual(['nothing new', 'nothing new']);
    expect(g.steps[0]?.missingUncounted).toEqual(['R-MIRROR2|src/a.ts|2|R-MIRROR2@src/a.ts']);
  });

  it('a cache hit: a later push on an already checked tree is matched through the first check', () => {
    const g = gateBSession('s1', [rec(1, 'cypher', 'd1', ['R-AXA|src/a.ts|3'], { turn: 'step-01' })], [step(1, 'd1', [f('R-AXA', 'src/a.ts', 3)]), step(2, 'd1', [f('R-AXA', 'src/a.ts', 3)])], [{ seq: 3, event: 'Stop', treeDigest: 'd1' }, { seq: 7, event: 'Stop', treeDigest: 'd1' }]);
    expect(g.pass).toBe(true);
    expect(g.steps[1]).toMatchObject({ status: 'agree', checks: [1], pushes: ['3 Stop', '7 Stop'] });
  });

  it('a session without a delivery audit fails; the report totals add up', () => {
    const none = gateBSession('s0', undefined, [step(1, 'd1', [])]);
    expect(none).toMatchObject({ auditPresent: false, pass: false });
    const ok = gateBSession('s1', [rec(1, 'cypher', 'd1', ['R-AXA|src/a.ts|3'])], [step(1, 'd1', [f('R-AXA', 'src/a.ts', 3)])]);
    const r = gateBReport([none, ok]);
    expect(r.pass).toBe(false);
    expect(r.totals).toEqual({ sessions: 2, steps: 1, agree: 1, nothingNew: 0, notComparable: 0, missing: 0, noAudit: 1 });
  });
});

describe('hx-gate-b CLI', () => {
  let tmp: string;
  let write: jest.SpyInstance;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hx-gate-b-')); write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true); jest.spyOn(process.stderr, 'write').mockImplementation(() => true); });
  afterEach(() => { jest.restoreAllMocks(); fs.rmSync(tmp, { recursive: true, force: true }); });

  const setup = (hubFindings: string[]): void => {
    const steps = [{ step: 'step-00', treeDigest: 'd0', symbolicNewVsSeed: [], evasionCandidates: [] }, { step: 'step-01', treeDigest: 'd1', symbolicNewVsSeed: [f('R-AXA', 'src/a.ts', 3)], evasionCandidates: [] }];
    fs.mkdirSync(path.join(tmp, 'scores'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'scores', 'scores.json'), JSON.stringify({ params: { counted: { mode: 'hx-i' } }, runs: [{ session: 'c1', arm: 'combined', task: 't01', steps }, { session: 'n1', arm: 'none', task: 't01', steps: [] }] }));
    fs.mkdirSync(path.join(tmp, 'sessions', 'c1'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'sessions', 'c1', 'session.json'), JSON.stringify({ deliveryAudit: [rec(1, 'cypher', 'd1', hubFindings)] }));
    fs.mkdirSync(path.join(tmp, 'hub'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'hub', 'c1.push.jsonl'), `${JSON.stringify({ seq: 2, event: 'Stop', treeDigest: 'd1' })}\n`);
  };

  it('exits 0 and writes the report when the hub ledger has every counted finding', () => {
    setup(['R-AXA|src/a.ts|3']);
    expect(main(['--results', tmp, '--json', path.join(tmp, 'gate-b.json')])).toBe(0);
    const r = JSON.parse(fs.readFileSync(path.join(tmp, 'gate-b.json'), 'utf8')) as { pass: boolean; modelCalls: number; counted: unknown; totals: { sessions: number } };
    expect(r).toMatchObject({ pass: true, modelCalls: 0, counted: { mode: 'hx-i' }, totals: { sessions: 1 } });
    expect(write.mock.calls.map((c) => String(c[0])).join('')).toContain('c1 t01 step-01 tree d1 checks [1] pushes [2 Stop]: agree');
  });

  it('exits 1 on a missing finding, 2 when the scores were not written in counted mode', () => {
    setup([]);
    expect(main(['--results', tmp])).toBe(1);
    fs.writeFileSync(path.join(tmp, 'scores', 'scores.json'), JSON.stringify({ runs: [{ session: 'c1', arm: 'combined', task: 't01', steps: [{ step: 'step-01' }] }] }));
    expect(main(['--results', tmp])).toBe(2);
    expect(main([])).toBe(2);
  });
});
