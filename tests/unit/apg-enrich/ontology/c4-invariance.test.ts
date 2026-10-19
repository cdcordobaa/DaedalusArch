/**
 * v1.4 U9 (C4-01 §4.4, "never overturns" is mechanical): for a case, the C3 scores and verdicts with and without the
 * A5 files (`interpretations.json`, `proposed-exceptions.json`) are byte-identical. The A5 files are written by the
 * runner (scripted mock, 0 model calls) into the project itself, and C3 is run again by a fresh in-process evaluator
 * (cypher-interp, no Neo4j, no result cache). The run id and timing fields are the only ones removed before the comparison.
 */
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { main } from '../../../../scripts/v1.4/c4-run.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { createInterpEvaluator } from '../../../../src/mcp-server/interp-evaluator.js';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { tempDir } from './helpers.js';

// Per-run identity and timings: the only fields two runs of the same input may differ in.
const VOLATILE = new Set(['runId', 'durationMs', 'timings', 'latencyMs', 'elapsedMs', 'executionTimeMs']);

function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (typeof v !== 'object' || v === null) return v;
  return Object.fromEntries(Object.entries(v).filter(([k]) => !VOLATILE.has(k)).map(([k, x]) => [k, stable(x)]));
}

async function c3(project: string, spec: string): Promise<EvaluationReport> {
  const r = await createInterpEvaluator()({ projectPath: project, specPath: resolve(spec), scoringMode: 'v1.3' });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  expect(r.data.cache).toBe('miss');
  return r.data.report;
}

describe('C4 never changes a verdict or a score (C4-01 §4.4)', () => {
  it.each([
    ['c4-01-adr-permits-read-skip', 'presets/layered.yaml'],
    ['c4-04t-superseded-adr', 'presets/hexagonal.yaml'],
  ])('%s: C3 with and without A5 is byte-identical', async (id, spec) => {
    const { dir, cleanup } = tempDir('c4-inv-');
    try {
      const project = join(dir, id);
      cpSync(join('tests/fixtures/v1.4-c4', id), project, { recursive: true });
      const before = await c3(project, spec);

      const out = join(dir, 'a5');
      const write = process.stdout.write.bind(process.stdout);
      process.stdout.write = (() => true) as typeof process.stdout.write;
      let code: number;
      try {
        code = await main(['--project', project, '--spec', spec, '--provider', 'mock', '--out', out]);
      } finally {
        process.stdout.write = write;
      }
      expect(code).toBe(0);
      const a5 = join(out, id, 'interpretations.json');
      expect(existsSync(a5)).toBe(true);
      const parsed = JSON.parse(readFileSync(a5, 'utf8')) as { artifact: string; entries: { c3Verdict: unknown }[] };
      expect(parsed.artifact).toBe('A5');
      expect(parsed.entries.length).toBeGreaterThan(0);
      // The A5 files sit inside the project: anything on the scoring path that read them would now differ.
      writeFileSync(join(project, 'interpretations.json'), readFileSync(a5));
      writeFileSync(join(project, 'proposed-exceptions.json'), readFileSync(join(out, id, 'proposed-exceptions.json')));
      const after = await c3(project, spec);

      expect(canonicalJSON(stable(after))).toBe(canonicalJSON(stable(before)));
      expect(after.verdict).toBe(before.verdict);
      expect(canonicalJSON(after.tiers)).toBe(canonicalJSON(before.tiers));
      expect(canonicalJSON(after.violations)).toBe(canonicalJSON(before.violations));
      expect(after.tiers?.verdict).toBe('fail');
      for (const e of parsed.entries) expect(e.c3Verdict).toMatchObject({ tier: 'blocking', verdict: 'fail' });
    } finally {
      cleanup();
    }
  }, 300_000);
});
