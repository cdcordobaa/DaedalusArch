/**
 * U4 plan Step 25: the C9 hunks applied to the U3-owned evaluation commands, pipeline factory and
 * CLI (D-U4-7, D-U4-8; BR-U4-ISO-01, ISO-04, ISO-09, AGG-03, AGG-06, SEL-07, RTR-03; FR-13, FR-23).
 * Command tests use the recorded correct-reference graph, a Mock or stub provider and temp
 * cassette dirs; the CLI exit codes are checked with a stubbed pipeline. No Neo4j, no live CLI.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { LLMCallContext, LLMProvider, LLMResponse } from '../../../src/shared/interfaces/llm-provider.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { CompiledFunctions, NeuronalInstruction, ProviderDescription } from '../../../src/shared/types/evaluation.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { RouteEvaluateCommand } from '../../../src/pipeline/commands/route-evaluate-command.js';
import { NeuronalEvaluateCommand } from '../../../src/pipeline/commands/neuronal-evaluate-command.js';
import { PipelineExecutor } from '../../../src/pipeline/pipeline-executor.js';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineCommand } from '../../../src/shared/interfaces/pipeline-stage.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { ClaudeCliProvider } from '../../../src/llm-critic/claude-cli-provider.js';
import { JUDGE_GRAPH_QUERIES } from '../../../src/llm-critic/judge-graph.js';
import { JUDGE_RUN_INCOMPLETE, judgeKnownSecrets, judgeStageNeeded, neuralRowsOf } from '../../../src/llm-critic/judge-stage.js';
import type { JudgeRunHolder, JudgeStageSettings } from '../../../src/llm-critic/judge-stage.js';
import { toNeuralResultRows } from '../../../src/llm-critic/neural-result-rows.js';
import { listCassetteKeys, readCassetteEntry, readRunManifest, runManifestPath, writeCassetteEntry } from '../../../src/llm-critic/cassette-manager.js';
import { FF_N02_RUBRIC } from '../../../src/llm-critic/rubric.js';
import { PINNED_CLI_VERSION } from '../../../src/llm-critic/frozen.js';
import { DEFAULT_NEURONAL_RUN_OPTIONS } from '../../../src/llm-critic/types.js';

const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'fixtures/correct-reference');
const GRAPH_FIX = path.join(REPO, 'tests/fixtures/judge-graph');
const CLI_FIX = path.join(REPO, 'tests/fixtures/claude-cli');

const dirs: string[] = [];
function tmpDir(prefix = 'u4-c9-'): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** Answers the judge-graph queries with the recorded correct-reference results. */
function recordedGraph(): GraphRepository {
  const byText = new Map<string, string>(Object.entries(JUDGE_GRAPH_QUERIES).map(([name, q]) => [q, name]));
  return {
    executeQuery: (cypher: string) => {
      const name = byText.get(cypher);
      if (name === undefined) return Promise.resolve(DomainResult.fail([{ code: 'NEO4J_QUERY_FAILED', message: 'unexpected query' }]));
      return Promise.resolve(DomainResult.ok(JSON.parse(fs.readFileSync(path.join(GRAPH_FIX, `correct-reference.${name}.json`), 'utf8')) as QueryResult));
    },
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  };
}

const N02: NeuronalInstruction = {
  functionId: functionId('FF-N02'), name: 'intent-alignment', dimension: 'semantic', severity: 'major', route: 'neuronal',
  semanticCriteria: { rule: FF_N02_RUBRIC.rule, rubric: { pass: FF_N02_RUBRIC.pass, fail: FF_N02_RUBRIC.fail, evidenceRequired: FF_N02_RUBRIC.evidenceRequired } },
  contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true }, shadowModeEligible: false, source: 'fitness-function', judgeUnit: 'file',
};
const COMPILED: CompiledFunctions = { symbolicQueries: [], neuronalInstructions: [N02], hybridPairs: [], totalCompiled: 1, disabledFunctions: [], warnings: [] };
const SPEC = {
  specVersion: '1', layerModel: { layers: [
    { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain', kind: 'domain' },
    { name: 'application', directories: ['src/application/**'], naming: [], role: 'application', kind: 'application' },
    { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'infrastructure', kind: 'infrastructure' },
  ] },
  fitnessFunctions: [{ id: functionId('FF-N02'), excludePaths: ['src/infrastructure/controllers/**'] }],
} as unknown as ParsedSpec;

function context(): FirewallContext {
  const ctx = new FirewallContext(runId('u4-c9'));
  ctx.setParsedSpec(SPEC);
  ctx.setCompiledFunctions(COMPILED);
  return ctx;
}

function stage(overrides: Partial<JudgeStageSettings['run']> = {}): JudgeStageSettings {
  const holder: JudgeRunHolder = {};
  return {
    projectRoot: ROOT, specSha: 'spec-sha', knownSecrets: [], holder,
    run: {
      llm: DEFAULT_NEURONAL_RUN_OPTIONS.llm, repetition: 0,
      cassette: { mode: 'record', dir: tmpDir('u4-c9-cas-'), omitPrompt: false }, ...overrides,
    },
  };
}

class LimitedProvider implements LLMProvider {
  readonly name = 'limited';
  calls = 0;
  describe(): ProviderDescription { return { provider: 'mock', model: 'mock-model' }; }
  evaluate(_p: string, _o: unknown, _c?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.calls++;
    if (this.calls >= 4) return Promise.resolve(DomainResult.fail([{ code: 'LLM_USAGE_LIMIT', message: "You've hit your limit" }]));
    return Promise.resolve(DomainResult.ok({
      content: JSON.stringify({ pass: true, confidence: 0.9, reasoning: 'r', evidence: [], violations: [] }),
      model: 'mock-model', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [],
    }));
  }
}

/** A command that would assemble the report; it must never run after an incomplete judge run. */
class ReportProbe implements PipelineCommand {
  readonly name = 'assemble-report';
  ran = false;
  execute(): Promise<DomainResult<void>> {
    this.ran = true;
    return Promise.resolve(DomainResult.ok(undefined));
  }
}

describe.each([
  ['RouteEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new RouteEvaluateCommand(recordedGraph(), p, 'full', s)],
  ['NeuronalEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new NeuronalEvaluateCommand(recordedGraph(), p, s)],
] as const)('%s with the judge stage', (_name, make) => {
  it('a complete run: results, failures forwarded, rows and provenance reach the report input; spec excludes applied', async () => {
    const s = stage();
    const ctx = context();
    const result = await make(new MockLLMProvider(), s).execute(ctx);
    expect(result.success).toBe(true);
    const evaluation = ctx.getEvaluationResults();
    expect(evaluation.failures).toEqual([]);
    expect(evaluation.neuronalResults.map((r) => String(r.functionId))).toEqual(['FF-N02']);
    expect(evaluation.neuronalResults[0]?.candidateExclusions?.['exclude-paths']).toBe(1);
    // the rows U3's builder receives (BR-U3-65) are the mapper over the recorded output
    expect(neuralRowsOf(s.holder)).toEqual(toNeuralResultRows(evaluation.neuronalResults));
    expect(s.holder.judge).toEqual(expect.objectContaining({ provider: 'mock', cassetteMode: 'record', runsPerUnit: 3, seededList: [] }));
  });

  it('AGG-03: an incomplete run writes the manifest, fails with JUDGE_RUN_INCOMPLETE and no report is assembled', async () => {
    const s = stage();
    const ctx = context();
    const probe = new ReportProbe();
    const executor = new PipelineExecutor([make(new LimitedProvider(), { ...s, run: { ...s.run } }), probe], ctx);
    const outcome = await executor.execute();
    expect(outcome.success).toBe(false);
    if (!outcome.success) expect(outcome.errors[0]?.code).toBe(JUDGE_RUN_INCOMPLETE);
    expect(probe.ran).toBe(false);
    expect(() => ctx.getEvaluationResults()).toThrow();
    const manifest = readRunManifest(s.run.cassette.dir, ROOT, 'spec-sha');
    expect(manifest?.stop).toBe('USAGE_LIMIT');
    expect(fs.existsSync(runManifestPath(s.run.cassette.dir, ROOT, 'spec-sha'))).toBe(true);

    // resume in record mode completes and removes the manifest
    const resumed = await make(new MockLLMProvider(), s).execute(context());
    expect(resumed.success).toBe(true);
    expect(readRunManifest(s.run.cassette.dir, ROOT, 'spec-sha')).toBeNull();
  });

  it('SEL-07: a missing baseline report is LLM_BASELINE_SELECTION_MISSING (critical, exit 2), nothing judged', async () => {
    const provider = new MockLLMProvider();
    const result = await make(provider, stage({ baselineReport: path.join(tmpDir(), 'absent.json') })).execute(context());
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
      expect((result.errors[0] as { critical?: boolean }).critical).toBe(true);
    }
    expect(provider.getCallCount()).toBe(0);
  });
});

// ── C14 pre-flight through the commands (exit 2 paths) ────────────────────────────────────

function proc(stdout: string): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1 };
}

class PreflightRunner implements ProcessRunner {
  judgeCalls = 0;
  constructor(private readonly version: string) {}
  run(_c: string, args: readonly string[], _o: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    if (args[0] === '--version') return Promise.resolve(DomainResult.ok(proc(`${this.version} (Claude Code)\n`)));
    if (args.includes('stream-json')) {
      const init = fs.readFileSync(path.join(CLI_FIX, 'init-clean.json'), 'utf8');
      return Promise.resolve(DomainResult.ok(proc(`${JSON.stringify(JSON.parse(init))}\n`)));
    }
    this.judgeCalls++;
    return Promise.resolve(DomainResult.ok(proc(fs.readFileSync(path.join(CLI_FIX, 'envelope-schema-tools-off.json'), 'utf8'))));
  }
}

function judgeDir(extra?: string): string {
  const dir = tmpDir('u4-c9-cfg-');
  fs.writeFileSync(path.join(dir, '.claude.json'), '{}');
  if (extra !== undefined) {
    fs.mkdirSync(path.dirname(path.join(dir, extra)), { recursive: true });
    fs.writeFileSync(path.join(dir, extra), '{}');
  }
  return dir;
}

function cli(runner: ProcessRunner, dir: string): ClaudeCliProvider {
  return new ClaudeCliProvider({ judgeConfigDir: dir, mode: 'record', projectRoot: ROOT }, { runner, parentEnv: { PATH: '/usr/bin:/bin', HOME: tmpDir() }, tmpRoot: tmpDir() });
}

describe('exit-2 command paths of the record-mode pre-flight', () => {
  it('ISO-04: an unlisted entry in the judge config dir → LLM_CLI_ISOLATION, no judge call, no results', async () => {
    const runner = new PreflightRunner(PINNED_CLI_VERSION);
    const ctx = context();
    const result = await new RouteEvaluateCommand(recordedGraph(), cli(runner, judgeDir('plugins/known_marketplaces.json')), 'full', stage()).execute(ctx);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors[0]?.code).toBe('LLM_CLI_ISOLATION');
      expect(result.errors[0]?.message).toContain('outside the allow-list');
    }
    expect(runner.judgeCalls).toBe(0);
    expect(() => ctx.getEvaluationResults()).toThrow();
    // control: the same command with a clean judge dir passes the pre-flight and judges
    const clean = new PreflightRunner(PINNED_CLI_VERSION);
    const ok = await new RouteEvaluateCommand(recordedGraph(), cli(clean, judgeDir()), 'full', stage()).execute(context());
    expect(ok.success).toBe(true);
    expect(clean.judgeCalls).toBeGreaterThan(0);
  });

  it('ISO-09: a drifted `claude --version` → LLM_CLI_VERSION_DRIFT before any call', async () => {
    const runner = new PreflightRunner('2.1.300');
    const result = await new NeuronalEvaluateCommand(recordedGraph(), cli(runner, judgeDir()), stage()).execute(context());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_CLI_VERSION_DRIFT');
    expect(runner.judgeCalls).toBe(0);
  });
});

// ── Review follow-ups: CAS-07 secrets, CAS-10 warning, ISO-05 disposal, no-neural-work skip ──

/** Echoes a parent-env secret into the verdict reasoning, as a model might. */
class EchoProvider implements LLMProvider {
  readonly name = 'echo';
  constructor(private readonly echoed: string) {}
  describe(): ProviderDescription { return { provider: 'mock', model: 'mock-model' }; }
  evaluate(): Promise<DomainResult<LLMResponse>> {
    return Promise.resolve(DomainResult.ok({
      content: JSON.stringify({ pass: true, confidence: 0.9, reasoning: `the run used ${this.echoed} here`, evidence: [], violations: [] }),
      model: 'mock-model', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [],
    }));
  }
}

function cassetteText(dir: string): string {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => fs.readFileSync(path.join(e.parentPath, e.name), 'utf8'))
    .join('\n');
}

describe('judge stage review follow-ups', () => {
  const SECRET = 'zq7plainvalue0x9noshape';
  const savedToken = process.env.FOO_TOKEN;
  beforeEach(() => { process.env.FOO_TOKEN = SECRET; });
  afterEach(() => {
    if (savedToken === undefined) delete process.env.FOO_TOKEN;
    else process.env.FOO_TOKEN = savedToken;
  });

  it('CAS-07: judgeKnownSecrets is the env-derived list united with the Neo4j policy secrets, sorted and deduplicated', () => {
    expect(judgeKnownSecrets(['neo4j-pw', 'b-host:7687', 'neo4j-pw'], { FOO_TOKEN: 'tok', PATH: '/bin', DB_PASSWORD: 'neo4j-pw' }))
      .toEqual(['b-host:7687', 'neo4j-pw', 'tok']);
  });

  it.each(['full', 'neuronal-only'] as const)('CAS-07: createPipeline (%s) gives the judge stage the env list united with the Neo4j policy secrets', (evaluationMode) => {
    const bundle = createPipeline({
      projectPath: ROOT, specFilePath: path.join(tmpDir(), 'spec.yaml'), neo4jUri: 'bolt://localhost:7687', neo4jUser: 'neo4j',
      neo4jPassword: 'neo4j-policy-pw-for-tests', evaluationMode, pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
      apgStorePath: tmpDir('u4-c9-apg-'),
    });
    const executor = bundle.executor as unknown as { commands: readonly { judge?: { knownSecrets: readonly string[] } }[] };
    const secrets = executor.commands.find((c) => c.judge !== undefined)?.judge?.knownSecrets ?? [];
    // booleans only: the list carries real parent-env values, which a failure diff must never print
    expect(secrets.includes(SECRET)).toBe(true);
    expect(secrets.includes('neo4j-policy-pw-for-tests')).toBe(true);
  });

  it.each([
    ['RouteEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new RouteEvaluateCommand(recordedGraph(), p, 'full', s)],
    ['NeuronalEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new NeuronalEvaluateCommand(recordedGraph(), p, s)],
  ] as const)('CAS-07 (%s): an unshaped env *_TOKEN echoed by the judge is redacted in the cassette and the result', async (_n, make) => {
    // control: the pre-fix wiring (Neo4j policy secrets only) writes the value to disk
    const leaky = { ...stage(), knownSecrets: ['neo4j-pw'] };
    expect((await make(new EchoProvider(SECRET), leaky).execute(context())).success).toBe(true);
    expect(cassetteText(leaky.run.cassette.dir).includes(SECRET)).toBe(true); // booleans: never print stored text

    const s = { ...stage(), knownSecrets: judgeKnownSecrets(['neo4j-pw']) };
    const ctx = context();
    expect((await make(new EchoProvider(SECRET), s).execute(ctx)).success).toBe(true);
    const stored = cassetteText(s.run.cassette.dir);
    expect(stored.length).toBeGreaterThan(0);
    expect(stored.includes(SECRET)).toBe(false);
    expect(stored.includes('[REDACTED]')).toBe(true);
    expect(JSON.stringify(ctx.getEvaluationResults()).includes(SECRET)).toBe(false);
  });

  it('CAS-10: a replay over one re-stamped entry adds JUDGE_PROVENANCE_MIXED to the context', async () => {
    const recorded = stage();
    expect((await new NeuronalEvaluateCommand(recordedGraph(), new MockLLMProvider(), recorded).execute(context())).success).toBe(true);
    const dir = recorded.run.cassette.dir;
    const [first] = listCassetteKeys(dir);
    const entry = first === undefined ? null : readCassetteEntry(dir, first);
    if (entry === null) throw new Error('no entry');
    writeCassetteEntry(dir, { ...entry, model: 'restamped-model' });

    const replay = stage({ cassette: { mode: 'replay', dir, omitPrompt: false } });
    const ctx = context();
    expect((await new NeuronalEvaluateCommand(recordedGraph(), new MockLLMProvider(), replay).execute(ctx)).success).toBe(true);
    expect(replay.holder.judge?.provenanceMixed).toBe(true);
    expect(ctx.warnings.map((w) => w.code)).toContain('JUDGE_PROVENANCE_MIXED');

    // control: an unmixed replay adds no such warning
    const clean = stage();
    expect((await new NeuronalEvaluateCommand(recordedGraph(), new MockLLMProvider(), clean).execute(context())).success).toBe(true);
    const cleanCtx = context();
    await new NeuronalEvaluateCommand(recordedGraph(), new MockLLMProvider(), stage({ cassette: { mode: 'replay', dir: clean.run.cassette.dir, omitPrompt: false } })).execute(cleanCtx);
    expect(cleanCtx.warnings.map((w) => w.code)).not.toContain('JUDGE_PROVENANCE_MIXED');
  });

  it.each([
    ['RouteEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new RouteEvaluateCommand(recordedGraph(), p, 'full', s)],
    ['NeuronalEvaluateCommand', (p: LLMProvider, s: JudgeStageSettings): PipelineCommand => new NeuronalEvaluateCommand(recordedGraph(), p, s)],
  ] as const)('ISO-05 (%s): an early failure after the pre-flight still removes the neutral cwd', async (_n, make) => {
    const tmpRoot = tmpDir('u4-c9-tmproot-');
    const runner = new PreflightRunner(PINNED_CLI_VERSION);
    const provider = new ClaudeCliProvider({ judgeConfigDir: judgeDir(), mode: 'record', projectRoot: ROOT }, { runner, parentEnv: { PATH: '/usr/bin:/bin', HOME: tmpDir() }, tmpRoot });
    const result = await make(provider, stage({ baselineReport: path.join(tmpDir(), 'absent.json') })).execute(context());
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
    expect(provider.isolationResult()).not.toBeNull(); // the pre-flight ran and created the neutral cwd
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  it('no neural work: judgeStageNeeded is false and full mode runs without the CLI pre-flight', async () => {
    const symbolicOnly: CompiledFunctions = { ...COMPILED, neuronalInstructions: [] };
    expect(judgeStageNeeded(symbolicOnly, 'full')).toBe(false);
    expect(judgeStageNeeded(COMPILED, 'full')).toBe(true);
    expect(judgeStageNeeded(COMPILED, 'symbolic-only')).toBe(false);
    expect(judgeStageNeeded({ ...symbolicOnly, hybridPairs: [{} as never] }, 'full')).toBe(true);
    expect(judgeStageNeeded({ ...symbolicOnly, hybridPairs: [{} as never] }, 'neuronal-only')).toBe(false);

    // a drifted CLI would fail the pre-flight; with no neural work the run never reaches it
    const runner = new PreflightRunner('2.1.300');
    const spy = jest.spyOn(runner, 'run');
    const ctx = new FirewallContext(runId('u4-c9-empty'));
    ctx.setParsedSpec(SPEC);
    ctx.setCompiledFunctions({ ...symbolicOnly, totalCompiled: 0 });
    const s = stage();
    const result = await new RouteEvaluateCommand(recordedGraph(), cli(runner, judgeDir()), 'full', s).execute(ctx);
    // the router reports the empty run itself (before the fix: LLM_CLI_VERSION_DRIFT from the pre-flight)
    expect(result.success).toBe(false);
    if (!result.success) expect(result.errors[0]?.code).toBe('NO_FUNCTIONS_TO_EVALUATE');
    expect(spy).not.toHaveBeenCalled();
    expect(s.holder.judge).toBeUndefined();
  });
});

// ── CLI exit codes (stubbed pipeline) ─────────────────────────────────────────────────────

class StopRun extends Error {}

describe('CLI exit codes for judge failures', () => {
  const saved = { password: process.env.NEO4J_PASSWORD };
  let exitSpy: jest.SpyInstance;
  let stderrSpy: jest.SpyInstance;
  beforeEach(() => {
    process.env.NEO4J_PASSWORD = 'test-password-for-cli-tests';
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => { throw new StopRun(String(code)); }) as never);
    stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    exitSpy.mockRestore();
    stderrSpy.mockRestore();
    if (saved.password === undefined) delete process.env.NEO4J_PASSWORD;
    else process.env.NEO4J_PASSWORD = saved.password;
    jest.resetModules();
  });

  it.each([
    [JUDGE_RUN_INCOMPLETE, '3'],
    ['LLM_CLI_ISOLATION', '2'],
    ['LLM_CLI_VERSION_DRIFT', '2'],
    ['LLM_BASELINE_SELECTION_MISSING', '2'],
  ])('%s → exit %s, no report written', async (code, expected) => {
    jest.doMock('../../../src/pipeline/pipeline-factory.js', () => ({
      createPipeline: () => ({
        executor: { execute: () => Promise.resolve(DomainResult.fail([{ code, message: code }])), requestShutdown: () => undefined, getTimings: () => ({ totalMs: 0, stages: [] }) },
        context: {},
        commands: [],
        cleanup: () => Promise.resolve(),
      }),
    }));
    jest.doMock('dotenv', () => ({ config: jest.fn() }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { program } = require('../../../src/cli/cli.js') as { program: { parseAsync(argv: string[]): Promise<unknown> } };
    const out = path.join(tmpDir(), 'report.html');
    await expect(program.parseAsync([
      'node', 'firewall', 'report', '--project', ROOT, '--spec', 's.yaml', '--output', out, '--llm-provider', 'mock', '--judge-config-dir', tmpDir(),
    ])).rejects.toThrow(new StopRun(expected));
    expect(fs.existsSync(out)).toBe(false);
  });
});
