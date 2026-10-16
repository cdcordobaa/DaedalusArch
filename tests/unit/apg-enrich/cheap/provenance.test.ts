import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { analyseProvenance, readGitHistory, readLoopRun } from '../../../../src/apg-enrich/cheap/index.js';
import type { ProvenanceResult } from '../../../../src/apg-enrich/cheap/index.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';
import { main } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import { runDirFor } from '../../../../scripts/lib/loop/loop.js';
import { CHEAP2_FIXTURES, check, loadExpected, missingFrom, pick, replayGit } from './batch2-helpers.js';
import type { ReplayCommit } from './batch2-helpers.js';
import { LAYERS } from './helpers.js';

const STEPS = JSON.parse(fs.readFileSync(path.join(CHEAP2_FIXTURES, 'provenance', 'steps.json'), 'utf8')) as { steps: ReplayCommit[] };

const tmp = (p: string): string => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), p)));

describe('agent provenance (batch 2) on a plain git history', () => {
  let repo: string;
  let result: ProvenanceResult;
  beforeAll(async () => {
    repo = tmp('cheap2-prov-');
    replayGit(repo, STEPS.steps);
    result = await analyseProvenance(readGitHistory(repo), { layerModel: LAYERS });
  }, 120_000);
  afterAll(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('reads one snapshot per commit with the trailer metadata', () => {
    expect(result.history.steps.map((s) => `${s.turnId}:${s.stepId}:${s.arm ?? ''}:${s.modelId ?? ''}:${(s.promptSha256 ?? '').slice(0, 1)}`)).toEqual([
      'step-01:todos:none:demo-model:a', 'step-02:tags:none:demo-model:b', 'step-03:due-dates:none:demo-model:c', 'step-04:reports:none:demo-model:d',
    ]);
  });

  it('flags the planted re-implementations and none of the near misses', () => {
    expect(check(result.flags, loadExpected('provenance'))).toEqual({ missed: [], nearMissFlags: [], unexpected: [] });
    const vias = result.edges.filter((e) => e.type === 'REIMPLEMENTS').map((e) => `${String(e.properties.step)}:${String(e.properties.via)}`).sort();
    expect(vias).toEqual(['step-02:clone', 'step-03:vocabulary', 'step-04:clone']);
  });

  it('attaches created / modified provenance to files and the introducing step to edges', () => {
    const todoFile = result.nodeFacts.filter((f) => f.key.endsWith('Step') || f.key === 'modifiedAtSteps');
    const fileId = (p: string): string | undefined => result.nodeFacts.find((f) => f.key === 'createdAtStep' && result.edges.some((e) => e.type === 'CREATED_AT_STEP' && e.sourceId === f.nodeId && e.evidence[0]?.file === p))?.nodeId;
    const id = fileId('src/todos/domain/todo.ts');
    expect(id === undefined).toBe(false);
    const fact = (key: string): unknown => todoFile.find((f) => f.nodeId === id && f.key === key)?.value;
    expect(pick(fact('createdAtStep'), ['turnId', 'stepId', 'arm', 'modelId', 'promptSha256'])).toEqual({ turnId: 'step-01', stepId: 'todos', arm: 'none', modelId: 'demo-model', promptSha256: 'a'.repeat(64) });
    expect(pick(fact('lastModifiedAtStep'), ['turnId', 'promptSha256'])).toEqual({ turnId: 'step-03', promptSha256: 'c'.repeat(64) });
    expect(fact('modifiedAtSteps')).toEqual(['step-01', 'step-03']);
    expect(result.edges.filter((e) => e.sourceId === id).map((e) => `${e.type}:${e.targetId}`)).toEqual(['CREATED_AT_STEP:step:0:step-01', 'MODIFIED_AT_STEP:step:2:step-03']);
    // The domain -> infrastructure import was introduced at step 3; the port import of the adapter at step 1.
    const imports = result.edgeFacts.filter((e) => e.type === 'IMPORTS').map((e) => e.createdAt.turnId);
    expect(missingFrom(imports, ['step-01', 'step-03', 'step-04'])).toEqual([]);
  });

  it('computes the erosion delta and attributes the new blocking finding to the step of its edge', () => {
    const blocking = result.erosion.map((e) => `${e.turnId}:${String(e.newBlocking)}/${String(e.totalBlocking)}`);
    expect(blocking).toEqual(['step-01:0/0', 'step-02:0/0', 'step-03:1/1', 'step-04:0/1']);
    const f = result.erosion[2]?.newFindings.find((x) => x.tier === 'blocking');
    expect(pick(f, ['rule', 'file', 'target', 'attributedTurn', 'via'])).toEqual({ rule: 'dependency-direction', file: 'src/todos/domain/todo.ts', target: 'src/todos/infrastructure/in-memory-todo.repository.ts', attributedTurn: 'step-03', via: 'edge' });
  });

  it('attributes a new two-ended advisory finding (a clone pair) to the step that completed the pair, not to its old end', () => {
    for (const k of [1, 3]) {
      const adv = result.erosion[k]?.newFindings.filter((f) => f.tier === 'advisory') ?? [];
      expect(adv.length > 0).toBe(true);
      expect([...new Set(adv.map((f) => f.attributedTurn))]).toEqual([result.erosion[k]?.turnId]);
    }
  });

  it('measures agent locality against the feature scope', () => {
    expect(result.locality.map((l) => `${l.turnId}:${l.componentsTouched.join('+')}:${l.scope.join('+')}:${String(l.locality)}`)).toEqual([
      'step-01:todos:todos:1',
      'step-02:tags:tags:1',
      'step-03:reports+todos:reports+todos:1',
      'step-04:reports+tags+todos:reports+todos:0.6667',
    ]);
  });
});

describe('agent provenance (batch 2) on the loop harness --dry-run demo', () => {
  const DEMO_LAYERS: LayerModel = {
    layers: ['domain', 'application', 'infrastructure'].map((name) => ({ name, kind: name as 'domain', directories: [`src/${name}/**`], naming: [], role: '', filePatterns: [] })),
  };
  let outRoot: string;
  beforeAll(async () => {
    outRoot = tmp('cheap2-loop-');
    const deps: LoopMainDeps = {
      runner: { run: () => Promise.reject(new Error('the dry run spawns nothing')) },
      clock: { now: () => 0 }, sleep: () => Promise.resolve(), now: () => new Date(Date.UTC(2026, 0, 1)), parentEnv: {},
      out: () => undefined, err: () => undefined,
    };
    const code = await main(['--plan', 'experiments/loop-demo/plan.dry-run.json', '--dry-run', '--out-root', path.join(outRoot, 'out'), '--binary', '/bin/false', '--harness-root', path.join(outRoot, 'h')], process.cwd(), deps);
    expect(code).toBe(0);
  }, 120_000);
  afterAll(() => {
    fs.rmSync(outRoot, { recursive: true, force: true });
  });
  const run = (arm: string): string => runDirFor(path.join(outRoot, 'out'), `claude-code-cli/stub-model/todo-list/${arm}/run-0`);

  it('reads the snapshot store: one snapshot per turn, with arm, model and prompt hash', () => {
    const h = readLoopRun(run('gate'));
    expect(h.source).toBe('loop-store');
    expect(h.steps.map((s) => `${s.turnId}:${s.kind}:${s.stepId}:${s.arm ?? ''}:${s.modelId ?? ''}`)).toEqual([
      'step-01:step:todos:gate:stub-model', 'step-02:step:tags:gate:stub-model', 'step-02-repair:repair:tags:gate:stub-model', 'step-03:step:due-dates:gate:stub-model',
    ]);
    expect(h.steps.every((s) => /^[0-9a-f]{64}$/.test(s.promptSha256 ?? ''))).toBe(true);
    expect(h.steps[1]?.recordedFindings?.map((f) => f.ruleId)).toEqual(['STUB-DEP']);
  });

  it('attributes the planted stub violation to step-02 and shows the gate repair resolving it', async () => {
    const none = await analyseProvenance(readLoopRun(run('none')), { layerModel: DEMO_LAYERS });
    expect(none.erosion.map((e) => `${e.turnId}:+${String(e.newBlocking)}-${String(e.resolvedBlocking)}`)).toEqual(['step-01:+0-0', 'step-02:+2-0', 'step-03:+0-0']);
    expect(none.erosion[1]?.newFindings.map((f) => `${f.rule}:${f.file}>${f.target ?? ''}:${f.attributedTurn}:${f.via}`).sort()).toEqual([
      'STUB-DEP:src/domain/tags.ts>src/infrastructure/tags-store.ts:step-02:edge',
      'dependency-direction:src/domain/tags.ts>src/infrastructure/tags-store.ts:step-02:edge',
    ]);
    const gate = await analyseProvenance(readLoopRun(run('gate')), { layerModel: DEMO_LAYERS });
    expect(gate.erosion.map((e) => `${e.turnId}:+${String(e.newBlocking)}-${String(e.resolvedBlocking)}`)).toEqual(['step-01:+0-0', 'step-02:+2-0', 'step-02-repair:+0-2', 'step-03:+0-0']);
    // The demo's step services share a shape and differ in concept: no re-implementation candidate.
    expect(gate.flags).toEqual([]);
    const created = gate.nodeFacts.filter((f) => f.key === 'createdAtStep').map((f) => (f.value as { turnId: string }).turnId);
    expect(created.sort()).toEqual(['step-01', 'step-01', 'step-02', 'step-02', 'step-02', 'step-03', 'step-03']);
  }, 120_000);
});
