/**
 * U5 evasion check: tree import graph, endpoint normalisation and placements (design §2.2, §2.4). EV-08: an
 * unresolved relative specifier is counted, never guessed. Synthetic trees; no model, no Neo4j.
 */
import {
  OUTSIDE,
  UNMAPPED,
  buildGraph,
  endpoints,
  isTestFile,
  parseTierTable,
  placementModel,
  placementOf,
  treePathOf,
} from '../../../../../scripts/v1.3/lib/evasion/import-graph.js';
import { mapFinding, parseNameStatus } from '../../../../../scripts/v1.3/lib/evasion/identity.js';
import { FIX_REL, loadSpec, tierText } from './helpers.js';

const tree = (files: Record<string, string>) => ({ files: new Map(Object.entries(files)) });

describe('import graph', () => {
  it('resolves relative specifiers (.js dropped, x.ts, x/index.ts), keeps the kind, and counts the unresolved', () => {
    const g = buildGraph(
      tree({
        'src/a.ts': "import { b } from './b.js';\nimport type { C } from './c';\nexport { d } from './d';\nconst e = import('./e');\nimport x from 'lodash';\nimport { z } from './missing';\n",
        'src/b.ts': 'export const b = 1;\n',
        'src/c/index.ts': 'export interface C {}\n',
        'src/d.ts': 'export const d = 1;\n',
        'src/e.ts': 'export const e = 1;\n',
      }),
    );
    expect(g.edges.map((e) => `${e.to}:${e.kind}`)).toEqual(['src/b.ts:static', 'src/c/index.ts:typeOnly', 'src/d.ts:reexport', 'src/e.ts:dynamic']);
    expect(g.unresolved).toBe(1);
  });

  it('endpoints: tree paths as they are, a project-relative path, a raw specifier from filePath, edgeless, unresolved', () => {
    const t = tree({ 'src/domain/a.ts': '', 'src/infra/b.ts': '' });
    const f = { ruleId: 'R', ruleName: 'r', message: '' };
    expect(endpoints({ ...f, filePath: 'src/domain/a.ts', target: 'src/infra/b.ts' }, t)).toEqual({ source: 'src/domain/a.ts', target: 'src/infra/b.ts' });
    expect(endpoints({ ...f, filePath: 'domain/a.ts', target: '../infra/b' }, t)).toEqual({ source: 'src/domain/a.ts', target: 'src/infra/b.ts' });
    expect(endpoints({ ...f, filePath: 'src/domain/a.ts' }, t)).toEqual({ source: 'src/domain/a.ts', target: 'edgeless' });
    expect(endpoints({ ...f, filePath: 'src/domain/a.ts', target: '../nowhere' }, t)).toEqual({ source: 'src/domain/a.ts', target: null });
    expect(treePathOf('./src/infra/b', t.files)).toBe('src/infra/b.ts');
  });

  it('test files are marked (REV-03 finding 5)', () => {
    expect(['src/a.test.ts', 'src/a.spec.ts', 'src/__tests__/a.ts', 'src/test/a.ts'].every(isTestFile)).toBe(true);
    expect(isTestFile('src/testing-utils.ts')).toBe(false);
  });

  it('placements: a layer, a DDD context layer, outside, unmapped', async () => {
    const layered = placementModel(await loadSpec(`${FIX_REL}/spec.yaml`));
    expect(placementOf(layered, 'src/business/x.ts')).toBe('business');
    expect(placementOf(layered, 'src/helpers/x.ts')).toBe(UNMAPPED);
    const ddd = placementModel(await loadSpec(`${FIX_REL}/spec-ddd.yaml`));
    expect(placementOf(ddd, 'src/ordering/infrastructure/db.ts')).toBe('ordering/infrastructure');
    expect(placementOf(ddd, 'src/scripts/seed.ts')).toBe(OUTSIDE);
    expect(placementOf(ddd, 'src/tools/dump.ts')).toBe(UNMAPPED);
  });

  it('the tier table: FF-S03 is blocking for layered only; FF-P02 is advisory', () => {
    const t = parseTierTable(tierText().text);
    expect(t.get('FF-S01')).toBe('blocking');
    expect(t.get('FF-S03')).toBe('blocking-layered-only');
    expect(t.get('FF-P02')).toBe('advisory');
  });
});

describe('rename seam', () => {
  it('parses name-status: an R row is a rename, a C row is not', () => {
    const m = parseNameStatus('R087\tsrc/a.ts\tsrc/b.ts\nC100\tsrc/c.ts\tsrc/d.ts\nM\tsrc/e.ts\nD\tsrc/f.ts\nA\tsrc/g.ts\n');
    expect([...m]).toEqual([['src/a.ts', 'src/b.ts']]);
  });

  it('maps a finding (cycle file lists included) and leaves a raw specifier alone', () => {
    const rho = { map: new Map([['src/a.ts', 'src/b.ts']]), renameDetection: 'full' as const };
    expect(mapFinding({ ruleId: 'R', ruleName: 'r', message: '', filePath: 'src/a.ts,src/c.ts', target: '../x' }, rho)).toMatchObject({ filePath: 'src/b.ts,src/c.ts', target: '../x' });
  });
});
