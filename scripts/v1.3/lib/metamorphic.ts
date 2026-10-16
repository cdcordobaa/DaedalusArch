/**
 * Metamorphic testing of the tool's verdict (v1.3, construct validity and reliability): semantics-preserving
 * transformations of a TypeScript project copy, and the comparison of blocking findings before and after.
 *
 * Every transformation edits a project directory in place and keeps the layer folders the spec maps (directories
 * are never renamed or moved). It returns how to map file paths before and after onto one canonical path, so the
 * two runs can be compared on (rule, file, target) as well as on (rule, layer pair). A transformation that can
 * produce several shapes (which file to split, which pair to merge, which order) yields candidates; the harness
 * keeps the first candidate that type-checks (`scripts/v1.3/metamorphic-run.ts`).
 *
 * Specifier style is preserved: a project that writes `./x.js` (NodeNext) keeps the extension, and a specifier that
 * names a directory (`./model`) keeps omitting `/index`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import YAML from 'yaml';
import { annotateNodes } from '../../../src/neo4j-ingestion/layer-annotator.js';
import type { APGNode } from '../../../src/shared/types/apg.js';
import type { LayerModel as SpecLayerModel } from '../../../src/shared/types/spec.js';
import { Node, Project, QuoteKind, SyntaxKind, ts } from 'ts-morph';
import type { ExportDeclaration, Identifier, ImportDeclaration, SourceFile, Statement } from 'ts-morph';

// ── transformation contract ──

export interface TransformOutcome {
  /** False when the transformation has nothing to act on in this project (identity; excluded from the rates). */
  readonly applied: boolean;
  readonly note: string;
  /** Original project-relative path -> canonical path (paths not listed map to themselves). */
  readonly origCanon: Readonly<Record<string, string>>;
  /** Transformed project-relative path -> canonical path (paths not listed map to themselves). */
  readonly newCanon: Readonly<Record<string, string>>;
  /**
   * Strings of the spec's `architecture` section to replace so the spec follows the change (a renamed file path the
   * spec names, a renamed class the spec names); see `rewriteSpecArchitecture`.
   */
  readonly specRenames?: Readonly<Record<string, string>>;
}

export interface TransformContext {
  /** Project-relative files the variant's defining finding names (tried first by split and merge). */
  readonly focus: readonly string[];
  /**
   * The layer key of a project-relative file (the instrument's assignment, `layerKey`). Split and merge stay inside
   * one layer: a NestJS feature folder holds several layers, told apart by file-name patterns. Absent: the directory.
   */
  readonly layerOf?: (file: string) => string;
}

/** One way to apply a transformation; `apply` edits `dir` in place. */
export interface TransformCandidate {
  readonly label: string;
  readonly apply: (dir: string) => Promise<TransformOutcome>;
}

export type TransformName =
  | 'rename'
  | 'reorder'
  | 'reformat'
  | 'barrel-add'
  | 'barrel-remove'
  | 'default-export'
  | 'import-type'
  | 'path-alias'
  | 'split'
  | 'merge'
  | 'rename-opaque'
  | 'rename-spec-stale'
  | 'import-type-drop';

/** The nine transformations of the task, in report order (barrels counted once, as add and remove). */
export const CORE_TRANSFORMS: readonly TransformName[] = [
  'rename', 'reorder', 'reformat', 'barrel-add', 'barrel-remove', 'default-export', 'import-type', 'path-alias', 'split', 'merge',
];
/**
 * Supplementary probes: names without role tokens, the rename with a spec that does not follow it, and the reverse
 * of `import-type`.
 */
export const PROBE_TRANSFORMS: readonly TransformName[] = ['rename-opaque', 'rename-spec-stale', 'import-type-drop'];
export const ALL_TRANSFORMS: readonly TransformName[] = [...CORE_TRANSFORMS, ...PROBE_TRANSFORMS];

export function isTransformName(s: string): s is TransformName {
  return (ALL_TRANSFORMS as readonly string[]).includes(s);
}

// ── project helpers ──

const toPosix = (p: string): string => p.split(path.sep).join('/');

export function openProject(dir: string): Project {
  return new Project({ tsConfigFilePath: path.join(dir, 'tsconfig.json'), manipulationSettings: { quoteKind: QuoteKind.Single } });
}

export function relOf(dir: string, sf: SourceFile | string): string {
  return toPosix(path.relative(dir, typeof sf === 'string' ? sf : sf.getFilePath()));
}

/** The project's own source files under `src/` (no declaration files), sorted by path. */
export function srcFiles(project: Project, dir: string): SourceFile[] {
  return project
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile() && relOf(dir, sf).startsWith('src/'))
    .sort((a, b) => a.getFilePath().localeCompare(b.getFilePath()));
}

const isRelative = (spec: string): boolean => spec.startsWith('./') || spec.startsWith('../') || spec === '.' || spec === '..';

/**
 * The specifier from `fromAbs` to `toAbs`, in the style of `likeSpec`: keeps a `.js` extension, and keeps naming a
 * directory instead of its `index` when `likeSpec` did (only without an extension).
 */
export function relSpec(fromAbs: string, toAbs: string, likeSpec: string): string {
  const ext = /\.js$/.test(likeSpec) ? '.js' : '';
  let noExt = toAbs.replace(/\.tsx?$/, '');
  const omitIndex = ext === '' && path.basename(noExt) === 'index' && !/(^|\/)index$/.test(likeSpec);
  if (omitIndex) noExt = path.dirname(noExt);
  let r = toPosix(path.relative(path.dirname(fromAbs), noExt));
  if (r === '') r = '.';
  if (!r.startsWith('.')) r = `./${r}`;
  return omitIndex ? r : r + ext;
}

type ModuleDecl = ImportDeclaration | ExportDeclaration;

function moduleDecls(sf: SourceFile): ModuleDecl[] {
  return [...sf.getImportDeclarations(), ...sf.getExportDeclarations().filter((e) => e.hasModuleSpecifier())];
}

function targetOf(decl: ModuleDecl): SourceFile | undefined {
  const spec = decl.getModuleSpecifierValue();
  if (spec === undefined) return undefined;
  return decl.getModuleSpecifierSourceFile();
}

/** Every module declaration in `files` whose specifier resolves to `target`. */
function importersOf(files: readonly SourceFile[], target: SourceFile): ModuleDecl[] {
  return files.filter((f) => f !== target).flatMap((f) => moduleDecls(f).filter((d) => targetOf(d) === target));
}

const outcome = (applied: boolean, note: string, origCanon: Record<string, string> = {}, newCanon: Record<string, string> = {}): TransformOutcome => ({
  applied,
  note,
  origCanon,
  newCanon,
});

/** Top-level names a statement declares (classes, functions, interfaces, types, enums, variables). */
function declaredNames(st: Statement): string[] {
  if (Node.isVariableStatement(st)) return st.getDeclarations().flatMap((d) => (Node.isIdentifier(d.getNameNode()) ? [d.getName()] : []));
  if (Node.isClassDeclaration(st) || Node.isFunctionDeclaration(st)) {
    const n = st.getName();
    return n === undefined ? [] : [n];
  }
  if (Node.isInterfaceDeclaration(st) || Node.isTypeAliasDeclaration(st) || Node.isEnumDeclaration(st)) return [st.getName()];
  return [];
}

function isExportedStatement(st: Statement): boolean {
  return Node.isExportable(st) && st.isExported();
}

/** The compiler symbol an identifier refers to (the value symbol of a shorthand property `{ x }`). */
function referencedSymbol(id: Identifier): ts.Symbol | undefined {
  const p = id.getParent();
  if (Node.isShorthandPropertyAssignment(p)) return id.getProject().getTypeChecker().compilerObject.getShorthandAssignmentValueSymbol(p.compilerNode);
  return id.getSymbol()?.compilerSymbol;
}

/** The compiler symbols that identifiers inside `nodes` refer to. */
function usedSymbols(nodes: readonly Node[]): Set<ts.Symbol> {
  const out = new Set<ts.Symbol>();
  for (const n of nodes) {
    for (const id of n.getDescendantsOfKind(SyntaxKind.Identifier)) {
      const s = referencedSymbol(id);
      if (s !== undefined) out.add(s);
    }
  }
  return out;
}

/** Local symbols of a file's import bindings, with where they come from. */
interface ImportBinding {
  readonly decl: ImportDeclaration;
  readonly local: string;
  readonly imported: string; // 'default' or '*' for those bindings
  readonly symbol: ts.Symbol | undefined;
  readonly typeOnly: boolean; // declaration-level or specifier-level `type`
  readonly kind: 'named' | 'default' | 'namespace';
}

function importBindings(sf: SourceFile): ImportBinding[] {
  const out: ImportBinding[] = [];
  const checker = sf.getProject().getTypeChecker().compilerObject;
  for (const decl of sf.getImportDeclarations()) {
    const dt = decl.isTypeOnly();
    const def = decl.getDefaultImport();
    if (def !== undefined) out.push({ decl, local: def.getText(), imported: 'default', symbol: checker.getSymbolAtLocation(def.compilerNode), typeOnly: dt, kind: 'default' });
    const ns = decl.getNamespaceImport();
    if (ns !== undefined) out.push({ decl, local: ns.getText(), imported: '*', symbol: checker.getSymbolAtLocation(ns.compilerNode), typeOnly: dt, kind: 'namespace' });
    for (const s of decl.getNamedImports()) {
      const local = s.getAliasNode()?.getText() ?? s.getName();
      // The local binding's (alias) symbol, which is what references in the file resolve to.
      const symbol = checker.getSymbolAtLocation(s.compilerNode.name);
      out.push({ decl, local, imported: s.getName(), symbol, typeOnly: dt || s.isTypeOnly(), kind: 'named' });
    }
  }
  return out;
}

/** Source text of an import declaration of `bindings` (all from one declaration) with a new specifier. */
function importText(bindings: readonly ImportBinding[], spec: string): string {
  const declTypeOnly = bindings.every((b) => b.decl.isTypeOnly());
  const named = bindings.filter((b) => b.kind === 'named');
  const def = bindings.find((b) => b.kind === 'default');
  const ns = bindings.find((b) => b.kind === 'namespace');
  const parts: string[] = [];
  if (def !== undefined) parts.push(def.local);
  if (ns !== undefined) parts.push(`* as ${ns.local}`);
  if (named.length > 0) {
    parts.push(
      `{ ${named
        .map((b) => `${!declTypeOnly && b.typeOnly ? 'type ' : ''}${b.imported === b.local ? b.local : `${b.imported} as ${b.local}`}`)
        .join(', ')} }`,
    );
  }
  return `import ${declTypeOnly ? 'type ' : ''}${parts.join(', ')} from '${spec}';`;
}

/** Writes renames (absolute old -> absolute new) after saving the project. */
async function saveWithRenames(project: Project, renames: ReadonlyMap<string, string>): Promise<void> {
  await project.save();
  for (const [from, to] of renames) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.renameSync(from, to);
  }
}

/** Points every relative module declaration of `files` whose source or target is renamed at the new location. */
function relink(files: readonly SourceFile[], renames: ReadonlyMap<string, string>): void {
  const plan: { decl: ModuleDecl; spec: string }[] = [];
  for (const sf of files) {
    for (const decl of moduleDecls(sf)) {
      const spec = decl.getModuleSpecifierValue() ?? '';
      if (!isRelative(spec)) continue;
      const target = targetOf(decl);
      if (target === undefined) continue;
      const from = renames.get(sf.getFilePath()) ?? sf.getFilePath();
      const to = renames.get(target.getFilePath()) ?? target.getFilePath();
      if (from === sf.getFilePath() && to === target.getFilePath()) continue;
      plan.push({ decl, spec: relSpec(from, to, spec) });
    }
  }
  for (const p of plan) p.decl.setModuleSpecifier(p.spec);
}

// ── rename (identifiers and files) ──

const PROTECTED_BASENAMES = new Set(['index.ts', 'main.ts']);

function prefixed(name: string): string {
  if (/^[A-Z][A-Z0-9_]*$/.test(name) && name.length > 1) return `ACME_${name}`;
  if (/^[A-Z]/.test(name)) return `Acme${name}`;
  return `acme${name.charAt(0).toUpperCase()}${name.slice(1)}`;
}

function prefixedFile(base: string): string {
  return /^[A-Z]/.test(base) ? `Acme${base}` : `acme-${base}`;
}

/** Renamable top-level declaration names of the project's own files, in a stable order. */
function topLevelNameNodes(files: readonly SourceFile[]): Identifier[] {
  const out: Identifier[] = [];
  for (const sf of files) {
    for (const st of sf.getStatements()) {
      if (Node.isVariableStatement(st)) {
        for (const d of st.getDeclarations()) {
          const n = d.getNameNode();
          if (Node.isIdentifier(n)) out.push(n);
        }
      } else if (Node.isClassDeclaration(st) || Node.isFunctionDeclaration(st)) {
        const n = st.getNameNode();
        if (n !== undefined) out.push(n);
      } else if (Node.isInterfaceDeclaration(st) || Node.isTypeAliasDeclaration(st) || Node.isEnumDeclaration(st)) {
        out.push(st.getNameNode());
      }
    }
  }
  return out;
}

/**
 * Renames every top-level declaration of `src/` and every file except `index.ts` and `main.ts`. `opaque` false keeps
 * the original words (a prefix, so role suffixes such as `Repository` or `.controller` survive); true replaces them
 * with numbered names that carry no role token.
 */
export function renameCandidate(opaque: boolean, specFollows = true): TransformCandidate {
  return {
    label: `${opaque ? 'opaque names' : 'Acme prefix'}${specFollows ? '' : ', spec not updated'}`,
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      let n = 0;
      const nameNodes = topLevelNameNodes(files);
      const newNames = new Map<string, string>();
      // Collect first (renaming invalidates nothing in ts-morph, but the order must not depend on earlier renames).
      const plan = nameNodes.map((id) => ({ id, from: id.getText() }));
      const idMap = new Map<string, string | null>(); // old name -> new name; null when one name got several
      for (const p of plan) {
        let to = newNames.get(p.from);
        if (to === undefined || opaque) {
          n += 1;
          to = opaque ? `${/^[A-Z]/.test(p.from) ? 'Q' : 'q'}${String(n).padStart(3, '0')}` : prefixed(p.from);
          newNames.set(p.from, to);
        }
        p.id.rename(to, { usePrefixAndSuffixText: false, renameInComments: false, renameInStrings: false });
        const seen = idMap.get(p.from);
        idMap.set(p.from, seen === undefined || seen === to ? to : null);
      }
      const renames = new Map<string, string>();
      const origCanon: Record<string, string> = {};
      const newCanon: Record<string, string> = {};
      let f = 0;
      for (const sf of files) {
        const base = path.basename(sf.getFilePath());
        if (PROTECTED_BASENAMES.has(base)) continue;
        f += 1;
        const newBase = opaque ? `m${String(f).padStart(3, '0')}.ts` : prefixedFile(base);
        const to = path.join(path.dirname(sf.getFilePath()), newBase);
        renames.set(sf.getFilePath(), to);
        newCanon[relOf(dir, to)] = relOf(dir, sf);
      }
      relink(files, renames);
      await saveWithRenames(project, renames);
      const specRenames: Record<string, string> = {};
      if (specFollows) {
        for (const [from, to] of idMap) if (to !== null) specRenames[from] = to;
        for (const [to, from] of Object.entries(newCanon)) specRenames[from] = to;
      }
      return { ...outcome(true, `${String(plan.length)} declarations, ${String(renames.size)} files renamed`, origCanon, newCanon), specRenames };
    },
  };
}

// ── reorder imports and declarations ──

function statementChunk(st: Statement): string {
  return st.getFullText().replace(/^\s+/, '');
}

/**
 * Reverses each file's imports and its hoisted declarations: interfaces and type aliases (reversed) go first,
 * function declarations (reversed) last; classes, variables, enums and other statements keep their relative order,
 * since moving them could use a class before its declaration.
 */
export function reorderCandidate(): TransformCandidate {
  return {
    label: 'reverse imports and hoisted declarations',
    apply: async (dir) => {
      const project = openProject(dir);
      let changed = 0;
      for (const sf of srcFiles(project, dir)) {
        const stmts = sf.getStatements();
        if (stmts.length < 2) continue;
        const imports: Statement[] = stmts.filter((s) => Node.isImportDeclaration(s));
        const rest: Statement[] = stmts.filter((s) => !Node.isImportDeclaration(s));
        const types: Statement[] = rest.filter((s) => Node.isInterfaceDeclaration(s) || Node.isTypeAliasDeclaration(s));
        const funcs: Statement[] = rest.filter((s) => Node.isFunctionDeclaration(s) && s.hasBody());
        const other = rest.filter((s) => !types.includes(s) && !funcs.includes(s));
        const ordered = [...[...imports].reverse(), ...[...types].reverse(), ...other, ...[...funcs].reverse()];
        if (ordered.every((s, i) => s === stmts[i])) continue;
        const tail = sf.getFullText().slice(stmts[stmts.length - 1]?.getEnd() ?? 0);
        const head = [...imports].reverse().map(statementChunk).join('\n');
        const body = ordered.filter((s) => !Node.isImportDeclaration(s)).map(statementChunk).join('\n\n');
        sf.replaceWithText(`${head}${head !== '' && body !== '' ? '\n\n' : ''}${body}${tail.trim() === '' ? '\n' : tail}`);
        changed += 1;
      }
      await project.save();
      return outcome(changed > 0, `${String(changed)} files reordered`);
    },
  };
}

// ── reformat ──

/** Reprints every file with prettier at settings far from the projects' own (4-space indent, no semicolons, ...). */
export const PRETTIER_ARGS: readonly string[] = [
  '--no-config', '--no-editorconfig', '--with-node-modules', '--parser', 'typescript', '--print-width', '60', '--tab-width', '4',
  '--no-semi', '--trailing-comma', 'all', '--no-bracket-spacing', '--arrow-parens', 'always', '--quote-props', 'consistent',
];

export function reformatCandidate(): TransformCandidate {
  return {
    label: 'prettier, 4 spaces, no semicolons, double quotes, width 60',
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir).map((sf) => sf.getFilePath());
      const before = files.map((f) => fs.readFileSync(f, 'utf8'));
      // The prettier CLI in a child process (its API loads ESM through a dynamic import, which jest cannot run).
      const bin = path.join(process.cwd(), 'node_modules', 'prettier', 'bin', 'prettier.cjs');
      // cwd = the project: prettier skips files outside its working directory.
      execFileSync(process.execPath, [bin, ...PRETTIER_ARGS, '--log-level', 'warn', '--write', ...files.map((f) => relOf(dir, f))], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
      const changed = files.filter((f, i) => fs.readFileSync(f, 'utf8') !== before[i]).length;
      return Promise.resolve(outcome(changed > 0, `${String(changed)} files reformatted`));
    },
  };
}

// ── barrels ──

/**
 * Adds an `index.ts` (`export * from './x'` per file) to every directory under `src/` that has no barrel, except
 * `src/` itself, and points imports from outside a directory (and outside its subtree) at its barrel. A directory
 * whose files export the same name twice gets no barrel (an `export *` conflict).
 */
export function barrelAddCandidate(): TransformCandidate {
  return {
    label: 'one export-star barrel per directory',
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      const byDir = new Map<string, SourceFile[]>();
      for (const sf of files) {
        const d = path.dirname(sf.getFilePath());
        byDir.set(d, [...(byDir.get(d) ?? []), sf]);
      }
      const nodeNext = files.some((sf) => moduleDecls(sf).some((d) => /^\.{1,2}\/.*\.js$/.test(d.getModuleSpecifierValue() ?? '')));
      const barrels = new Map<string, string>(); // dir -> barrel abs path
      const members = new Set<SourceFile>();
      for (const [d, list] of byDir) {
        if (relOf(dir, d) === 'src') continue;
        if (list.some((sf) => path.basename(sf.getFilePath()) === 'index.ts')) continue;
        const names = new Set<string>();
        let conflict = false;
        for (const sf of list) {
          for (const name of sf.getExportedDeclarations().keys()) {
            if (name === 'default') continue;
            if (names.has(name)) conflict = true;
            names.add(name);
          }
        }
        if (conflict) continue;
        barrels.set(d, path.join(d, 'index.ts'));
        for (const sf of list) members.add(sf);
      }
      if (barrels.size === 0) return outcome(false, 'no directory can take a barrel');
      let rewired = 0;
      const plan: { decl: ModuleDecl; spec: string }[] = [];
      for (const sf of files) {
        if (path.basename(sf.getFilePath()) === 'index.ts') continue;
        for (const decl of moduleDecls(sf)) {
          const spec = decl.getModuleSpecifierValue() ?? '';
          if (!isRelative(spec)) continue;
          if (Node.isImportDeclaration(decl) && (decl.getNamespaceImport() !== undefined || decl.getImportClause() === undefined)) continue;
          if (Node.isExportDeclaration(decl) && !decl.hasNamedExports()) continue;
          const target = targetOf(decl);
          if (target === undefined || !members.has(target)) continue;
          const tdir = path.dirname(target.getFilePath());
          const barrel = barrels.get(tdir);
          if (barrel === undefined) continue;
          const from = path.dirname(sf.getFilePath());
          if (from === tdir || from.startsWith(tdir + path.sep)) continue;
          const likeSpec = nodeNext ? 'x.js' : 'x';
          let s = relSpec(sf.getFilePath(), barrel, likeSpec);
          if (!nodeNext) s = s.replace(/\/index$/, '');
          plan.push({ decl, spec: s });
        }
      }
      for (const p of plan) {
        p.decl.setModuleSpecifier(p.spec);
        rewired += 1;
      }
      for (const [d, barrel] of barrels) {
        const list = (byDir.get(d) ?? []).map((sf) => path.basename(sf.getFilePath()).replace(/\.ts$/, '')).sort();
        project.createSourceFile(barrel, list.map((b) => `export * from './${b}${nodeNext ? '.js' : ''}';`).join('\n') + '\n');
      }
      await project.save();
      return outcome(true, `${String(barrels.size)} barrels added, ${String(rewired)} imports rewired`);
    },
  };
}

/**
 * Removes the project's barrels (`index.ts` files that only re-export): every import through a barrel is pointed at
 * the file that declares each name, and the barrel is deleted. No barrel: not applicable.
 */
export function barrelRemoveCandidate(): TransformCandidate {
  return {
    label: 'import declaring files directly, delete barrels',
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      const barrels = files.filter((sf) => path.basename(sf.getFilePath()) === 'index.ts' && sf.getStatements().every((s) => Node.isExportDeclaration(s) && s.hasModuleSpecifier()));
      if (barrels.length === 0) return outcome(false, 'no barrel');
      let rewired = 0;
      for (const barrel of barrels) {
        // name exported by the barrel -> declaring file
        const declaring = new Map<string, SourceFile>();
        for (const [name, decls] of barrel.getExportedDeclarations()) {
          const d = decls[0];
          if (d !== undefined) declaring.set(name, d.getSourceFile());
        }
        for (const decl of importersOf(files.filter((f) => !f.wasForgotten()), barrel)) {
          const sf = decl.getSourceFile();
          const spec = decl.getModuleSpecifierValue() ?? '';
          const likeSpec = /\.js$/.test(spec) ? 'x.js' : 'x';
          if (Node.isImportDeclaration(decl)) {
            if (decl.getNamespaceImport() !== undefined || decl.getDefaultImport() !== undefined) throw new Error(`${relOf(dir, sf)}: namespace or default import of a barrel`);
            const groups = new Map<SourceFile, ImportBinding[]>();
            for (const b of importBindings(sf).filter((x) => x.decl === decl)) {
              const t = declaring.get(b.imported);
              if (t === undefined) throw new Error(`${relOf(dir, sf)}: ${b.imported} not found behind ${relOf(dir, barrel)}`);
              groups.set(t, [...(groups.get(t) ?? []), b]);
            }
            const texts = [...groups].map(([t, bs]) => importText(bs, relSpec(sf.getFilePath(), t.getFilePath(), likeSpec)));
            decl.replaceWithText(texts.join('\n'));
          } else {
            const groups = new Map<SourceFile, string[]>();
            for (const s of decl.getNamedExports()) {
              const t = declaring.get(s.getName());
              if (t === undefined) throw new Error(`${relOf(dir, sf)}: ${s.getName()} not found behind ${relOf(dir, barrel)}`);
              groups.set(t, [...(groups.get(t) ?? []), s.getText()]);
            }
            const kw = decl.isTypeOnly() ? 'export type' : 'export';
            decl.replaceWithText([...groups].map(([t, ss]) => `${kw} { ${ss.join(', ')} } from '${relSpec(sf.getFilePath(), t.getFilePath(), likeSpec)}';`).join('\n'));
          }
          rewired += 1;
        }
        barrel.delete();
      }
      await project.save();
      return outcome(true, `${String(barrels.length)} barrels removed, ${String(rewired)} imports rewired`);
    },
  };
}

// ── default <-> named exports ──

/**
 * Turns the main export of every file into its default export: the exported class named like the file, else the
 * first exported class, else the first exported function. Importers switch to a default import (a type-only import
 * becomes a separate `import type X from`), named re-exports become `default as X`, and an `export *` of the file
 * gains `export { default as X }`.
 */
export function defaultExportCandidate(): TransformCandidate {
  return {
    label: 'main export of each file becomes the default export',
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      let switched = 0;
      for (const sf of files) {
        const base = path.basename(sf.getFilePath()).replace(/\.ts$/, '');
        if (PROTECTED_BASENAMES.has(`${base}.ts`)) continue;
        if (sf.getDefaultExportSymbol() !== undefined) continue;
        const classes = sf.getClasses().filter((c) => c.isExported() && c.getName() !== undefined);
        const funcs = sf.getFunctions().filter((f) => f.isExported() && f.getName() !== undefined && f.hasBody());
        const main = classes.find((c) => c.getName() === base) ?? classes[0] ?? funcs[0];
        if (main === undefined) continue;
        const name = main.getName() ?? '';
        for (const decl of importersOf(files, sf)) {
          const isf = decl.getSourceFile();
          const spec = decl.getModuleSpecifierValue() ?? '';
          if (Node.isImportDeclaration(decl)) {
            const spcs = decl.getNamedImports().filter((s) => s.getName() === name);
            for (const s of spcs) {
              const local = s.getAliasNode()?.getText() ?? name;
              const typeOnly = decl.isTypeOnly() || s.isTypeOnly();
              const othersLeft = decl.getNamedImports().length > 1 || decl.getDefaultImport() !== undefined;
              s.remove();
              if (typeOnly) {
                isf.insertImportDeclaration(decl.getChildIndex() + 1, { isTypeOnly: true, defaultImport: local, moduleSpecifier: spec });
                if (!othersLeft) decl.remove();
              } else if (decl.getDefaultImport() === undefined) {
                decl.setDefaultImport(local);
                if (decl.getNamedImports().length === 0) decl.removeNamedImports();
              } else {
                isf.insertImportDeclaration(decl.getChildIndex() + 1, { defaultImport: local, moduleSpecifier: spec });
              }
            }
          } else if (decl.hasNamedExports()) {
            for (const s of decl.getNamedExports().filter((x) => x.getName() === name)) {
              const alias = s.getAliasNode()?.getText() ?? name;
              s.replaceWithText(`default as ${alias}`);
            }
          } else {
            isf.insertExportDeclaration(decl.getChildIndex() + 1, { namedExports: [`default as ${name}`], moduleSpecifier: spec });
          }
        }
        main.setIsDefaultExport(true);
        switched += 1;
      }
      await project.save();
      return outcome(switched > 0, `${String(switched)} files switched to a default export`);
    },
  };
}

// ── import type ──

function hasDecoratorMetadata(project: Project): boolean {
  return project.getCompilerOptions().emitDecoratorMetadata === true;
}

/**
 * Whether a reference to an imported name is a type position (a position `import type` allows). `typeof X` counts
 * as a type position. Under `emitDecoratorMetadata`, a type annotation in a class with decorators is a value
 * position (the compiler emits the class as runtime metadata).
 */
export function isTypePosition(id: Node, decoratorMetadata: boolean): boolean {
  let inType = false;
  for (let p: Node | undefined = id.getParent(); p !== undefined; p = p.getParent()) {
    if (Node.isHeritageClause(p)) {
      const owner = p.getParent();
      inType = p.getToken() === SyntaxKind.ImplementsKeyword || Node.isInterfaceDeclaration(owner);
      if (!inType) return false;
      break;
    }
    if (Node.isTypeQuery(p)) {
      inType = true;
      break;
    }
    if (Node.isExpressionWithTypeArguments(p)) continue;
    if (Node.isTypeNode(p)) {
      inType = true;
      break;
    }
    if (Node.isStatement(p) || Node.isSourceFile(p) || Node.isExportSpecifier(p) || Node.isBlock(p)) return false;
  }
  if (!inType) return false;
  if (!decoratorMetadata) return true;
  for (let p: Node | undefined = id.getParent(); p !== undefined; p = p.getParent()) {
    if (Node.isBlock(p)) return true;
    if (Node.isClassDeclaration(p)) {
      const decorated = p.getDecorators().length > 0 || p.getDescendantsOfKind(SyntaxKind.Decorator).length > 0;
      return !decorated;
    }
  }
  return true;
}

/** Whole import declarations whose bindings are only used in type positions become `import type`. */
export function importTypeCandidate(): TransformCandidate {
  return {
    label: 'type-only usages -> import type',
    apply: async (dir) => {
      const project = openProject(dir);
      const meta = hasDecoratorMetadata(project);
      let converted = 0;
      for (const sf of srcFiles(project, dir)) {
        const bindings = importBindings(sf);
        const ids = sf.getDescendantsOfKind(SyntaxKind.Identifier);
        for (const decl of sf.getImportDeclarations()) {
          if (decl.isTypeOnly()) continue;
          const own = bindings.filter((b) => b.decl === decl);
          if (own.length === 0 || own.some((b) => b.kind === 'namespace' || b.symbol === undefined)) continue;
          if (own.some((b) => b.kind === 'default') && own.some((b) => b.kind === 'named')) continue;
          const allType = own.every((b) => {
            const refs = ids.filter((id) => id.getText() === b.local && !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration) && referencedSymbol(id) === b.symbol);
            return refs.length > 0 && refs.every((r) => isTypePosition(r, meta));
          });
          if (!allType) continue;
          for (const s of decl.getNamedImports()) if (s.isTypeOnly()) s.setIsTypeOnly(false);
          decl.setIsTypeOnly(true);
          converted += 1;
        }
      }
      await project.save();
      return outcome(converted > 0, `${String(converted)} import declarations made type-only`);
    },
  };
}

/** Probe, the reverse direction: every `import type` (and inline `type` specifier) becomes a plain import. */
export function importTypeDropCandidate(): TransformCandidate {
  return {
    label: 'import type -> import',
    apply: async (dir) => {
      const project = openProject(dir);
      let converted = 0;
      for (const sf of srcFiles(project, dir)) {
        for (const decl of sf.getImportDeclarations()) {
          let touched = false;
          if (decl.isTypeOnly()) {
            decl.setIsTypeOnly(false);
            touched = true;
          }
          for (const s of decl.getNamedImports()) {
            if (s.isTypeOnly()) {
              s.setIsTypeOnly(false);
              touched = true;
            }
          }
          if (touched) converted += 1;
        }
      }
      await project.save();
      return outcome(converted > 0, `${String(converted)} type-only imports made plain`);
    },
  };
}

// ── path alias ──

export const ALIAS_PREFIX = '@app/';

/**
 * Adds `baseUrl: "."` and `paths: { "@app/*": ["src/*"] }` to tsconfig.json and rewrites every relative specifier
 * that leaves the importing file's directory (`../`) to the alias.
 */
export function pathAliasCandidate(): TransformCandidate {
  return {
    label: '@app/* -> src/*',
    apply: async (dir) => {
      const tsconfigPath = path.join(dir, 'tsconfig.json');
      const parsed = ts.parseConfigFileTextToJson(tsconfigPath, fs.readFileSync(tsconfigPath, 'utf8'));
      if (parsed.error !== undefined) throw new Error('tsconfig.json does not parse');
      const config = parsed.config as { compilerOptions?: Record<string, unknown> };
      const co = { ...(config.compilerOptions ?? {}) };
      if (co.paths !== undefined || co.baseUrl !== undefined) return outcome(false, 'tsconfig already has paths or baseUrl');
      co.baseUrl = '.';
      co.paths = { [`${ALIAS_PREFIX}*`]: ['src/*'] };
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      const srcRoot = path.join(dir, 'src');
      const plan: { decl: ModuleDecl; spec: string }[] = [];
      for (const sf of files) {
        for (const decl of moduleDecls(sf)) {
          const spec = decl.getModuleSpecifierValue() ?? '';
          if (!spec.startsWith('../')) continue;
          const target = targetOf(decl);
          if (target === undefined) continue;
          const like = relSpec(sf.getFilePath(), target.getFilePath(), spec);
          const ext = /\.js$/.test(like) ? '.js' : '';
          let t = target.getFilePath().replace(/\.tsx?$/, '');
          if (ext === '' && path.basename(t) === 'index' && !/(^|\/)index$/.test(spec)) t = path.dirname(t);
          plan.push({ decl, spec: `${ALIAS_PREFIX}${toPosix(path.relative(srcRoot, t))}${ext}` });
        }
      }
      if (plan.length === 0) return outcome(false, 'no relative import leaves its directory');
      for (const p of plan) p.decl.setModuleSpecifier(p.spec);
      await project.save();
      fs.writeFileSync(tsconfigPath, JSON.stringify({ ...config, compilerOptions: co }, null, 2) + '\n');
      return outcome(true, `${String(plan.length)} imports use the alias`);
    },
  };
}

// ── split one file into two (same directory) ──

function extraName(base: string): string {
  return /^[A-Z]/.test(base) ? `Extra${base}` : `extra-${base}`;
}

/** The ordered candidate files: focus files first, then by number of exported declarations (desc), then path. */
function orderedCandidates(dir: string, files: readonly SourceFile[], focus: readonly string[]): SourceFile[] {
  const eligible = files.filter((sf) => !PROTECTED_BASENAMES.has(path.basename(sf.getFilePath())));
  const exportedCount = (sf: SourceFile): number => sf.getStatements().filter((s) => isExportedStatement(s) && declaredNames(s).length > 0).length;
  const focused = focus.flatMap((f) => eligible.filter((sf) => relOf(dir, sf) === f));
  const rest = eligible.filter((sf) => !focused.includes(sf)).sort((a, b) => exportedCount(b) - exportedCount(a) || a.getFilePath().localeCompare(b.getFilePath()));
  return [...new Set([...focused, ...rest])];
}

interface SplitPlan {
  readonly file: string; // project-relative
  readonly cut: number; // index into the non-import statements: statements [cut..] move
}

/** Split plans for the project, in preference order (see `splitCandidates`). */
export function planSplits(dir: string, focus: readonly string[], layerOf?: (file: string) => string): SplitPlan[] {
  const project = openProject(dir);
  const files = srcFiles(project, dir);
  const plans: SplitPlan[] = [];
  for (const sf of orderedCandidates(dir, files, focus)) {
    if (layerOf !== undefined) {
      const rel = relOf(dir, sf);
      if (layerOf(rel) !== layerOf(toPosix(path.join(path.dirname(rel), extraName(path.basename(rel)))))) continue;
    }
    if (sf.getExportDeclarations().length > 0) continue;
    if (sf.getStatements().some((s) => Node.isExportAssignment(s))) continue;
    if (importersOf(files, sf).some((d) => Node.isImportDeclaration(d) && d.getNamespaceImport() !== undefined)) continue;
    const rest = sf.getStatements().filter((s) => !Node.isImportDeclaration(s));
    const exportedIdx = rest.flatMap((s, i) => (isExportedStatement(s) && declaredNames(s).length > 0 ? [i] : []));
    if (exportedIdx.length < 2) continue;
    // Cuts between exported declarations, from the middle outwards.
    const cuts = exportedIdx.slice(1).map((i) => i);
    const mid = cuts.length / 2;
    cuts.sort((a, b) => Math.abs(cuts.indexOf(a) - mid) - Math.abs(cuts.indexOf(b) - mid));
    for (const cut of cuts) {
      const moved = rest.slice(cut);
      const kept = rest.slice(0, cut);
      const keptSyms = new Map<ts.Symbol, Statement>();
      const movedSyms = new Map<ts.Symbol, Statement>();
      for (const s of kept) for (const sym of declSymbols(s)) keptSyms.set(sym, s);
      for (const s of moved) for (const sym of declSymbols(s)) movedSyms.set(sym, s);
      const mUses = [...usedSymbols(moved)].filter((x) => keptSyms.has(x));
      const kUses = [...usedSymbols(kept)].filter((x) => movedSyms.has(x));
      if (mUses.length > 0 && kUses.length > 0) continue;
      if (mUses.some((x) => !isExportedStatement(keptSyms.get(x) as Statement))) continue;
      if (kUses.some((x) => !isExportedStatement(movedSyms.get(x) as Statement))) continue;
      plans.push({ file: relOf(dir, sf), cut });
    }
  }
  return plans;
}

function declSymbols(st: Statement): ts.Symbol[] {
  const out: ts.Symbol[] = [];
  if (Node.isVariableStatement(st)) {
    for (const d of st.getDeclarations()) {
      const s = d.getSymbol();
      if (s !== undefined) out.push(s.compilerSymbol);
    }
  } else {
    const s = (st as Node).getSymbol();
    if (s !== undefined) out.push(s.compilerSymbol);
  }
  return out;
}

/** The import declarations (as text) of `sf` that `nodes` need, keeping only the bindings they use. */
function neededImports(sf: SourceFile, nodes: readonly Node[]): string[] {
  const used = usedSymbols(nodes);
  const texts: string[] = [];
  const all = importBindings(sf);
  for (const decl of sf.getImportDeclarations()) {
    const keep = all.filter((b) => b.decl === decl && b.symbol !== undefined && used.has(b.symbol));
    if (keep.length > 0) texts.push(importText(keep, decl.getModuleSpecifierValue()));
  }
  return texts;
}

function applySplit(plan: SplitPlan): TransformCandidate {
  return {
    label: `split ${plan.file} at statement ${String(plan.cut)}`,
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      const sf = project.getSourceFileOrThrow(path.join(dir, plan.file));
      const rest = sf.getStatements().filter((s) => !Node.isImportDeclaration(s));
      const moved = rest.slice(plan.cut);
      const kept = rest.slice(0, plan.cut);
      const extraAbs = path.join(path.dirname(sf.getFilePath()), extraName(path.basename(sf.getFilePath())));
      if (fs.existsSync(extraAbs)) throw new Error(`${extraAbs} exists`);
      const movedNames = new Set(moved.filter(isExportedStatement).flatMap(declaredNames));
      const mUsesKept = [...new Set(kept.filter((s) => declSymbols(s).some((x) => usedSymbols(moved).has(x))).flatMap(declaredNames))];
      const kUsesMoved = [...new Set(moved.filter((s) => declSymbols(s).some((x) => usedSymbols(kept).has(x))).flatMap(declaredNames))];
      const anySpec = moduleDecls(sf).map((d) => d.getModuleSpecifierValue() ?? '').find(isRelative) ?? importersOf(files, sf)[0]?.getModuleSpecifierValue() ?? './x';
      const like = /\.js$/.test(anySpec) ? 'x.js' : 'x';

      // 1. importers elsewhere
      for (const decl of importersOf(files, sf)) {
        const isf = decl.getSourceFile();
        const spec = relSpec(isf.getFilePath(), extraAbs, like);
        if (Node.isImportDeclaration(decl)) {
          const own = importBindings(isf).filter((b) => b.decl === decl && b.kind === 'named');
          const mv = own.filter((b) => movedNames.has(b.imported));
          if (mv.length === 0) continue;
          const text = importText(mv, spec);
          if (mv.length === own.length && decl.getDefaultImport() === undefined) decl.replaceWithText(text);
          else {
            for (const s of decl.getNamedImports().filter((x) => movedNames.has(x.getName()))) s.remove();
            decl.replaceWithText(`${decl.getText()}\n${text}`);
          }
        } else if (decl.hasNamedExports()) {
          const mv = decl.getNamedExports().filter((s) => movedNames.has(s.getName()));
          if (mv.length === 0) continue;
          const kw = decl.isTypeOnly() ? 'export type' : 'export';
          const text = `${kw} { ${mv.map((s) => s.getText()).join(', ')} } from '${spec}';`;
          if (mv.length === decl.getNamedExports().length) decl.replaceWithText(text);
          else {
            for (const s of mv) s.remove();
            decl.replaceWithText(`${decl.getText()}\n${text}`);
          }
        } else {
          decl.replaceWithText(`${decl.getText()}\nexport * from '${spec}';`);
        }
      }

      // 2. the new file and the trimmed original
      const movedImports = neededImports(sf, moved);
      const keptImports = keptImportTexts(sf, kept, moved);
      const ownSpec = relSpec(extraAbs, sf.getFilePath(), like);
      const extraSpec = relSpec(sf.getFilePath(), extraAbs, like);
      const extraText = [
        ...movedImports,
        ...(mUsesKept.length > 0 ? [`import { ${mUsesKept.join(', ')} } from '${ownSpec}';`] : []),
        '',
        moved.map(statementChunk).join('\n\n'),
        '',
      ].join('\n');
      const keptText = [
        ...keptImports,
        ...(kUsesMoved.length > 0 ? [`import { ${kUsesMoved.join(', ')} } from '${extraSpec}';`] : []),
        '',
        kept.map(statementChunk).join('\n\n'),
        '',
      ].join('\n');
      sf.replaceWithText(keptText.replace(/^\n+/, ''));
      project.createSourceFile(extraAbs, extraText.replace(/^\n+/, ''));
      await project.save();
      return outcome(true, `split ${plan.file} into it and ${relOf(dir, extraAbs)} (${String(moved.length)} statements moved)`, {}, { [relOf(dir, extraAbs)]: plan.file });
    },
  };
}

/** Import texts the kept part of a split file needs: bindings used by the kept part, plus unused ones nobody needs. */
function keptImportTexts(sf: SourceFile, kept: readonly Node[], moved: readonly Node[]): string[] {
  const usedKept = usedSymbols(kept);
  const usedMoved = usedSymbols(moved);
  const all = importBindings(sf);
  const texts: string[] = [];
  for (const decl of sf.getImportDeclarations()) {
    const own = all.filter((b) => b.decl === decl);
    if (own.length === 0) {
      texts.push(decl.getText()); // side-effect import stays with the original file
      continue;
    }
    // A binding only the moved part uses goes with it; everything else (also unused bindings) stays.
    const keep = own.filter((b) => b.symbol === undefined || usedKept.has(b.symbol) || !usedMoved.has(b.symbol));
    if (keep.length > 0) texts.push(importText(keep, decl.getModuleSpecifierValue()));
  }
  return texts;
}

/** Split candidates: the focus file first, then the files with most exported declarations. */
export function splitCandidates(dir: string, ctx: TransformContext, max = 6): TransformCandidate[] {
  return planSplits(dir, ctx.focus, ctx.layerOf).slice(0, max).map(applySplit);
}

// ── merge two files of the same directory ──

interface MergePlan {
  readonly into: string; // project-relative, kept
  readonly from: string; // project-relative, deleted
  readonly fromFirst: boolean; // the merged file puts `from`'s statements before `into`'s
}

/**
 * Merge plans: a focus file with each sibling, then other sibling pairs; both statement orders. A pair made of two
 * focus files (both ends of the defining finding) comes last.
 */
export function planMerges(dir: string, focus: readonly string[], layerOf?: (file: string) => string): MergePlan[] {
  const project = openProject(dir);
  const files = srcFiles(project, dir);
  const order = orderedCandidates(dir, files, focus);
  const plans: MergePlan[] = [];
  const seen = new Set<string>();
  for (const a of order) {
    const siblings = order.filter((b) => b !== a && path.dirname(b.getFilePath()) === path.dirname(a.getFilePath()));
    for (const b of siblings) {
      const key = [relOf(dir, a), relOf(dir, b)].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      if (layerOf !== undefined && layerOf(relOf(dir, a)) !== layerOf(relOf(dir, b))) continue;
      if (!mergeable(files, a, b)) continue;
      const aUsesB = importersOf([a], b).length > 0;
      const bUsesA = importersOf([b], a).length > 0;
      // The file imported by the other goes first (a class must be declared before a top-level use).
      const first = aUsesB && !bUsesA;
      plans.push({ into: relOf(dir, a), from: relOf(dir, b), fromFirst: first });
      plans.push({ into: relOf(dir, a), from: relOf(dir, b), fromFirst: !first });
    }
  }
  // Merging the two ends of the defining finding makes it intra-file by construction: tried last.
  const both = (p: MergePlan): number => (focus.includes(p.into) && focus.includes(p.from) ? 1 : 0);
  return plans.map((p, i) => ({ p, i })).sort((x, y) => both(x.p) - both(y.p) || x.i - y.i).map((x) => x.p);
}

function mergeable(files: readonly SourceFile[], a: SourceFile, b: SourceFile): boolean {
  for (const sf of [a, b]) {
    if (sf.getExportDeclarations().length > 0) return false;
    if (sf.getStatements().some((s) => Node.isExportAssignment(s))) return false;
    if (importersOf(files, sf).some((d) => Node.isImportDeclaration(d) && (d.getNamespaceImport() !== undefined || d.getDefaultImport() !== undefined))) return false;
  }
  const declA = new Set(a.getStatements().flatMap(declaredNames));
  const declB = new Set(b.getStatements().flatMap(declaredNames));
  for (const n of declA) if (declB.has(n)) return false;
  const imp = (sf: SourceFile, other: SourceFile): Map<string, string> => {
    const m = new Map<string, string>();
    for (const bd of importBindings(sf)) {
      const t = targetOf(bd.decl);
      if (t === other) continue;
      m.set(bd.local, `${t?.getFilePath() ?? bd.decl.getModuleSpecifierValue()}#${bd.imported}`);
    }
    return m;
  };
  const ia = imp(a, b);
  const ib = imp(b, a);
  for (const [local, origin] of ia) {
    if (declB.has(local)) return false;
    const o = ib.get(local);
    if (o !== undefined && o !== origin) return false;
  }
  for (const local of ib.keys()) if (declA.has(local)) return false;
  return true;
}

function applyMerge(plan: MergePlan): TransformCandidate {
  return {
    label: `merge ${plan.from} into ${plan.into}${plan.fromFirst ? ' (merged file first)' : ''}`,
    apply: async (dir) => {
      const project = openProject(dir);
      const files = srcFiles(project, dir);
      const a = project.getSourceFileOrThrow(path.join(dir, plan.into));
      const b = project.getSourceFileOrThrow(path.join(dir, plan.from));
      const like = /\.js$/.test(moduleDecls(a).concat(moduleDecls(b)).map((d) => d.getModuleSpecifierValue() ?? '').find(isRelative) ?? '') ? 'x.js' : 'x';
      // Imports: a's, then b's minus bindings a already has, minus imports of each other.
      const texts: string[] = [];
      const have = new Set<string>();
      for (const sf of [a, b]) {
        const all = importBindings(sf);
        for (const decl of sf.getImportDeclarations()) {
          const t = targetOf(decl);
          if (t === a || t === b) continue;
          const own = all.filter((x) => x.decl === decl);
          if (own.length === 0) {
            if (!have.has(decl.getText())) texts.push(decl.getText());
            have.add(decl.getText());
            continue;
          }
          const keep = own.filter((x) => !have.has(x.local));
          for (const x of keep) have.add(x.local);
          // Same directory: a relative specifier of b is valid in a unchanged.
          if (keep.length > 0) texts.push(importText(keep, decl.getModuleSpecifierValue()));
        }
      }
      const body = (sf: SourceFile): string => sf.getStatements().filter((s) => !Node.isImportDeclaration(s)).map(statementChunk).join('\n\n');
      const parts = plan.fromFirst ? [body(b), body(a)] : [body(a), body(b)];
      // Importers of b now import a.
      for (const decl of importersOf(files, b)) {
        if (decl.getSourceFile() === a) continue;
        decl.setModuleSpecifier(relSpec(decl.getSourceFile().getFilePath(), a.getFilePath(), like === 'x.js' ? 'x.js' : decl.getModuleSpecifierValue() ?? 'x'));
      }
      a.replaceWithText(`${texts.join('\n')}\n\n${parts.filter((p) => p !== '').join('\n\n')}\n`);
      b.delete();
      await project.save();
      return outcome(true, `merged ${plan.from} into ${plan.into}`, { [plan.from]: plan.into }, {});
    },
  };
}

export function mergeCandidates(dir: string, ctx: TransformContext, max = 8): TransformCandidate[] {
  return planMerges(dir, ctx.focus, ctx.layerOf).slice(0, max).map(applyMerge);
}

// ── candidates per transformation ──

export function candidatesFor(name: TransformName, dir: string, ctx: TransformContext): TransformCandidate[] {
  switch (name) {
    case 'rename':
      return [renameCandidate(false)];
    case 'rename-opaque':
      return [renameCandidate(true)];
    case 'rename-spec-stale':
      return [renameCandidate(false, false)];
    case 'reorder':
      return [reorderCandidate()];
    case 'reformat':
      return [reformatCandidate()];
    case 'barrel-add':
      return [barrelAddCandidate()];
    case 'barrel-remove':
      return [barrelRemoveCandidate()];
    case 'default-export':
      return [defaultExportCandidate()];
    case 'import-type':
      return [importTypeCandidate()];
    case 'import-type-drop':
      return [importTypeDropCandidate()];
    case 'path-alias':
      return [pathAliasCandidate()];
    case 'split':
      return splitCandidates(dir, ctx);
    case 'merge':
      return mergeCandidates(dir, ctx);
  }
}

// ── spec ──

/**
 * Replaces, inside the spec's `architecture` section, every string value (or list item) that equals a key of
 * `renames`: a file path the spec names (a DDD aggregate root or inner entity) or a class name (a DDD
 * `domain_event_types` entry). Globs are left alone: the transformations keep folders and the rename keeps role
 * words, so a glob that matched still matches. Returns the new YAML and the replacements, or undefined if none.
 */
export function rewriteSpecArchitecture(specText: string, renames: Readonly<Record<string, string>>): { text: string; replaced: string[] } | undefined {
  const doc = YAML.parse(specText) as { architecture?: unknown };
  const replaced: string[] = [];
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      const to = Object.prototype.hasOwnProperty.call(renames, v) ? renames[v] : undefined;
      if (to !== undefined && to !== v) {
        replaced.push(`${v} -> ${to}`);
        return to;
      }
      return v;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  if (doc.architecture === undefined) return undefined;
  const architecture = walk(doc.architecture);
  if (replaced.length === 0) return undefined;
  return { text: YAML.stringify({ ...doc, architecture }), replaced: [...new Set(replaced)].sort() };
}

// ── comparison ──

export interface LayerModel {
  /** The instrument's own file-to-layer assignment (directory globs, then file-name patterns); null: no layer. */
  readonly layerOf: (file: string) => string | null;
  /** DDD: context roots (`src/ordering/`), so a layer key also names the context. */
  readonly contexts: readonly { name: string; root: string }[];
}

interface SpecLayers {
  architecture?: {
    layers?: { name: string; directories?: string[]; file_patterns?: string[] }[];
    ddd?: { contexts?: { name: string; root: string }[] };
  };
}

/** The layer model of a parsed spec YAML, assigning files with `annotateNodes` (src/neo4j-ingestion/layer-annotator.ts). */
export function layerModelFromSpec(spec: SpecLayers): LayerModel {
  const model: SpecLayerModel = {
    layers: (spec.architecture?.layers ?? []).map((l) => ({ name: l.name, directories: l.directories ?? [], naming: [], filePatterns: l.file_patterns ?? [], role: '' })),
  };
  const cache = new Map<string, string | null>();
  const layerOf = (file: string): string | null => {
    let v = cache.get(file);
    if (v === undefined) {
      const node: APGNode = { id: file, type: 'File', filePath: file, name: file, decorators: [], properties: {} };
      v = annotateNodes([node], model).annotations.get(file)?.layer ?? null;
      cache.set(file, v);
    }
    return v;
  };
  const contexts = (spec.architecture?.ddd?.contexts ?? []).map((c) => ({ name: c.name, root: c.root.endsWith('/') ? c.root : `${c.root}/` }));
  return { layerOf, contexts };
}

/** `layer` or `context:layer` of a project-relative file; `?` when no layer matches; `-` for no file. */
export function layerKey(model: LayerModel, file: string): string {
  if (file === '') return '-';
  const layer = model.layerOf(file) ?? '?';
  const ctx = model.contexts.find((c) => file.startsWith(c.root));
  return ctx === undefined ? layer : `${ctx.name}:${layer}`;
}

export interface Row {
  readonly ruleId: string;
  readonly file: string;
  readonly target?: string;
}

const CYCLE_RULES = new Set(['FF-S02']);

function splitFiles(s: string | undefined): string[] {
  return (s ?? '').split(',').map((x) => x.trim()).filter((x) => x !== '');
}

/** (rule, layer pair) key; a cycle's key is its rule and the sorted set of layers it passes through. */
export function layerPairKey(model: LayerModel, r: Row): string {
  if (CYCLE_RULES.has(r.ruleId)) {
    const ls = [...new Set([...splitFiles(r.file), ...splitFiles(r.target)].map((f) => layerKey(model, f)))].sort();
    return `${r.ruleId}|{${ls.join(',')}}`;
  }
  return `${r.ruleId}|${layerKey(model, r.file)}>${layerKey(model, r.target ?? '')}`;
}

/** (rule, file, target) key over canonical paths; a cycle's key is its sorted, deduplicated canonical files. */
export function fileKey(canon: (p: string) => string, r: Row): string {
  if (CYCLE_RULES.has(r.ruleId)) return `${r.ruleId}|{${[...new Set([...splitFiles(r.file), ...splitFiles(r.target)].map(canon))].sort().join(',')}}`;
  return `${r.ruleId}|${canon(r.file)}|${r.target === undefined ? '' : canon(r.target)}`;
}

export interface RunSummary {
  /** The CLI's v1.3 verdict (`tiers.verdict`). */
  readonly verdict: string;
  readonly blockingRules: readonly string[];
  readonly blocking: readonly Row[];
  readonly advisory: readonly Row[];
}

export interface Comparison {
  readonly definingRules: readonly string[];
  readonly definingBefore: string;
  readonly definingAfter: string;
  readonly verdictBefore: string;
  readonly verdictAfter: string;
  /** Layer-pair keys of blocking rows present only before / only after. */
  readonly lostPairs: readonly string[];
  readonly gainedPairs: readonly string[];
  /** File-level keys of blocking rows present only before / only after (canonical paths). */
  readonly lostFiles: readonly string[];
  readonly gainedFiles: readonly string[];
  /** The task's invariance: the defining-rule verdict and the set of blocking (rule, layer pair) keys unchanged. */
  readonly invariant: boolean;
  /** Stricter: also the set of blocking (rule, file, target) keys unchanged after mapping files. */
  readonly invariantFiles: boolean;
  /** Advisory rows (layer-pair keys) changed; reported, not part of invariance. */
  readonly advisoryChanged: boolean;
}

/**
 * Defining-rule verdict: each defining rule violated or not, whatever its tier (three DDD variants plant a rule that
 * is advisory under the DDD tiers); with no defining rule, the overall v1.3 verdict.
 */
function definingVerdict(rules: readonly string[], s: RunSummary): string {
  if (rules.length === 0) return `verdict:${s.verdict}`;
  return rules.map((r) => `${r}:${[...s.blocking, ...s.advisory].some((x) => x.ruleId === r) ? 'violated' : 'clean'}`).join(',');
}

export function compareRuns(
  model: LayerModel,
  definingRules: readonly string[],
  before: RunSummary,
  after: RunSummary,
  origCanon: Readonly<Record<string, string>>,
  newCanon: Readonly<Record<string, string>>,
): Comparison {
  const pairs = (s: RunSummary): Set<string> => new Set(s.blocking.map((r) => layerPairKey(model, r)));
  const cb = (p: string): string => origCanon[p] ?? p;
  const ca = (p: string): string => newCanon[p] ?? p;
  const fb = new Set(before.blocking.map((r) => fileKey(cb, r)));
  const fa = new Set(after.blocking.map((r) => fileKey(ca, r)));
  const pb = pairs(before);
  const pa = pairs(after);
  const advB = new Set(before.advisory.map((r) => layerPairKey(model, r)));
  const advA = new Set(after.advisory.map((r) => layerPairKey(model, r)));
  const lostPairs = [...pb].filter((k) => !pa.has(k)).sort();
  const gainedPairs = [...pa].filter((k) => !pb.has(k)).sort();
  const lostFiles = [...fb].filter((k) => !fa.has(k)).sort();
  const gainedFiles = [...fa].filter((k) => !fb.has(k)).sort();
  const definingBefore = definingVerdict(definingRules, before);
  const definingAfter = definingVerdict(definingRules, after);
  const invariant = definingBefore === definingAfter && lostPairs.length === 0 && gainedPairs.length === 0;
  return {
    definingRules,
    definingBefore,
    definingAfter,
    verdictBefore: before.verdict,
    verdictAfter: after.verdict,
    lostPairs,
    gainedPairs,
    lostFiles,
    gainedFiles,
    invariant,
    invariantFiles: invariant && lostFiles.length === 0 && gainedFiles.length === 0,
    advisoryChanged: advB.size !== advA.size || [...advB].some((k) => !advA.has(k)),
  };
}

/** Reduces the CLI's JSON output to the rows the comparison needs (paths project-relative). */
export function summariseCliOutput(parsed: {
  violations?: { functionId?: unknown; filePath?: unknown; target?: unknown }[];
  tiers?: { verdict?: unknown; blocking?: { rules?: { functionId?: unknown }[] } };
}, normalise: (p: string) => string): RunSummary {
  const blockingRules = (parsed.tiers?.blocking?.rules ?? []).map((r) => String(r.functionId)).sort();
  const set = new Set(blockingRules);
  const rows: Row[] = (parsed.violations ?? [])
    .filter((v) => typeof v.functionId === 'string' && typeof v.filePath === 'string')
    .map((v) => {
      const target = typeof v.target === 'string' && v.target !== '' ? normalise(v.target) : undefined;
      return { ruleId: v.functionId as string, file: normalise(v.filePath as string), ...(target !== undefined ? { target } : {}) };
    });
  return {
    verdict: typeof parsed.tiers?.verdict === 'string' ? parsed.tiers.verdict : 'unknown',
    blockingRules,
    blocking: rows.filter((r) => set.has(r.ruleId)),
    advisory: rows.filter((r) => !set.has(r.ruleId)),
  };
}
