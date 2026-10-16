import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { stripComments } from '../../../../../scripts/v1.3/lib/labelling/excerpt-scrub.js';
import { excerpt } from '../../../../../scripts/v1.3/lib/labelling/meaningful-prompt.js';

const REPO = path.resolve(__dirname, '../../../../..');
const AUDIT_SHEET = path.join(REPO, 'audit/view/v1.3-labels-audit.md');

/** Words that reveal a fixture's intended answer. */
const LEAK = /violat|near|miss|FF-|planted|expected/i;

/** The text of a code excerpt with identifiers and keywords removed (an identifier such as `expectedTotal` is code). */
function nonIdentifierText(code: string): string {
  const sc = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, code);
  const parts: string[] = [];
  for (let k = sc.scan(); k !== ts.SyntaxKind.EndOfFileToken; k = sc.scan()) {
    if (k === ts.SyntaxKind.Identifier || (k >= ts.SyntaxKind.FirstKeyword && k <= ts.SyntaxKind.LastKeyword)) continue;
    parts.push(sc.getTokenText());
  }
  return parts.join(' ');
}

/** The code blocks of a sheet, with the `    n | ` line-number prefix cut. */
function excerptBlocks(md: string): string[] {
  return [...md.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => (m[1] ?? '').split('\n').map((l) => l.replace(/^\s*\d+ \| ?/, '')).join('\n'));
}

describe('stripComments', () => {
  it('removes line comments and keeps the line count', () => {
    const src = ['const a = 1; // VIOLATION (value-object immutability)', '// near-miss: FF-P01', 'const b = 2;'].join('\n');
    const out = stripComments(src);
    expect(out.split('\n')).toEqual(['const a = 1;', '', 'const b = 2;']);
  });

  it('removes block and JSDoc comments, keeping the line breaks inside them', () => {
    const src = ['/**', ' * VIOLATION (planted): expected to fire.', ' * @param x the value', ' */', 'export function f(x: number) { return /* inline */ x; }', 'const y = 1;'].join('\n');
    const out = stripComments(src).split('\n');
    expect(out).toHaveLength(6);
    expect(out.slice(0, 4)).toEqual(['', '', '', '']);
    expect(out[4]).toBe('export function f(x: number) { return  x; }');
    expect(out[5]).toBe('const y = 1;');
  });

  it('keeps // and /* inside string, template and regular expression literals', () => {
    const src = [
      "const url = 'https://example.com/a'; // trailing note",
      'const s = "/* not a comment */";',
      'const t = `a // b ${url} /* c */`;',
      'const re = /\\/\\/.*$/g;',
    ].join('\n');
    const out = stripComments(src).split('\n');
    expect(out[0]).toBe("const url = 'https://example.com/a';");
    expect(out[1]).toBe('const s = "/* not a comment */";');
    expect(out[2]).toBe('const t = `a // b ${url} /* c */`;');
    expect(out[3]).toBe('const re = /\\/\\/.*$/g;');
  });

  it('returns comment-free text unchanged (apart from CRLF)', () => {
    const src = 'import { X } from "./x";\r\nexport class Y {}\r\n';
    expect(stripComments(src)).toBe('import { X } from "./x";\nexport class Y {}\n');
  });

  it('leaves the excerpt numbered by the original lines', () => {
    const src = ['/** header', ' * VIOLATION */', 'export class Quantity {', '  // near-miss', '  set value(v: number) {}', '}'].join('\n');
    const ex = excerpt(src, 5, 1).split('\n');
    expect(ex).toEqual(['    4 | ', '    5 |   set value(v: number) {}', '    6 | }']);
    expect(LEAK.test(excerpt(src, 3))).toBe(false);
  });
});

describe('answer leak check', () => {
  it('flags leak words in comments but not in identifiers', () => {
    expect(LEAK.test(nonIdentifierText('const expectedTotal = missing; // VIOLATION'))).toBe(true);
    expect(LEAK.test(nonIdentifierText(stripComments('const expectedTotal = missing; // VIOLATION')))).toBe(false);
  });

  it('the author audit sheet has no answer-revealing text in any excerpt outside identifiers', () => {
    const blocks = excerptBlocks(fs.readFileSync(AUDIT_SHEET, 'utf8'));
    expect(blocks.length).toBeGreaterThanOrEqual(30);
    const leaks = blocks.flatMap((b, i) => (LEAK.test(nonIdentifierText(b)) ? [`A${String(i + 1).padStart(3, '0')}`] : []));
    expect(leaks).toEqual([]);
  });
});
