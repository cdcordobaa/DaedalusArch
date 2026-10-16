/**
 * Lexical scan of one TypeScript/JavaScript source text for `check_file` and `check_diff`: the module specifiers it
 * imports (static `import`/`export ... from`, `import x = require('x')`, side-effect `import 'x'`, plain `require('x')`
 * and `import('x')`) and the classes
 * it declares (name, line, decorators). Regex-based on a copy with comments blanked out, so it needs no compiler and
 * works on partial text (the added lines of a diff). Line numbers are 1-based in the scanned text. Pure.
 */

export interface ScannedImport {
  readonly specifier: string;
  readonly line: number;
  /**
   * `type` for `import type` / `export type` (erased at runtime, still an IMPORTS edge in the graph). `require` and
   * `dynamic` are string-literal calls: the frozen v1.2E extractor only counted them (BR-U2-25), the v1.3 extractor
   * models them as IMPORTS edges (`dynamicImports`), and `check_file` scores them as v1.3 does (R03).
   */
  readonly kind: 'static' | 'type' | 'side-effect' | 'require' | 'dynamic';
}

export interface ScannedClass {
  readonly name: string;
  readonly line: number;
  readonly decorators: readonly string[];
}

export interface SourceScan {
  readonly imports: readonly ScannedImport[];
  readonly classes: readonly ScannedClass[];
}

/**
 * `text` with every comment replaced by spaces (newlines kept), so offsets and line numbers are unchanged. String and
 * template literals are skipped over, so `'http://x'` is not read as a comment.
 */
export function blankComments(text: string): string {
  const out = text.split('');
  let i = 0;
  const n = text.length;
  const blank = (from: number, to: number): void => {
    for (let k = from; k < to; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '/' && next === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? n : end;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? n : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < n && text[i] !== c) {
        if (text[i] === '\\') i++;
        else if (c !== '`' && text[i] === '\n') break;
        i++;
      }
      i++;
    } else {
      i++;
    }
  }
  return out.join('');
}

function lineAt(text: string, offset: number): number {
  let line = 1;
  for (let k = 0; k < offset && k < text.length; k++) if (text[k] === '\n') line++;
  return line;
}

const FROM_RE = /\b(import|export)(\s+type)?\b[^'";]*?\bfrom\s*(['"])([^'"\n]+)\3/g;
const SIDE_EFFECT_RE = /\bimport\s*(['"])([^'"\n]+)\1/g;
const IMPORT_EQUALS_RE =
  /\bimport\s+(?:type\s+)?[A-Za-z_$][\w$]*\s*=\s*(require\s*\(\s*(['"])([^'"\n]+)\2\s*\))/g;
const REQUIRE_RE = /\brequire\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const DYNAMIC_RE = /\bimport\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g;
const CLASS_RE =
  /((?:@[A-Za-z_$][\w$.]*(?:\([^)]*\))?\s*)*)(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g;
const DECORATOR_RE = /@([A-Za-z_$][\w$.]*)/g;

export function scanSource(text: string): SourceScan {
  const code = blankComments(text);
  const imports: ScannedImport[] = [];
  const seen = new Set<number>();
  const push = (offset: number, specifier: string, kind: ScannedImport['kind']): void => {
    if (seen.has(offset)) return;
    seen.add(offset);
    imports.push({ specifier, line: lineAt(code, offset), kind });
  };
  for (const m of code.matchAll(FROM_RE)) {
    push(m.index, m[4] ?? '', m[2] !== undefined ? 'type' : 'static');
  }
  for (const m of code.matchAll(SIDE_EFFECT_RE)) push(m.index, m[2] ?? '', 'side-effect');
  for (const m of code.matchAll(IMPORT_EQUALS_RE)) {
    push(m.index + m[0].length - (m[1] ?? '').length, m[3] ?? '', 'static');
  }
  for (const m of code.matchAll(REQUIRE_RE)) push(m.index, m[2] ?? '', 'require');
  for (const m of code.matchAll(DYNAMIC_RE)) push(m.index, m[2] ?? '', 'dynamic');
  imports.sort((a, b) => a.line - b.line);

  const classes: ScannedClass[] = [];
  for (const m of code.matchAll(CLASS_RE)) {
    const decoratorText = m[1] ?? '';
    const decorators = [...decoratorText.matchAll(DECORATOR_RE)].map((d) => d[1] ?? '');
    const classOffset = m.index + decoratorText.length;
    classes.push({ name: m[2] ?? '', line: lineAt(code, classOffset), decorators });
  }
  return { imports, classes };
}
