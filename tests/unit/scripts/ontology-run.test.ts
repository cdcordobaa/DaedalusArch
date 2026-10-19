/**
 * scripts/v1.3/ontology-run.ts: estimate and replay of the recorded-fixture cassettes, the A2 / verdict outputs, the
 * vendor routes, the fact policy and the NS-02 set (v1.4 U3). No model call: every `main` gets fake route factories
 * and temporary `--cassettes` / `--out` directories; no test writes under tests/fixtures/.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { cheapOutcome, prepareOntologyInput, resolveSubject } from '../../../src/apg-enrich/ontology/index.js';
import type { ExpectedSemanticManifest, Ns02Block, RouteDeps } from '../../../src/apg-enrich/ontology/index.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';
import { FIXTURES, NS02_SET, fixtureCases, main, ns02Targets } from '../../../scripts/v1.3/ontology-run.js';

// The two regexes replication/v1.3/groups/g-ontology.mjs parses (BR-U3-17).
const RUN_LINE = /^(case-[\w-]+): (\d+) Sem nodes, (\d+) Sem edges, (\d+) findings, (\d+) rejected \(hallucinations\); calls (\d+), cache hits (\d+)/gm;
const EST_LINE = /^(case-[\w-]+): classes (\d+), groups (\d+), rule-candidate classes (\d+); calls a=(\d+) b<=(\d+) c=(\d+) d<=(\d+)/gm;
const AGGREGATE_KEYS = ['acceptedAssertions', 'cases', 'cheapCaughtExpected', 'cheapFlaggedForbidden', 'expected', 'forbidden', 'forbiddenHits', 'found', 'hallucinationRate', 'hallucinations', 'judgeRecorded', 'precision', 'recall', 'unexpected'];

function fakeDeps(): { deps: RouteDeps; built: string[] } {
  const built: string[] = [];
  const no = (what: string) => (): Promise<DomainResult<never>> => { built.push(what); return Promise.resolve(DomainResult.fail([{ code: 'TEST_NO_ROUTE', message: `${what} must not be built in a test` }])); };
  return { deps: { claudeCli: no('claude-cli'), geminiApi: no('gemini-api'), agyCli: no('gemini-agy') }, built };
}

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('ontology-run script', () => {
  let out: string[];
  let spy: jest.SpyInstance;
  let fake: ReturnType<typeof fakeDeps>;
  const dirs: string[] = [];
  const scratch = (p: string): string => { const d = tmp(p); dirs.push(d); return d; };
  beforeEach(() => {
    out = [];
    fake = fakeDeps();
    spy = jest.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => { out.push(String(s)); return true; });
  });
  afterEach(() => {
    spy.mockRestore();
    expect(fake.built).toEqual([]); // no test ever opens a live route
  });
  afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
  const text = (): string => out.join('');

  it('lists the six planted cases', () => {
    expect(fixtureCases()).toHaveLength(6);
  });

  it('--estimate counts calls per case and calls nothing; the lines keep the replication format', async () => {
    expect(await main(['--fixtures', '--provider', 'mock', '--estimate', '--out', scratch('ont-est-')], fake.deps)).toBe(0);
    expect(out.filter((l) => l.startsWith('case-'))).toHaveLength(6);
    expect([...text().matchAll(EST_LINE)]).toHaveLength(6);
    expect(text()).toContain('budget 200 ok');
  }, 120_000);

  it('--replay of the mock cassettes scores every case, writes A2 and verdicts, and keeps the replication format', async () => {
    const dir = scratch('ont-rep-');
    expect(await main(['--fixtures', '--provider', 'mock', '--replay', '--out', dir], fake.deps)).toBe(0);
    const scores = JSON.parse(fs.readFileSync(path.join(dir, 'scores.json'), 'utf8')) as { aggregate: Record<string, number> };
    expect(scores.aggregate).toMatchObject({ expected: 3, found: 2, forbiddenHits: 0, acceptedAssertions: 128 });
    expect(Object.keys(scores.aggregate).sort()).toEqual(AGGREGATE_KEYS);
    expect(text()).toContain('| case-01-rule-dup-shapes | ruleDuplications: free-shipping-at-50 | expected | found | missed | not-recorded |');
    const runs = [...text().matchAll(RUN_LINE)];
    expect(runs).toHaveLength(6);
    expect(runs.every((m) => m[6] === '0')).toBe(true);
    expect(runs.reduce((s, m) => s + Number(m[7]), 0)).toBe(110);
    // case-03: the N4 note on its own line, not on the per-case line the replication regex reads
    expect(out.some((l) => l.startsWith('  note: case-03-concept-fragmentation') && l.includes('N4: no declared context'))).toBe(true);
    for (const c of fixtureCases()) {
      expect(fs.existsSync(path.join(dir, c, 'facts.json'))).toBe(true);
      expect(fs.existsSync(path.join(dir, c, 'verdicts.json'))).toBe(true);
    }
    const v02 = JSON.parse(fs.readFileSync(path.join(dir, 'case-02-misplaced-pricing', 'verdicts.json'), 'utf8')) as { rule: string }[];
    expect(v02.map((v) => v.rule)).toEqual(['SEM-MISPLACED']);
    // the parent sidecar ns02 blocks are scored: the pilot pair's bar at the fact level
    const f02 = JSON.parse(fs.readFileSync(path.join(dir, 'case-02-misplaced-pricing', 'fact-scores.json'), 'utf8')) as { required: number; hit: number; falseFacts: number };
    expect(f02).toMatchObject({ required: 2, hit: 2, falseFacts: 0 });
    const v04b = JSON.parse(fs.readFileSync(path.join(dir, 'case-04b-control-clean-notification', 'verdict-scores.json'), 'utf8')) as { outcome: string }[];
    expect(v04b.map((v) => v.outcome)).toEqual(['clear']);
  }, 180_000);

  it('rejects a call without a target, an unknown provider or an unknown fact policy', async () => {
    expect(await main([], fake.deps)).toBe(2);
    expect(await main(['--fixtures', '--provider', 'gpt'], fake.deps)).toBe(2);
    expect(await main(['--fixtures', '--fact-policy', 'some'], fake.deps)).toBe(2);
  });

  it('--runs 1 with agreed-only is refused in record and replay (the runs = 1 trap); --estimate --runs 1 still prints', async () => {
    const c = path.join(FIXTURES, 'case-02-misplaced-pricing');
    expect(await main(['--project', c, '--provider', 'mock', '--runs', '1', '--cassettes', scratch('ont-c1-'), '--out', scratch('ont-o1-')], fake.deps)).toBe(2);
    expect(text()).toContain('runs = 1 trap');
    expect(await main(['--project', c, '--provider', 'mock', '--runs', '1', '--replay', '--cassettes', scratch('ont-c1-'), '--out', scratch('ont-o1-')], fake.deps)).toBe(2);
    out = [];
    expect(await main(['--project', c, '--layers', path.join(FIXTURES, 'layers.json'), '--provider', 'mock', '--runs', '1', '--estimate', '--out', scratch('ont-o1-')], fake.deps)).toBe(0);
    expect(text()).toContain('case-02-misplaced-pricing: classes 4, groups 2, rule-candidate classes 2; calls a=4 b<=2 c=2 d<=40');
    out = [];
    expect(await main(['--project', c, '--layers', path.join(FIXTURES, 'layers.json'), '--provider', 'mock', '--runs', '1', '--fact-policy', 'any', '--cassettes', scratch('ont-c1-'), '--out', scratch('ont-o1-')], fake.deps)).toBe(0);
    const runs1 = [...text().matchAll(RUN_LINE)].map((m) => Number(m[6]));
    expect(runs1).toHaveLength(1);
    expect(runs1[0]).toBeGreaterThanOrEqual(8); // a + b + c = 8 at runs 1; `any` may add pass (d) pairs
  }, 120_000);

  it('Gemini routes: no model is exit 2; estimate and replay call nothing and build no provider', async () => {
    const c = path.join(FIXTURES, 'case-02-misplaced-pricing');
    const layers = path.join(FIXTURES, 'layers.json');
    expect(await main(['--project', c, '--provider', 'gemini-api', '--estimate'], fake.deps)).toBe(2);
    expect(await main(['--project', c, '--provider', 'gemini-agy', '--estimate'], fake.deps)).toBe(2);
    expect(await main(['--project', c, '--layers', layers, '--provider', 'gemini-api', '--model', 'gemini-x', '--estimate', '--out', scratch('ont-g-')], fake.deps)).toBe(0);
    out = [];
    const dir = scratch('ont-g-');
    expect(await main(['--project', c, '--layers', layers, '--provider', 'gemini-agy', '--model', 'gemini-x', '--replay', '--cassettes', scratch('ont-gc-'), '--out', dir], fake.deps)).toBe(0);
    const m = [...text().matchAll(RUN_LINE)][0];
    expect(m?.[6]).toBe('0');
    const result = JSON.parse(fs.readFileSync(path.join(dir, 'case-02-misplaced-pricing', 'result.json'), 'utf8')) as { provider: unknown; calls: { cassetteMisses: number } };
    expect(result.provider).toEqual({ provider: 'gemini-agy', model: 'gemini-x' });
    expect(result.calls.cassetteMisses).toBeGreaterThan(0);
  }, 120_000);

  it('pilot invariant (BR-U3-15): a mock record of case-02 + case-04b at runs 2 makes exactly 26 calls within --budget 20', async () => {
    const layers = path.join(FIXTURES, 'layers.json');
    const cas = scratch('ont-pc-');
    let calls = 0;
    for (const c of ['case-02-misplaced-pricing', 'case-04b-control-clean-notification']) {
      out = [];
      expect(await main(['--project', path.join(FIXTURES, c), '--layers', layers, '--estimate', '--runs', '2', '--budget', '20', '--provider', 'gemini-agy', '--model', 'gemini-x', '--out', scratch('ont-pe-')], fake.deps)).toBe(0);
      expect(text()).toContain('budget 20');
      out = [];
      expect(await main(['--project', path.join(FIXTURES, c), '--layers', layers, '--provider', 'mock', '--runs', '2', '--budget', '20', '--cassettes', cas, '--out', scratch('ont-po-')], fake.deps)).toBe(0);
      calls += [...text().matchAll(RUN_LINE)].reduce((s, x) => s + Number(x[6]), 0);
    }
    expect(calls).toBe(26);
  }, 120_000);

  it('--ns02 --estimate lists the 12 set projects (not the retired pair) and calls nothing', async () => {
    expect(await main(['--ns02', '--estimate', '--provider', 'gemini-agy', '--model', 'gemini-x', '--out', scratch('ont-ns-')], fake.deps)).toBe(0);
    const ids = [...text().matchAll(EST_LINE)].map((m) => m[1]);
    expect(ids).toHaveLength(12);
    expect(ids).toEqual(ns02Targets().map((t) => t.id));
    expect(ids.some((id) => id?.startsWith('case-06'))).toBe(false);
    expect(ids).toEqual(expect.arrayContaining(['case-09-limit-only-in-controller', 'case-09t-control-length-check-in-controller', 'case-02-misplaced-pricing']));
  }, 180_000);
});

describe('NS-02 set index', () => {
  interface SetProject { id: string; dir: string; layers: string; ns02: string; manifestSha256?: string }
  const set = JSON.parse(fs.readFileSync(NS02_SET, 'utf8')) as { pairs: { defect: SetProject; twin: SetProject }[]; retired: { pair: string }[] };
  const projects = set.pairs.flatMap((p) => [p.defect, p.twin]);

  it('has six pairs, retires case-06 / case-06t, and leaves the parent manifests byte-unchanged', () => {
    expect(set.pairs).toHaveLength(6);
    expect(set.retired.map((r) => r.pair)).toEqual(['case-06 / case-06t']);
    expect(fs.existsSync(path.join(FIXTURES, 'ns02', 'case-06-invariant-only-in-controller'))).toBe(true);
    for (const p of projects.filter((x) => x.manifestSha256 !== undefined)) {
      const sha = createHash('sha256').update(fs.readFileSync(path.join(FIXTURES, p.dir, 'expected-semantic.json'))).digest('hex');
      expect({ id: p.id, sha }).toEqual({ id: p.id, sha: p.manifestSha256 });
    }
  });

  it('every manifest and parent block loads, and every subject resolves in its case APG', async () => {
    for (const p of projects) {
      const layers = JSON.parse(fs.readFileSync(path.join(FIXTURES, p.layers), 'utf8')) as LayerModel;
      const block = (JSON.parse(fs.readFileSync(path.join(FIXTURES, p.ns02), 'utf8')) as { ns02: Ns02Block }).ns02;
      expect(block.expectedFacts.length + block.expectedVerdicts.length).toBeGreaterThan(0);
      const input = await prepareOntologyInput(path.join(FIXTURES, p.dir), { layerModel: layers });
      const names = [...block.expectedFacts.flatMap((f) => [f.subject, ...(typeof (f.value as { other?: unknown } | undefined)?.other === 'string' ? [(f.value as { other: string }).other] : [])]), ...block.expectedVerdicts.flatMap((v) => v.sites ?? [])];
      for (const n of names) expect(() => resolveSubject(n, input.apg)).not.toThrow();
    }
  }, 240_000);

  it('BR-U3-16: the cheap outcome is the same on case-09 and case-09t', async () => {
    const outcome = async (id: string, polarity: 'expect' | 'forbid'): Promise<boolean> => {
      const dir = path.join(FIXTURES, 'ns02', id);
      const layers = JSON.parse(fs.readFileSync(path.join(dir, 'layers.json'), 'utf8')) as LayerModel;
      const m = JSON.parse(fs.readFileSync(path.join(dir, 'expected-semantic.json'), 'utf8')) as ExpectedSemanticManifest;
      const input = await prepareOntologyInput(dir, { layerModel: layers });
      const item = m[polarity].misplacedResponsibilities.find((i) => i.class === 'OrderController');
      if (item === undefined) throw new Error(`no OrderController item in ${id}`);
      return cheapOutcome('misplacedResponsibilities', item, input.cheap, input.apg);
    };
    const defect = await outcome('case-09-limit-only-in-controller', 'expect');
    const twin = await outcome('case-09t-control-length-check-in-controller', 'forbid');
    expect(defect).toBe(twin);
  }, 120_000);
});
