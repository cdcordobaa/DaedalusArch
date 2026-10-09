/**
 * Static import check shared by the BR-U5b-55 whitelist test (`imports.test.ts`) and the U6 SO2 measurement-script
 * whitelist (`tests/unit/scripts/so2-imports.test.ts`, ADR-021 item 8). Not a test file: it registers no test.
 */
import { dirname, relative, resolve } from 'node:path';
import { Node, Project, SyntaxKind } from 'ts-morph';

/** What a script may import besides `scripts/**`, `node:*` and type-only `src/shared/types/**`. */
export interface ImportPolicy {
  readonly packages: ReadonlySet<string>;
  readonly src: ReadonlySet<string>;
}

interface ImportUse {
  readonly specifier: string;
  readonly typeOnly: boolean;
}

export function importsOf(fileName: string, text: string): ImportUse[] {
  const project = new Project({ useInMemoryFileSystem: true, skipAddingFilesFromTsConfig: true });
  const sf = project.createSourceFile(fileName, text);
  const uses: ImportUse[] = [];
  for (const d of sf.getImportDeclarations()) {
    const typeOnly = d.isTypeOnly() || (d.getNamedImports().length > 0 && d.getDefaultImport() === undefined
      && d.getNamespaceImport() === undefined && d.getNamedImports().every((n) => n.isTypeOnly()));
    uses.push({ specifier: d.getModuleSpecifierValue(), typeOnly });
  }
  for (const d of sf.getExportDeclarations()) {
    const spec = d.getModuleSpecifierValue();
    if (spec !== undefined) uses.push({ specifier: spec, typeOnly: d.isTypeOnly() });
  }
  sf.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    const isDynamicImport = callee.getKind() === SyntaxKind.ImportKeyword;
    const isRequire = Node.isIdentifier(callee) && callee.getText() === 'require';
    if (!isDynamicImport && !isRequire) return;
    const arg = node.getArguments()[0];
    uses.push({ specifier: arg !== undefined && Node.isStringLiteral(arg) ? arg.getLiteralValue() : `<non-literal ${arg?.getText() ?? ''}>`, typeOnly: false });
  });
  return uses;
}

/** Returns the disallowed imports of one file (repo-relative `file`, its `text`) under `policy`. */
export function disallowedImportsUnder(policy: ImportPolicy, file: string, text: string, root: string): string[] {
  const bad: string[] = [];
  for (const { specifier, typeOnly } of importsOf(file, text)) {
    if (specifier.startsWith('node:')) continue;
    if (!specifier.startsWith('.')) {
      const pkg = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : (specifier.split('/')[0] ?? specifier);
      if (!policy.packages.has(pkg)) bad.push(`${file}: package ${specifier}`);
      continue;
    }
    const target = relative(root, resolve(root, dirname(file), specifier)).replace(/\.js$/, '.ts');
    if (target.startsWith('scripts/')) continue;
    if (policy.src.has(target)) continue;
    if (typeOnly && target.startsWith('src/shared/types/')) continue;
    bad.push(`${file}: ${typeOnly ? 'type-only ' : ''}${target}`);
  }
  return bad;
}

