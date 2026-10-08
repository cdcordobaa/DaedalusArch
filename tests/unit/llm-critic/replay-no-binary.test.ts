/**
 * U4 plan Step 23: CAS-10 / OPS-06 / ISO-09 replay guard (T5). Record through `ClaudeCliProvider`
 * with a `ProcessRunner` stub answering the committed probe fixtures; replay through a fresh
 * `ClaudeCliProvider` on the real `NodeProcessRunner` with `PATH` emptied. The replayed
 * `NeuronalEvalOutput` must equal the recorded one byte for byte, with zero spawns and neither
 * `isAvailable`, the version check nor the isolation pre-flight (`prepare` → `checkJudgeIsolation`)
 * ever reached. A Mock variant is kept as an extra; OPS-06 is covered by the CLI variant.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../src/shared/interfaces/process-runner.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { createJudgeProvider } from '../../../src/llm-critic/provider-factory.js';
import { ClaudeCliProvider } from '../../../src/llm-critic/claude-cli-provider.js';
import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import type { NeuronalEvalOutput } from '../../../src/llm-critic/llm-critic.js';
import { judgeProvenanceOf } from '../../../src/llm-critic/provenance.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import { FF_N02_RUBRIC } from '../../../src/llm-critic/rubric.js';
import { PINNED_CLI_VERSION } from '../../../src/llm-critic/frozen.js';
import { listCassetteKeys } from '../../../src/llm-critic/cassette-manager.js';

const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'fixtures/correct-reference');
const FIX = path.join(REPO, 'tests/fixtures/claude-cli');
const VIEW = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/judge-graph/correct-reference.view.json'), 'utf8')) as JudgeGraphView;
const ENVELOPE = JSON.parse(fs.readFileSync(path.join(FIX, 'envelope-schema-tools-off.json'), 'utf8')) as Record<string, unknown>;
const INIT_CLEAN = JSON.parse(fs.readFileSync(path.join(FIX, 'init-clean.json'), 'utf8')) as Record<string, unknown>;
const FAIL_UNIT = 'src/domain/entities/Task.ts';

const LAYERS: LayerDefinition[] = [
  { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain', kind: 'domain' },
  { name: 'application', directories: ['src/application/**'], naming: [], role: 'application', kind: 'application' },
  { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'infrastructure', kind: 'infrastructure' },
];

const INSTRUCTION: NeuronalInstruction = {
  functionId: functionId('FF-N02'), name: 'intent-alignment', dimension: 'semantic', severity: 'major', route: 'neuronal',
  semanticCriteria: { rule: FF_N02_RUBRIC.rule, rubric: { pass: FF_N02_RUBRIC.pass, fail: FF_N02_RUBRIC.fail, evidenceRequired: FF_N02_RUBRIC.evidenceRequired } },
  contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true }, shadowModeEligible: false, source: 'fitness-function', judgeUnit: 'file',
};

const NO_GRAPH = {} as GraphRepository;
const dirs: string[] = [];
function tmpDir(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  dirs.push(d);
  return d;
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

function touch(root: string, rel: string, content = ''): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

/** A judge config dir holding only names of the ADR-018 allow-list. */
function cleanConfigDir(): string {
  const dir = tmpDir('u4-k7-cfg-');
  touch(dir, '.claude.json', '{}');
  touch(dir, 'cache/changelog.md');
  touch(dir, 'settings.json', JSON.stringify({ env: { DISABLE_AUTOUPDATER: '1' } }));
  return dir;
}

function proc(stdout: string): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 5 };
}

/**
 * Record-side runner: `--version` = the pin, the init probe = `init-clean.json`, judge calls =
 * the committed envelope, made failing (with a violation on the unit's own file) for one unit.
 */
class FixtureRunner implements ProcessRunner {
  calls = 0;
  run(_command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> {
    this.calls++;
    if (args[0] === '--version') return Promise.resolve(DomainResult.ok(proc(`${PINNED_CLI_VERSION} (Claude Code)\n`)));
    if (args.includes('stream-json')) {
      return Promise.resolve(DomainResult.ok(proc(`${JSON.stringify(INIT_CLEAN)}\n${JSON.stringify({ type: 'result', is_error: false, result: '{}' })}\n`)));
    }
    const failing = (options.stdin ?? '').includes(`Id: ${FAIL_UNIT}\n`);
    const envelope = failing
      ? {
        ...ENVELOPE,
        structured_output: {
          pass: false, confidence: 0.8, reasoning: 'persistence in an entity (scrub probe: Bearer abcdefghijklmnopqrstuvwxyz0123456789)', evidence: ['save()'],
          violations: [{ filePath: FAIL_UNIT, message: 'storage access in a domain entity' }],
        },
      }
      : ENVELOPE;
    return Promise.resolve(DomainResult.ok(proc(JSON.stringify(envelope))));
  }
}

async function judge(provider: Parameters<typeof evaluateNeuronal>[0]['provider'], dir: string, mode: 'record' | 'replay'): Promise<NeuronalEvalOutput> {
  const result = await evaluateNeuronal({
    instructions: [INSTRUCTION], graphRepository: NO_GRAPH, provider, projectRoot: ROOT, graphView: VIEW, knownSecrets: [],
    options: { evaluatorSpecLayers: LAYERS, cassette: { mode, dir, omitPrompt: false } },
  });
  if (!result.success) throw new Error(result.errors.map((e) => e.code).join(','));
  return result.data;
}

describe('CAS-10 / OPS-06 / ISO-09: replay through ClaudeCliProvider with claude absent from PATH', () => {
  const savedPath = process.env.PATH;
  afterEach(() => {
    process.env.PATH = savedPath;
    jest.restoreAllMocks();
  });

  it('reproduces the recorded NeuronalEvalOutput byte for byte with zero spawns', async () => {
    const dir = tmpDir('u4-k7-cas-');
    const projectFree = tmpDir('u4-k7-root-');

    // (1) record: C14 on the fixture runner, wrapped once by the factory in record mode
    const runner = new FixtureRunner();
    const rec = await createJudgeProvider(
      { provider: 'claude-cli', cassette: { mode: 'record', dir } },
      { judgeConfigDir: cleanConfigDir(), runner, parentEnv: { PATH: '/usr/bin:/bin', HOME: projectFree } },
    );
    if (!rec.success) throw new Error(rec.errors.map((e) => `${e.code}: ${e.message}`).join(','));
    const recorded = await judge(rec.data, dir, 'record');
    expect(recorded.completeness).toEqual({ status: 'complete' });
    expect(runner.calls).toBe(2 + 30); // --version, init probe, 10 file units × 3 runs
    expect(listCassetteKeys(dir)).toHaveLength(30);
    expect(recorded.results[0]?.unitResults.find((u) => u.unitId === FAIL_UNIT)?.verdict).toBe('fail');
    expect(JSON.stringify(recorded)).not.toContain('abcdefghijklmnopqrstuvwxyz0123456789');
    const recordedJudge = judgeProvenanceOf(rec.data, { runsPerUnit: 3, repetition: 0, seededList: [] });

    // (2) replay: a fresh C14 on the real runner, PATH emptied
    const spawn = jest.spyOn(NodeProcessRunner.prototype, 'run');
    const available = jest.spyOn(ClaudeCliProvider.prototype, 'isAvailable');
    const prepare = jest.spyOn(ClaudeCliProvider.prototype, 'prepare');
    process.env.PATH = tmpDir('u4-k7-empty-path-');
    const rep = await createJudgeProvider(
      { provider: 'claude-cli', cassette: { mode: 'replay', dir } },
      { judgeConfigDir: cleanConfigDir() },
    );
    if (!rep.success) throw new Error('replay factory failed');
    expect(rep.data.innerProvider).toBeInstanceOf(ClaudeCliProvider);
    const replayed = await judge(rep.data, dir, 'replay');

    expect(JSON.stringify(replayed)).toBe(JSON.stringify(recorded));
    expect(spawn).toHaveBeenCalledTimes(0);
    expect(available).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled(); // the only caller of checkJudgeIsolation and the version check

    const replayJudge = judgeProvenanceOf(rep.data, { runsPerUnit: 3, repetition: 0, seededList: [] });
    expect(replayJudge).toEqual({ ...recordedJudge, cassetteMode: 'replay' });
    expect(replayJudge.cliVersion).toBe(PINNED_CLI_VERSION);
    expect(spawn).toHaveBeenCalledTimes(0);
  });

  it('extra variant: the Mock provider replays its record byte for byte', async () => {
    const dir = tmpDir('u4-k7-mock-');
    const rec = await createJudgeProvider({ provider: 'mock', cassette: { mode: 'record', dir } });
    const rep = await createJudgeProvider({ provider: 'mock', cassette: { mode: 'replay', dir } });
    if (!rec.success || !rep.success) throw new Error('factory failed');
    const recorded = await judge(rec.data, dir, 'record');
    process.env.PATH = tmpDir('u4-k7-empty-path-');
    const replayed = await judge(rep.data, dir, 'replay');
    expect(JSON.stringify(replayed)).toBe(JSON.stringify(recorded));
  });
});
