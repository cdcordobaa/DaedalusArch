/**
 * U3 container tests (D-U3-14): FR-12 ids and locations, metric filters and the U3 templates
 * against the real Neo4j 5.26. Same skip and host guards as golden.test.ts (see golden-env.ts).
 * Each case runs the full symbolic pipeline, which wipes and re-ingests the graph itself.
 */
import { GOLDEN_CASES } from './golden-cases.js';
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
