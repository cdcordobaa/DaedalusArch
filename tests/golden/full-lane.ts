/**
 * Full-mode golden lane L0 helpers (FR-30, U4 Q16 A; BR-U4-CAS-10, CAS-11; Build and Test Step 46).
 *
 * The lane replays committed **Mock** judge cassettes for the five golden fixtures in full mode
 * (`tests/fixtures/judge-cassettes/<case>/`; correct-reference is U4's D-U4-12 set, variant-a..d are
 * Build and Test's, recorded with the same scripted Mock). It never calls a live judge. A replay miss
 * fails with `re-record: <n> missing keys` (CAS-11); the re-record is its own commit and
 * `tests/golden/CHANGES.md` line (`re-record, cause <commit/FR>`).
 *
 * Snapshots live in `tests/golden/__snapshots_full__/` (the change-log checker already lists that
 * directory). The L0 baseline is held by E-2 (the judge rubric freeze must precede the first measured
 * full-mode run, BR-U4-POL-01): until the directory holds a `.json` file, the lane asserts replay
 * completeness and determinism and does not compare; afterwards a missing snapshot fails under CI or
 * `GOLDEN_REQUIRED=1`, as in the symbolic suite.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import { DomainResult } from '../../src/shared/errors/domain-result.js';
import type { DomainError } from '../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMResponse } from '../../src/shared/interfaces/llm-provider.js';
import type { EvaluationReport } from '../../src/shared/types/evaluation.js';
import { MockLLMProvider } from '../../src/llm-critic/mock-provider.js';
import { INCOMPLETE_DIR, listCassetteKeys } from '../../src/llm-critic/cassette-manager.js';
import type { RunManifest } from '../../src/llm-critic/types.js';
import { parseLLMOptions } from '../../src/cli/llm-options.js';
import { REPO_ROOT } from './golden-cases.js';
import type { GoldenCase } from './golden-cases.js';
import type { GoldenNeo4jConfig } from './golden-env.js';

export const FULL_SNAPSHOT_DIR = path.join(REPO_ROOT, 'tests', 'golden', '__snapshots_full__');
export const FULL_LANE_CASSETTE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', 'judge-cassettes');
export const JUDGE_RUN_INCOMPLETE = 'JUDGE_RUN_INCOMPLETE';

export function laneCassetteDir(caseId: string): string {
  return path.join(FULL_LANE_CASSETTE_ROOT, caseId);
}

/** The CAS-11 failure message of the lane. */
export function reRecordMessage(missingKeys: number): string {
  return `re-record: ${String(missingKeys)} missing keys`;
}

/** Run manifests an incomplete replay left in `dir` (`<dir>/_incomplete/*.json`). */
export function readRunManifests(dir: string): RunManifest[] {
  const d = path.join(dir, INCOMPLETE_DIR);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) as RunManifest);
}

/** Distinct outstanding keys of the manifests that `dir` does not hold (the replay misses). */
export function missingKeyCount(manifests: readonly RunManifest[], dir: string): number {
  const present = new Set(listCassetteKeys(dir));
  const missing = new Set<string>();
  for (const m of manifests) for (const o of m.outstanding) if (!present.has(o.key)) missing.add(o.key);
  return missing.size;
}

/** Copies a cassette directory into a fresh temp directory (a replay miss writes `_incomplete/` there, never in the tree). */
export function copyCassettes(src: string, prefix: string): string {
  const dst = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  fs.cpSync(src, dst, { recursive: true });
  return dst;
}

/** Fixed, mixed verdict per (function, unit): the same rule as `tests/golden/u4-neural.test.ts`. */
export function scriptedFails(fnId: string, unitId: string): boolean {
  const byte = createHash('sha256').update(`${fnId}|${unitId}`).digest()[0] ?? 0;
  return byte % 3 === 0;
}

function firstUnitFile(prompt: string): string {
  const m = /\nUnit files:\n- ([^\n]+)\n/.exec(prompt);
  return m?.[1] ?? '';
}

/** Scripts every `MockLLMProvider` the factory builds (as the U4 recorder does); restore with `jest.restoreAllMocks`. */
export function scriptMock(): jest.SpyInstance {
  return jest.spyOn(MockLLMProvider.prototype, 'evaluate').mockImplementation(
    (prompt: string, llmOptions: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> => {
      const fails = scriptedFails(call?.functionId ?? '', call?.unitId ?? '');
      const verdict = fails
        ? {
          pass: false, confidence: 0.8, reasoning: 'Scripted fixture verdict: fail', evidence: ['scripted evidence'],
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

export interface LaneRun {
  readonly ok: true;
  readonly report: EvaluationReport;
}
export interface LaneFailure {
  readonly ok: false;
  readonly errors: readonly DomainError[];
}

/** Runs the real pipeline in full mode against `specs/clean-arch.yaml` with the given judge argv. */
export async function runFullMode(
  c: GoldenCase,
  neo4j: GoldenNeo4jConfig,
  llmArgv: readonly string[],
  options: { readonly emptyPath?: boolean } = {},
): Promise<LaneRun | LaneFailure> {
  const llm = parseLLMOptions([...llmArgv], {}, { projectRoot: c.projectPath });
  if (!llm.success) throw new Error(`parseLLMOptions: ${llm.errors.map((e) => e.code).join(', ')}`);
  const apgStorePath = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), `full-lane-apg-${c.id}-`)));
  const emptyPath = options.emptyPath === true ? fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'full-lane-path-'))) : null;
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
  if (emptyPath !== null) process.env.PATH = emptyPath;
  const bundle = createPipeline(config);
  try {
    const result = await bundle.executor.execute();
    return result.success ? { ok: true, report: result.data } : { ok: false, errors: result.errors };
  } finally {
    process.env.PATH = savedPath;
    await bundle.cleanup();
    fs.rmSync(apgStorePath, { recursive: true, force: true });
    if (emptyPath !== null) fs.rmSync(emptyPath, { recursive: true, force: true });
  }
}

/**
 * The lane's replay: Mock provider, replay mode, `PATH` emptied, from a temp copy of `cassetteDir`.
 * A miss throws `re-record: <n> missing keys` (CAS-11); any other failure throws its error codes.
 */
export async function replayLane(c: GoldenCase, neo4j: GoldenNeo4jConfig, cassetteDir: string): Promise<EvaluationReport> {
  const dir = copyCassettes(cassetteDir, `full-lane-cas-${c.id}-`);
  try {
    const run = await runFullMode(c, neo4j, ['--llm-provider', 'mock', '--cassette-mode', 'replay', '--cassette-dir', dir], { emptyPath: true });
    if (run.ok) return run.report;
    if (run.errors.some((e) => e.code === JUDGE_RUN_INCOMPLETE)) {
      throw new Error(reRecordMessage(missingKeyCount(readRunManifests(dir), dir)));
    }
    throw new Error(`full-mode lane failed for ${c.id}: ${run.errors.map((e) => e.code).join(', ')}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** The lane snapshot: the neural half of the report and the scores it feeds (no run-specific field). */
export function fullLaneSnapshot(caseId: string, report: EvaluationReport): string {
  const { cassetteMode: _mode, ...judge } = report.judge as unknown as Record<string, unknown>;
  const snapshot = {
    caseId,
    evaluationMode: report.evaluationMode,
    verdict: report.verdict,
    ahsDeterministic: report.ahsDeterministic,
    ahsNeuronal: report.ahsNeuronal,
    ahsCombined: report.ahsCombined,
    judge,
    neuralResults: report.neuralResults ?? [],
  };
  return `${JSON.stringify(sortKeysDeep(snapshot), null, 2)}\n`;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(record).sort()) out[k] = sortKeysDeep(record[k]);
    return out;
  }
  return value;
}

/** The L0 baseline exists once the full snapshot directory holds a `.json` file. */
export function fullBaselineExists(): boolean {
  try {
    return fs.readdirSync(FULL_SNAPSHOT_DIR).some((f) => f.endsWith('.json'));
  } catch {
    return false;
  }
}
