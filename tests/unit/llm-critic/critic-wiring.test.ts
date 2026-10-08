/**
 * U4 plan Step 21 (U4-K4): the critic judges real units through the cassette decorator, with
 * selection, completeness, aggregation and stable ids (BR-U4-CTX-01, SEL-05, AGG-03, 05, 06, 09,
 * VIO-02, VRD-04, OPS-01, OPS-03; BR-U3-51; T1, T3, T10, T17, T18, T19).
 *
 * Input: `fixtures/correct-reference` with its graph view recorded from the lane graph
 * (`tests/fixtures/judge-graph/correct-reference.view.json`), the `specs/clean-arch.yaml` layers,
 * a Mock or scripted provider, and a fresh temp cassette dir per run. No Neo4j, no CLI.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { PipelineWarning } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../src/shared/interfaces/llm-provider.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { NeuronalInstruction, ProviderDescription } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { computeViolationId } from '../../../src/evaluation-engine/violation-id.js';
import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import type { NeuronalEvalOutput } from '../../../src/llm-critic/llm-critic.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import type { NeuronalEvalInput, NeuronalRunOptions } from '../../../src/llm-critic/types.js';
import { FF_N01_RUBRIC, FF_N02_RUBRIC } from '../../../src/llm-critic/rubric.js';
import { listCassetteKeys } from '../../../src/llm-critic/cassette-manager.js';
import { JUDGE_EFFORT, JUDGE_MAX_TOKENS, JUDGE_MODEL } from '../../../src/llm-critic/frozen.js';

const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'fixtures/correct-reference');
const VIEW = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/judge-graph/correct-reference.view.json'), 'utf8')) as JudgeGraphView;

const LAYERS: LayerDefinition[] = [
  { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain', kind: 'domain' },
  { name: 'application', directories: ['src/application/**'], naming: [], role: 'application', kind: 'application' },
  { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'infrastructure', kind: 'infrastructure' },
];

const FILE_UNITS = VIEW.files.map((f) => f.path).sort();
const MODULE_UNITS = ['src/application/use-cases', 'src/domain/entities', 'src/domain/repositories', 'src/infrastructure'];

function instruction(id: 'FF-N01' | 'FF-N02'): NeuronalInstruction {
  const rubric = id === 'FF-N01' ? FF_N01_RUBRIC : FF_N02_RUBRIC;
  return {
    functionId: functionId(id), name: id, dimension: id === 'FF-N01' ? 'integrity' : 'semantic', severity: 'major',
    route: 'neuronal',
    semanticCriteria: { rule: rubric.rule, rubric: { pass: rubric.pass, fail: rubric.fail, evidenceRequired: rubric.evidenceRequired } },
    contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true },
    shadowModeEligible: false, source: 'fitness-function', judgeUnit: id === 'FF-N01' ? 'module' : 'file',
  };
}

const NO_GRAPH: GraphRepository = {
  executeQuery: () => Promise.resolve(DomainResult.fail([{ code: 'NEO4J_QUERY_FAILED', message: 'no graph in this test' }])),
  clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
  healthCheck: () => Promise.resolve(true),
  close: () => Promise.resolve(),
};

const tmpDirs: string[] = [];
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-k4-'));
  tmpDirs.push(d);
  return d;
}

/** Every warning emitted in this suite, for the BR-U3-51 `context.functionId` check. */
const allWarnings: PipelineWarning[] = [];

afterAll(() => {
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
  // BR-U3-51: every JUDGE_NO_UNITS warning emitted in this suite carries its function id.
  const noUnits = allWarnings.filter((w) => w.code === 'JUDGE_NO_UNITS');
  expect(noUnits.length).toBeGreaterThan(0);
  for (const w of noUnits) expect(typeof w.context?.functionId).toBe('string');
});

function verdict(pass: boolean, conf: number, violations: { filePath: string; message: string }[] = [], reasoning = 'r'): string {
  return JSON.stringify({ pass, confidence: conf, reasoning, evidence: [`e-${reasoning}`], violations });
}

type Answer = string | { readonly error: string };

/** Scripted provider: answers by call context; optional delay; records calls. */
class ScriptedProvider implements LLMProvider {
  readonly name = 'scripted';
  readonly calls: LLMCallContext[] = [];
  constructor(
    private readonly answer: (call: LLMCallContext, n: number) => Answer,
    private readonly delayMs: (call: LLMCallContext) => number = () => 0,
  ) {}
  describe(): ProviderDescription { return { provider: 'mock', model: 'mock-model' }; }
  async evaluate(_prompt: string, _options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const c = call ?? { runIndex: 0, repetition: 0, functionId: '?' };
    const n = this.calls.push(c);
    const d = this.delayMs(c);
    if (d > 0) await new Promise((r) => setTimeout(r, d));
    const a = this.answer(c, n);
    if (typeof a !== 'string') return DomainResult.fail([{ code: a.error, message: `${a.error} from stub` }]);
    return DomainResult.ok({ content: a, model: 'mock-model', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [] });
  }
}

async function run(
  instructions: NeuronalInstruction[],
  provider: LLMProvider,
  options: Partial<NeuronalRunOptions> = {},
  extra: Partial<NeuronalEvalInput> = {},
): Promise<NeuronalEvalOutput> {
  const dir = options.cassette?.dir ?? tmpDir();
  const result = await evaluateNeuronal({
    instructions, graphRepository: NO_GRAPH, provider, projectRoot: ROOT, graphView: VIEW, knownSecrets: [],
    options: { evaluatorSpecLayers: LAYERS, ...options, cassette: { mode: 'record', dir, omitPrompt: false, ...options.cassette } },
    ...extra,
  });
  if (!result.success) throw new Error(result.errors.map((e) => e.code).join(','));
  allWarnings.push(...result.data.warnings);
  return result.data;
}

describe('critic wiring (U4-K4)', () => {
  it('T1 / CTX-01: the prompt holds a unique line of the unit\'s real source (placeholder gone)', async () => {
    const mock = new MockLLMProvider();
    await run([instruction('FF-N02')], mock);
    const first = FILE_UNITS[0] ?? '';
    const source = fs.readFileSync(path.join(ROOT, first), 'utf8');
    const unique = source.split('\n').find((l) => l.includes('class ') || l.includes('interface ')) ?? '';
    expect(unique.length).toBeGreaterThan(0);
    expect(mock.getPrompts()[0]).toContain(unique.trim());
    expect(mock.getPrompts().some((p) => p.includes('placeholder'))).toBe(false);
  });

  it('OPS-01 / T3: the provider receives NeuronalRunOptions.llm (the :61-66 literals are gone)', async () => {
    const mock = new MockLLMProvider();
    await run([instruction('FF-N02')], mock);
    expect(mock.getLastOptions()).toEqual({ model: JUDGE_MODEL, effort: JUDGE_EFFORT, maxTokens: JUDGE_MAX_TOKENS });
    expect(mock.getLastOptions()).toEqual({ model: 'claude-opus-5-5', effort: 'high', maxTokens: 8192 });
    expect(mock.getLastCall()).toEqual(expect.objectContaining({ repetition: 0, functionId: 'FF-N02' }));
  });

  it('T17: one unit result per selected unit, unitsCapped = 0 on the fixture graph (file and module units)', async () => {
    const out = await run([instruction('FF-N01'), instruction('FF-N02')], new MockLLMProvider());
    expect(out.completeness).toEqual({ status: 'complete' });
    const [n01, n02] = out.results;
    expect(n01?.unitResults.map((u) => u.unitId)).toEqual(MODULE_UNITS);
    expect(n02?.unitResults.map((u) => u.unitId)).toEqual(FILE_UNITS);
    for (const r of out.results) {
      expect(r.unitsCapped).toBe(0);
      expect(r.unitsSelected).toBe(r.unitResults.length);
      for (const u of r.unitResults) expect(u.runs).toHaveLength(3);
    }
  });

  it('producer test: every new field is defined (DE §4.3, §4.4), failures [] when empty', async () => {
    const out = await run([instruction('FF-N01'), instruction('FF-N02')], new MockLLMProvider());
    expect(out.failures).toEqual([]);
    for (const r of out.results) {
      for (const key of ['unitsInvalidByCause', 'candidateExclusions', 'candidateCount', 'uncoveredFileCount', 'truncatedUnits',
        'excerptTruncatedUnits', 'selection', 'aggregationRule'] as const) {
        expect(r[key]).toBeDefined();
      }
      expect(r.aggregationRule).toBe('majority-of-valid-units-v1');
      expect(r.selection?.source).toBe('own');
      expect(r.removedByVariant).toBeUndefined();
      expect(r.icc).toBe(0);
      expect(r.runs).toEqual([]);
      for (const u of r.unitResults) {
        for (const key of ['layer', 'filePaths', 'status', 'flaggedUnstable', 'validRunCount', 'invalidRunCauses', 'truncated'] as const) {
          expect(u[key]).toBeDefined();
        }
        expect(u.origin).toBeUndefined();
      }
    }
    expect(out.results[0]?.singleFileModules).toBeDefined();   // module function
    expect(out.results[1]?.singleFileModules).toBeUndefined(); // file function
  });

  it('AGG-08: an all-pass Integrity function keeps dimension integrity and lists no violation', async () => {
    const out = await run([instruction('FF-N01')], new MockLLMProvider());
    expect(out.results[0]).toEqual(expect.objectContaining({ dimension: 'integrity', verdict: 'pass', violations: [] }));
  });

  it('T18 / VIO-02: neural ids come from computeViolationId with [unitId] and are stable across runs and run orders', async () => {
    const target = 'src/domain/entities/Task.ts';
    const answer = (c: LLMCallContext): Answer => (c.unitId === target
      ? verdict(false, 0.6 + c.runIndex / 10, [{ filePath: target, message: `wording ${String(c.runIndex)}` }], `run${String(c.runIndex)}`)
      : verdict(true, 0.9));
    const a = await run([instruction('FF-N02')], new ScriptedProvider(answer));
    const b = await run([instruction('FF-N02')], new ScriptedProvider(answer, (c) => 30 - c.runIndex * 10));
    const ids = (o: NeuronalEvalOutput): string[] => o.results.flatMap((r) => r.violations.map((v) => v.id));
    expect(ids(a)).toEqual([computeViolationId({ functionId: 'FF-N02', filePath: target, discriminator: [target] })]);
    expect(ids(b)).toEqual(ids(a));
    // VIO-01: message of the most confident citing run
    expect(a.results[0]?.violations[0]?.message).toBe('wording 2');
    expect(a.results[0]?.verdict).toBe('warning'); // one failing unit of ten (BLM §8)
  });

  it('OPS-03: seeded random delays give an identical NeuronalEvalOutput over 10 runs', async () => {
    let seed = 7;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const answer = (c: LLMCallContext): Answer =>
      verdict(c.runIndex !== 1 || (c.unitId ?? '').includes('application'), 0.5 + (c.runIndex * 0.1), [], `${c.unitId ?? ''}-${String(c.runIndex)}`);
    const outputs: string[] = [];
    for (let i = 0; i < 10; i++) {
      const out = await run([instruction('FF-N01'), instruction('FF-N02')], new ScriptedProvider(answer, () => Math.floor(rand() * 8)));
      outputs.push(JSON.stringify(out));
    }
    expect(new Set(outputs).size).toBe(1);
  });

  it('T10 / AGG-03: usage limit on call 4 of 6 → incomplete, manifest of the outstanding calls; resume issues only those', async () => {
    const dir = tmpDir();
    const options: Partial<NeuronalRunOptions> = { unitCap: 2, maxConcurrency: 1, cassette: { mode: 'record', dir, omitPrompt: false } };
    const limited = new ScriptedProvider((_c, n) => (n === 4 ? { error: 'LLM_USAGE_LIMIT' } : verdict(true, 0.8)));
    const first = await run([instruction('FF-N02')], limited, options);
    expect(first.completeness).toEqual({ status: 'incomplete', stop: 'USAGE_LIMIT', outstanding: 3 });
    expect(first.results).toEqual([]);
    expect(first.failures).toEqual([]);
    expect(first.manifest?.stop).toBe('USAGE_LIMIT');
    expect(first.manifest?.completedCalls).toBe(3);
    expect(first.manifest?.outstanding.map((o) => o.runIndex)).toEqual([0, 1, 2]);
    expect(new Set(first.manifest?.outstanding.map((o) => o.unitId)).size).toBe(1);
    expect(listCassetteKeys(dir)).toHaveLength(3);
    expect(first.warnings.some((w) => w.code === 'JUDGE_RUN_INCOMPLETE')).toBe(true);

    const working = new ScriptedProvider(() => verdict(true, 0.8));
    const resumed = await run([instruction('FF-N02')], working, options);
    expect(resumed.completeness).toEqual({ status: 'complete' });
    expect(working.calls).toHaveLength(3);
    expect(working.calls.map((c) => c.unitId)).toEqual(first.manifest?.outstanding.map((o) => o.unitId));
    expect(resumed.results[0]?.unitsSelected).toBe(2);
    expect(listCassetteKeys(dir)).toHaveLength(6);
  });

  it('T19 / AGG-05: fewer than half the units valid → INSUFFICIENT_VALID_RUNS in failures, no result', async () => {
    const out = await run([instruction('FF-N02')], new ScriptedProvider((c) =>
      (FILE_UNITS.slice(0, 4).includes(c.unitId ?? '') ? verdict(true, 0.9) : 'not json')));
    expect(out.results).toEqual([]);
    expect(out.failures).toHaveLength(1);
    expect(out.failures[0]).toEqual(expect.objectContaining({ functionId: 'FF-N02', name: 'FF-N02', code: 'INSUFFICIENT_VALID_RUNS' }));
    expect(out.failures[0]?.message).toBe('4 of 10 selected units valid for FF-N02 (invalid units by cause: PARSE_FAILURE: 6)');
    expect(out.warnings.filter((w) => w.code === 'INSUFFICIENT_VALID_RUNS')).toHaveLength(6);
  });

  it('AGG-09: zero selected units → no result, no failure, one JUDGE_NO_UNITS with context.functionId (BR-U3-51)', async () => {
    const unlayered: JudgeGraphView = { ...VIEW, files: VIEW.files.map((f) => ({ ...f, layer: null })) };
    const inst = instruction('FF-N02');
    const mock = new MockLLMProvider();
    const out = await run([inst], mock, {}, { graphView: unlayered });
    expect(out.results).toEqual([]);
    expect(out.failures).toEqual([]);
    const noUnits = out.warnings.filter((w) => w.code === 'JUDGE_NO_UNITS');
    expect(noUnits).toHaveLength(1);
    expect(noUnits[0]?.context?.functionId).toBe(String(inst.functionId));
    expect(mock.getCallCount()).toBe(0);
  });

  it('SEL-05: coverage on a capped run (candidateCount, unitsSelected, unitsCapped, exclusions, uncovered, singleFileModules)', async () => {
    const view: JudgeGraphView = {
      ...VIEW,
      files: VIEW.files.map((f) => (f.path.endsWith('ICategoryRepository.ts') ? { ...f, layer: null } : f)),
    };
    const out = await run([instruction('FF-N01'), instruction('FF-N02')], new MockLLMProvider(), { unitCap: 3 }, { graphView: view });
    const [n01, n02] = out.results;
    expect(n02).toEqual(expect.objectContaining({ candidateCount: 9, unitsSelected: 3, unitsCapped: 6, uncoveredFileCount: 1 }));
    expect(n02?.candidateExclusions).toEqual(expect.objectContaining({ unlayered: 1, barrel: 0 }));
    expect(n02?.selection?.candidateUnitIds).toHaveLength(9);
    expect(n02?.selection?.selectedUnitIds).toEqual(n02?.unitResults.map((u) => u.unitId));
    expect(n01?.unitsSelected).toBe(3);
    expect((n01?.candidateCount ?? 0) - (n01?.unitsSelected ?? 0)).toBe(n01?.unitsCapped);
    expect(n01?.singleFileModules).toBe(n01?.unitResults.filter((u) => (u.filePaths ?? []).length === 1).length);
    expect(new Set(n02?.unitResults.map((u) => u.layer)).size).toBe(3); // round-robin over layers (SEL-04)
  });

  it('VRD-04 end to end: passing runs that list violations → one VERDICT_INCONSISTENT per function with the count', async () => {
    const target = 'src/domain/entities/Task.ts';
    const out = await run([instruction('FF-N02')], new ScriptedProvider((c) => (c.unitId === target
      ? verdict(true, 0.9, [{ filePath: target, message: 'a' }, { filePath: target, message: 'b' }])
      : verdict(true, 0.9))));
    const inconsistent = out.warnings.filter((w) => w.code === 'VERDICT_INCONSISTENT');
    expect(inconsistent).toHaveLength(1);
    expect(inconsistent[0]?.context).toEqual({ functionId: 'FF-N02', count: 3 });
    expect(inconsistent[0]?.message).toContain('3 passing run(s)');
    expect(out.results[0]?.violations).toEqual([]);
  });

  it('a graph read failure is each function\'s CRITIC_001 failure, never a throw', async () => {
    const result = await evaluateNeuronal({
      instructions: [instruction('FF-N02'), instruction('FF-N01')], graphRepository: NO_GRAPH, provider: new MockLLMProvider(),
      projectRoot: ROOT, knownSecrets: [], options: { evaluatorSpecLayers: LAYERS, cassette: { mode: 'record', dir: tmpDir(), omitPrompt: false } },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.results).toEqual([]);
      expect(result.data.failures.map((f) => [String(f.functionId), f.code])).toEqual([['FF-N01', 'CRITIC_001'], ['FF-N02', 'CRITIC_001']]);
    }
  });

  it('a unit file that cannot be read is that function\'s CRITIC_001 failure; other functions still judge', async () => {
    const view: JudgeGraphView = { ...VIEW, files: [...VIEW.files, { path: 'src/domain/entities/Ghost.ts', layer: 'domain', isBarrel: false }] };
    const out = await run([instruction('FF-N01'), instruction('FF-N02')], new MockLLMProvider(), {}, { graphView: view });
    expect(out.failures.map((f) => [String(f.functionId), f.code])).toEqual([['FF-N01', 'CRITIC_001'], ['FF-N02', 'CRITIC_001']]);
    const other = await run([instruction('FF-N02')], new MockLLMProvider(), {}, {
      graphView: view, excludePaths: { 'FF-N02': ['src/domain/entities/Ghost.ts'] },
    });
    expect(other.failures).toEqual([]);
    expect(other.results[0]?.candidateExclusions?.['exclude-paths']).toBe(1);
  });

  it('SEL-07: a baseline without the function\'s row is LLM_BASELINE_SELECTION_MISSING', async () => {
    const result = await evaluateNeuronal({
      instructions: [instruction('FF-N02')], graphRepository: NO_GRAPH, provider: new MockLLMProvider(), projectRoot: ROOT,
      graphView: VIEW, knownSecrets: [],
      options: { evaluatorSpecLayers: LAYERS, baseline: [], cassette: { mode: 'record', dir: tmpDir(), omitPrompt: false } },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
  });

  it('SEL-07: a variant run reuses the baseline selection and records removedByVariant', async () => {
    const base = await run([instruction('FF-N02')], new MockLLMProvider(), { unitCap: 2 });
    const selection = base.results[0]?.selection;
    expect(selection).toBeDefined();
    if (selection === undefined) return;
    const variant = await run([instruction('FF-N02')], new MockLLMProvider(), {
      baseline: [{ ...selection, selectedUnitIds: [...selection.selectedUnitIds, 'src/gone.ts'] }],
    });
    expect(variant.results[0]?.selection?.source).toBe('baseline');
    expect(variant.results[0]?.unitResults.map((u) => u.unitId)).toEqual(selection.selectedUnitIds);
    expect(variant.results[0]?.removedByVariant).toEqual(['src/gone.ts']);
  });
});
