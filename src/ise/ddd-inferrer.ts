/**
 * ISE: the `architecture.ddd` block for a project classified as DDD. The preset's own block describes one specific
 * project, so it is never copied; every field is inferred from the paths and the APG:
 * - contexts: bounded-context folders (`contexts.ts`: repeated internal layering, or the DDD layer names); public API =
 *   the context's direct files and its `contracts/` (published language) folder; ACL = its `acl/` folder;
 * - aggregates: each subfolder of a context's domain folder (the sub-folder named `domain`, else the one the structure
 *   says: `ContextLayout.domain`), except value-object and event folders; the root is
 *   the file named like the folder, else the module file most imported from outside the module; inner entities are
 *   the other class files directly in the module that the root imports;
 * - value objects, repositories, application services: globs over the folders and suffixes actually found;
 * - domain event types: the type that at least 60% of the classes in event folders extend or implement (majority vote).
 */
import * as path from 'node:path';
import type { IseGraph } from './graph-view.js';
import { detectContexts } from './contexts.js';
import { STYLE_TOKENS, normaliseToken } from './vocabulary.js';

export interface InferredDdd {
  readonly source_root: string;
  readonly contexts: readonly { name: string; root: string; public_api: string[]; acl: string[] }[];
  readonly outside_contexts: readonly string[];
  readonly aggregates: readonly { name: string; context: string; module: string; root: string; inner_entities: string[] }[];
  readonly value_objects: readonly string[];
  readonly repositories: readonly string[];
  readonly domain_event_types: readonly string[];
  readonly application_services: readonly string[];
}

const base = (f: string): string => path.posix.basename(f).replace(/\.[^.]+$/, '');
const inList = (seg: string, list: readonly string[]): boolean => list.includes(normaliseToken(seg));

export function inferDddBlock(graph: IseGraph): InferredDdd {
  const files = graph.files;
  const { sourceRoot: root, contexts: layouts } = detectContexts(graph);
  const contexts = layouts.map((c) => c.root);
  const childDirs = (dir: string): string[] =>
    [...new Set(files.filter((f) => f.startsWith(dir) && f.slice(dir.length).includes('/')).map((f) => f.slice(dir.length).split('/')[0] ?? ''))].sort();
  const importsOf = new Map<string, Set<string>>();
  for (const e of graph.edges) importsOf.set(e.from, (importsOf.get(e.from) ?? new Set<string>()).add(e.to));

  const ctxOut = layouts.map((c) => {
    const kids = childDirs(c.layerRoot);
    return {
      name: c.root.slice(root.length, -1),
      root: c.root,
      public_api: [
        ...files.filter((f) => f.startsWith(c.root) && !f.slice(c.root.length).includes('/')),
        ...kids.filter((k) => inList(k, ['contracts', 'publishedlanguage'])).map((k) => `${c.layerRoot}${k}/**`),
      ],
      acl: kids.filter((k) => inList(k, ['acl', 'anticorruption'])).map((k) => `${c.layerRoot}${k}/**`),
    };
  });

  const outside = new Set<string>();
  for (const f of files) {
    if (!f.startsWith(root) || contexts.some((c) => f.startsWith(c))) continue;
    const rest = f.slice(root.length);
    outside.add(rest.includes('/') ? `${root}${rest.split('/')[0] ?? ''}/**` : f);
  }

  const aggregates: InferredDdd['aggregates'][number][] = [];
  const skip = [...STYLE_TOKENS.valueObjects, ...STYLE_TOKENS.events];
  for (const c of layouts) {
    if (c.domain === null) continue;
    const d = c.domain;
    for (const mod of childDirs(d).filter((k) => !inList(k, skip))) {
      const m = `${d}${mod}/`;
      const direct = files.filter((f) => f.startsWith(m) && !f.slice(m.length).includes('/'));
      const inModule = (f: string): boolean => f.startsWith(m);
      const classFiles = direct.filter((f) => graph.declarations.some((x) => x.file === f && x.kind === 'class'));
      let rootFile = direct.find((f) => normaliseToken(base(f)) === normaliseToken(mod));
      if (rootFile === undefined) {
        const fanIn = (f: string): number => graph.edges.filter((e) => e.to === f && !inModule(e.from)).length;
        rootFile = [...classFiles].sort((a, b) => fanIn(b) - fanIn(a) || (a < b ? -1 : 1))[0];
      }
      if (rootFile === undefined) continue;
      const rootImports = importsOf.get(rootFile) ?? new Set<string>();
      aggregates.push({
        name: base(rootFile),
        context: c.root.slice(root.length, -1),
        module: `${m}**`,
        root: rootFile,
        inner_entities: classFiles.filter((f) => f !== rootFile && rootImports.has(f) && !base(f).endsWith("Repository")),
      });
    }
  }

  // Layer folders as paths relative to the context root (`domain`, or `x/kernel` below a single-child chain).
  const voDirs = new Set<string>();
  const repoDirs = new Set<string>();
  const appDirs = new Set<string>();
  for (const f of files) {
    const segs = f.split('/');
    segs.slice(0, -1).forEach((s) => {
      if (inList(s, STYLE_TOKENS.valueObjects)) voDirs.add(s);
    });
    const ctx = layouts.find((c) => f.startsWith(c.root));
    if (ctx === undefined) continue;
    const child = ctx.children.find((k) => f.startsWith(k));
    if (child === undefined) continue;
    const rel = child.slice(ctx.root.length, -1);
    if (f.endsWith("Repository.ts")) repoDirs.add(rel);
    if (child === ctx.application && !f.slice(child.length).includes('/')) appDirs.add(rel);
  }

  // Domain event base type: majority vote over the classes declared in event folders.
  const eventClasses = graph.declarations.filter((d) => d.kind === 'class' && d.file.split('/').some((s) => inList(s, STYLE_TOKENS.events)));
  const supers = new Map<string, number>();
  for (const e of graph.typeEdges) {
    if ((e.kind === 'implements' || e.kind === 'extends') && eventClasses.some((c) => c.name === e.from.name && c.file === e.from.file)) {
      supers.set(e.to.name, (supers.get(e.to.name) ?? 0) + 1);
    }
  }
  const eventTypes = [...supers].filter(([, n]) => eventClasses.length > 0 && n / eventClasses.length >= 0.6).map(([t]) => t).sort();

  return {
    source_root: root,
    contexts: ctxOut,
    outside_contexts: [...outside].sort(),
    aggregates,
    value_objects: [...voDirs].sort().map((d) => `${root}**/${d}/**`),
    repositories: [...repoDirs].sort().map((d) => `${root}*/${d}/**/*Repository.ts`),
    domain_event_types: eventTypes,
    application_services: [...appDirs].sort().map((d) => `${root}*/${d}/*.ts`),
  };
}
