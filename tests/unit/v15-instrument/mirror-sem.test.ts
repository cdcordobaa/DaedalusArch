/**
 * R-MIRROR-SEM (row H11, exploratory, instrument v1.5.4): candidates (symbolic), the model fact's cache, the Cypher
 * rule's decision on each answer, and the delivery hub's session cache. Zero model calls: every judge here is a stub.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';
import { buildGraph, loadRules, runTree } from '../../../src/v15-instrument/graph.js';
import {
  createMirrorJudge, mirrorKeyOf, mirrorPrompt, MIRROR_SEM_MODEL, sessionJudgeFromEnv, structureHolds,
  type CallRequest, type CallResult, type MirrorAnswer, type MirrorJudge,
} from '../../../src/v15-instrument/mirror-sem.js';
import { cypherMessage } from '../../../src/v15-instrument/rule-messages.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CASES = path.join(REPO, 'experiments', 'sem-mirror-dev', 'cases');
const RULE = 'R-MIRROR-SEM';
const caseOf = (c: string): { tree: string; spec: string; seed?: string } => ({
  tree: path.join(CASES, c, 'tree'), spec: path.join(CASES, c, 'spec.yaml'),
  ...(fs.existsSync(path.join(CASES, c, 'seed')) ? { seed: path.join(CASES, c, 'seed') } : {}),
});

function stub(mirror: MirrorAnswer | null): MirrorJudge {
  const stats = { asked: 0, session: 0, disk: 0, calls: 0, misses: 0, errors: 0, callMs: 0 };
  return { stats, judge: async (c) => { stats.asked++; return { verdict: mirror === null ? null : { mirror, reason: 'stub reason' }, key: mirrorKeyOf(c), from: mirror === null ? 'error' : 'call', ms: 0 }; } };
}

describe('R-MIRROR-SEM candidates (symbolic)', () => {
  let scratch: string;
  beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-')); });
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const facts = async (c: string) => { const x = caseOf(c); return (await buildGraph(x.tree, { spec: x.spec, withApg: false, scratch, ...(x.seed !== undefined ? { baseline: x.seed } : {}) })).facts.mirrorCandidates; };

  it('a renamed one-to-one copy the core branches on is a candidate, structure holds', async () => {
    const [c, ...rest] = await facts('parcel-mirror');
    expect(rest).toHaveLength(0);
    expect(c).toMatchObject({ coreSet: 'ParcelStage', vendorSet: 'TrackingStatus', module: 'shiptrack-sdk', mappedFrom: 6, mappedTo: 6, oneToOne: true, ownedBy: '' });
    expect(c!.branches.length).toBeGreaterThanOrEqual(4);
    expect(structureHolds(c!)).toBe(true);
  });
  it('a coarser domain vocabulary is a candidate too (the model decides), not one to one', async () => {
    const [c] = await facts('parcel-coarse');
    expect(c).toMatchObject({ coreSet: 'DeliveryOutcome', mappedFrom: 6, mappedTo: 3, oneToOne: false });
    expect(structureHolds(c!)).toBe(true);
  });
  it('enum members through a Record table, and a const object through an if chain', async () => {
    expect((await facts('stay-mirror-enum'))[0]).toMatchObject({ coreSet: 'StayStatus', coreKind: 'enum', mappedFrom: 5, oneToOne: true });
    expect((await facts('payout-mirror-const'))[0]).toMatchObject({ coreSet: 'PayoutState', coreKind: 'const', mappedFrom: 3 });
  });
  it('no branch in the core, or a set the seed already declares: not asked', async () => {
    const [nb] = await facts('parcel-no-branch');
    expect(nb!.branches).toHaveLength(0);
    expect(structureHolds(nb!)).toBe(false);
    const [so] = await facts('parcel-seed-owned');
    expect(so!.ownedBy).toBe('baseline');
    expect(structureHolds(so!)).toBe(false);
  });
  it('the prompt has no line numbers, so the cache key does not move with an edit elsewhere', async () => {
    const [c] = await facts('parcel-mirror');
    const shifted = { ...c!, line: c!.line + 7, branches: c!.branches.map((b) => ({ ...b, line: b.line + 3 })), pairs: c!.pairs.map((p) => ({ ...p, line: p.line + 1 })) };
    expect(mirrorKeyOf(shifted)).toBe(mirrorKeyOf(c!));
    expect(mirrorPrompt(c!)).toContain('LABEL_CREATED -> Created');
    expect(mirrorPrompt(c!)).toContain('GLOSSARY.md');
  });
});

describe('R-MIRROR-SEM rule: fires only on structure AND mirror = yes', () => {
  let scratch: string;
  beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-r-')); });
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const rules = loadRules().filter((r) => r.id === RULE);
  const run = async (c: string, judge?: MirrorJudge) => {
    const x = caseOf(c);
    return runTree(x.tree, rules, { spec: x.spec, withApg: false, scratch, ...(x.seed !== undefined ? { baseline: x.seed } : {}), ...(judge !== undefined ? { mirrorJudge: judge } : {}) });
  };

  it.each([['yes', 1], ['no', 0], ['unsure', 0], [null, 0]] as const)('answer %s -> %d finding(s)', async (ans, n) => {
    const r = await run('parcel-mirror', stub(ans));
    const f = r.findings.filter((x) => x.rule === RULE);
    expect(f).toHaveLength(n);
    if (ans === 'unsure') expect(r.stats.mirrorSemUnsure).toBe(1);
    if (ans === null) expect(r.stats.mirrorSemNoAnswer).toBe(1);
    if (n === 1) {
      expect(f[0]).toMatchObject({ file: 'src/domain/parcel.ts', subject: 'ParcelStage', status: 'violation' });
      const m = cypherMessage(f[0]!, rules[0]);
      expect(m.why).toContain('src/domain/parcel.ts:');
      expect(m.why).toContain('stub reason');
      expect(m.fix).toContain('ParcelStage');
    }
  });
  it('no judge: never fires, zero calls; a set the structure rejects is never asked', async () => {
    expect((await run('parcel-mirror')).findings.filter((x) => x.rule === RULE)).toHaveLength(0);
    const j = stub('yes');
    expect((await run('parcel-no-branch', j)).findings.filter((x) => x.rule === RULE)).toHaveLength(0);
    expect((await run('parcel-seed-owned', j)).findings.filter((x) => x.rule === RULE)).toHaveLength(0);
    expect(j.stats.asked).toBe(0);
  });
  it('the judge is only asked when R-MIRROR-SEM is among the rules run', async () => {
    const j = stub('yes');
    const x = caseOf('parcel-mirror');
    await runTree(x.tree, loadRules().filter((r) => r.id === 'R-MIRROR2'), { spec: x.spec, withApg: false, scratch, mirrorJudge: j });
    expect(j.stats.asked).toBe(0);
  });
});

describe('R-MIRROR-SEM model fact: content-hash cache', () => {
  let dir: string;
  let scratch: string;
  beforeAll(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-cache-')); scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-c-')); });
  afterAll(() => { fs.rmSync(dir, { recursive: true, force: true }); fs.rmSync(scratch, { recursive: true, force: true }); });
  const calls: CallRequest[] = [];
  const caller = async (req: CallRequest): Promise<CallResult> => { calls.push(req); return { answer: { mirror: 'yes', reason: 'r' }, model: req.model, error: null, durationMs: 5, inputTokens: 1, outputTokens: 1 }; };

  it('one call per content; session map, then disk; replay never calls', async () => {
    const x = caseOf('parcel-mirror');
    const [c] = (await buildGraph(x.tree, { spec: x.spec, withApg: false, scratch })).facts.mirrorCandidates;
    const a = createMirrorJudge({ mode: 'live', cacheDir: dir, caller });
    expect((await a.judge(c!)).from).toBe('call');
    expect((await a.judge(c!)).from).toBe('session');
    expect(calls).toHaveLength(1);
    expect(calls[0]!.model).toBe(MIRROR_SEM_MODEL);
    const b = createMirrorJudge({ mode: 'live', cacheDir: dir, caller });
    expect((await b.judge(c!)).from).toBe('disk');
    const r = createMirrorJudge({ mode: 'replay', cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-empty-')), caller });
    expect((await r.judge(c!))).toMatchObject({ from: 'miss', verdict: null });
    expect(calls).toHaveLength(1);
    // the cached file holds the answer and the model, never a cost figure
    const f = fs.readdirSync(dir).map((n) => fs.readFileSync(path.join(dir, n), 'utf8')).join('');
    expect(f).not.toMatch(/cost/i);
  });
  it('an invalid answer is retried once and not cached', async () => {
    let n = 0;
    const bad = async (req: CallRequest): Promise<CallResult> => { n++; return { answer: { mirror: 'maybe' }, model: req.model, error: null, durationMs: 1, inputTokens: null, outputTokens: null }; };
    const x = caseOf('parcel-coarse');
    const [c] = (await buildGraph(x.tree, { spec: x.spec, withApg: false, scratch })).facts.mirrorCandidates;
    const j = createMirrorJudge({ mode: 'live', cacheDir: dir, caller: bad });
    expect((await j.judge(c!))).toMatchObject({ verdict: null, from: 'error' });
    expect(n).toBe(2);
    expect(fs.existsSync(path.join(dir, `${mirrorKeyOf(c!).slice(0, 24)}.json`))).toBe(false);
  });
  it('under jest the hub default makes no judge (no test calls a model)', () => {
    expect(sessionJudgeFromEnv({ JEST_WORKER_ID: '1' })).toBeNull();
    expect(sessionJudgeFromEnv({ DAEDALUS_MIRROR_SEM: 'off' })).toBeNull();
  });
});

describe('R-MIRROR-SEM in the delivery hub: an unchanged candidate is never re-asked in a session', () => {
  let tmp: string;
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  it('push, then push again after an unrelated edit: one model call', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-hub-'));
    let calls = 0;
    const caller = async (req: CallRequest): Promise<CallResult> => { calls++; return { answer: { mirror: 'yes', reason: 'stub' }, model: req.model, error: null, durationMs: 3, inputTokens: null, outputTokens: null }; };
    const hub = new DeliveryHub(path.join(tmp, 'sock', 'h.sock'), null, path.join(tmp, 'logs'), {
      mirrorJudge: (ledger) => createMirrorJudge({ mode: 'live', cacheDir: path.join(tmp, 'cache'), caller, ledger }),
    });
    await hub.start();
    try {
      const work = path.join(tmp, 'work');
      fs.cpSync(path.join(CASES, 'parcel-coarse', 'tree'), work, { recursive: true });
      await hub.setCell({ id: 'c1', session: null, step: 's1', turn: 't1', spec: path.join(CASES, 'parcel-coarse', 'spec.yaml'), project: work, baseline: path.join(CASES, 'parcel-coarse', 'tree') });
      expect(calls).toBe(0); // the seed's sets are the baseline's
      fs.cpSync(path.join(CASES, 'parcel-mirror', 'tree'), work, { recursive: true });
      const post = (file: string): string => JSON.stringify({ session_id: 's', cwd: work, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(work, file), content: 'x' } });
      const r1 = await hub.handleHook(post('src/domain/parcel.ts'));
      expect(r1).toContain('vendor value set copied into the core');
      expect(calls).toBe(1);
      fs.appendFileSync(path.join(work, 'src/application/update-customer.use-case.ts'), '\n// an unrelated comment\n');
      await hub.handleHook(post('src/application/update-customer.use-case.ts'));
      expect(calls).toBe(1);
      expect(hub.mirrorSemStats).toMatchObject({ calls: 1 });
      expect(hub.mirrorSemStats!.session).toBeGreaterThanOrEqual(1);
      const lines = fs.readFileSync(path.join(tmp, 'logs', 'c1.push.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { mirrorSem?: { calls: number; session: number } });
      expect(lines.map((l) => l.mirrorSem?.calls)).toEqual([1, 0]);
      expect(fs.readFileSync(path.join(tmp, 'logs', 'c1.mirror-sem.jsonl'), 'utf8').trim().split('\n')).toHaveLength(1);
    } finally {
      await hub.stop();
    }
  }, 120_000);
});
