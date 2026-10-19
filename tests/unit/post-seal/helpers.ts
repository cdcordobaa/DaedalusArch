/** Shared helpers of the v1.4 U2 post-seal tests (no test of their own). No Neo4j, no network, no model. */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import { parseInstrumentVersion } from '../../../src/fitness-compiler/role-exemptions.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';

export const ROOT = path.resolve(__dirname, '../../..');

export const PRESET_STYLES = ['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd'] as const;

const cache = new Map<string, ParsedSpec>();

/** A spec file (repository-relative), parsed once per test file. */
export async function specAt(rel: string): Promise<ParsedSpec> {
  const hit = cache.get(rel);
  if (hit !== undefined) return hit;
  const r = await parseSpec({ specFilePath: path.join(ROOT, rel) });
  if (!r.success) throw new Error(`${rel}: ${r.errors.map((e) => e.message).join('; ')}`);
  cache.set(rel, r.data);
  return r.data;
}

export const presetSpec = (style: string): Promise<ParsedSpec> => specAt(`presets/${style}.yaml`);

export function must<T>(value: T | null | undefined, what: string): T {
  if (value == null) throw new Error(`missing: ${what}`);
  return value;
}

/** The pipeline on a project directory: cypher-interp, symbolic-only (no LLM provider is built), instrument v2. */
export async function runPipeline(projectDir: string, specPath: string, extra: Partial<PipelineConfig> = {}): Promise<DomainResult<EvaluationReport>> {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'u2-apg-'));
  const { executor, cleanup } = createPipeline({
    projectPath: projectDir, specFilePath: specPath, neo4jUri: '', neo4jUser: '', neo4jPassword: '', evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless', persist: false, diff: false, verbose: false, apgStorePath: store, instrumentVersion: parseInstrumentVersion('v2'),
    scoringMode: 'v1.3', graphEngine: 'cypher-interp', ...extra,
  });
  try {
    return await executor.execute();
  } finally {
    await cleanup();
    fs.rmSync(store, { recursive: true, force: true });
  }
}

/** Writes `files` (relative path to text) into a fresh temporary project with a tsconfig; returns its directory. */
export function tempProject(files: Readonly<Record<string, string>>): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u2-proj-')));
  const all: Record<string, string> = {
    'tsconfig.json': JSON.stringify({ compilerOptions: { strict: true, module: 'commonjs', target: 'ES2022', skipLibCheck: true }, include: ['src/**/*.ts'] }),
    ...files,
  };
  for (const [rel, text] of Object.entries(all)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}
