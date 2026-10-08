/**
 * U4 gated neural acceptance (plan Step 28; FR-33, FR-23, NFR-08; T5, T13, T17; D-U4-12,
 * U5b OI-3). Same skip and host guards as the rest of the golden suite (golden-env.ts).
 * Writes no snapshot; every pipeline run wipes and re-ingests the lane database.
 *
 * Per fixture: the real pipeline (extract, ingest into the lane graph, compile
 * `specs/clean-arch.yaml`) runs in **full** mode with the judge options the CLI passes by
 * default (`parseLLMOptions`, DE §5.6) and `--llm-provider mock`; the critic reads the live
 * lane through `loadJudgeGraphView` and the Mock is wrapped by the cassette decorator in
 * record mode into a temp dir; the same run is then replayed with `PATH` emptied. Asserted:
 * one result per selected unit, `unitsCapped = 0`, record and replay byte-identical, and no
 * cassette, warning or report (U3's real builder, now on v1.2e) contains a known secret.
 *
 * The Mock is scripted through `MockLLMProvider.prototype.evaluate` (the factory builds the
 * instance): a fixed, mixed pass/fail verdict per (function, unit), so `ahsNeuronal` is
 * non-trivial. No verdict value is quoted in any document.
 *
 * Committed fixture cassettes (D-U4-12): with `U4_RECORD_FIXTURE_CASSETTES=1` a recorder
 * writes correct-reference's full-mode cassettes into
 * `tests/fixtures/judge-cassettes/correct-reference/`. The normal gated run replays them
 * with the U5b argv (`--llm-provider mock --cassette-mode replay --cassette-dir <dir>`) and
 * `PATH` emptied, asserting zero `CASSETTE_MISS` and an output byte-identical to a fresh
 * Mock record. Re-record (own commit, BR-U4-CAS-11) by rerunning the recorder.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMResponse } from '../../src/shared/interfaces/llm-provider.js';
import type { EvaluationReport, EvaluationResults } from '../../src/shared/types/evaluation.js';
import { MockLLMProvider } from '../../src/llm-critic/mock-provider.js';
import { listCassetteKeys } from '../../src/llm-critic/cassette-manager.js';
import { judgeKnownSecrets } from '../../src/llm-critic/judge-stage.js';
import { DEFAULT_NEURONAL_RUN_OPTIONS } from '../../src/llm-critic/types.js';
import { parseLLMOptions } from '../../src/cli/llm-options.js';
import { GOLDEN_CASES, REPO_ROOT } from './golden-cases.js';
import type { GoldenCase } from './golden-cases.js';
import { resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

const goldenEnv = resolveGoldenEnv();
if (!goldenEnv.enabled) {
  console.warn(`[u4-neural] ${goldenEnv.reason}`);
}
const describeU4 = goldenEnv.enabled ? describe : describe.skip;

/** Committed Mock fixture cassettes (D-U4-12, U5b OI-3). */
export const FIXTURE_CASSETTE_DIR = path.join(REPO_ROOT, 'tests', 'fixtures', 'judge-cassettes', 'correct-reference');
const RECORD_FIXTURE_CASSETTES = process.env.U4_RECORD_FIXTURE_CASSETTES === '1';

/** Bearer-shaped scrub probe (allow-listed test literal, as in Steps 18, 19 and 23). */
const BEARER_PROBE = 'Bearer abcdefghijklmnopqrstuvwxyz0123456789';
const BEARER_BODY = 'abcdefghijklmnopqrstuvwxyz0123456789';

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

const dirs: string[] = [];
function tmpDir(prefix: string): string {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  dirs.push(d);
  return d;
}

/** The first unit file named in the prompt (`## Unit` section). */
function firstUnitFile(prompt: string): string {
  const m = /\nUnit files:\n- ([^\n]+)\n/.exec(prompt);
  return m?.[1] ?? '';
}

/** Fixed, mixed verdict per (function, unit): about one unit in three fails. */
export function scriptedFails(fnId: string, unitId: string): boolean {
  const byte = createHash('sha256').update(`${fnId}|${unitId}`).digest()[0] ?? 0;
  return byte % 3 === 0;
}

interface ScriptOptions {
  /** Echo the scrub probes (a known secret and a bearer token) in failing reasoning. */
  readonly secretProbe?: string;
}

/** Scripts every `MockLLMProvider` the factory builds (prototype spy, restored after each test). */
function scriptMock(options: ScriptOptions = {}): jest.SpyInstance {
  return jest.spyOn(MockLLMProvider.prototype, 'evaluate').mockImplementation(
    (prompt: string, llmOptions: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> => {
      const fnId = call?.functionId ?? '';
      const unitId = call?.unitId ?? '';
      const fails = scriptedFails(fnId, unitId);
      const probe = options.secretProbe !== undefined ? ` (scrub probe: ${options.secretProbe} ${BEARER_PROBE})` : '';
      const verdict = fails
        ? {
          pass: false, confidence: 0.8, reasoning: `Scripted fixture verdict: fail${probe}`, evidence: ['scripted evidence'],
          violations: [{ filePath: firstUnitFile(prompt), message: 'Scripted fixture violation' }],
        }
        : { pass: true, confidence: 0.9, reasoning: 'Scripted fixture verdict: pass', evidence: ['scripted evidence'], violations: [] };
      const content = JSON.stringify(verdict);
      return Promise.resolve(DomainResult.ok({
        content,
        model: 'mock-model',
        usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(content.length / 4) },
        usedOptions: {},
        ignoredOptions: Object.keys(llmOptions) as (keyof LLMOptions)[],
      }));
    },
  );
}

interface FullRun {
  readonly report: EvaluationReport;
  readonly evaluation: EvaluationResults;
  readonly warningsText: string;
}

/** The DE §5.6 argv for the Mock judge (U5b replay argv when `mode` is replay). */
function mockArgv(mode: 'record' | 'replay', dir: string): string[] {
  return ['--llm-provider', 'mock', '--cassette-mode', mode, '--cassette-dir', dir];
}

/** Runs the real pipeline in full mode with the Mock judge; never rejects (errors are thrown with codes only). */
async function runFull(c: GoldenCase, mode: 'record' | 'replay', cassetteDir: string, emptyPath: boolean): Promise<FullRun> {
  const neo4j = neo4jConfig();
  const llm = parseLLMOptions(mockArgv(mode, cassetteDir), {}, { projectRoot: c.projectPath });
  if (!llm.success) throw new Error(`parseLLMOptions: ${llm.errors.map((e) => e.code).join(', ')}`);
  const apgStorePath = tmpDir(`u4-neural-apg-${c.id}-`);
  const config: PipelineConfig = {
    projectPath: c.projectPath,
    specFilePath: c.specPath,
    neo4jUri: neo4j.uri,
    neo4jUser: neo4j.user,
    neo4jPassword: neo4j.password,
    evaluationMode: 'full',
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath,
    llmConfig: llm.data,
  };
  const savedPath = process.env.PATH;
  if (emptyPath) process.env.PATH = tmpDir('u4-neural-empty-path-');
  const bundle = createPipeline(config);
  try {
    const result = await bundle.executor.execute();
    if (!result.success) {
      throw new Error(`pipeline failed (${mode}): ${result.errors.map((e) => e.code).join(', ')}`);
    }
    return {
      report: result.data,
      evaluation: bundle.context.getEvaluationResults(),
      warningsText: JSON.stringify([...bundle.context.warnings]),
    };
  } finally {
    process.env.PATH = savedPath;
    await bundle.cleanup();
  }
}

/** The critic's part of a run: neural results, failures and the report rows (no run-specific field). */
function neuralOutput(run: FullRun): string {
  return JSON.stringify({
    neuronalResults: run.evaluation.neuronalResults,
    failures: run.evaluation.failures ?? [],
    neuralResults: run.report.neuralResults,
  });
}

function allFilesText(dir: string): string {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(fs.readFileSync(p, 'utf8'));
    }
  };
  walk(dir);
  return out.join('\n');
}

/** Shared per-run assertions: one result per selected unit, nothing capped, mixed verdicts present overall. */
function expectUnitCoverage(run: FullRun): { fails: number; passes: number } {
  let fails = 0;
  let passes = 0;
  expect(run.evaluation.neuronalResults.length).toBeGreaterThan(0);
  for (const r of run.evaluation.neuronalResults) {
    const ids = r.unitResults.map((u) => u.unitId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(r.unitsSelected);
    expect(r.unitsCapped).toBe(0);
    for (const u of r.unitResults) {
      if (u.verdict === 'fail') fails++;
      else if (u.verdict === 'pass') passes++;
    }
  }
  return { fails, passes };
}

describeU4('U4 neural acceptance on the lane (FR-33, FR-23, NFR-08; T5, T13, T17)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(() => {
    for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
  });

  it.each(GOLDEN_CASES.map((c) => [c.id, c] as const))(
    '%s: full mode, Mock record then replay with PATH emptied; one result per unit, no cap, no secret leaks',
    async (_id, c) => {
      const neo4j = neo4jConfig();
      const cassetteDir = tmpDir(`u4-neural-cas-${c.id}-`);
      const known = judgeKnownSecrets([neo4j.password]);

      const recSpy = scriptMock({ secretProbe: neo4j.password });
      const recorded = await runFull(c, 'record', cassetteDir, false);
      const calls = recSpy.mock.calls.length;
      jest.restoreAllMocks();

      const replaySpy = scriptMock({ secretProbe: neo4j.password });
      const replayed = await runFull(c, 'replay', cassetteDir, true);
      expect(replaySpy).not.toHaveBeenCalled();

      // T17: one result per selected unit, unitsCapped = 0; the scripted verdicts are mixed
      const { fails, passes } = expectUnitCoverage(recorded);
      expect(fails).toBeGreaterThan(0);
      expect(passes).toBeGreaterThan(0);
      const keys = listCassetteKeys(cassetteDir);
      expect(keys.length).toBe(calls);
      const selected = recorded.evaluation.neuronalResults.reduce((n, r) => n + r.unitsSelected, 0);
      expect(calls).toBe(selected * DEFAULT_NEURONAL_RUN_OPTIONS.runsPerEvaluation);

      // T5 / NFR-08: record and replay byte-identical
      expect(neuralOutput(replayed)).toBe(neuralOutput(recorded));
      // Provenance: replay reads the entries; the Mock's describe() model ('mock-model') is not the
      // requested model the entries carry, so `model` is compared only for being set (open item).
      const { model: recModel, ...recJudge } = recorded.report.judge;
      const { model: repModel, ...repJudge } = replayed.report.judge;
      expect(repJudge).toEqual({ ...recJudge, cassetteMode: 'replay' });
      expect([recModel, repModel].every((m) => typeof m === 'string' && m !== '')).toBe(true);
      expect((recorded.report.neuralResults ?? []).length).toBe(recorded.evaluation.neuronalResults.length);

      // T13 / CAS-07: no known secret in any cassette, warning or report (booleans: never print a value)
      const texts = [
        allFilesText(cassetteDir), recorded.warningsText, replayed.warningsText,
        JSON.stringify(recorded.report), JSON.stringify(replayed.report),
      ];
      // the probes reached the outputs (failing reasoning) and were scrubbed there
      expect(JSON.stringify(recorded.evaluation.neuronalResults).includes('scrub probe:')).toBe(true);
      expect(allFilesText(cassetteDir).includes('scrub probe:')).toBe(true);
      for (const text of texts) {
        expect(text.includes(neo4j.password)).toBe(false);
        expect(text.includes(BEARER_BODY)).toBe(false);
        expect(known.some((s) => s.length >= 8 && text.includes(s))).toBe(false);
        expect(text.includes('CASSETTE_MISS')).toBe(false);
      }
    },
  );

  if (RECORD_FIXTURE_CASSETTES) {
    it('recorder: writes the correct-reference Mock fixture cassettes (U4_RECORD_FIXTURE_CASSETTES=1)', async () => {
      const c = GOLDEN_CASES.find((g) => g.id === 'correct-reference');
      if (!c) throw new Error('correct-reference case missing');
      fs.rmSync(FIXTURE_CASSETTE_DIR, { recursive: true, force: true });
      fs.mkdirSync(FIXTURE_CASSETTE_DIR, { recursive: true });
      const spy = scriptMock();
      const recorded = await runFull(c, 'record', FIXTURE_CASSETTE_DIR, false);
      expect(listCassetteKeys(FIXTURE_CASSETTE_DIR).length).toBe(spy.mock.calls.length);
      const { fails, passes } = expectUnitCoverage(recorded);
      expect(fails).toBeGreaterThan(0);
      expect(passes).toBeGreaterThan(0);
    });
  }

  it('committed Mock fixture cassettes replay with PATH emptied: zero CASSETTE_MISS, byte-identical to a fresh Mock record (D-U4-12, U5b OI-3)', async () => {
    const c = GOLDEN_CASES.find((g) => g.id === 'correct-reference');
    if (!c) throw new Error('correct-reference case missing');
    expect(listCassetteKeys(FIXTURE_CASSETTE_DIR).length).toBeGreaterThan(0);
    const before = allFilesText(FIXTURE_CASSETTE_DIR);

    const replaySpy = scriptMock();
    const replayed = await runFull(c, 'replay', FIXTURE_CASSETTE_DIR, true);
    expect(replaySpy).not.toHaveBeenCalled();
    jest.restoreAllMocks();
    expect(replayed.warningsText.includes('CASSETTE_MISS')).toBe(false);
    expect(JSON.stringify(replayed.evaluation.failures ?? []).includes('CASSETTE_MISS')).toBe(false);

    scriptMock();
    const fresh = await runFull(c, 'record', tmpDir('u4-neural-fresh-'), false);
    expect(neuralOutput(replayed)).toBe(neuralOutput(fresh));

    const { fails, passes } = expectUnitCoverage(replayed);
    expect(fails).toBeGreaterThan(0);
    expect(passes).toBeGreaterThan(0);
    // replay writes nothing into the committed directory
    expect(allFilesText(FIXTURE_CASSETTE_DIR)).toBe(before);
  });

});
