/**
 * R03 (Docs/v1.3/post-merge-review-2026-10-16.md): the v1.3 extractor models string-literal `require()` and `import()`
 * calls as IMPORTS edges (V13_DEFAULT_OPTIONS.dynamicImports), so `evaluate` scores them (FF-S01, FF-S04, FF-P01) and
 * a cycle they close fails no-cyclic-deps. The MCP fast path must agree: same blocking rules on the same files.
 * The fixture's evaluate answer (cypher-interp engine) is checked here too, so the two sides cannot drift apart.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkSource } from '../../../src/mcp-server/file-check.js';
import { ProjectView } from '../../../src/mcp-server/project-files.js';
import { evaluateProject } from '../../../src/mcp-server/evaluate-project.js';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { CLEAN_ARCH_SPEC, REPO, loadSpec } from './helpers.js';

const PROJECT = path.join(REPO, 'tests/fixtures/v1.3-dynamic-imports');
let clean: ParsedSpec;

beforeAll(async () => {
  clean = await loadSpec(CLEAN_ARCH_SPEC);
});

function mcpBlocking(file: string): string[] {
  const view = new ProjectView({ root: PROJECT });
  const res = checkSource(clean, { path: file, content: fs.readFileSync(path.join(PROJECT, file), 'utf8'), view });
  return [...new Set(res.findings.filter((f) => f.tier === 'blocking').map((f) => f.rule))].sort();
}

describe('R03: require()/import() are scored by check_file as evaluate scores them', () => {
  it('evaluate (v1.3 defaults) reports the dynamic-import edges as blocking findings', async () => {
    const graph = { healthCheck: () => Promise.resolve(true), close: () => Promise.resolve() } as unknown as GraphRepository;
    const r = await evaluateProject({ projectPath: PROJECT, specPath: CLEAN_ARCH_SPEC, scoringMode: 'v1.3' }, { NEO4J_PASSWORD: 'unused', APG_STORE_PATH: fs.mkdtempSync(path.join(os.tmpdir(), 'r03-apg-')) }, {
      makeGraph: () => graph,
      makePipeline: (config) => createPipeline({ ...config, graphEngine: 'cypher-interp' }),
    });
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    const blockingIds = new Set((r.data.tiers?.blocking.rules ?? []).map((x) => String(x.functionId)));
    const byFile = new Map<string, Set<string>>();
    for (const g of r.data.byRule) {
      if (!blockingIds.has(g.ruleId)) continue;
      for (const v of g.violations) for (const f of v.filePath.split(',')) {
        const rel = path.relative(PROJECT, path.resolve(PROJECT, f)).split(path.sep).join('/');
        byFile.set(rel, new Set([...(byFile.get(rel) ?? []), g.ruleId]));
      }
    }
    expect([...(byFile.get('src/domain/order.ts') ?? [])].sort()).toEqual(['FF-S01', 'FF-S04']);
    expect([...(byFile.get('src/domain/orm.ts') ?? [])].sort()).toEqual(['FF-P01']);
    expect([...(byFile.get('src/application/a.ts') ?? [])].sort()).toEqual(['FF-S02']);
  }, 120_000);

  it('check_file gives the same blocking rules on the same files', () => {
    expect(mcpBlocking('src/domain/order.ts')).toEqual(['FF-S01', 'FF-S04']);
    expect(mcpBlocking('src/domain/orm.ts')).toEqual(['FF-P01']);
    expect(mcpBlocking('src/application/a.ts')).toEqual(['FF-S02']);
  });

  it('the cycle graph keeps the import() edge', () => {
    const g = new ProjectView({ root: PROJECT }).importGraph();
    expect([...(g.get('src/application/a.ts') ?? [])]).toEqual(['src/application/b.ts']);
  });
});
