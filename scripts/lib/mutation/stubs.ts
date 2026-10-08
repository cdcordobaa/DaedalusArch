/**
 * Stub packages on failed module resolution only (FR-v1.2E-24; Q2; ADR-015 item 7; BR-U5a-10 with the R2 stub
 * content rule).
 *
 * - A use is `{ specifier, fromFile, form, name? }`: the base's own imports (`collectImportUses`) plus the imports
 *   an operator edit will add (passed by the caller). The same use list is given to the baseline copy and to the
 *   mutant copy, so both get byte-identical stubs (BR-U5a-10 c).
 * - Per bare specifier, `ts.resolveModuleName` (the TypeScript re-exported by ts-morph, as U2 D-U2-3) is asked
 *   from each importing file under the base tsconfig. A stub is written only when resolution fails **and** no
 *   directory of that package exists in any ancestor `node_modules` of an importing file (never over a package;
 *   ghostfolio's monorepo root included). Relative, absolute and `node:` specifiers are never stubbed.
 * - Stub = `<copy>/node_modules/<specifier>/package.json` (`"types": "index.d.ts"`) + `index.d.ts`, whose content
 *   is a pure function of the sorted (form, name) list: named `X` → `export declare const X: any;`, a class used
 *   with `new`/`extends` → `export declare class X { [key: string]: any; constructor(...args: any[]); }`, any
 *   default import → `declare const _default: any; export default _default;`; a specifier used only through
 *   namespace imports or an import-equals declaration (`import x = …`) → `declare const _ns: any; export = _ns;`. A mix of namespace
 *   with named/default forms gets the named/default form (any remaining error fails BR-U5a-07, never patched).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ts } from 'ts-morph';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProvisionedStub } from './types.js';

export type ImportForm = 'default' | 'named' | 'named-class' | 'namespace';

export interface ImportUse {
  readonly specifier: string;
  /** POSIX, relative to the copy root. */
  readonly fromFile: string;
  readonly form: ImportForm;
  /** Imported (not local) name; named forms only. */
  readonly name?: string;
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** A bare package specifier (not relative, not absolute, not `node:`). */
export function isBareSpecifier(specifier: string): boolean {
  return (
    specifier.length > 0 &&
    !specifier.startsWith('.') &&
    !specifier.startsWith('/') &&
    !specifier.startsWith('node:') &&
    !path.isAbsolute(specifier)
  );
}

/** `@scope/name/sub` → `@scope/name`; `name/sub` → `name`. */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/** Parsed compiler options and root file names of the copy's tsconfig. */
export function readTsconfig(copyRoot: string, tsconfigRel: string): DomainResult<{ options: ts.CompilerOptions; fileNames: readonly string[] }> {
  const file = path.resolve(copyRoot, ...tsconfigRel.split('/'));
  const read = ts.readConfigFile(file, (p) => ts.sys.readFile(p));
  if (read.error !== undefined) {
    return DomainResult.fail([{ code: 'MUT_TSCONFIG_INVALID', message: `cannot read ${tsconfigRel}: ${ts.flattenDiagnosticMessageText(read.error.messageText, ' ')}` }]);
  }
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, path.dirname(file), undefined, file);
  return DomainResult.ok({ options: parsed.options, fileNames: parsed.fileNames });
}

function toPosixRel(root: string, abs: string): string {
  return path.relative(root, abs).split(path.sep).join('/');
}

/**
 * Bare-specifier imports of the base's tsconfig files: default, named (imported name; `named-class` when the local
 * binding is used with `new` or in an `extends` clause), namespace (`import * as`, import-equals).
 * Type-only and side-effect-only imports contribute their forms the same way; re-exports are not imports.
 */
export function collectImportUses(copyRoot: string, tsconfigRel: string): DomainResult<readonly ImportUse[]> {
  const cfg = readTsconfig(copyRoot, tsconfigRel);
  if (!cfg.success) return cfg;
  const uses: ImportUse[] = [];
  for (const abs of cfg.data.fileNames) {
    if (abs.split(/[\\/]/).includes('node_modules')) continue;
    const fromFile = toPosixRel(copyRoot, abs);
    const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true);
    const classLocals = new Set<string>();
    const visit = (node: ts.Node): void => {
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) classLocals.add(node.expression.text);
      if (ts.isHeritageClause(node) && node.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(node.parent)) {
        for (const t of node.types) if (ts.isIdentifier(t.expression)) classLocals.add(t.expression.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    for (const stmt of sf.statements) {
      if (ts.isImportDeclaration(stmt) && ts.isStringLiteral(stmt.moduleSpecifier)) {
        const specifier = stmt.moduleSpecifier.text;
        if (!isBareSpecifier(specifier)) continue;
        const clause = stmt.importClause;
        if (clause === undefined) continue;
        if (clause.name !== undefined) uses.push({ specifier, fromFile, form: 'default' });
        const nb = clause.namedBindings;
        if (nb !== undefined && ts.isNamespaceImport(nb)) uses.push({ specifier, fromFile, form: 'namespace' });
        if (nb !== undefined && ts.isNamedImports(nb)) {
          for (const el of nb.elements) {
            const name = (el.propertyName ?? el.name).text;
            if (name === 'default') {
              uses.push({ specifier, fromFile, form: 'default' });
              continue;
            }
            uses.push({ specifier, fromFile, form: classLocals.has(el.name.text) ? 'named-class' : 'named', name });
          }
        }
      } else if (
        ts.isImportEqualsDeclaration(stmt) &&
        ts.isExternalModuleReference(stmt.moduleReference) &&
        ts.isStringLiteral(stmt.moduleReference.expression) &&
        isBareSpecifier(stmt.moduleReference.expression.text)
      ) {
        uses.push({ specifier: stmt.moduleReference.expression.text, fromFile, form: 'namespace' });
      }
    }
  }
  return DomainResult.ok(uses);
}

/** `index.d.ts` content for one specifier: a pure function of the sorted (form, name) list. */
export function stubContent(uses: readonly ImportUse[]): string {
  const classes = new Set<string>();
  const consts = new Set<string>();
  let hasDefault = false;
  let hasNamespace = false;
  for (const u of uses) {
    if (u.form === 'default') hasDefault = true;
    else if (u.form === 'namespace') hasNamespace = true;
    else if (u.name !== undefined) (u.form === 'named-class' ? classes : consts).add(u.name);
  }
  for (const c of classes) consts.delete(c);
  const lines: string[] = [];
  if (classes.size === 0 && consts.size === 0 && !hasDefault) {
    if (hasNamespace) lines.push('declare const _ns: any;', 'export = _ns;');
  } else {
    const named = [...[...classes].map((n) => ['named-class', n] as const), ...[...consts].map((n) => ['named', n] as const)].sort(
      (a, b) => cmp(a[1], b[1]) || cmp(a[0], b[0]),
    );
    for (const [form, n] of named) {
      lines.push(
        form === 'named-class'
          ? `export declare class ${n} { [key: string]: any; constructor(...args: any[]); }`
          : `export declare const ${n}: any;`,
      );
    }
    if (hasDefault) lines.push('declare const _default: any;', 'export default _default;');
  }
  return `${lines.join('\n')}\n`;
}

function packageJsonContent(specifier: string): string {
  return `${JSON.stringify({ name: specifier, version: '0.0.0-u5a-stub', private: true, types: 'index.d.ts' }, null, 2)}\n`;
}

/** True when `<ancestor>/node_modules/<package>` exists for any ancestor directory of `fromAbs`. */
export function packageDirOnResolutionPath(fromAbs: string, packageName: string): boolean {
  let dir = path.dirname(fromAbs);
  for (;;) {
    if (fs.existsSync(path.join(dir, 'node_modules', ...packageName.split('/')))) return true;
    const parent = path.dirname(dir);
    if (parent === dir) return false;
    dir = parent;
  }
}

/**
 * Writes a stub for every bare specifier whose resolution fails from an importing file and that has no package
 * directory on that file's resolution path; returns `provisionedStubs[]` sorted by specifier.
 */
export function provisionStubs(copyRoot: string, tsconfigRel: string, uses: readonly ImportUse[]): DomainResult<readonly ProvisionedStub[]> {
  const cfg = readTsconfig(copyRoot, tsconfigRel);
  if (!cfg.success) return cfg;
  const bySpecifier = new Map<string, ImportUse[]>();
  for (const u of uses) {
    if (!isBareSpecifier(u.specifier)) continue;
    const list = bySpecifier.get(u.specifier) ?? [];
    list.push(u);
    bySpecifier.set(u.specifier, list);
  }
  const plans: { specifier: string; uses: ImportUse[] }[] = [];
  for (const specifier of [...bySpecifier.keys()].sort(cmp)) {
    const list = bySpecifier.get(specifier) ?? [];
    const pkg = packageNameOf(specifier);
    let failed = false;
    let blocked = false;
    for (const fromFile of [...new Set(list.map((u) => u.fromFile))].sort(cmp)) {
      const fromAbs = path.resolve(copyRoot, ...fromFile.split('/'));
      const resolved = ts.resolveModuleName(specifier, fromAbs, cfg.data.options, ts.sys).resolvedModule;
      if (resolved !== undefined) continue;
      failed = true;
      if (packageDirOnResolutionPath(fromAbs, pkg)) blocked = true;
    }
    if (failed && !blocked) plans.push({ specifier, uses: list });
  }
  const stubs: ProvisionedStub[] = [];
  for (const p of plans) {
    const dir = path.join(copyRoot, 'node_modules', ...p.specifier.split('/'));
    const sorted = [...p.uses].sort((a, b) => cmp(a.form, b.form) || cmp(a.name ?? '', b.name ?? ''));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'package.json'), packageJsonContent(p.specifier), { flag: 'wx' });
    fs.writeFileSync(path.join(dir, 'index.d.ts'), stubContent(sorted), { flag: 'wx' });
    stubs.push({ specifier: p.specifier, path: toPosixRel(copyRoot, dir) });
  }
  return DomainResult.ok(stubs);
}
