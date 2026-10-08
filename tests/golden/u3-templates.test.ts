/**
 * U3 container tests (D-U3-14): FR-12 ids and locations, metric filters and the U3 templates
 * against the real Neo4j 5.26. Same skip and host guards as golden.test.ts (see golden-env.ts).
 * Each case runs the full symbolic pipeline, which wipes and re-ingests the graph itself.
 */
import * as path from 'node:path';
import neo4jDriver from 'neo4j-driver';
import { compileFunctions } from '../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../src/fitness-compiler/compiler-input.js';
import { parseSpec } from '../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../src/shared/types/evaluation.js';
import { GOLDEN_CASES, REPO_ROOT } from './golden-cases.js';
import type { GoldenCase } from './golden-cases.js';
import { resolveGoldenEnv } from './golden-env.js';
import type { GoldenNeo4jConfig } from './golden-env.js';
import { runGoldenCase } from './golden-runner.js';
import type { GoldenRun } from './golden-runner.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[u3-templates] ${goldenEnv.reason}`);
}

const describeU3 = goldenEnv.enabled ? describe : describe.skip;

const RUN_TIMEOUT_MS = 240_000;

function neo4jConfig(): GoldenNeo4jConfig {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  return goldenEnv.neo4j;
}

function goldenCase(id: string): GoldenCase {
  const c = GOLDEN_CASES.find((g) => g.id === id);
  if (c === undefined) throw new Error(`golden case ${id} missing`);
  return c;
}

async function run(id: string): Promise<GoldenRun> {
  const result = await runGoldenCase(goldenCase(id), neo4jConfig());
  if (!result.success) throw new Error(`${id} failed: ${result.errors.map((e) => e.code).join(', ')}`);
  return result.data;
}

describeU3('U3-R2 FR-12 ids and locations (BR-U3-04, BR-U3-05)', () => {
  it('two runs on variant-a give identical violation id sets', async () => {
    const first = await run('variant-a-structural');
    const second = await run('variant-a-structural');
    const ids = (r: GoldenRun): string[] => r.report.violations.map((v) => v.id).sort();
    expect(ids(first).length).toBeGreaterThan(0);
    expect(ids(second)).toEqual(ids(first));
    expect(new Set(ids(first)).size).toBe(ids(first).length);
    for (const id of ids(first)) expect(id).toMatch(/^v-[0-9a-f]{16}$/);
  }, RUN_TIMEOUT_MS);

  it('variant-a: every structural violation has a numeric line and a target', async () => {
    const r = await run('variant-a-structural');
    const structural = r.report.violations.filter((v) => v.dimension === 'structural');
    expect(structural.length).toBeGreaterThan(0);
    for (const v of structural) {
      expect({ id: String(v.functionId), file: v.filePath, lineIsNumber: typeof v.line === 'number', hasTarget: typeof v.target === 'string' })
        .toEqual({ id: String(v.functionId), file: v.filePath, lineIsNumber: true, hasTarget: true });
      expect(v.tag).toBe(String(v.functionId) === 'FF-S02' ? 'topological' : 'structural');
    }
  }, RUN_TIMEOUT_MS);
});

const METRIC_TEMPLATES = ['dependency-inversion', 'domain-stability', 'abstraction-ratio'] as const;

/** The three metric queries of specs/clean-arch.yaml, compiled with or without `exclude_paths`. */
async function metricQueries(withExcludes: boolean): Promise<readonly CypherQuery[]> {
  const parsed = await parseSpec({ specFilePath: path.join(REPO_ROOT, 'specs/clean-arch.yaml') });
  if (!parsed.success) throw new Error('specs/clean-arch.yaml did not parse');
  const input = compilerInputFromSpec(parsed.data);
  // abstraction-ratio has no exclude marker (BR-U1-32): excludes on it are a compile error, so it runs without.
  const fitnessFunctions = input.fitnessFunctions.map((ff) =>
    (withExcludes && ff.name !== 'abstraction-ratio' && (METRIC_TEMPLATES as readonly string[]).includes(ff.name)
      ? { ...ff, excludePaths: ['src/x/**'] } : ff));
  const compiled = compileFunctions({ ...input, fitnessFunctions });
  if (!compiled.success) throw new Error(`did not compile: ${compiled.errors.map((e) => e.message).join('; ')}`);
  const queries = [...compiled.data.symbolicQueries, ...compiled.data.hybridPairs.map((h) => h.symbolicQuery)]
    .filter((q) => (METRIC_TEMPLATES as readonly string[]).includes(q.name));
  expect(queries.map((q) => q.name).sort()).toEqual([...METRIC_TEMPLATES].sort());
  return queries;
}

describeU3('U3-R4 metric filters (BR-U3-10, 11, 12)', () => {
  it('correct-reference: FF-P02, FF-C01 and FF-C06 return 0 rows and pass', async () => {
    const r = await run('correct-reference');
    for (const id of ['FF-P02', 'FF-C01', 'FF-C06']) {
      const result = r.evaluationResults.symbolicResults.find((x) => String(x.functionId) === id);
      expect({ id, rows: result?.violations.length, passed: result?.passed }).toEqual({ id, rows: 0, passed: true });
    }
  }, RUN_TIMEOUT_MS);

  it("variant-a: FF-C06 has one violation with filePath '<project>' and evidence ['ratio=0.2']", async () => {
    const r = await run('variant-a-structural');
    const c06 = r.report.violations.filter((v) => String(v.functionId) === 'FF-C06');
    expect(c06.map((v) => ({ filePath: v.filePath, evidence: v.evidence }))).toEqual([{ filePath: '<project>', evidence: ['ratio=0.2'] }]);
  }, RUN_TIMEOUT_MS);

  it('the three templates EXPLAIN with and without an exclude list (exclude-marker test of BR-U1-32)', async () => {
    const neo4j = neo4jConfig();
    const driver = neo4jDriver.driver(neo4j.uri, neo4jDriver.auth.basic(neo4j.user, neo4j.password));
    try {
      for (const withExcludes of [false, true]) {
        for (const q of await metricQueries(withExcludes)) {
          const session = driver.session();
          try {
            await session.run(`EXPLAIN ${q.cypher}`, q.params, { timeout: 30_000 });
            const excluded = q.cypher.includes('$excludePatterns');
            expect({ name: q.name, withExcludes, excluded })
              .toEqual({ name: q.name, withExcludes, excluded: withExcludes && q.name !== 'abstraction-ratio' });
          } finally {
            await session.close();
          }
        }
      }
    } finally {
      await driver.close();
    }
  }, RUN_TIMEOUT_MS);
});
