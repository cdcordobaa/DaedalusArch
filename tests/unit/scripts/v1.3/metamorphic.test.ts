import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  candidatesFor,
  compareRuns,
  fileKey,
  layerKey,
  layerModelFromSpec,
  layerPairKey,
  relSpec,
  rewriteSpecArchitecture,
  summariseCliOutput,
} from '../../../../scripts/v1.3/lib/metamorphic.js';
import type { RunSummary, TransformName, TransformOutcome } from '../../../../scripts/v1.3/lib/metamorphic.js';
import { wilson } from '../../../../scripts/v1.3/lib/metamorphic-report.js';
import { typecheckProject } from '../../../../scripts/v1.3/lib/typecheck.js';

jest.setTimeout(60_000);

const TSCONFIG = {
  compilerOptions: { target: 'ES2021', lib: ['ES2021'], module: 'CommonJS', moduleResolution: 'node', strict: true, noEmit: true, skipLibCheck: true, types: [] },
  include: ['src/**/*.ts'],
};

/** A three-folder project: domain (two entities, a type), application (a service) and api (a controller). */
const FILES: Record<string, string> = {
  'src/domain/Money.ts': "export class Money {\n  constructor(readonly cents: number) {}\n}\n\nexport interface Priced {\n  price: Money;\n}\n\nexport function zero(): Money {\n  return new Money(0);\n}\n",
  'src/domain/Order.ts': "import { Money, Priced } from './Money';\n\nexport class Order implements Priced {\n  constructor(readonly price: Money) {}\n}\n",
  'src/application/PlaceOrder.ts': "import { Order } from '../domain/Order';\nimport { zero } from '../domain/Money';\nimport { Priced } from '../domain/Money';\n\nexport class PlaceOrder {\n  run(): Priced {\n    return new Order(zero());\n  }\n}\n",
  'src/api/OrderController.ts': "import { PlaceOrder } from '../application/PlaceOrder';\n\nexport class OrderController {\n  constructor(private readonly placeOrder: PlaceOrder) {}\n  post(): number {\n    return this.placeOrder.run().price.cents;\n  }\n}\n",
};

function makeProject(files: Record<string, string> = FILES, tsconfig: unknown = TSCONFIG): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'metamorphic-'));
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return dir;
}

const read = (dir: string, rel: string): string => fs.readFileSync(path.join(dir, rel), 'utf8');

async function applyFirst(name: TransformName, dir: string, focus: string[] = []): Promise<TransformOutcome> {
  for (const c of candidatesFor(name, dir, { focus })) {
    const snapshot = fs.mkdtempSync(path.join(os.tmpdir(), 'metamorphic-snap-'));
    fs.cpSync(dir, snapshot, { recursive: true });
    const out = await c.apply(dir);
    if (!out.applied || typecheckProject(dir).length === 0) {
      fs.rmSync(snapshot, { recursive: true, force: true });
      return out;
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(snapshot, dir);
  }
  throw new Error(`${name}: no candidate type-checks`);
}

describe('metamorphic: specifiers', () => {
  it('keeps the .js extension and the directory form of the specifier it imitates', () => {
    expect(relSpec('/p/src/a/X.ts', '/p/src/b/Y.ts', '../b/Z')).toBe('../b/Y');
    expect(relSpec('/p/src/a/X.ts', '/p/src/b/Y.ts', '../b/Z.js')).toBe('../b/Y.js');
    expect(relSpec('/p/src/a/X.ts', '/p/src/a/Y.ts', './Z')).toBe('./Y');
    expect(relSpec('/p/src/a/X.ts', '/p/src/b/index.ts', '../b')).toBe('../b');
    expect(relSpec('/p/src/a/X.ts', '/p/src/b/index.ts', '../b/index')).toBe('../b/index');
    expect(relSpec('/p/src/a/X.ts', '/p/src/b/index.ts', '../b/index.js')).toBe('../b/index.js');
  });
});

describe('metamorphic: comparison keys', () => {
  const model = layerModelFromSpec({
    architecture: {
      layers: [
        { name: 'domain', directories: ['src/*/domain/**', 'src/shared/**'] },
        { name: 'api', directories: ['src/*/api/**'] },
      ],
      ddd: { contexts: [{ name: 'ordering', root: 'src/ordering/' }] },
    },
  });

  it('maps files to layer keys with the DDD context, ? for no layer and - for no file', () => {
    expect(layerKey(model, 'src/ordering/domain/Order.ts')).toBe('ordering:domain');
    expect(layerKey(model, 'src/shared/Money.ts')).toBe('domain');
    expect(layerKey(model, 'src/main.ts')).toBe('?');
    expect(layerKey(model, '')).toBe('-');
  });

  it('assigns layers like the instrument: directories first, then file-name patterns', () => {
    const nest = layerModelFromSpec({
      architecture: {
        layers: [
          { name: 'domain', directories: ['src/domain/**'] },
          { name: 'infrastructure', directories: ['src/infrastructure/**'], file_patterns: ['**/*.repository.ts'] },
        ],
      },
    });
    expect(layerKey(nest, 'src/registrations/x.repository.ts')).toBe('infrastructure');
    expect(layerKey(nest, 'src/domain/x.repository.ts')).toBe('domain');
    // a barrel in a feature folder matches no directory and no pattern
    expect(layerKey(nest, 'src/registrations/index.ts')).toBe('?');
  });

  it('rewrites spec strings that name a renamed file or class, not globs or other sections', () => {
    const spec = 'architecture:\n  ddd:\n    aggregates:\n      - root: src/o/Order.ts\n        inner_entities: [src/o/OrderLine.ts]\n    domain_event_types: [DomainEvent]\n    repositories: ["src/**/*Repository.ts"]\nfitness_functions:\n  - id: Order\n';
    const r = rewriteSpecArchitecture(spec, { 'src/o/Order.ts': 'src/o/AcmeOrder.ts', DomainEvent: 'AcmeDomainEvent', Order: 'AcmeOrder' });
    expect(r?.replaced).toEqual(['DomainEvent -> AcmeDomainEvent', 'src/o/Order.ts -> src/o/AcmeOrder.ts']);
    expect(r?.text).toContain('root: src/o/AcmeOrder.ts');
    expect(r?.text).toContain('src/**/*Repository.ts');
    expect(r?.text).toContain('id: Order');
    expect(rewriteSpecArchitecture(spec, { 'src/x.ts': 'src/y.ts' })).toBeUndefined();
  });

  it('keys a cycle by its set of layers or canonical files, other rows by source and target', () => {
    expect(layerPairKey(model, { ruleId: 'FF-S02', file: 'src/ordering/domain/A.ts,src/ordering/domain/B.ts,src/ordering/domain/A.ts', target: 'src/ordering/domain/B.ts' })).toBe('FF-S02|{ordering:domain}');
    expect(layerPairKey(model, { ruleId: 'FF-S01', file: 'src/ordering/domain/A.ts', target: 'src/ordering/api/C.ts' })).toBe('FF-S01|ordering:domain>ordering:api');
    expect(layerPairKey(model, { ruleId: 'FF-C03', file: 'src/ordering/domain/A.ts' })).toBe('FF-C03|ordering:domain>-');
    const canon = (p: string): string => (p === 'x/AcmeA.ts' ? 'x/A.ts' : p);
    expect(fileKey(canon, { ruleId: 'FF-S02', file: 'x/AcmeA.ts,x/B.ts,x/AcmeA.ts', target: 'x/B.ts' })).toBe('FF-S02|{x/A.ts,x/B.ts}');
    expect(fileKey(canon, { ruleId: 'FF-S01', file: 'x/AcmeA.ts', target: 'y/C.ts' })).toBe('FF-S01|x/A.ts|y/C.ts');
  });

  const run = (blocking: RunSummary['blocking'], verdict = 'fail'): RunSummary => ({ verdict, blockingRules: ['FF-S01', 'FF-S02'], blocking, advisory: [] });

  it('is invariant under a rename that keeps the layer pair, and not when the defining rule disappears', () => {
    const before = run([{ ruleId: 'FF-S01', file: 'src/ordering/domain/A.ts', target: 'src/ordering/api/C.ts' }]);
    const renamed = run([{ ruleId: 'FF-S01', file: 'src/ordering/domain/AcmeA.ts', target: 'src/ordering/api/AcmeC.ts' }]);
    const c = compareRuns(model, ['FF-S01'], before, renamed, {}, { 'src/ordering/domain/AcmeA.ts': 'src/ordering/domain/A.ts', 'src/ordering/api/AcmeC.ts': 'src/ordering/api/C.ts' });
    expect(c.invariant).toBe(true);
    expect(c.invariantFiles).toBe(true);
    const gone = compareRuns(model, ['FF-S01'], before, run([], 'pass'), {}, {});
    expect(gone.invariant).toBe(false);
    expect(gone.definingBefore).toBe('FF-S01:violated');
    expect(gone.definingAfter).toBe('FF-S01:clean');
    expect(gone.lostPairs).toEqual(['FF-S01|ordering:domain>ordering:api']);
  });

  it('separates the layer-pair view from the file view (a second row on the same pair)', () => {
    const before = run([{ ruleId: 'FF-S01', file: 'src/ordering/domain/A.ts', target: 'src/ordering/api/C.ts' }]);
    const after = run([...before.blocking, { ruleId: 'FF-S01', file: 'src/ordering/domain/B.ts', target: 'src/ordering/api/C.ts' }]);
    const c = compareRuns(model, ['FF-S01'], before, after, {}, {});
    expect(c.invariant).toBe(true);
    expect(c.invariantFiles).toBe(false);
    expect(c.gainedFiles).toEqual(['FF-S01|src/ordering/domain/B.ts|src/ordering/api/C.ts']);
  });

  it('uses the overall verdict as the defining verdict of a variant without a defining rule', () => {
    const c = compareRuns(model, [], run([], 'pass'), run([{ ruleId: 'FF-S02', file: 'src/ordering/domain/A.ts', target: 'src/ordering/domain/B.ts' }]), {}, {});
    expect(c.definingBefore).toBe('verdict:pass');
    expect(c.definingAfter).toBe('verdict:fail');
    expect(c.invariant).toBe(false);
  });

  it('reduces CLI output to blocking and advisory rows', () => {
    const s = summariseCliOutput(
      {
        tiers: { verdict: 'fail', blocking: { rules: [{ functionId: 'FF-S01' }] } },
        violations: [
          { functionId: 'FF-S01', filePath: '/p/src/a.ts', target: '/p/src/b.ts' },
          { functionId: 'FF-C03', filePath: '/p/src/a.ts' },
        ],
      },
      (p) => p.replace('/p/', ''),
    );
    expect(s.blocking).toEqual([{ ruleId: 'FF-S01', file: 'src/a.ts', target: 'src/b.ts' }]);
    expect(s.advisory).toEqual([{ ruleId: 'FF-C03', file: 'src/a.ts' }]);
    expect(wilson(10, 10)[0]).toBeCloseTo(0.722, 3);
  });
});

describe('metamorphic: transformations keep the project compiling', () => {
  let dir = '';
  beforeEach(() => {
    dir = makeProject();
    expect(typecheckProject(dir)).toEqual([]);
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rename: prefixes declarations and files, keeps folders and role words', async () => {
    const out = await applyFirst('rename', dir);
    expect(out.specRenames?.['src/domain/Order.ts']).toBe('src/domain/AcmeOrder.ts');
    expect(out.specRenames?.Order).toBe('AcmeOrder');
    expect(typecheckProject(dir)).toEqual([]);
    expect(read(dir, 'src/application/AcmePlaceOrder.ts')).toContain("import { AcmeOrder } from '../domain/AcmeOrder';");
    expect(read(dir, 'src/api/AcmeOrderController.ts')).toContain('export class AcmeOrderController');
    expect(out.newCanon['src/domain/AcmeMoney.ts']).toBe('src/domain/Money.ts');
  });

  it('rename-opaque: numbered names without role words', async () => {
    const out = await applyFirst('rename-opaque', dir);
    expect(typecheckProject(dir)).toEqual([]);
    expect(Object.keys(out.newCanon).every((p) => /\/m\d{3}\.ts$/.test(p))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'src/api/OrderController.ts'))).toBe(false);
  });

  it('reorder: imports reversed, interfaces first, functions last', async () => {
    await applyFirst('reorder', dir);
    expect(typecheckProject(dir)).toEqual([]);
    const money = read(dir, 'src/domain/Money.ts');
    expect(money.indexOf('interface Priced')).toBeLessThan(money.indexOf('class Money'));
    expect(money.indexOf('function zero')).toBeGreaterThan(money.indexOf('class Money'));
    const place = read(dir, 'src/application/PlaceOrder.ts');
    expect(place.indexOf("from '../domain/Order'")).toBeGreaterThan(place.indexOf('import { zero }'));
  });

  it('reformat: prettier with other settings', async () => {
    await applyFirst('reformat', dir);
    expect(typecheckProject(dir)).toEqual([]);
    expect(read(dir, 'src/domain/Order.ts')).toContain('import {Money, Priced} from "./Money"\n');
  });

  it('barrel-add and barrel-remove: imports go through index.ts and back', async () => {
    await applyFirst('barrel-add', dir);
    expect(typecheckProject(dir)).toEqual([]);
    expect(read(dir, 'src/domain/index.ts')).toBe("export * from './Money';\nexport * from './Order';\n");
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("import { Order } from '../domain';");
    // same-directory imports stay direct
    expect(read(dir, 'src/domain/Order.ts')).toContain("from './Money'");
    const out = await applyFirst('barrel-remove', dir);
    expect(out.applied).toBe(true);
    expect(typecheckProject(dir)).toEqual([]);
    expect(fs.existsSync(path.join(dir, 'src/domain/index.ts'))).toBe(false);
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("import { Order } from '../domain/Order';");
  });

  it('barrel-remove: not applicable without a barrel', async () => {
    const out = await applyFirst('barrel-remove', dir);
    expect(out.applied).toBe(false);
  });

  it('default-export: the class named like its file becomes the default export', async () => {
    await applyFirst('default-export', dir);
    expect(typecheckProject(dir)).toEqual([]);
    expect(read(dir, 'src/domain/Order.ts')).toContain('export default class Order');
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("import Order from '../domain/Order';");
    expect(read(dir, 'src/domain/Order.ts')).toContain("import Money, { Priced } from './Money';");
  });

  it('import-type: only declarations used in type positions', async () => {
    await applyFirst('import-type', dir);
    expect(typecheckProject(dir)).toEqual([]);
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("import type { Priced } from '../domain/Money';");
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("import { Order } from '../domain/Order';");
    // a constructor parameter type is a type position without decorator metadata
    expect(read(dir, 'src/api/OrderController.ts')).toContain('import type { PlaceOrder }');
    await applyFirst('import-type-drop', dir);
    expect(read(dir, 'src/application/PlaceOrder.ts')).not.toContain('import type');
  });

  it('path-alias: tsconfig paths and @app/ specifiers for imports that leave the directory', async () => {
    await applyFirst('path-alias', dir);
    expect(typecheckProject(dir)).toEqual([]);
    const cfg = JSON.parse(read(dir, 'tsconfig.json')) as { compilerOptions: { paths: unknown; baseUrl: string } };
    expect(cfg.compilerOptions.paths).toEqual({ '@app/*': ['src/*'] });
    expect(read(dir, 'src/application/PlaceOrder.ts')).toContain("from '@app/domain/Order'");
    expect(read(dir, 'src/domain/Order.ts')).toContain("from './Money'");
  });

  it('split: moves the tail of a file to a sibling and repoints importers', async () => {
    const out = await applyFirst('split', dir, ['src/domain/Money.ts']);
    expect(typecheckProject(dir)).toEqual([]);
    const extra = Object.keys(out.newCanon)[0] ?? '';
    expect(path.dirname(extra)).toBe('src/domain');
    expect(out.newCanon[extra]).toBe('src/domain/Money.ts');
    expect(fs.existsSync(path.join(dir, extra))).toBe(true);
  });

  it('merge: folds a sibling into the focus file and repoints importers', async () => {
    const out = await applyFirst('merge', dir, ['src/domain/Order.ts']);
    expect(typecheckProject(dir)).toEqual([]);
    const [from, into] = Object.entries(out.origCanon)[0] ?? ['', ''];
    expect([from, into].sort()).toEqual(['src/domain/Money.ts', 'src/domain/Order.ts']);
    expect(fs.existsSync(path.join(dir, from))).toBe(false);
  });
});

describe('metamorphic: NodeNext projects keep .js specifiers', () => {
  it('barrel-add and path-alias write .js specifiers', async () => {
    const files: Record<string, string> = Object.fromEntries(Object.entries(FILES).map(([k, v]) => [k, v.replace(/from '(\.[^']+)'/g, "from '$1.js'")]));
    const cfg = { compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true, noEmit: true, skipLibCheck: true, types: [] }, include: ['src/**/*.ts'] };
    for (const t of ['barrel-add', 'path-alias', 'rename', 'default-export'] as const) {
      const dir = makeProject(files, cfg);
      try {
        expect(typecheckProject(dir)).toEqual([]);
        await applyFirst(t, dir);
        expect(typecheckProject(dir)).toEqual([]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });
});
