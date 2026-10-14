import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';
import type { ExtractorOptions } from '../../../src/apg-extractor/types.js';
import { restrictToGraphMode } from '../../../src/apg-extractor/graph-mode.js';

const ROOT = '/proj';

function setup(files: Record<string, string>, options: ExtractorOptions = {}) {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict: false, experimentalDecorators: true },
  });
  for (const [fp, content] of Object.entries(files)) project.createSourceFile(fp, content);
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const result = extractEdges(sfs, lookup, ROOT, options);
  const classId = (name: string, path: string): string => lookup.typeNodes.get(`${name.toLowerCase()}@${path}`) ?? '';
  return { nodes, ...result, classId };
}

const NEST = `
export function Module(_m: object): ClassDecorator { return () => undefined; }
export function forwardRef<T>(fn: () => T): T { return fn(); }
`;

const FIXTURE: Record<string, string> = {
  '/proj/src/nest.ts': NEST,
  '/proj/src/infra/db.module.ts': `
import { Module } from '../nest';
import { DbService } from './db.service';
@Module({ providers: [DbService], exports: [DbService] })
export class DbModule {}`,
  '/proj/src/infra/db.service.ts': 'export class DbService {}',
  '/proj/src/orders/orders.module.ts': `
import { Module, forwardRef } from '../nest';
import { DbModule } from '../infra/db.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { AuditModule } from '../audit/audit.module';
@Module({
  imports: [DbModule, forwardRef(() => AuditModule), AuditModule.forRoot({})],
  controllers: [OrdersController],
  providers: [OrdersService, { provide: 'TOKEN', useClass: OrdersService }],
  exports: [OrdersService, DbModule],
})
export class OrdersModule {}`,
  '/proj/src/orders/orders.controller.ts': 'export class OrdersController {}',
  '/proj/src/orders/orders.service.ts': 'export class OrdersService {}',
  '/proj/src/audit/audit.module.ts': `
import { Module } from '../nest';
@Module({})
export class AuditModule { static forRoot(_o: object) { return AuditModule; } }`,
};

describe('v1.3 moduleWiring option', () => {
  it('is on by default in v1.3: MODULE_* edges without passing the option, same as moduleWiring: true', () => {
    const byDefault = setup(FIXTURE);
    expect(byDefault.edges.filter(e => e.type.startsWith('MODULE_')).length).toBeGreaterThan(0);
    expect(byDefault.edges).toEqual(setup(FIXTURE, { moduleWiring: true }).edges);
  });

  it('explicit off (moduleWiring: false): no MODULE_* edges (v1.2E behaviour)', () => {
    const { edges, warnings } = setup(FIXTURE, { moduleWiring: false });
    expect(edges.filter(e => e.type.startsWith('MODULE_'))).toHaveLength(0);
    expect(warnings.some(w => w.code === 'EXTRACTOR_010')).toBe(false);
  });

  it('extracts MODULE_IMPORTS between modules, with forRoot and forwardRef flags', () => {
    const { edges, classId } = setup(FIXTURE, { moduleWiring: true });
    const orders = classId('OrdersModule', 'src/orders/orders.module.ts');
    const imports = edges.filter(e => e.type === 'MODULE_IMPORTS' && e.sourceId === orders);
    expect(imports.map(e => e.targetId)).toEqual([
      classId('DbModule', 'src/infra/db.module.ts'),
      classId('AuditModule', 'src/audit/audit.module.ts'),
    ]);
    // Keep-first: the plain forwardRef edge precedes the later `AuditModule.forRoot()` duplicate.
    expect(imports[0]?.properties).toMatchObject({ dynamicModule: false, forwardRef: false, line: 8 });
    expect(imports[1]?.properties).toMatchObject({ dynamicModule: false, forwardRef: true });
  });

  it('extracts MODULE_PROVIDES for providers and controllers with a role, resolving useClass', () => {
    const { edges, classId } = setup(FIXTURE, { moduleWiring: true });
    const orders = classId('OrdersModule', 'src/orders/orders.module.ts');
    const provides = edges.filter(e => e.type === 'MODULE_PROVIDES' && e.sourceId === orders);
    expect(provides.map(e => [e.targetId, e.properties.role])).toEqual([
      [classId('OrdersService', 'src/orders/orders.service.ts'), 'provider'],
      [classId('OrdersController', 'src/orders/orders.controller.ts'), 'controller'],
    ]);
    const db = edges.filter(e => e.type === 'MODULE_PROVIDES' && e.sourceId === classId('DbModule', 'src/infra/db.module.ts'));
    expect(db).toHaveLength(1);
  });

  it('extracts MODULE_EXPORTS of classes and re-exported modules', () => {
    const { edges, classId } = setup(FIXTURE, { moduleWiring: true });
    const orders = classId('OrdersModule', 'src/orders/orders.module.ts');
    const exported = edges.filter(e => e.type === 'MODULE_EXPORTS' && e.sourceId === orders).map(e => e.targetId);
    expect(exported).toEqual([
      classId('OrdersService', 'src/orders/orders.service.ts'),
      classId('DbModule', 'src/infra/db.module.ts'),
    ]);
  });

  it('gives every edge a deterministic unique id and leaves the v1.2E edges untouched', () => {
    const off = setup(FIXTURE, { moduleWiring: false });
    const on = setup(FIXTURE, { moduleWiring: true });
    const v12 = on.edges.filter(e => !e.type.startsWith('MODULE_'));
    expect(v12).toEqual(off.edges);
    const moduleEdges = on.edges.filter(e => e.type.startsWith('MODULE_'));
    expect(moduleEdges.length).toBeGreaterThan(0);
    expect(new Set(on.edges.map(e => e.id)).size).toBe(on.edges.length);
    expect(setup(FIXTURE, { moduleWiring: true }).edges).toEqual(on.edges);
  });

  it('warns EXTRACTOR_010 for an element outside the extracted set', () => {
    const { edges, warnings } = setup({
      '/proj/src/nest.ts': NEST,
      '/proj/src/a.module.ts': "import { Module } from './nest';\nimport { X } from 'external-lib';\n@Module({ imports: [X] })\nexport class AModule {}",
    }, { moduleWiring: true });
    expect(edges.filter(e => e.type === 'MODULE_IMPORTS')).toHaveLength(0);
    expect(warnings.some(w => w.code === 'EXTRACTOR_010')).toBe(true);
  });

  it('ignores classes without @Module and @Module without a metadata object', () => {
    const { edges } = setup({
      '/proj/src/nest.ts': NEST,
      '/proj/src/a.ts': "import { Module } from './nest';\n@Module(config())\nexport class A {}\nexport class B {}\ndeclare function config(): object;",
    }, { moduleWiring: true });
    expect(edges.filter(e => e.type.startsWith('MODULE_'))).toHaveLength(0);
  });

  it('is dropped by the ast-only graph mode', () => {
    const { edges, packageNodes } = setup(FIXTURE, { moduleWiring: true });
    const view = restrictToGraphMode({ edges, packageNodes }, 'ast-only');
    expect(view.edges.some(e => e.type.startsWith('MODULE_'))).toBe(false);
  });
});
