/**
 * v1.3 field-level state facts (`fieldState` extractor option): HOLDS_STATE_OF edges from a Class to the Class or
 * Interface an instance field holds, and the FF-P06 field-half variant that reads them (`CompileOptions.fieldState`).
 * In-memory projects only (no fixture directory, so the pinned v1.2E byte-identity list is unchanged).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import { extractAPG } from '../../../src/apg-extractor/apg-extractor.js';
import { V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS, V13_FIELD_STATE_OPTIONS } from '../../../src/apg-extractor/types.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/types.js';
import { applyFieldState, applyV13Rewrites, FIELD_STATE_PURITY_TEXT } from '../../../src/fitness-compiler/v13-rewrites.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import { memGraph } from '../../../src/fitness-compiler/apg2-in-memory.js';
import { v13DomainStatePurity } from '../../../src/fitness-compiler/v13-in-memory-baselines.js';
import { RULE_TIERS } from '../../../src/scoring-engine/rule-tiers.js';
import { splitPartial } from '../../../src/scoring-engine/tiered-scoring.js';
import type { APGEdge, APGNode } from '../../../src/shared/types/apg.js';
import type { LayerModel } from '../../../src/shared/types/spec.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';

const ROOT = '/proj';
const lines = (...ls: string[]): string => ls.join('\n');

function setup(files: Record<string, string>, options: ExtractorOptions = V13_FIELD_STATE_OPTIONS, strict = true): { nodes: APGNode[]; edges: APGEdge[] } {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true, compilerOptions: { strict, experimentalDecorators: true } });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles().filter((sf) => !sf.getFilePath().includes('/node_modules/'));
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const { edges } = extractEdges(sfs, lookup, ROOT, options);
  return { nodes, edges };
}

function holds(nodes: readonly APGNode[], edges: readonly APGEdge[]): { source: string; target: string; properties: unknown }[] {
  const name = new Map(nodes.map((n) => [n.id, n.name]));
  return edges
    .filter((e) => e.type === 'HOLDS_STATE_OF')
    .map((e) => ({ source: name.get(e.sourceId) ?? '?', target: name.get(e.targetId) ?? '?', properties: e.properties }));
}

const INFRA = {
  '/proj/src/infrastructure/SqlOrderRepository.ts': lines(
    "import { OrderRepository } from '../domain/OrderRepository';",
    'export class SqlOrderRepository implements OrderRepository { save(): void {} }',
  ),
  '/proj/src/infrastructure/SystemClock.ts': 'export class SystemClock { now(): number { return 0; } }',
  '/proj/src/domain/OrderRepository.ts': 'export interface OrderRepository { save(): void; }',
};

describe('option defaults', () => {
  it('fieldState is OFF in the v1.2E and v1.3 defaults and ON in V13_FIELD_STATE_OPTIONS', () => {
    expect(V12E_DEFAULT_OPTIONS.fieldState).toBe(false);
    expect(V13_DEFAULT_OPTIONS.fieldState).toBe(false);
    expect(V13_FIELD_STATE_OPTIONS.fieldState).toBe(true);
    expect({ ...V13_FIELD_STATE_OPTIONS, fieldState: false }).toEqual(V13_DEFAULT_OPTIONS);
  });

  it('no HOLDS_STATE_OF edge under the v1.2E or v1.3 defaults; every other edge is the same with the option on', () => {
    const files = { ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SystemClock } from '../infrastructure/SystemClock';",
      'export class Order { private clock: SystemClock = new SystemClock(); }',
    ) };
    for (const opts of [V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS]) {
      expect(setup(files, opts).edges.filter((e) => e.type === 'HOLDS_STATE_OF')).toEqual([]);
    }
    const on = setup(files, V13_FIELD_STATE_OPTIONS).edges;
    expect(on.filter((e) => e.type !== 'HOLDS_STATE_OF')).toEqual(setup(files, V13_DEFAULT_OPTIONS).edges);
    expect(on.filter((e) => e.type === 'HOLDS_STATE_OF')).toHaveLength(1);
  });
});

describe('HOLDS_STATE_OF sources', () => {
  it('declared field type', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SystemClock } from '../infrastructure/SystemClock';",
      'export class Order {',
      '  private clock!: SystemClock;',
      '}',
    ) });
    expect(holds(nodes, edges)).toEqual([
      { source: 'Order', target: 'SystemClock', properties: { field: 'clock', source: 'declared-type', line: 3, sources: ['declared-type'], fields: ['clock'] } },
    ]);
  });

  it('field initialiser `= new X()` without a type annotation (the clean v08 LoanPolicy shape)', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/LoanPolicy.ts': lines(
      "import { SystemClock } from '../infrastructure/SystemClock';",
      'export class LoanPolicy {',
      '  private readonly clock = new SystemClock();',
      '}',
    ) });
    expect(holds(nodes, edges)).toEqual([
      { source: 'LoanPolicy', target: 'SystemClock', properties: { field: 'clock', source: 'initializer', line: 3, sources: ['initializer'], fields: ['clock'] } },
    ]);
  });

  it('constructor assignment from `new X()` and from a parameter typed X', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SystemClock } from '../infrastructure/SystemClock';",
      "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
      'export class Order {',
      '  private clock;',
      '  private repo;',
      '  constructor(repo: SqlOrderRepository) {',
      '    this.clock = new SystemClock();',
      '    this.repo = repo;',
      '  }',
      '}',
    ) }, V13_FIELD_STATE_OPTIONS, false);
    expect(holds(nodes, edges)).toEqual([
      { source: 'Order', target: 'SystemClock', properties: { field: 'clock', source: 'constructor-new', line: 7, sources: ['constructor-new'], fields: ['clock'] } },
      { source: 'Order', target: 'SqlOrderRepository', properties: { field: 'repo', source: 'constructor-param', line: 8, sources: ['constructor-param'], fields: ['repo'] } },
    ]);
  });

  it('a constructor parameter property is CONSTRUCTOR_INJECTS only (no double count)', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
      'export class Order { constructor(private readonly repo: SqlOrderRepository) {} }',
    ) });
    expect(holds(nodes, edges)).toEqual([]);
    expect(edges.filter((e) => e.type === 'CONSTRUCTOR_INJECTS')).toHaveLength(1);
  });

  it('property-injection decorator', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
      'declare function Inject(): PropertyDecorator;',
      'export class Order {',
      '  @Inject() private repo!: SqlOrderRepository;',
      '}',
    ) });
    expect(holds(nodes, edges)).toEqual([
      { source: 'Order', target: 'SqlOrderRepository', properties: { field: 'repo', source: 'property-injection', line: 4, sources: ['property-injection'], fields: ['repo'] } },
    ]);
  });

  it('interface-typed field holding a concrete initialiser: one edge to each, sources merged per target', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { OrderRepository } from './OrderRepository';",
      "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
      'export class Order {',
      '  private repo: OrderRepository = new SqlOrderRepository();',
      '  private backup: OrderRepository;',
      '  constructor() { this.backup = new SqlOrderRepository(); }',
      '}',
    ) });
    expect(holds(nodes, edges)).toEqual([
      { source: 'Order', target: 'OrderRepository', properties: { field: 'repo', source: 'declared-type', line: 4, sources: ['declared-type'], fields: ['repo', 'backup'] } },
      { source: 'Order', target: 'SqlOrderRepository', properties: { field: 'repo', source: 'initializer', line: 4, sources: ['initializer', 'constructor-new'], fields: ['repo', 'backup'] } },
    ]);
  });

  it('generic wrappers: a local Repository<T> holds Repository (not T); built-in containers hold their element', () => {
    const { nodes, edges } = setup({
      '/proj/src/infrastructure/Repository.ts': 'export class Repository<T> { items: T[] = []; }',
      '/proj/src/domain/Line.ts': 'export class Line {}',
      '/proj/src/infrastructure/Cache.ts': 'export class Cache {}',
      '/proj/src/domain/Order.ts': lines(
        "import { Repository } from '../infrastructure/Repository';",
        "import { Line } from './Line';",
        "import { Cache } from '../infrastructure/Cache';",
        'export class Order {',
        '  private repo!: Repository<Order>;',
        '  private lines: Line[] = [];',
        '  private caches!: Map<string, Cache>;',
        '  private pending!: Promise<Cache>;',
        '}',
      ),
    });
    expect(holds(nodes, edges).map((h) => h.target)).toEqual(['Repository', 'Line', 'Cache']);
  });

  it('an external generic (TypeORM-style Repository<T> from a package) gives no edge', () => {
    const { nodes, edges } = setup({
      '/proj/node_modules/typeorm/index.d.ts': 'export declare class Repository<T> { find(): T[]; }',
      '/proj/src/domain/Order.ts': lines(
        "import { Repository } from 'typeorm';",
        'export class Order { private repo!: Repository<Order>; }',
      ),
    });
    expect(holds(nodes, edges)).toEqual([]);
  });

  it('optional fields and `T | null` unwrap; other unions, primitives, statics and self-references give no edge', () => {
    const { nodes, edges } = setup({ ...INFRA, '/proj/src/domain/Order.ts': lines(
      "import { SystemClock } from '../infrastructure/SystemClock';",
      "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
      'export class Order {',
      '  private clock?: SystemClock;',
      '  private repo: SqlOrderRepository | null = null;',
      '  private either!: SystemClock | SqlOrderRepository;',
      '  private name = "x";',
      '  private static shared: SystemClock;',
      '  private parent?: Order;',
      '}',
    ) });
    expect(holds(nodes, edges).map((h) => [h.target, (h.properties as { field: string }).field])).toEqual([
      ['SystemClock', 'clock'], ['SqlOrderRepository', 'repo'],
    ]);
  });
});

describe('FF-P06 field-half variant', () => {
  it('the rewrite swaps the field edge type only, only for domain-state-purity, and only under the flag', () => {
    const frozen = CYPHER_TEMPLATES.get('domain-state-purity')?.template ?? '';
    expect(frozen).toContain(FIELD_STATE_PURITY_TEXT.frozen);
    const variant = applyFieldState('domain-state-purity', frozen);
    expect(variant).toBe(frozen.replace(FIELD_STATE_PURITY_TEXT.frozen, FIELD_STATE_PURITY_TEXT.variant));
    expect(applyFieldState('dependency-direction', frozen)).toBe(frozen);
    expect(applyV13Rewrites('domain-state-purity', frozen, { edgeViews: true, roleTokens: true })).toBe(applyV13Rewrites('domain-state-purity', frozen, { edgeViews: true, roleTokens: true, fieldState: false }));
    expect(V13_COMPILE_OPTIONS.fieldState).toBeUndefined();
  });

  it('HOLDS_STATE_OF rows are in the N/A field half with FLOWS_TO rows; CONSTRUCTOR_INJECTS rows count', () => {
    const partial = RULE_TIERS.get('FF-P06')?.partial;
    if (partial === undefined) throw new Error('FF-P06 is not partial');
    const v = (relType: string): Violation => ({ discriminator: ['C', 'T', relType, 'f'], message: `x via ${relType} (f)` } as unknown as Violation);
    const split = splitPartial([v('HOLDS_STATE_OF'), v('FLOWS_TO'), v('CONSTRUCTOR_INJECTS')], partial);
    expect(split.na.map((x) => x.discriminator?.[2])).toEqual(['HOLDS_STATE_OF', 'FLOWS_TO']);
    expect(split.counted.map((x) => x.discriminator?.[2])).toEqual(['CONSTRUCTOR_INJECTS']);
  });

  it('in memory: an interface-typed domain field is not a violation; a concrete infrastructure one is', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-field-state-'));
    try {
      const write = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
      };
      write('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022', module: 'commonjs' }, include: ['src'] }));
      for (const [abs, text] of Object.entries(INFRA)) write(abs.slice('/proj/'.length), text);
      write('src/domain/Ported.ts', lines(
        "import { OrderRepository } from './OrderRepository';",
        'export class Ported { constructor(repo: OrderRepository) { this.repo = repo; } private repo: OrderRepository; }',
      ));
      write('src/domain/LoanPolicy.ts', lines(
        "import { SystemClock } from '../infrastructure/SystemClock';",
        'export class LoanPolicy { private readonly clock = new SystemClock(); }',
      ));
      write('src/domain/Holder.ts', lines(
        "import { SqlOrderRepository } from '../infrastructure/SqlOrderRepository';",
        'export class Holder { private repo?: SqlOrderRepository; }',
      ));
      const res = await extractAPG(dir, V13_FIELD_STATE_OPTIONS);
      if (!res.success) throw new Error('extraction failed');
      const model: LayerModel = {
        layers: [
          { name: 'domain', kind: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain' },
          { name: 'infrastructure', kind: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'infrastructure' },
        ],
      };
      const g = memGraph(res.data, model);
      const flows = v13DomainStatePurity(g, 'domain', 'infrastructure', 'FLOWS_TO');
      const held = v13DomainStatePurity(g, 'domain', 'infrastructure', 'HOLDS_STATE_OF');
      expect(flows.map((r) => r.class)).toEqual(['LoanPolicy']);
      expect(held.map((r) => [r.class, r.targetName, r.relType])).toEqual([
        ['Holder', 'SqlOrderRepository', 'HOLDS_STATE_OF'],
        ['LoanPolicy', 'SystemClock', 'HOLDS_STATE_OF'],
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
