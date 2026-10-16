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

/**
 * A hexagonal project under arbitrary names: `src/<group>/<inbound>/` and `src/<group>/<outbound>/` adapters, driving
 * ports in the application implemented there, a driven port implemented by the outbound adapter, a composition root.
 */
export function hexShaped(group = 'adapters', inbound = 'inbound', outbound = 'outbound', extra: readonly string[] = []): IseGraph {
  const i = `src/${group}/${inbound}`;
  const o = `src/${group}/${outbound}`;
  return graph({
    files: ['src/core/Room.ts', 'src/app/ports/BookRoom.ts', 'src/app/ports/RoomRepository.ts', 'src/app/BookRoomService.ts', `${i}/http/RoomController.ts`, `${i}/cli/RoomCli.ts`, `${o}/db/SqlRoomRepository.ts`, 'src/app/ports/Clock.ts', `${o}/sys/SystemClock.ts`, 'src/wiring/container.ts'],
    edges: [
      'src/app/BookRoomService.ts>src/app/ports/Clock.ts', `${o}/sys/SystemClock.ts>src/app/ports/Clock.ts`, `src/wiring/container.ts>${o}/sys/SystemClock.ts`,
      'src/app/BookRoomService.ts>src/core/Room.ts', 'src/app/BookRoomService.ts>src/app/ports/BookRoom.ts', 'src/app/BookRoomService.ts>src/app/ports/RoomRepository.ts',
      'src/app/ports/RoomRepository.ts>src/core/Room.ts',
      `${i}/http/RoomController.ts>src/app/ports/BookRoom.ts`, `${i}/cli/RoomCli.ts>src/app/ports/BookRoom.ts`,
      `${o}/db/SqlRoomRepository.ts>src/app/ports/RoomRepository.ts`, `${o}/db/SqlRoomRepository.ts>src/core/Room.ts`,
      `src/wiring/container.ts>${i}/http/RoomController.ts`, `src/wiring/container.ts>${o}/db/SqlRoomRepository.ts`, 'src/wiring/container.ts>src/app/BookRoomService.ts',
      ...extra,
    ],
    classes: ['src/core/Room.ts', 'src/app/BookRoomService.ts', `${i}/http/RoomController.ts`, `${i}/cli/RoomCli.ts`, `${o}/db/SqlRoomRepository.ts`, `${o}/sys/SystemClock.ts`],
    interfaces: ['src/app/ports/BookRoom.ts', 'src/app/ports/RoomRepository.ts', 'src/app/ports/Clock.ts'],
    typeEdges: [
      ['implements', `${o}/sys/SystemClock.ts`, 'src/app/ports/Clock.ts'],
      ['implements', 'src/app/BookRoomService.ts', 'src/app/ports/BookRoom.ts'],
      ['implements', `${o}/db/SqlRoomRepository.ts`, 'src/app/ports/RoomRepository.ts'],
    ],
  });
}

/**
 * Two bounded contexts with the same internal layering under arbitrary layer names (`dom`, `app`, `inf`, plus `api`),
 * a public entry file each, a shared kernel and a composition root. `between` is inserted between a context folder
 * and its layer folders (a single-child chain).
 */
export function dddShaped(dom = 'domain', app = 'application', inf = 'infrastructure', between = ''): IseGraph {
  const files: string[] = ['src/shared-kernel/Money.ts', 'src/main.ts'];
  const edges: string[] = [];
  const classes: string[] = [];
  const interfaces: string[] = [];
  const typeEdges: [IseTypeEdge['kind'], string, string][] = [];
  for (const [ctx, agg] of [['ordering', 'order'], ['billing', 'invoice']] as const) {
    const L = `src/${ctx}/${between === '' ? '' : `${between}/`}`;
    const A = `${agg.slice(0, 1).toUpperCase()}${agg.slice(1)}`;
    const root = `${L}${dom}/${agg}/${A}.ts`;
    const repo = `${L}${dom}/${agg}/${A}Repository.ts`;
    const svc = `${L}${app}/Handle${A}.ts`;
    const impl = `${L}${inf}/InMemory${A}Repository.ts`;
    const api = `${L}api/${A}Controller.ts`;
    const index = `src/${ctx}/index.ts`;
    files.push(root, repo, svc, impl, api, index);
    edges.push(`${repo}>${root}`, `${svc}>${root}`, `${svc}>${repo}`, `${impl}>${repo}`, `${impl}>${root}`, `${api}>${svc}`, `${index}>${svc}`, `${root}>src/shared-kernel/Money.ts`, `src/main.ts>${api}`, `src/main.ts>${impl}`);
    classes.push(root, svc, impl, api);
    interfaces.push(repo);
    typeEdges.push(['implements', impl, repo]);
  }
  // One published-API import across contexts: billing's application reads ordering's entry file.
  edges.push(`src/billing/${between === '' ? '' : `${between}/`}${app}/HandleInvoice.ts>src/ordering/index.ts`);
  classes.push('src/shared-kernel/Money.ts');
  return graph({ files, edges, classes, interfaces, typeEdges });
}
