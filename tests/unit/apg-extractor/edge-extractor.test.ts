import { Project } from 'ts-morph';
import { extractNodes } from '../../../src/apg-extractor/node-extractor.js';
import { extractEdges } from '../../../src/apg-extractor/edge-extractor.js';

const ROOT = '/proj';

function setup(files: Record<string, string>) {
  const project = new Project({
    useInMemoryFileSystem: true,
    skipFileDependencyResolution: true,
    compilerOptions: { strict: false },
  });
  for (const [fp, content] of Object.entries(files)) {
    project.createSourceFile(fp, content);
  }
  const sfs = project.getSourceFiles();
  const { nodes, lookup } = extractNodes(sfs, ROOT);
  const { edges, warnings } = extractEdges(sfs, lookup, ROOT);
  return { nodes, edges, warnings, lookup };
}

describe('DECLARES edges', () => {
  it('creates DECLARES edge from File to Class', () => {
    const { edges } = setup({ '/proj/src/foo.ts': 'export class Foo {}' });
    const declares = edges.filter(e => e.type === 'DECLARES');
    expect(declares).toHaveLength(1);
  });

  it('creates DECLARES edge from File to Interface', () => {
    const { edges } = setup({ '/proj/src/foo.ts': 'export interface IFoo {}' });
    const declares = edges.filter(e => e.type === 'DECLARES');
    expect(declares).toHaveLength(1);
  });

  it('creates DECLARES edge from File to Function', () => {
    const { edges } = setup({ '/proj/src/foo.ts': 'export function hello() {}' });
    const declares = edges.filter(e => e.type === 'DECLARES');
    expect(declares).toHaveLength(1);
  });
});

describe('CONTAINS edges', () => {
  it('creates CONTAINS edge from Class to each Method', () => {
    const { edges } = setup({
      '/proj/src/foo.ts': `
        export class Svc {
          methodA() {}
          methodB() {}
        }
      `,
    });
    const contains = edges.filter(e => e.type === 'CONTAINS');
    expect(contains).toHaveLength(2);
  });
});

describe('IMPLEMENTS edges', () => {
  it('creates IMPLEMENTS edge when class implements interface in same file', () => {
    const { edges } = setup({
      '/proj/src/foo.ts': `
        export interface IFoo { doIt(): void; }
        export class Foo implements IFoo { doIt() {} }
      `,
    });
    const impl = edges.filter(e => e.type === 'IMPLEMENTS');
    expect(impl).toHaveLength(1);
  });
});

describe('EXTENDS edges', () => {
  it('creates EXTENDS edge when class extends another in same file', () => {
    const { edges } = setup({
      '/proj/src/foo.ts': `
        export class Base {}
        export class Child extends Base {}
      `,
    });
    const ext = edges.filter(e => e.type === 'EXTENDS');
    expect(ext).toHaveLength(1);
  });
});

describe('CONSTRUCTOR_INJECTS edges', () => {
  it('creates edge for structural DI (no decorator)', () => {
    const { edges } = setup({
      '/proj/src/repo.ts': 'export interface IRepo { save(): void; }',
      '/proj/src/svc.ts': `
        import { IRepo } from './repo.js';
        export class Svc {
          constructor(private repo: IRepo) {}
        }
      `,
    });
    const injects = edges.filter(e => e.type === 'CONSTRUCTOR_INJECTS');
    expect(injects.length).toBeGreaterThanOrEqual(1);
    expect(injects[0].properties.decoratorBased).toBe(false);
  });

  it('does NOT create edge for primitive constructor params', () => {
    const { edges } = setup({
      '/proj/src/svc.ts': `
        export class Svc {
          constructor(private name: string, private count: number) {}
        }
      `,
    });
    const injects = edges.filter(e => e.type === 'CONSTRUCTOR_INJECTS');
    expect(injects).toHaveLength(0);
  });

  it('marks decorator-based injection correctly', () => {
    const { edges } = setup({
      '/proj/src/repo.ts': 'export class Repo {}',
      '/proj/src/svc.ts': `
        import { Repo } from './repo.js';
        function Injectable(): ClassDecorator { return () => {}; }
        @Injectable()
        export class Svc {
          constructor(private repo: Repo) {}
        }
      `,
    });
    const injects = edges.filter(e => e.type === 'CONSTRUCTOR_INJECTS');
    expect(injects.length).toBeGreaterThanOrEqual(1);
    expect(injects[0].properties.decoratorBased).toBe(true);
  });
});

describe('Edge deduplication', () => {
  it('does not emit duplicate DECLARES edges', () => {
    const { edges } = setup({
      '/proj/src/foo.ts': 'export class Foo {}',
    });
    const declares = edges.filter(e => e.type === 'DECLARES');
    // Should only have 1 DECLARES edge File→Class, not 2
    expect(declares).toHaveLength(1);
  });
});

describe('CALLS edges', () => {
  it('does NOT create CALLS edge for same-class method calls', () => {
    const { edges } = setup({
      '/proj/src/svc.ts': `
        export class Svc {
          a() { this.b(); }
          b() {}
        }
      `,
    });
    const calls = edges.filter(e => e.type === 'CALLS');
    expect(calls).toHaveLength(0);
  });
});

describe('Warning codes', () => {
  it('emits EXTRACTOR_001 for external imports', () => {
    const { warnings } = setup({
      '/proj/src/foo.ts': "import { something } from 'lodash';",
    });
    expect(warnings.some(w => w.code === 'EXTRACTOR_001')).toBe(true);
  });
});
