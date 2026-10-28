/**
 * N1 runner (v1.5 final study, neuro-symbolic secondary). Zero model calls: every answer is a stub.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { writeSpecWithAggregates } from '../../../src/v15-instrument/s3-ownership.js';
import type { AggregateEntry, S3Answer } from '../../../src/v15-instrument/s3-ownership.js';
import {
  ADMITTED, CassetteMiss, agreement, ask, batchesFor, capFor, cohenKappa, keyOf, rootsInBoth, s3Roots, wilsonLower,
} from '../../../experiments/v15-n1/lib.js';
import type { Budget, CallRequest, CallResult, Caller, Mode } from '../../../experiments/v15-n1/lib.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const FIX = path.join(REPO, 'experiments', 'detect-02', 'fixtures', 'precision', 'p04-one-aggregate-saved-twice');

const agg = (name: string, root: string, context = 'ctx'): AggregateEntry => ({ name, context, module: `${path.posix.dirname(root)}/**`, root, inner_entities: [] });
const budget = (mode: Mode, cap = 10): Budget => ({ mode, target: 'test', cap, used: 0, planned: 0, stopped: null, truncated: [] });
const ok = (answer: unknown): CallResult => ({ answer, model: 'claude-sonnet-5-5', error: null, durationMs: 1, inputTokens: 1, outputTokens: 1 });
const EMPTY: S3Answer = { types: [], stores: [] };

describe('N1 runner', () => {
  let tmp: string;
  beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-n1-test-')); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const store = (): { cassettes: string; ledger: string } => ({ cassettes: path.join(tmp, 'cassettes'), ledger: path.join(tmp, 'ledger.jsonl') });

  it('keeps a root only when it is named in both runs', () => {
    const a = agg('Order', 'src/orders/domain/Order.ts');
    const b = agg('Invoice', 'src/billing/domain/Invoice.ts');
    const c = agg('Customer', 'src/crm/domain/Customer.ts');
    const r = rootsInBoth([a, b], [b, c, { ...a, context: 'other' }]);
    expect(r.kept.map((x) => x.name)).toEqual(['Invoice', 'Order']);
    expect(r.dropped).toEqual([{ id: 'src/crm/domain/Customer.ts#Customer', run: 1 }]);
    expect(r.contextDiffers).toEqual(['src/orders/domain/Order.ts#Order']);
    const s = rootsInBoth([a, b], [b, c]);
    expect(s.kept.map((x) => x.name)).toEqual(['Invoice']);
    expect(s.dropped).toEqual([{ id: 'src/orders/domain/Order.ts#Order', run: 0 }, { id: 'src/crm/domain/Customer.ts#Customer', run: 1 }]);
    // Same name in another file is another root.
    expect(rootsInBoth([a], [agg('Order', 'src/other/Order.ts')]).kept).toEqual([]);
  });

  it('the root swap writes the kept roots as the spec aggregates block and keeps the rest of the spec', () => {
    const spec = path.join(tmp, 'spec.yaml');
    fs.writeFileSync(spec, YAML.stringify({ architecture: { style: 'ddd', ddd: { aggregates: [agg('Declared', 'src/x/domain/Declared.ts')], invariants: [{ id: 'i1', kind: 'set', owner: 'Declared' }] }, layers: ['domain'] } }));
    const kept = rootsInBoth([agg('Order', 'src/orders/domain/Order.ts', 'orders'), agg('Ghost', 'src/g/Ghost.ts')], [agg('Order', 'src/orders/domain/Order.ts', 'orders')]).kept;
    const out = writeSpecWithAggregates(spec, path.join(tmp, 's3.yaml'), kept);
    const doc = YAML.parse(fs.readFileSync(out, 'utf8')) as { architecture: { style: string; layers: string[]; ddd: { aggregates: unknown[]; invariants: unknown[] } } };
    expect(doc.architecture.ddd.aggregates).toEqual([{ name: 'Order', context: 'orders', module: 'src/orders/domain/**', root: 'src/orders/domain/Order.ts', inner_entities: [] }]);
    expect(doc.architecture.ddd.invariants).toEqual([{ id: 'i1', kind: 'set', owner: 'Declared' }]);
    expect(doc.architecture.style).toBe('ddd');
    expect(doc.architecture.layers).toEqual(['domain']);
  });

  it('S3 over a tree: a root grounded in both runs is kept, a root named in one run only is dropped', async () => {
    const meta = JSON.parse(fs.readFileSync(path.join(FIX, 'fixture.json'), 'utf8')) as { legit: string };
    const tree = path.join(FIX, meta.legit);
    const t = { id: 'p04', tree, spec: path.join(FIX, 'spec.yaml'), scratch: tmp };
    const batches = batchesFor(t);
    expect(batches.length).toBeGreaterThan(0);
    const listed = batches[0]!.listed.filter((l) => !l.store);
    expect(listed.length).toBeGreaterThan(1);
    const cite = (l: (typeof listed)[number]): { path: string; line: number; quote: string } => ({ path: l.file, line: l.line, quote: fs.readFileSync(path.join(tree, l.file), 'utf8').split('\n')[l.line - 1]!.trim().slice(0, 30) });
    const [x, y] = [listed[0]!, listed[1]!];
    let calls = 0;
    // Run 0 names x and y; run 1 names only x. The run is in the cassette key, so the prompt alone cannot tell them
    // apart: the stub answers by call order (run 0's batches come first).
    const caller: Caller = (_req: CallRequest) => {
      calls++;
      const names = calls <= batches.length ? [x, y] : [x];
      return Promise.resolve(ok({ types: names.map((l) => ({ name: l.name, path: l.file, verdict: 'root', context: null, cites: [cite(l)] })), stores: [] }));
    };
    const b = budget('record');
    const r = await s3Roots(t, b, { caller, store: store() });
    expect(calls).toBe(2 * batches.length);
    expect(r.complete).toBe(true);
    expect(r.kept.map((k) => k.name)).toEqual([x.name]);
    expect(r.dropped.map((d) => d.id)).toEqual([`${y.file}#${y.name}`]);
  }, 120_000);

  it('enforces the call cap, counts retries, and reports truncation', async () => {
    let calls = 0;
    const caller: Caller = () => { calls++; return Promise.resolve(calls === 1 ? ok({ nope: true }) : ok(EMPTY)); };
    const b = budget('record', 3);
    const deps = { caller, store: store() };
    const r1 = await ask({ item: 'a', run: 0, prompt: 'p1' }, b, deps); // invalid, then retry: 2 calls
    expect(r1.answer).toEqual(EMPTY);
    expect(b.used).toBe(2);
    await ask({ item: 'b', run: 0, prompt: 'p2' }, b, deps); // 3rd call
    const r3 = await ask({ item: 'c', run: 0, prompt: 'p3' }, b, deps); // cap
    const r4 = await ask({ item: 'd', run: 0, prompt: 'p4' }, b, deps);
    expect(calls).toBe(3);
    expect([r3.invalid, r4.invalid]).toEqual(['cap', 'stopped']);
    expect(b.stopped).toMatch(/cap reached \(3 of 3/);
    expect(b.truncated).toEqual(['c run 0', 'd run 0']);
    expect(fs.readFileSync(deps.store.ledger, 'utf8').trim().split('\n')).toHaveLength(3);
    expect(capFor(2)).toBe(6);
    expect(capFor(5)).toBe(15);
  });

  it('a pre-call check (CLI version change) stops before the call', async () => {
    let calls = 0;
    const b = budget('record');
    const r = await ask({ item: 'a', run: 0, prompt: 'p' }, b, { caller: () => { calls++; return Promise.resolve(ok(EMPTY)); }, store: store(), preCall: () => 'CLI version changed' });
    expect(calls).toBe(0);
    expect(r.invalid).toBe('stopped');
    expect(b.stopped).toBe('CLI version changed');
  });

  it('replays from cassettes without calling, errors on a miss, and estimate only counts', async () => {
    const st = store();
    await ask({ item: 'a', run: 0, prompt: 'p' }, budget('record'), { caller: () => Promise.resolve(ok(EMPTY)), store: st });
    const never: Caller = () => Promise.reject(new Error('called in replay'));
    const rb = budget('replay');
    const hit = await ask({ item: 'a', run: 0, prompt: 'p' }, rb, { caller: never, store: st });
    expect(hit).toMatchObject({ cached: true, answer: EMPTY, invalid: null });
    expect(rb.used).toBe(0);
    // Run 1 of the same prompt is a different cassette.
    expect(keyOf({ item: 'a', run: 1, prompt: 'p' })).not.toBe(keyOf({ item: 'a', run: 0, prompt: 'p' }));
    await expect(ask({ item: 'a', run: 1, prompt: 'p' }, rb, { caller: never, store: st })).rejects.toBeInstanceOf(CassetteMiss);
    const eb = budget('estimate');
    await ask({ item: 'a', run: 0, prompt: 'p' }, eb, { caller: never, store: st });
    await ask({ item: 'a', run: 1, prompt: 'p' }, eb, { caller: never, store: st });
    expect([eb.planned, eb.used]).toEqual([1, 0]);
  });

  it('agreement: identical share over the union and Cohen kappa', () => {
    const ag = agreement(['t|R|a|1', 't|R|b|2', 't|R|c|3'], ['t|R|a|1', 't|R|b|2', 't|R|d|4']);
    expect(ag).toMatchObject({ declared: 3, s3: 3, union: 4, identical: 2, share: 0.5, vacuous: false, onlyDeclared: ['t|R|c|3'], onlyS3: ['t|R|d|4'] });
    // Over the union there is no both-absent cell: identical sides give an undefined kappa, any difference kappa <= 0.
    expect(agreement(['x'], ['x']).kappaUnion).toBeNull();
    expect(agreement(['x'], ['x']).share).toBe(1);
    expect(ag.kappaUnion!).toBeLessThanOrEqual(0);
    expect(agreement([], [])).toMatchObject({ share: 1, vacuous: true, kappaUnion: null });
    // a=40 b=10 c=5 d=45: po 0.85, pe 0.5, kappa 0.7.
    const pairs: [boolean, boolean][] = [
      ...Array<[boolean, boolean]>(40).fill([true, true]), ...Array<[boolean, boolean]>(10).fill([true, false]),
      ...Array<[boolean, boolean]>(5).fill([false, true]), ...Array<[boolean, boolean]>(45).fill([false, false]),
    ];
    expect(cohenKappa(pairs)).toBeCloseTo(0.7, 10);
    expect(cohenKappa([])).toBeNull();
  });

  it('Wilson lower bound and the admitted rows', () => {
    expect(wilsonLower(36, 36)).toBeCloseTo(0.9036, 3);
    expect(wilsonLower(0, 0)).toBeNull();
    expect(Object.keys(ADMITTED)).toEqual(['K01', 'K02', 'K03', 'K05', 'K10', 'K13', 'K14', 'K15', 'K16']);
    expect(ADMITTED['K10']).toEqual(['R-D5S']);
  });
});
