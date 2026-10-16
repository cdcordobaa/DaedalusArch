/**
 * Helpers of `scripts/v1.3/default-view-coverage.ts`: the sub-class of a barrel edge (how the barrel exports a name)
 * and of a `require()` / `import()` edge (the call form). Pure over a ts-morph source file.
 */
import { Node, SyntaxKind } from 'ts-morph';
import type { SourceFile, Symbol as MorphSymbol } from 'ts-morph';

/** How a barrel exports one name, as the first hop of a re-export chain. */
export type ExportForm =
  | 'named-reexport'      // export { A } from './a'
  | 'renamed-reexport'    // export { A as B } from './a', export { default as B } from './a'
  | 'export-star'         // export * from './a'
  | 'namespace-reexport'  // export * as ns from './a'
  | 'local-reexport'      // import { A } from './a'; export { A }  /  export default A
  | 'declared'            // declared in the file itself
  | 'unknown';

/** How `barrel` exports `name` (`'default'` for the default export). */
export function exportForm(barrel: SourceFile, name: string): ExportForm {
  const sym = name === 'default' ? barrel.getDefaultExportSymbol() : barrel.getExportSymbols().find((s) => s.getName() === name);
  return sym === undefined ? 'unknown' : formOfSymbol(sym, barrel);
}

function formOfSymbol(sym: MorphSymbol, barrel: SourceFile): ExportForm {
  const decl = sym.getDeclarations()[0];
  if (decl === undefined) return 'unknown';
  // An `export *` name is not an alias in the barrel: the checker hands back the declaration in the other file.
  if (decl.getSourceFile() !== barrel) return 'export-star';
  if (Node.isExportSpecifier(decl)) {
    if (decl.getExportDeclaration().getModuleSpecifierValue() === undefined) return 'local-reexport';
    const alias = decl.getAliasNode();
    return alias !== undefined && alias.getText() !== decl.getNameNode().getText() ? 'renamed-reexport' : 'named-reexport';
  }
  if (Node.isNamespaceExport(decl)) return 'namespace-reexport';
  if (Node.isExportAssignment(decl)) {
    const expr = decl.getExpression();
    return Node.isIdentifier(expr) && (expr.getSymbol()?.isAlias() ?? false) ? 'local-reexport' : 'declared';
  }
  return 'declared';
}

/** Form of a `require()` / `import()` call. */
export type CallForm =
  | 'dynamic-import'        // import('./a')
  | 'require:destructured'  // const { a } = require('./a')
  | 'require:member'        // require('./a').default
  | 'require:assigned'      // const a = require('./a')
  | 'require:bare'          // require('./a') as a statement or an argument
  | 'unknown';

/** The form of the first `require()` / `import()` call that starts on `line` (1-based) of `sf`. */
export function callForm(sf: SourceFile, line: number): CallForm {
  for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    if (call.getStartLineNumber() !== line) continue;
    const callee = call.getExpression();
    if (callee.getKind() === SyntaxKind.ImportKeyword) return 'dynamic-import';
    if (!(Node.isIdentifier(callee) && callee.getText() === 'require')) continue;
    const parent = call.getParent();
    if (Node.isVariableDeclaration(parent)) return Node.isObjectBindingPattern(parent.getNameNode()) ? 'require:destructured' : 'require:assigned';
    if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === call) return 'require:member';
    return 'require:bare';
  }
  return 'unknown';
}

/** A tsconfig `paths` / `baseUrl` specifier (not relative, not absolute). */
export function isAliasSpecifier(specifier: string): boolean {
  return !(specifier.startsWith('.') || specifier.startsWith('/'));
}
