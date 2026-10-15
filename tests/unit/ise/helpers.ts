/** Synthetic ISE graphs for the unit tests. */
import type { IseDeclaration, IseGraph, IseTypeEdge } from '../../../src/ise/graph-view.js';

export interface GraphSpec {
  readonly files: readonly string[];
  /** `a.ts>b.ts` (file-to-file import). */
  readonly edges?: readonly string[];
  readonly packages?: readonly [string, string][];
  readonly classes?: readonly (string | [string, string, readonly string[]])[];
  readonly interfaces?: readonly string[];
  /** [kind, fromFile, toFile]: the first declaration of each file. */
  readonly typeEdges?: readonly [IseTypeEdge['kind'], string, string][];
}

const baseName = (f: string): string => (f.split('/').pop() ?? f).replace(/\.ts$/, '');

/** Classes are named after their file unless given as [file, name, decorators]. */
export function graph(spec: GraphSpec): IseGraph {
  const declarations: IseDeclaration[] = [
    ...(spec.classes ?? []).map((c): IseDeclaration =>
      typeof c === 'string' ? { name: baseName(c), kind: 'class', file: c, decorators: [] } : { name: c[1], kind: 'class', file: c[0], decorators: [...c[2]] }),
    ...(spec.interfaces ?? []).map((f): IseDeclaration => ({ name: baseName(f), kind: 'interface', file: f, decorators: [] })),
  ];
  const decl = (f: string): IseDeclaration => {
    const d = declarations.find((x) => x.file === f);
    if (d === undefined) throw new Error(`no declaration in ${f}`);
    return d;
  };
  return {
    files: [...spec.files].sort(),
    edges: (spec.edges ?? []).map((e) => {
      const [from = '', to = ''] = e.split('>');
      return { from, to, typeOnly: false };
    }),
    packageImports: (spec.packages ?? []).map(([file, pkg]) => ({ file, pkg })),
    declarations,
    typeEdges: (spec.typeEdges ?? []).map(([kind, a, b]) => ({ kind, from: decl(a), to: decl(b) })),
  };
}

/** A small clean-architecture-shaped project under arbitrary directory names (core, app, outer). */
export function cleanShaped(core = 'domain', app = 'application', outer = 'infrastructure'): IseGraph {
  const c = (f: string): string => `src/${core}/${f}`;
  const a = (f: string): string => `src/${app}/${f}`;
  const o = (f: string): string => `src/${outer}/${f}`;
  return graph({
    files: [c('entities/Book.ts'), c('repositories/BookRepository.ts'), a('use-cases/RegisterBook.ts'), a('ports/Clock.ts'), o('persistence/InMemoryBookRepository.ts'), o('system/SystemClock.ts'), o('main.ts')],
    edges: [
      `${c('repositories/BookRepository.ts')}>${c('entities/Book.ts')}`,
      `${a('use-cases/RegisterBook.ts')}>${c('entities/Book.ts')}`,
      `${a('use-cases/RegisterBook.ts')}>${c('repositories/BookRepository.ts')}`,
      `${a('use-cases/RegisterBook.ts')}>${a('ports/Clock.ts')}`,
      `${o('persistence/InMemoryBookRepository.ts')}>${c('repositories/BookRepository.ts')}`,
      `${o('persistence/InMemoryBookRepository.ts')}>${c('entities/Book.ts')}`,
      `${o('system/SystemClock.ts')}>${a('ports/Clock.ts')}`,
      `${o('main.ts')}>${a('use-cases/RegisterBook.ts')}`,
      `${o('main.ts')}>${o('persistence/InMemoryBookRepository.ts')}`,
    ],
    classes: [c('entities/Book.ts'), a('use-cases/RegisterBook.ts'), o('persistence/InMemoryBookRepository.ts'), o('system/SystemClock.ts')],
    interfaces: [c('repositories/BookRepository.ts'), a('ports/Clock.ts')],
    typeEdges: [
      ['implements', o('persistence/InMemoryBookRepository.ts'), c('repositories/BookRepository.ts')],
      ['implements', o('system/SystemClock.ts'), a('ports/Clock.ts')],
      ['injects', a('use-cases/RegisterBook.ts'), c('repositories/BookRepository.ts')],
    ],
  });
}

/** A layered project: presentation -> business -> persistence, no interfaces, an entry file. */
export function layeredShaped(top = 'presentation', mid = 'business', low = 'persistence'): IseGraph {
  return graph({
    files: [`src/${top}/OrderController.ts`, `src/${top}/OrderView.ts`, `src/${mid}/OrderService.ts`, `src/${mid}/Order.ts`, `src/${low}/OrderGateway.ts`, `src/${low}/Database.ts`, 'src/main.ts'],
    edges: [
      `src/${top}/OrderController.ts>src/${mid}/OrderService.ts`,
      `src/${top}/OrderController.ts>src/${top}/OrderView.ts`,
      `src/${top}/OrderView.ts>src/${mid}/Order.ts`,
      `src/${mid}/OrderService.ts>src/${low}/OrderGateway.ts`,
      `src/${mid}/OrderService.ts>src/${mid}/Order.ts`,
      `src/${low}/OrderGateway.ts>src/${low}/Database.ts`,
      `src/main.ts>src/${top}/OrderController.ts`,
    ],
    classes: [`src/${top}/OrderController.ts`, `src/${mid}/OrderService.ts`, `src/${mid}/Order.ts`, `src/${low}/OrderGateway.ts`, `src/${low}/Database.ts`],
  });
}
