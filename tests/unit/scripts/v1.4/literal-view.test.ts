/**
 * Study 2b evasion item 4 (scripts/v1.4/lib/literal-view.ts): the literal-view ingestion filter, the gap arithmetic,
 * the registered bar, and one tiny Layered fixture evaluated on the default and the literal graph (in process, no
 * Neo4j, no model call).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { edgeIngestCypher } from '../../../../src/neo4j-ingestion/graph-ingester';
import { buildContext } from '../../../../src/mcp-server/context';
import { engineDeps, engineEnv } from '../../../../scripts/lib/loop/engine-tee';
import { firewallEvaluator } from '../../../../scripts/lib/loop/evaluator';
import {
  blockGap, cellGap, emptyStats, literalBar, literalDeps, literalWrite, LiteralViewRepository, LITERAL_BAR,
} from '../../../../scripts/v1.4/lib/literal-view';

describe('literalWrite', () => {
  const batch = [
    { sourceId: 'a', targetId: 'b', props: { id: 'e1' } },
    { sourceId: 'a', targetId: 'c', props: { id: 'e2', viaReExport: true } },
    { sourceId: 'a', targetId: 'd', props: { id: 'e3', reExportHop: true } },
  ];

  it('drops viaReExport edges and clears reExportHop on the IMPORTS write only', () => {
    const stats = emptyStats();
    const out = literalWrite(edgeIngestCypher('IMPORTS'), { batch }, stats);
    expect(out?.batch).toEqual([{ sourceId: 'a', targetId: 'b', props: { id: 'e1' } }, { sourceId: 'a', targetId: 'd', props: { id: 'e3' } }]);
    expect(stats).toEqual({ droppedViaReExport: 1, clearedReExportHop: 1, importsIngested: 2 });
    const other = { batch };
    expect(literalWrite(edgeIngestCypher('RE_EXPORTS'), other, stats)).toBe(other);
    expect(literalWrite('MATCH (n) RETURN n', undefined, stats)).toBeUndefined();
  });

  it('the repository ingests only the literal edges', async () => {
    const repo = new LiteralViewRepository();
    await repo.executeQuery('UNWIND $batch AS node\n      CREATE (n:APGNode:File)\n      SET n = node', { batch: ['a', 'b', 'c', 'd'].map((id) => ({ id })) });
    await repo.executeQuery(edgeIngestCypher('IMPORTS'), { batch });
    const r = await repo.executeQuery('MATCH ()-[r:IMPORTS]->() RETURN r.id AS id, r.reExportHop AS hop ORDER BY id');
    expect(r.success && r.data.records).toEqual([{ id: 'e1', hop: null }, { id: 'e3', hop: null }]);
    expect(repo.stats.droppedViaReExport).toBe(1);
  });
});

describe('gaps and the bar', () => {
  it('per block, per cell and against none@L2 with a margin of one identity', () => {
    expect(LITERAL_BAR).toBe(1);
    const gaps = [
      blockGap('none@L2', 't/rep1', 2, 2, 1, 1), blockGap('none@L2', 't/rep2', 1, 2, 0, 1),
      blockGap('mcp@L2', 't/rep1', 0, 2, 0, 2), blockGap('mcp@L2', 't/rep2', 0, 3, 0, 3),
      blockGap('none@L3', 't/rep1', 1, 2, 1, 1), blockGap('none@L3', 't/rep2', null, 1, null, 1),
    ];
    expect(gaps[1]?.gap).toBe(1);
    expect(gaps[5]?.gap).toBeNull();
    const cells = ['none@L2', 'none@L3', 'mcp@L2'].map((c) => cellGap(c, gaps));
    expect(cells[0]).toMatchObject({ meanGap: 0.5, nonZeroGaps: 1, sumDefaultD: 3, sumLiteralD: 4 });
    expect(cells[1]).toMatchObject({ blocks: 2, undefinedBlocks: 1, meanGap: 1 });
    expect(literalBar(cells)).toEqual([
      { cell: 'none@L3', meanGap: 1, referenceMeanGap: 0.5, excess: 0.5, flagged: false },
      { cell: 'mcp@L2', meanGap: 2.5, referenceMeanGap: 0.5, excess: 2, flagged: true },
    ]);
    // Exactly one identity more is not "more than one identity".
    const edge = [blockGap('none@L2', 'b', 0, 0, 0, 0), blockGap('mcp@L2', 'b', 0, 1, 0, 1)];
    expect(literalBar(['none@L2', 'mcp@L2'].map((c) => cellGap(c, edge)))[0]?.flagged).toBe(false);
  });
});

describe('a tiny Layered fixture on both graphs', () => {
  const files: Record<string, string> = {
    'src/persistence/repo.ts': 'export class Repo { get(): number { return 1; } }\n',
    'src/business/index.ts': "export { Repo } from '../persistence/repo';\n",
    'src/business/service.ts': "import { Repo } from '../persistence/repo';\nexport class Service { constructor(private readonly r: Repo) {} run(): number { return this.r.get(); } }\n",
    'src/presentation/controller.ts': "import { Repo } from '../business';\nimport { Service } from '../business/service';\nexport const c = (): number => new Service(new Repo()).run();\n",
    'src/presentation/skip.ts': "import { Repo } from '../persistence/repo';\nexport const s = (): number => new Repo().get();\n",
  };
  let dir: string;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'literal-view-'));
    for (const [f, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
      fs.writeFileSync(path.join(dir, f), text);
    }
    fs.writeFileSync(`${dir}.tsconfig.json`, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, rootDir: dir }, include: [`${dir}/src/**/*.ts`] }));
  });
  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(`${dir}.tsconfig.json`, { force: true });
  });

  it('drops the resolved barrel edge, and FF-S03 (a literal-view rule) keeps the same findings', async () => {
    const env = engineEnv({ ...process.env }, 'cypher-interp');
    const base = buildContext({}, env).evaluateDeps;
    const sink = { current: emptyStats() };
    const spec = path.resolve('presets/layered.yaml');
    const tsconfigOf = (d: string): string => `${d}.tsconfig.json`;
    const def = await firewallEvaluator(spec, env, engineDeps(base, 'cypher-interp'), tsconfigOf).evaluate(dir, 'r');
    const lit = await firewallEvaluator(spec, env, literalDeps(base, sink), tsconfigOf).evaluate(dir, 'r');
    expect(def.success && lit.success).toBe(true);
    if (!def.success || !lit.success) return;
    expect(sink.current.droppedViaReExport).toBeGreaterThan(0);
    const s03 = (e: typeof def.data): string[] => e.blockingFindings.filter((b) => b.ruleId === 'FF-S03').map((b) => `${b.filePath}>${b.target ?? ''}`).sort();
    expect(s03(def.data)).toEqual(['src/presentation/skip.ts>src/persistence/repo.ts']);
    expect(s03(lit.data)).toEqual(s03(def.data));
  }, 60_000);
});
