/**
 * Scope of the APG v2 templates (`Docs/v1.3/apg2-scope-adr-draft.md`): one test group per change, on small projects
 * written to a temporary directory, extracted with `V13_APG2_OPTIONS` and read through the in-memory mirrors (the live
 * run checks that the Cypher returns the same rows: `Docs/DiagnosticRuns/apg2-scope-2026-10-15.md`).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG, componentsFromLayerModel, V12E_DEFAULT_OPTIONS, V13_APG2_OPTIONS } from '../../../src/apg-extractor/index.js';
import type { ComponentDeclaration } from '../../../src/apg-extractor/index.js';
import type { APGResult } from '../../../src/shared/types/apg.js';
import type { LayerDefinition, LayerModel } from '../../../src/shared/types/spec.js';
import type { LayerKind } from '../../../src/shared/types/enums.js';
import { APG2_TEMPLATES } from '../../../src/fitness-compiler/apg2-templates.js';
import { APG2_IN_MEMORY, apg2Params, compositionRootLayers, memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import type { Apg2Params, MemGraph, Row } from '../../../src/fitness-compiler/apg2-in-memory.js';
import {
  APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_MIN_TYPES_FOR_DISTANCE, APG2_TEST_PATTERNS, isApg2TestPath, matchesAny,
} from '../../../src/shared/apg2-scope.js';

const TSCONFIG = JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'CommonJS', moduleResolution: 'node', strict: true, skipLibCheck: true }, include: ['src/**/*.ts'] });

const dirs: string[] = [];
function project(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apg2-scope-'));
  dirs.push(dir);
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), TSCONFIG);
  for (const [p, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
    fs.writeFileSync(path.join(dir, p), text);
  }
  return dir;
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

async function extract(dir: string, components: ComponentDeclaration[]): Promise<APGResult> {
  const r = await extractAPG(dir, { ...V13_APG2_OPTIONS, components });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}
const layer = (name: string, kind: LayerKind, dirsOf: string[], roles: string[] = []): LayerDefinition =>
  ({ name, directories: dirsOf, naming: [], role: roles.join(', '), kind, kindSource: 'explicit' });
const run = (t: string, g: MemGraph, p: Apg2Params): Row[] => {
  const f = APG2_IN_MEMORY.get(t);
  if (f === undefined) throw new Error(`no mirror ${t}`);
  return f(g, p);
};
const pairs = (rows: Row[]): string[] => rows.map((r) => `${String(r.filePath)} -> ${String(r.target)}`);

describe('scope patterns', () => {
  it('recognise test files and test composition roots', () => {
    for (const p of ['src/a.spec.ts', 'src/a.test.tsx', 'src/__tests__/x.ts', 'src/__mocks__/m.ts', 'test/x.ts', 'src/tests/y.ts',
      'src/config/testContainer.ts', 'src/test-module.ts', 'src/TestContainer.ts', 'src/test_utils.ts',
      'src/domain/Test.ts' /* the ADR's name rule (`Test` then `.`) covers it: a known cost of a name convention */]) {
      expect({ p, test: isApg2TestPath(p) }).toEqual({ p, test: true });
    }
    for (const p of ['src/testimony.ts', 'src/latest.ts', 'src/contest/x.ts', 'src/domain/Testimonial.ts', 'src/attestation.ts']) {
      expect({ p, test: isApg2TestPath(p) }).toEqual({ p, test: false });
    }
  });

  it('recognise composition roots by bootstrap and DI wiring names', () => {
    for (const p of ['src/main.ts', 'main.ts', 'src/app.module.ts', 'src/bootstrap.ts', 'src/composition-root.ts', 'src/compositionRoot.ts',
      'src/di/container.ts', 'src/app.container.ts', 'src/di.ts']) {
      expect({ p, root: matchesAny(APG2_COMPOSITION_ROOT_NAME_PATTERNS, p) }).toEqual({ p, root: true });
    }
    for (const p of ['src/domain.ts', 'src/mainline.ts', 'src/modules/order.ts', 'src/container-ship.ts', 'src/domain/Container.ts']) {
      expect({ p, root: matchesAny(APG2_COMPOSITION_ROOT_NAME_PATTERNS, p) }).toEqual({ p, root: false });
    }
  });

  it('are bound by apg2Params with the a priori minimum of 4 types', () => {
    const p = apg2Params({ layers: [layer('domain', 'domain', ['src/domain/**'])] });
    expect(APG2_MIN_TYPES_FOR_DISTANCE).toBe(4);
    expect(p).toMatchObject({ compositionRootLayers: [], compositionRootPatterns: APG2_COMPOSITION_ROOT_NAME_PATTERNS, testPatterns: APG2_TEST_PATTERNS, aclPatterns: [], minTypes: 4 });
  });

  it.each([...APG2_TEMPLATES.values()].map((t) => [t.functionName, t] as const))('%s: Cypher reads test scope; deep-import and type-leak read composition roots', (name, t) => {
    // Component templates read Component nodes, whose membership already leaves test code out (the extractor).
    const fileLevel = !name.startsWith('component-');
    expect(t.template.includes('$testPatterns')).toBe(fileLevel);
    expect(t.requiredParams.includes('testPatterns')).toBe(fileLevel);
    for (const p of t.requiredParams) expect(t.template).toContain(`$${p}`);
    const roots = ['boundary-type-leak', 'deep-import-declared-api', 'deep-import-inferred-api'].includes(name);
    expect(t.template.includes('$compositionRootLayers')).toBe(roots);
    expect(t.template.includes('$aclPatterns')).toBe(name.startsWith('deep-import'));
  });
});

describe('change 1: composition roots', () => {
  it('detects declared (role) and structural (allowed_dependencies) composition-root layers', () => {
    const layers = [layer('domain', 'domain', ['src/domain/**']), layer('application', 'application', ['src/application/**']),
      layer('adapters', 'infrastructure', ['src/adapters/**']), layer('config', 'application', ['src/config/**']),
      layer('wiring', 'application', ['src/wiring/**'], ['composition-root'])];
    expect(compositionRootLayers({ layers })).toEqual(['wiring']);
    const allowedDependencies = [{ from: 'application', to: 'domain' }, { from: 'adapters', to: 'application' }, { from: 'adapters', to: 'domain' },
      ...['domain', 'application', 'adapters', 'wiring'].map((to) => ({ from: 'config', to }))];
    expect(compositionRootLayers({ layers, allowedDependencies })).toEqual(['config', 'wiring']);
  });

  const lm: LayerModel = {
    layers: [layer('domain', 'domain', ['src/domain/**']), layer('application', 'application', ['src/application/**']),
      layer('infrastructure', 'infrastructure', ['src/infrastructure/**']), layer('presentation', 'presentation', ['src/presentation/**']),
      layer('config', 'application', ['src/config/**'], ['composition-root'])],
  };
  const files = {
    'src/infrastructure/PgRepo.ts': 'export class PgRepo { find(): number { return 1; } }\n',
    'src/application/Service.ts': "import { PgRepo } from '../infrastructure/PgRepo';\nexport function leak(): PgRepo { return new PgRepo(); }\n",
    'src/application/bootstrap.ts': "import { PgRepo } from '../infrastructure/PgRepo';\nexport function boot(): PgRepo { return new PgRepo(); }\n",
    'src/config/wire.ts': "import { PgRepo } from '../infrastructure/PgRepo';\nexport function wire(): PgRepo { return new PgRepo(); }\n",
    'src/application/testContainer.ts': "import { PgRepo } from '../infrastructure/PgRepo';\nexport function createTestContainer(): PgRepo { return new PgRepo(); }\n",
  };

  it('boundary-type-leak: a composition root (by layer role or by name) and a test composition root expose adapters freely', async () => {
    const apg = await extract(project(files), componentsFromLayerModel(lm));
    const rows = run('boundary-type-leak', memGraph(apg, lm), apg2Params(lm));
    expect(rows.map((r) => r.member)).toEqual(['leak']);
    // Without the scope (no roots, no tests) every one of them is reported.
    const unscoped = { ...apg2Params(lm), compositionRootLayers: [], compositionRootPatterns: [], testPatterns: [] };
    expect(run('boundary-type-leak', memGraph(apg, lm), unscoped).map((r) => r.member)).toEqual(['leak', 'boot', 'createTestContainer', 'wire']);
  });
});

describe('changes 1 and 2: deep imports from composition roots and anti-corruption layers', () => {
  const lm: LayerModel = {
    layers: [layer('composition', 'application', ['src/main.ts'], ['composition-root'])],
    ddd: {
      sourceRoot: 'src/', outsideContexts: ['src/main.ts'], aggregates: [], valueObjects: [], repositories: [], domainEventTypes: [], applicationServices: [],
      contexts: [
        { name: 'ordering', root: 'src/ordering/', publicApi: ['src/ordering/index.ts'], acl: [] },
        { name: 'billing', root: 'src/billing/', publicApi: ['src/billing/index.ts'], acl: ['src/billing/acl/**'] },
      ],
    },
  };
  const files = {
    'src/ordering/index.ts': "export { Order } from './domain/Order';\n",
    'src/ordering/domain/Order.ts': 'export class Order { id = 1; }\n',
    'src/ordering/internal/OrderId.ts': 'export class OrderId { v = 1; }\n',
    'src/billing/index.ts': "export { Invoice } from './domain/Invoice';\n",
    'src/billing/domain/Invoice.ts': 'export class Invoice { n = 1; }\n',
    'src/billing/acl/OrderingAcl.ts': "import { OrderId } from '../../ordering/internal/OrderId';\nexport class OrderingAcl { id?: OrderId; }\n",
    'src/billing/app/Leak.ts': "import { OrderId } from '../../ordering/internal/OrderId';\nexport class Leak { id?: OrderId; }\n",
    'src/main.ts': "import { OrderId } from './ordering/internal/OrderId';\nimport { Invoice } from './billing/domain/Invoice';\nexport const x = [OrderId, Invoice];\n",
    'src/wiring/container.ts': "import { OrderId } from '../ordering/internal/OrderId';\nexport const c = OrderId;\n",
    'src/__tests__/order.ts': "import { OrderId } from '../ordering/internal/OrderId';\nexport const t = OrderId;\n",
    'src/billing/testContainer.ts': "import { OrderId } from '../ordering/internal/OrderId';\nexport const t = OrderId;\n",
  };

  it('reports only the non-ACL, non-root, non-test deep import; the graph keeps every DEEP_IMPORT fact', async () => {
    const apg = await extract(project(files), componentsFromLayerModel(lm));
    const g = memGraph(apg, lm);
    const p = apg2Params(lm);
    expect(p.compositionRootLayers).toEqual(['composition']);
    expect(p.aclPatterns).toHaveLength(1);
    expect(pairs(run('deep-import-declared-api', g, p))).toEqual(['src/billing/app/Leak.ts -> src/ordering/internal/OrderId.ts']);
    const deep = apg.edges.filter((e) => e.type === 'DEEP_IMPORT').length;
    expect(deep).toBe(7); // main.ts x2, container, ACL, Leak, the test file and the test composition root
    const unscoped = { ...p, compositionRootLayers: [], compositionRootPatterns: [], testPatterns: [], aclPatterns: [] };
    expect(run('deep-import-declared-api', g, unscoped).length).toBe(7); // the scope removes rows, not graph facts
  });

  it('the ACL exemption is only for imports into another module, and only for declared ACL globs', async () => {
    const apg = await extract(project(files), componentsFromLayerModel(lm));
    const g = memGraph(apg, lm);
    const noAcl = { ...apg2Params(lm), aclPatterns: [] };
    expect(pairs(run('deep-import-declared-api', g, noAcl))).toEqual([
      'src/billing/acl/OrderingAcl.ts -> src/ordering/internal/OrderId.ts',
      'src/billing/app/Leak.ts -> src/ordering/internal/OrderId.ts',
    ]);
  });
});

describe('change 3: test code belongs to no component and is never a row source', () => {
  const lm: LayerModel = { layers: [layer('domain', 'domain', ['src/domain/**']), layer('application', 'application', ['src/application/**'])] };
  const files = {
    'src/domain/Order.ts': 'export class Order { at = Date.now(); place(): number { return Date.now(); } }\n',
    'src/domain/__tests__/OrderFixture.ts': 'export class OrderFixture { make(): number { return Date.now(); } }\n',
    'src/application/testSetup.ts': 'export class TestSetup { seed(): number { return Math.random(); } }\n',
  };

  it('drops test files from BELONGS_TO and from the I/O templates', async () => {
    const apg = await extract(project(files), componentsFromLayerModel(lm));
    const files_ = apg.edges.filter((e) => e.type === 'BELONGS_TO').map((e) => apg.nodes.find((n) => n.id === e.sourceId)?.filePath);
    expect(files_).toEqual(['src/domain/Order.ts']);
    const rows = run('nondeterminism-in-core', memGraph(apg, lm), apg2Params(lm));
    expect([...new Set(rows.map((r) => r.filePath))]).toEqual(['src/domain/Order.ts']);
  });
});

describe('changes 4 and 5: component-adp-cycle and main-sequence distance skip layers; distance needs 4 types', () => {
  const lm: LayerModel = { layers: [layer('domain', 'domain', ['src/domain/**']), layer('application', 'application', ['src/application/**'])] };
  const iface = (n: string): string => `export interface ${n} { x(): number }\n`;
  const files = {
    // A layer cycle (domain <-> application).
    'src/domain/Order.ts': "import { Svc } from '../application/Svc';\nexport class Order { s?: Svc; }\n",
    'src/application/Svc.ts': "import { Order } from '../domain/Order';\nexport class Svc { o?: Order; }\n",
    // Modules: big (4 interfaces, depends on small; A = 1, I = 1, D = 1) and small (2 interfaces; D = 1), in a cycle.
    'src/mods/big/a.ts': `import type { S1 } from '../small/s1';\n${iface('A1')}export type U = S1;\n`,
    'src/mods/big/b.ts': iface('A2'), 'src/mods/big/c.ts': iface('A3'), 'src/mods/big/d.ts': iface('A4'),
    'src/mods/small/s1.ts': `import type { A1 } from '../big/a';\n${iface('S1')}export type V = A1;\n`,
    'src/mods/small/s2.ts': iface('S2'),
  };
  const components: ComponentDeclaration[] = [
    ...componentsFromLayerModel(lm),
    { name: 'big', kind: 'module', include: ['src/mods/big/**'] },
    { name: 'small', kind: 'module', include: ['src/mods/small/**'] },
  ];

  it('component-adp-cycle reports the module cycle and not the layer cycle (FF-S01 / FF-S02 report that one)', async () => {
    const apg = await extract(project(files), components);
    const kinds = apg.edges.filter((e) => e.type === 'DEPENDS_ON').map((e) => e.properties.kind);
    expect(kinds).toContain('layer');
    const rows = run('component-adp-cycle', memGraph(apg, lm), apg2Params(lm));
    expect(rows.map((r) => `${String(r.component)}->${String(r.target)} ${String(r.kind)}`)).toEqual(['big->small module', 'small->big module']);
  });

  it('component-main-sequence-distance reads only non-layer components with at least 4 types', async () => {
    const apg = await extract(project(files), components);
    const g = memGraph(apg, lm);
    const p = { ...apg2Params(lm), threshold: -1 }; // every computable D passes the threshold, so only the scope filters
    expect(run('component-main-sequence-distance', g, p).map((r) => r.component)).toEqual(['big']);
    expect(run('component-main-sequence-distance', g, { ...p, minTypes: 0 }).map((r) => r.component)).toEqual(['big', 'small']);
  });
});

describe('change 6: sub-barrels are public API only when the component entry exports them', () => {
  const files = {
    'src/lib/index.ts': "export * from './sub';\n",
    'src/lib/sub/index.ts': "export * from './Thing';\n",
    'src/lib/sub/Thing.ts': 'export class Thing { a = 1; }\n',
    'src/lib/other/index.ts': "export * from './Other';\n",
    'src/lib/other/Other.ts': 'export class Other { b = 1; }\n',
    'src/flat/model/index.ts': "export * from './Model';\n",
    'src/flat/model/Model.ts': 'export class Model { c = 1; }\n',
    'src/flat/services/Svc.ts': 'export class Svc { d = 1; }\n',
    'src/app/use.ts': [
      "import { Thing } from '../lib/sub';", "import { Other } from '../lib/other';",
      "import { Model } from '../flat/model';", "import { Svc } from '../flat/services/Svc';",
      'export const all = [Thing, Other, Model, Svc];', '',
    ].join('\n'),
  };
  const components: ComponentDeclaration[] = [
    { name: 'lib', kind: 'module', include: ['src/lib/**'] },
    { name: 'flat', kind: 'module', include: ['src/flat/**'] },
    { name: 'app', kind: 'module', include: ['src/app/**'] },
  ];

  it('closes the entry set over re-exported barrels; an unexported barrel and a component without a root index give no entry', async () => {
    const apg = await extract(project(files), components);
    const comp = (n: string): unknown => apg.nodes.find((x) => x.type === 'Component' && x.name === n)?.properties.entryFiles;
    expect(comp('lib')).toEqual(['src/lib/index.ts', 'src/lib/sub/index.ts']);
    expect(comp('flat')).toEqual([]);
    const lm: LayerModel = { layers: [] };
    expect(pairs(run('deep-import-inferred-api', memGraph(apg, lm), apg2Params(lm)))).toEqual(['src/app/use.ts -> src/lib/other/index.ts']);
  });
});

describe('isolation', () => {
  it('the v1.2E options still give no APG v2 edge on a scope project', async () => {
    const dir = project({ 'src/main.ts': 'export const a = 1;\n', 'src/__tests__/x.ts': "import { a } from '../main';\nexport const b = a;\n" });
    const r = await extractAPG(dir, V12E_DEFAULT_OPTIONS);
    if (!r.success) throw new Error('extract');
    expect(r.data.edges.filter((e) => ['BELONGS_TO', 'DEEP_IMPORT', 'DEPENDS_ON'].includes(e.type))).toEqual([]);
    expect(r.data.apg2).toBeUndefined();
  });
});
