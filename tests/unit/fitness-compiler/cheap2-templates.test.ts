/**
 * Batch-2 cheap-proxy extension templates (`cheap2-templates.ts`) and their in-memory mirrors (`cheap2-in-memory.ts`),
 * run on the planted fixtures of `tests/fixtures/v1.3-cheap2`: every template is advisory, registered as the `cheap2`
 * catalogue, and its mirror returns one row per planted case of its rule and none on the near misses.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { CHEAP2_TEMPLATES, CHEAP2_TEMPLATE_TIERS } from '../../../src/fitness-compiler/cheap2-templates.js';
import { CHEAP2_IN_MEMORY } from '../../../src/fitness-compiler/cheap2-in-memory.js';
import type { CheapFacts } from '../../../src/fitness-compiler/cheap2-in-memory.js';
import { apg2Params, memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import type { Row } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { V13_EXTENSION_TEMPLATE_CATALOGUES, v13ExtensionCatalogueOf } from '../../../src/fitness-compiler/extension-templates.js';
import { analyseProvenance, readGitHistory } from '../../../src/apg-enrich/cheap/index.js';
import type { ContextProxyId } from '../../../src/apg-enrich/cheap/index.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import { CHEAP2_FIXTURES, loadExpected, materialiseFixture, replayGit, runDir } from '../apg-enrich/cheap/batch2-helpers.js';
import type { ReplayCommit } from '../apg-enrich/cheap/batch2-helpers.js';
import { LAYERS } from '../apg-enrich/cheap/helpers.js';

const rows = (template: string, apg: APGResult, facts: CheapFacts): Row[] => {
  const f = CHEAP2_IN_MEMORY.get(template);
  if (f === undefined) throw new Error(`no mirror for ${template}`);
  return f(memGraph(apg, LAYERS), facts, apg2Params(LAYERS));
};

describe('batch-2 cheap template catalogue', () => {
  it('is registered as the cheap2 extension catalogue, advisory only, every template mirrored', () => {
    expect(V13_EXTENSION_TEMPLATE_CATALOGUES.get('cheap2')).toBe(CHEAP2_TEMPLATES);
    for (const name of CHEAP2_TEMPLATES.keys()) {
      expect(v13ExtensionCatalogueOf(name)).toBe('cheap2');
      expect(CYPHER_TEMPLATES.has(name)).toBe(false);
    }
    expect([...CHEAP2_IN_MEMORY.keys()].sort()).toEqual([...CHEAP2_TEMPLATES.keys()].sort());
    expect([...CHEAP2_TEMPLATE_TIERS.keys()].sort()).toEqual([...CHEAP2_TEMPLATES.keys()].sort());
    expect([...CHEAP2_TEMPLATE_TIERS.values()].every((t) => t.tier === 'advisory')).toBe(true);
    expect(CHEAP2_TEMPLATES.size).toBe(7);
  });

  const CASES: readonly { template: string; fixture: string; proxy: ContextProxyId; kind: string; options?: Record<string, unknown>; git?: boolean }[] = [
    { template: 'framework-exception-in-core', fixture: 'error-flow', proxy: 'error-flow', kind: 'framework-http-exception-in-core' },
    { template: 'endpoint-bypasses-application', fixture: 'reachability', proxy: 'reachability', kind: 'endpoint-bypasses-core' },
    { template: 'vendor-sdk-outside-adapters', fixture: 'sdk-spread', proxy: 'sdk-spread', kind: 'vendor-sdk-outside-adapters' },
    { template: 'untested-component', fixture: 'test-topology', proxy: 'test-topology', kind: 'untested-component' },
    { template: 'env-read-outside-config', fixture: 'config-surface', proxy: 'config-surface', kind: 'env-read-outside-config' },
    { template: 'hidden-coupling', fixture: 'co-change', proxy: 'co-change', kind: 'hidden-coupling', options: { coChangeMaxFilesPerCommit: 6 }, git: true },
  ];
  for (const c of CASES) it(`${c.template}: one row per planted ${c.kind} site, none on the near misses`, async () => {
    const root = materialiseFixture(c.fixture);
    if (c.git === true) {
      const h = JSON.parse(fs.readFileSync(path.join(CHEAP2_FIXTURES, c.fixture, 'history.json'), 'utf8')) as { commits: ReplayCommit[] };
      replayGit(root, h.commits);
    }
    const fx = await runDir(root, [c.proxy], c.options ?? {});
    try {
      const r = rows(c.template, fx.apg, fx.enrichment);
      const exp = loadExpected(c.fixture);
      const plantedFiles = [...new Set(exp.planted.filter((p) => p.kind === c.kind).map((p) => p.file))].sort();
      const rowFiles = [...new Set(r.map((x) => String(x.filePath)))].sort();
      if (c.template === 'hidden-coupling') {
        // One row per file pair: every planted pair, from its first file.
        expect(rowFiles).toEqual(plantedFiles);
      } else if (c.template === 'endpoint-bypasses-application') {
        expect(rowFiles).toEqual(plantedFiles);
        expect(r.map((x) => String(x.target)).sort()).toEqual(['InMemoryProductRepository.findAll', 'OrderStore.save']);
      } else {
        expect(rowFiles).toEqual(plantedFiles);
      }
      const onNearMiss = (x: Row, n: (typeof exp.nearMisses)[number]): boolean => {
        if (x.filePath !== n.file) return false;
        const member = typeof x.member === 'string' ? x.member : '';
        if (n.methodName !== undefined) return member === (n.className !== undefined ? `${n.className}.${n.methodName}` : n.methodName);
        return n.className === undefined || member.startsWith(n.className);
      };
      for (const n of exp.nearMisses) expect(r.filter((x) => onNearMiss(x, n))).toEqual([]);
    } finally {
      fx.cleanup();
    }
  });


  it('agent-reimplementation: one row per planted re-implementation of the provenance fixture', async () => {
    const steps = JSON.parse(fs.readFileSync(path.join(CHEAP2_FIXTURES, 'provenance', 'steps.json'), 'utf8')) as { steps: ReplayCommit[] };
    const repo = materialiseFixture('provenance');
    try {
      replayGit(repo, steps.steps);
      const res = await analyseProvenance(readGitHistory(repo), { layerModel: LAYERS });
      if (res.apg === null) throw new Error('no snapshot');
      const r = rows('agent-reimplementation', res.apg, res);
      expect(r.map((x) => `${String(x.step)}:${String(x.unit)}>${String(x.existing)}:${String(x.via)}`)).toEqual([
        'step-04:isBehind>isLate:clone',
        'step-03:TodoStore>InMemoryTodoRepository:vocabulary',
        'step-02:TagService.overdueTagged>TodoService.overdue:clone',
      ]);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  }, 120_000);
});
