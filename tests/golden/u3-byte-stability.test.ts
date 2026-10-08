/**
 * U3-R14 byte-stability (FR-35, NFR-02; U3 BR-U3-61; TF-18). Two symbolic-only runs of
 * variant-a and of variant-c give byte-identical report JSON after the five-path normaliser.
 * Same skip and host guards as golden.test.ts (see golden-env.ts).
 */
import { GOLDEN_CASES } from './golden-cases.js';
import { resolveGoldenEnv } from './golden-env.js';
import { runGoldenCase } from './golden-runner.js';
import { normaliseForByteStability } from './byte-stability.js';

const goldenEnv = resolveGoldenEnv();

if (!goldenEnv.enabled) {
  console.warn(`[u3-byte-stability] ${goldenEnv.reason}`);
}

const describeU3 = goldenEnv.enabled ? describe : describe.skip;

const RUN_TIMEOUT_MS = 480_000;

async function normalisedRun(id: string): Promise<string> {
  if (!goldenEnv.enabled) throw new Error(goldenEnv.reason);
  const c = GOLDEN_CASES.find((g) => g.id === id);
  if (c === undefined) throw new Error(`golden case ${id} missing`);
  const result = await runGoldenCase(c, goldenEnv.neo4j);
  if (!result.success) throw new Error(`${id} failed: ${result.errors.map((e) => e.code).join(', ')}`);
  return normaliseForByteStability(result.data.report);
}

describeU3('U3-R14 byte-stability (BR-U3-61, TF-18)', () => {
  it.each(['variant-a-structural', 'variant-c-everything'])('%s: two symbolic-only runs are byte-identical after the five-path normaliser', async (id) => {
    const first = await normalisedRun(id);
    const second = await normalisedRun(id);
    expect(first.length).toBeGreaterThan(0);
    expect(second).toBe(first);
  }, RUN_TIMEOUT_MS);
});
