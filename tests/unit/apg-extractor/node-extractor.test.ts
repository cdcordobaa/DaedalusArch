import { Project } from 'ts-morph';
import { extractNodes, detectBarrel } from '../../../src/apg-extractor/node-extractor.js';

const ROOT = '/proj';

function makeProject(files: Record<string, string>): ReturnType<Project['getSourceFiles']> {
  const project = new Project({ useInMemoryFileSystem: true, skipFileDependencyResolution: true });
  for (const [fp, content] of Object.entries(files)) {
    project.createSourceFile(fp, content);
  }
  return project.getSourceFiles();
}

describe('extractNodes — File node', () => {
  it('creates one File node per source file', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export class Foo {}' });
    const { nodes } = extractNodes(sfs, ROOT);
    const fileNodes = nodes.filter(n => n.type === 'File');
    expect(fileNodes).toHaveLength(1);
    expect(fileNodes[0].filePath).toBe('src/foo.ts');
    expect(fileNodes[0].name).toBe('foo.ts');
  });

  it('marks barrel files with isBarrel=true', () => {
    const sfs = makeProject({ "/proj/src/index.ts": "export { Foo } from './foo.js';" });
    const { nodes } = extractNodes(sfs, ROOT);
    const fileNode = nodes.find(n => n.type === 'File');
    expect(fileNode?.properties.isBarrel).toBe(true);
  });

  it('marks non-barrel files with isBarrel=false', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export class Foo {}' });
    const { nodes } = extractNodes(sfs, ROOT);
    const fileNode = nodes.find(n => n.type === 'File');
    expect(fileNode?.properties.isBarrel).toBe(false);
  });
});

describe('extractNodes — Class node', () => {
  it('extracts Class node with correct name and filePath', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export class UserService {}' });
    const { nodes } = extractNodes(sfs, ROOT);
    const cls = nodes.find(n => n.type === 'Class');
    expect(cls).toBeDefined();
    expect(cls?.name).toBe('UserService');
    expect(cls?.filePath).toBe('src/foo.ts');
  });

  it('extracts class decorators', () => {
    const sfs = makeProject({
      '/proj/src/foo.ts': `
        function Injectable(): ClassDecorator { return () => {}; }
        @Injectable()
        export class MyService {}
      `,
    });
    const { nodes } = extractNodes(sfs, ROOT);
    const cls = nodes.find(n => n.type === 'Class');
    expect(cls?.decorators).toContain('Injectable');
  });

  it('sets isAbstract correctly', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export abstract class BaseService {}' });
    const { nodes } = extractNodes(sfs, ROOT);
    const cls = nodes.find(n => n.type === 'Class');
    expect(cls?.properties.isAbstract).toBe(true);
  });
});

describe('extractNodes — Interface node', () => {
  it('extracts Interface node', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export interface IRepository {}' });
    const { nodes } = extractNodes(sfs, ROOT);
    const iface = nodes.find(n => n.type === 'Interface');
    expect(iface).toBeDefined();
    expect(iface?.name).toBe('IRepository');
    expect(iface?.decorators).toEqual([]);
  });
});

describe('extractNodes — Method node', () => {
  it('extracts Method node with qualified name', () => {
    const sfs = makeProject({
      '/proj/src/foo.ts': `
        export class MyService {
          async doWork(): Promise<void> {}
        }
      `,
    });
    const { nodes } = extractNodes(sfs, ROOT);
    const method = nodes.find(n => n.type === 'Method');
    expect(method).toBeDefined();
    expect(method?.name).toBe('MyService.doWork');
    expect(method?.properties.isAsync).toBe(true);
  });

  it('multiple methods all get qualified names', () => {
    const sfs = makeProject({
      '/proj/src/foo.ts': `
        export class Svc {
          a() {}
          b() {}
        }
      `,
    });
    const { nodes } = extractNodes(sfs, ROOT);
    const methods = nodes.filter(n => n.type === 'Method');
    expect(methods).toHaveLength(2);
    expect(methods.map(m => m.name).sort()).toEqual(['Svc.a', 'Svc.b']);
  });
});

describe('extractNodes — Function node', () => {
  it('extracts module-level function declaration', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export function greet(): string { return "hi"; }' });
    const { nodes } = extractNodes(sfs, ROOT);
    const fn = nodes.find(n => n.type === 'Function');
    expect(fn).toBeDefined();
    expect(fn?.name).toBe('greet');
    expect(fn?.properties.isExported).toBe(true);
  });
});

describe('extractNodes — NodeLookup registry', () => {
  it('fileNodes maps filePath to File nodeId', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export class Foo {}' });
    const { lookup } = extractNodes(sfs, ROOT);
    expect(lookup.fileNodes.has('src/foo.ts')).toBe(true);
  });

  it('typeNodes maps lowercased name@path to Class nodeId', () => {
    const sfs = makeProject({ '/proj/src/foo.ts': 'export class UserService {}' });
    const { lookup } = extractNodes(sfs, ROOT);
    expect(lookup.typeNodes.has('userservice@src/foo.ts')).toBe(true);
  });
});

describe('detectBarrel', () => {
  it('returns true for pure re-export file', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('/proj/index.ts', "export { Foo } from './foo.js';");
    expect(detectBarrel(sf)).toBe(true);
  });

  it('returns false for file with class declaration', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('/proj/foo.ts', 'export class Foo {}');
    expect(detectBarrel(sf)).toBe(false);
  });

  it('returns false for empty file', () => {
    const project = new Project({ useInMemoryFileSystem: true });
    const sf = project.createSourceFile('/proj/empty.ts', '');
    expect(detectBarrel(sf)).toBe(false);
  });
});
