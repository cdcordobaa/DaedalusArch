/**
 * R01 (Docs/v1.3/post-merge-review-2026-10-16.md): the loop's firewall evaluator must extract every snapshot with the
 * pinned per-run harness tsconfig (`<H>/runs/<runId>/tsconfig.json`), never with a tsconfig of the work tree (it has
 * none, or one the agent chose).
 *
 * A scripted loop run (the stub generator, no model) with the real `evaluate_project` pipeline: the Cypher templates
 * run in process (`graphEngine: 'cypher-interp'`), so no Neo4j is needed. The demo script plants a domain -> infrastructure
 * import at step 2, so the gate arm must see blocking findings there and run its repair turn.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPipeline } from '../../../../src/pipeline/pipeline-factory.js';
import type { EvaluateDeps } from '../../../../src/mcp-server/evaluate-project.js';
import type { GraphRepository } from '../../../../src/shared/interfaces/graph-repository.js';
import { harnessTsconfigPath } from '../../../../scripts/lib/generators/argv.js';
import { loopEvaluatorOf } from '../../../../scripts/lib/loop/evaluator.js';
import { runLoop } from '../../../../scripts/lib/loop/loop.js';
import { demoStubScript } from '../../../../scripts/lib/loop/stub.js';
import type { StubScript } from '../../../../scripts/lib/loop/stub.js';
import type { StepRecord } from '../../../../scripts/lib/loop/types.js';
import { context, spec, stubAgent, tmpRoot } from './helpers.js';

const REPO_ROOT = path.resolve(__dirname, '../../../..');
const SPEC = path.join(REPO_ROOT, 'specs/clean-arch.yaml');

const healthyGraph = { healthCheck: () => Promise.resolve(true), close: () => Promise.resolve() } as unknown as GraphRepository;

function inProcessDeps(seen: (string | undefined)[]): EvaluateDeps {
  return {
    makeGraph: () => healthyGraph,
    makePipeline: (config) => {
      seen.push(config.tsconfigPath);
      return createPipeline({ ...config, graphEngine: 'cypher-interp' });
    },
  };
}

async function gateRun(script: StubScript): Promise<{ steps: readonly StepRecord[]; seen: (string | undefined)[]; harness: string; runId: string }> {
  const root = tmpRoot('loop-r01-');
  const harness = path.join(root, 'harness');
  const seen: (string | undefined)[] = [];
  const env = { NEO4J_PASSWORD: 'unused', APG_STORE_PATH: path.join(root, 'apg-store') };
  const evaluator = loopEvaluatorOf(harness, env, inProcessDeps(seen))(SPEC);
  const r = await runLoop(context(path.join(root, 'out'), stubAgent({ script }), { evaluator }), spec('gate'));
  if (!r.success || r.data.kind !== 'completed') throw new Error(r.success ? r.data.kind : r.errors.map((e) => e.message).join('; '));
  return { steps: r.data.steps, seen, harness, runId: r.data.runId };
}

describe('R01: the loop evaluator uses the pinned harness tsconfig', () => {
  it('a scripted gate run with no work-tree tsconfig evaluates every snapshot and repairs the planted violation', async () => {
    const { steps, seen, harness, runId } = await gateRun(demoStubScript);
    for (const s of steps) for (const t of s.turns) expect(t.snapshot.evaluationError).toBeUndefined();
    const pinned = harnessTsconfigPath(harness, runId);
    expect(seen.length).toBeGreaterThan(0);
    expect(new Set(seen)).toEqual(new Set([pinned]));
    expect(fs.existsSync(pinned)).toBe(true);
    // Step 2 plants src/domain/tags.ts -> src/infrastructure/tags-store.ts: blocking, so the gate repairs it.
    expect(steps[1]?.repair?.attempted).toBe(true);
    expect(steps[1]?.repair?.blockingBefore).toBeGreaterThan(0);
    expect(steps[1]?.repair?.cleared).toBe(true);
    expect(steps[0]?.turns[0]?.snapshot.evaluation?.blockingViolationCount).toBe(0);
  }, 120_000);

  it('a work-tree tsconfig that leaves out src/domain is ignored: the planted violation is still found', async () => {
    const narrowing: StubScript = (input, task) => ({
      ...demoStubScript(input, task),
      'tsconfig.json': `${JSON.stringify({ compilerOptions: { strict: true }, include: ['src/application/**/*.ts'] })}\n`,
    });
    const { steps } = await gateRun(narrowing);
    expect(steps[1]?.repair?.attempted).toBe(true);
    expect(steps[1]?.repair?.blockingBefore).toBeGreaterThan(0);
    const files = (steps[1]?.turns[0]?.snapshot.evaluation?.blockingFindings ?? []).map((f) => f.filePath);
    expect(files.some((f) => f.endsWith('src/domain/tags.ts'))).toBe(true);
  }, 120_000);
});
