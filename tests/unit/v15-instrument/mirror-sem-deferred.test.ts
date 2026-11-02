/**
 * R-MIRROR-SEM deferred judge (`DAEDALUS_MIRROR_SEM=deferred`): the model call is taken off the check path, so a push
 * never waits for it; the answer fires from the next check of the candidate on. Zero model calls: every caller here is
 * a stub, and the slow one is released by the test.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';
import { buildGraph } from '../../../src/v15-instrument/graph.js';
import {
  createMirrorJudge, deferredJudge, sessionJudgeFromEnv, type CallRequest, type CallResult,
} from '../../../src/v15-instrument/mirror-sem.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const CASES = path.join(REPO, 'experiments', 'sem-mirror-dev', 'cases');

/** A caller that answers only when the test releases it. */
function gated(answer: unknown): { caller: (req: CallRequest) => Promise<CallResult>; release: () => void; calls: () => number } {
  let open: () => void = () => undefined;
  const gate = new Promise<void>((r) => { open = r; });
  let n = 0;
  return {
    caller: async (req) => { n++; await gate; return { answer, model: req.model, error: null, durationMs: 7000, inputTokens: null, outputTokens: null }; },
    release: () => open(),
    calls: () => n,
  };
}

describe('deferred judge', () => {
  let scratch: string;
  beforeAll(() => { scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-d-')); });
  afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));
  const candidate = async (c: string) => {
    const x = path.join(CASES, c);
    return (await buildGraph(path.join(x, 'tree'), { spec: path.join(x, 'spec.yaml'), withApg: false, scratch })).facts.mirrorCandidates[0]!;
  };

  it('answers pending at once, makes one call, and gives the verdict once it has arrived', async () => {
    const g = gated({ mirror: 'yes', reason: 'r' });
    const j = deferredJudge(createMirrorJudge({ mode: 'live', disk: false, caller: g.caller }));
    const c = await candidate('parcel-mirror');
    expect(await j.judge(c)).toMatchObject({ verdict: null, from: 'pending' });
    expect(await j.judge(c)).toMatchObject({ verdict: null, from: 'pending' });
    expect(j.inflight!()).toBe(1);
    g.release();
    await j.settle!();
    expect(j.inflight!()).toBe(0);
    expect(await j.judge(c)).toMatchObject({ verdict: { mirror: 'yes' }, from: 'session' });
    expect(g.calls()).toBe(1);
  });

  it('a failed answer is asked again on the next check', async () => {
    let n = 0;
    const bad = async (req: CallRequest): Promise<CallResult> => { n++; return { answer: null, model: req.model, error: 'boom', durationMs: 1, inputTokens: null, outputTokens: null }; };
    const j = deferredJudge(createMirrorJudge({ mode: 'live', disk: false, caller: bad }));
    const c = await candidate('parcel-mirror');
    await j.judge(c); await j.settle!();
    expect(n).toBe(2); // the inner judge's one retry
    expect(await j.judge(c)).toMatchObject({ from: 'pending' });
    await j.settle!();
    expect(n).toBe(4);
  });

  it('the env switch picks it; jest still gets no judge', () => {
    expect(sessionJudgeFromEnv({ JEST_WORKER_ID: '1', DAEDALUS_MIRROR_SEM: 'deferred' })).toBeNull();
    expect(sessionJudgeFromEnv({ DAEDALUS_MIRROR_SEM: 'deferred' })?.settle).toBeDefined();
  });
});

describe('deferred judge in the delivery hub: a push never waits for the model', () => {
  let tmp: string;
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  it('first push answers without the finding; after the answer arrives, the next push of that file fires', async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mirror-sem-dhub-'));
    const g = gated({ mirror: 'yes', reason: 'stub' });
    const hub = new DeliveryHub(path.join(tmp, 'sock', 'h.sock'), null, path.join(tmp, 'logs'), {
      mirrorJudge: (ledger) => deferredJudge(createMirrorJudge({ mode: 'live', cacheDir: path.join(tmp, 'cache'), caller: g.caller, ledger })),
    });
    await hub.start();
    try {
      const work = path.join(tmp, 'work');
      fs.cpSync(path.join(CASES, 'parcel-coarse', 'tree'), work, { recursive: true });
      await hub.setCell({ id: 'c1', session: null, step: 's1', turn: 't1', spec: path.join(CASES, 'parcel-coarse', 'spec.yaml'), project: work, baseline: path.join(CASES, 'parcel-coarse', 'tree') });
      fs.cpSync(path.join(CASES, 'parcel-mirror', 'tree'), work, { recursive: true });
      const post = (file: string): string => JSON.stringify({ session_id: 's', cwd: work, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(work, file), content: 'x' } });
      const t0 = Date.now();
      const r1 = await hub.handleHook(post('src/domain/parcel.ts'));
      expect(Date.now() - t0).toBeLessThan(5000); // the gated call is still out: the push did not wait for it
      expect(r1).not.toContain('vendor value set copied into the core');
      expect(g.calls()).toBe(1);
      g.release();
      await hub.settleJudge();
      fs.appendFileSync(path.join(work, 'src/domain/parcel.ts'), '\n// a later edit\n');
      const r2 = await hub.handleHook(post('src/domain/parcel.ts'));
      expect(r2).toContain('vendor value set copied into the core');
      expect(g.calls()).toBe(1);
    } finally {
      g.release();
      await hub.stop();
    }
  }, 120_000);
});
