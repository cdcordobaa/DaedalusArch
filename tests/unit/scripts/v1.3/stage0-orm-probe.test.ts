/**
 * Stage-0 instrument probe (Docs/DiagnosticRuns/v1.3-stage0-orm-probe-2026-10-16.md): the per-file tools on the
 * planted TypeORM fixtures, fast path only (no graph, no Neo4j), and the recorded results file.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildContext } from '../../../../src/mcp-server/context.js';
import { checkFileTool, checkImportTool } from '../../../../src/mcp-server/tools.js';

const ROOT = path.resolve(__dirname, '../../../..');
const FIXTURES = path.join(ROOT, 'fixtures/v1.3-stage0-orm-probe');
const LAYOUTS = {
  clean: { spec: 'specs/clean-arch.yaml', persistence: 'src/infrastructure/persistence' },
  hexagonal: { spec: 'presets/hexagonal.yaml', persistence: 'src/adapters/outbound/persistence' },
} as const;

const PLANTED: Readonly<Record<string, (l: keyof typeof LAYOUTS) => string>> = {
  'decorated-domain-class': () => 'src/domain/entities/order.ts',
  'version-column': (l) => `${LAYOUTS[l].persistence}/order.orm-entity.ts`,
  'datasource-in-use-case': () => 'src/application/use-cases/place-order.ts',
  'repository-without-port': () => 'src/application/use-cases/place-order.ts',
  'querybuilder-in-logic': () => 'src/application/services/order-report.service.ts',
};

const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('NEO4J_')));

describe('stage-0 ORM probe fixtures: check_file and check_import (fast path)', () => {
  for (const layout of Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]) {
    const ctx = buildContext({ spec: path.join(ROOT, LAYOUTS[layout].spec), project: path.join(FIXTURES, 'control', layout), engine: 'cypher-interp' }, env);
    for (const [caseId, planted] of Object.entries(PLANTED)) {
      const blocks = caseId === 'decorated-domain-class';
      it(`${caseId}/${layout}: ${blocks ? 'blocks' : 'passes'}`, async () => {
        const rel = planted(layout);
        const content = fs.readFileSync(path.join(FIXTURES, caseId, layout, rel), 'utf8');
        const file = await checkFileTool(ctx, { path: rel, content });
        const imp = await checkImportTool(ctx, { from: rel, module: 'typeorm' });
        if (!file.ok || !imp.ok) throw new Error('tool failed');
        expect(file.data.blockingVerdict).toBe(blocks ? 'block' : 'pass');
        expect(imp.data.blockingVerdict).toBe(blocks ? 'block' : 'pass');
        if (blocks) expect(imp.data.violations.map((v) => v.ruleId)).toEqual(['FF-P01']);
      });
    }
  }
});

describe('stage-0 ORM probe: recorded results', () => {
  it('only decorated-domain-class has a blocking graph finding, labelled correct', () => {
    const r = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/v1.3-stage0-orm-probe/results.json'), 'utf8')) as {
      prediction: { holds: boolean; blockingCases: string[] };
      summary: { case: string; graphBlocking: number; checkCorrect: string }[];
    };
    expect(r.prediction.holds).toBe(true);
    expect(r.prediction.blockingCases).toEqual(['decorated-domain-class']);
    for (const s of r.summary) {
      expect(s.graphBlocking).toBe(s.case === 'decorated-domain-class' ? 1 : 0);
      if (s.graphBlocking > 0) expect(s.checkCorrect).toBe('correct');
    }
  });
});
