/**
 * The graph facts a fix hint may read, as a narrow port so the MCP tools (no graph) and the CLI (the extracted APG)
 * share one hint builder. `graphFactsFromApg` reads the APG the pipeline extracted; nothing here queries Neo4j.
 */
import type { APGResult } from '../shared/types/apg.js';

export interface ImportFact {
  /** A file path, or a package name when `package` is true. */
  readonly target: string;
  readonly package: boolean;
  readonly typeOnly: boolean;
  readonly importedNames: readonly string[];
}

export interface Declarations {
  readonly classes: readonly string[];
  readonly interfaces: readonly string[];
  readonly functions: readonly string[];
}

export interface GraphFacts {
  readonly files: readonly string[];
  declarations(file: string): Declarations;
  /** Literal imports of a file (resolved edges through a barrel excluded). */
  importsOf(file: string): readonly ImportFact[];
  /** Files that import `file` (literal edges). */
  importersOf(file: string): readonly string[];
  /** Interfaces the classes of `file` implement: name and declaring file (absent when unresolved). */
  implementedBy(file: string, className?: string): readonly { readonly name: string; readonly file: string | undefined }[];
  /** The file declaring an interface or class of this name, when exactly one does. */
  fileDeclaring(name: string): string | undefined;
}

const EMPTY: Declarations = { classes: [], interfaces: [], functions: [] };

export function graphFactsFromApg(apg: Pick<APGResult, 'nodes' | 'edges'>, toRelative: (p: string) => string = (p) => p): GraphFacts {
  const byId = new Map(apg.nodes.map((n) => [n.id, n]));
  const decl = new Map<string, { classes: string[]; interfaces: string[]; functions: string[] }>();
  const declaring = new Map<string, Set<string>>();
  const files: string[] = [];
  for (const n of apg.nodes) {
    const file = toRelative(n.filePath);
    if (n.type === 'File') {
      files.push(file);
      continue;
    }
    if (n.type !== 'Class' && n.type !== 'Interface' && n.type !== 'Function') continue;
    const d = decl.get(file) ?? { classes: [], interfaces: [], functions: [] };
    (n.type === 'Class' ? d.classes : n.type === 'Interface' ? d.interfaces : d.functions).push(n.name);
    decl.set(file, d);
    if (n.type !== 'Function') {
      const s = declaring.get(n.name) ?? new Set<string>();
      s.add(file);
      declaring.set(n.name, s);
    }
  }
  const imports = new Map<string, ImportFact[]>();
  const importers = new Map<string, Set<string>>();
  const impl = new Map<string, { cls: string; name: string; file: string | undefined }[]>();
  for (const e of apg.edges) {
    const src = byId.get(e.sourceId);
    const tgt = byId.get(e.targetId);
    if (src === undefined || tgt === undefined) continue;
    if ((e.type === 'IMPORTS' || e.type === 'RE_EXPORTS') && src.type === 'File') {
      if (e.properties.viaReExport === true) continue;
      const from = toRelative(src.filePath);
      const isPackage = tgt.type === 'Package';
      const to = isPackage ? tgt.name : toRelative(tgt.filePath);
      const names = Array.isArray(e.properties.importedNames) ? e.properties.importedNames.map(String) : [];
      const list = imports.get(from) ?? [];
      list.push({ target: to, package: isPackage, typeOnly: e.properties.isTypeOnly === true, importedNames: names });
      imports.set(from, list);
      if (!isPackage) {
        const s = importers.get(to) ?? new Set<string>();
        s.add(from);
        importers.set(to, s);
      }
    }
    if (e.type === 'IMPLEMENTS' && src.type === 'Class') {
      const from = toRelative(src.filePath);
      const list = impl.get(from) ?? [];
      list.push({ cls: src.name, name: tgt.name, file: tgt.type === 'Interface' && tgt.filePath !== '' ? toRelative(tgt.filePath) : undefined });
      impl.set(from, list);
    }
  }
  return {
    files: files.sort(),
    declarations: (file) => decl.get(file) ?? EMPTY,
    importsOf: (file) => imports.get(file) ?? [],
    importersOf: (file) => [...(importers.get(file) ?? [])].sort(),
    implementedBy: (file, className) =>
      (impl.get(file) ?? [])
        .filter((i) => className === undefined || i.cls === className)
        .map((i) => ({ name: i.name, file: i.file ?? (declaring.get(i.name)?.size === 1 ? [...(declaring.get(i.name) ?? [])][0] : undefined) })),
    fileDeclaring: (name) => {
      const s = declaring.get(name);
      return s?.size === 1 ? [...s][0] : undefined;
    },
  };
}
