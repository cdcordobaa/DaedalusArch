/**
 * R02 (Docs/v1.3/post-merge-review-2026-10-16.md): `--scoring v1.2e` computes the frozen universal metrics, but the
 * pipeline always extracts the v1.3 graph (reExportEdges 'both'), so a barrel import counts twice in fan-out. The fix
 * is opt-in (it changes v1.2e-mode outputs, which scripts/run-experiment.ts produces): `extractorDefaults: 'v1.2e'`
 * (CLI `--extractor v1.2e`) extracts the registered v1.2E graph. The default stays the v1.3 graph.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import type { EvaluationReport } from '../../../src/shared/types/evaluation.js';

const SPEC = path.resolve(__dirname, '../../../specs/clean-arch.yaml');

function project(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'r02-')));
  const w = (rel: string, text: string): void => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  w('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, module: 'commonjs', target: 'ES2022' }, include: ['src/**/*.ts'] }));
  w('src/domain/x.ts', 'export class X {}\n');
  w('src/domain/y.ts', 'export class Y {}\n');
  w('src/domain/index.ts', "export { X } from './x';\nexport { Y } from './y';\n");
  w('src/application/a.ts', "import { X, Y } from '../domain';\nexport const both = [X, Y];\n");
  return root;
}

async function run(root: string, extra: Partial<PipelineConfig>): Promise<EvaluationReport> {
  const { executor, cleanup } = createPipeline({
    projectPath: root, specFilePath: SPEC, neo4jUri: '', neo4jUser: '', neo4jPassword: '', evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless', persist: false, diff: false, verbose: false, apgStorePath: path.join(root, '.apg'), graphEngine: 'cypher-interp',
    ...extra,
  });
  try {
    const r = await executor.execute();
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    return r.data;
  } finally {
    await cleanup();
  }
}

describe('R02: the v1.2e scoring mode and the graph it measures', () => {
  it('--extractor v1.2e gives the resolved-only fan-out of the registered v1.2E graph; the default is unchanged', async () => {
    const root = project();
    try {
      const v12eOnV13Graph = await run(root, { scoringMode: 'v1.2e' });
      expect(v12eOnV13Graph.universalMetrics.maxFanOut).toBe(3); // literal hop + two resolved edges (the defect, kept by default)
      const v12eOnV12eGraph = await run(root, { scoringMode: 'v1.2e', extractorDefaults: 'v1.2e' });
      expect(v12eOnV12eGraph.universalMetrics.maxFanOut).toBe(2);
      const v13 = await run(root, { scoringMode: 'v1.3' });
      expect(v13.universalMetrics.maxFanOut).toBe(1); // v1.3: the literal view (a -> the barrel)
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }, 120_000);
});
