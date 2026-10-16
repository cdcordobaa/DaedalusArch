/**
 * R09 and R30 (Docs/v1.3/post-merge-review-2026-10-16.md), through the whole in-process pipeline (cypher-interp, no
 * Neo4j) on the v1.3 reference projects:
 * - R09: the carrier rules Q5 D, Q16 B and Q17 C add are declared by the switch, so report identity I1 must still
 *   hold and the report must assemble (no REPORT_COUNTS_INCONSISTENT);
 * - R30: under `--scoring v1.2e` no switch applies, not even at compile time.
 * The answers are injected (`PipelineConfig.constructAnswers`); the switch file stays at A. No per-option effect on the
 * development set is computed: only whether a report assembles and which functions ran.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';
import { CONSTRUCT_ANSWERS, isStatusQuo, withAnswers } from '../../../src/shared/construct-switches.js';
import type { DomainResult } from '../../../src/shared/errors/domain-result.js';

const REF = path.resolve(__dirname, '../../fixtures/v1.3-reference');
const PRESETS = path.resolve(__dirname, '../../../presets');

async function evaluate(project: string, spec: string, extra: Partial<PipelineConfig>): Promise<DomainResult<EvaluationReport>> {
  const store = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-report-'));
  const { executor, cleanup } = createPipeline({
    projectPath: project, specFilePath: spec, neo4jUri: '', neo4jUser: '', neo4jPassword: '', evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless', persist: false, diff: false, verbose: false, apgStorePath: store, graphEngine: 'cypher-interp', ...extra,
  });
  try {
    return await executor.execute();
  } finally {
    await cleanup();
    fs.rmSync(store, { recursive: true, force: true });
  }
}

const codes = (r: DomainResult<unknown>): string[] => (r.success ? [] : r.errors.map((e) => e.code));
const ran = (r: EvaluationReport): string[] => r.functionResults.map((f) => String(f.functionId)).sort();

describe('construct switches through the report builder', () => {
  it('the switch file is at the status quo (every answer A)', () => {
    expect(isStatusQuo(CONSTRUCT_ANSWERS)).toBe(true);
  });

  it.each([
    ['hexagonal', { Q5: 'D' }, 'FF-S05'],
    ['ddd', { Q5: 'D' }, 'FF-S05'],
    ['ddd', { Q16: 'B' }, 'FF-S02'],
    ['ddd', { Q17: 'C' }, 'FF-DS03'],
    ['clean-architecture', { Q24: 'B' }, 'FF-S03'],
  ] as const)('R09: %s with %j assembles a report that runs the carrier %s', async (style, answers, carrier) => {
    const project = style === 'ddd' ? path.join(REF, 'ddd/clean') : path.join(REF, style, 'project');
    // (the ddd reference project is an overlay set: its clean tree with the preset spec)
    const spec = style === 'ddd' ? path.join(PRESETS, 'ddd.yaml') : path.join(REF, style, 'spec.yaml');
    const r = await evaluate(project, spec, { scoringMode: 'v1.3', constructAnswers: withAnswers(answers) });
    expect(codes(r)).toEqual([]);
    if (r.success) expect(ran(r.data)).toContain(carrier);
  }, 120_000);

  it('R30: under --scoring v1.2e a set switch changes nothing (compile overlays included)', async () => {
    const project = path.join(REF, 'clean-architecture/project');
    const spec = path.join(REF, 'clean-architecture/spec.yaml');
    const base = await evaluate(project, spec, { scoringMode: 'v1.2e' });
    const switched = await evaluate(project, spec, { scoringMode: 'v1.2e', constructAnswers: withAnswers({ Q24: 'B', Q13: 'C', Q25: 'B' }) });
    if (!base.success || !switched.success) throw new Error([...codes(base), ...codes(switched)].join('; '));
    expect(ran(switched.data)).toEqual(ran(base.data));
    expect(switched.data.ahsDeterministic).toBe(base.data.ahsDeterministic);
    expect(switched.data.violations.map((v) => v.id).sort()).toEqual(base.data.violations.map((v) => v.id).sort());
  }, 120_000);
});
