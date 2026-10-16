/**
 * `stripComments` (Docs/v1.3/judge-steering-plan.md §7): comments out, every line kept, strings, templates and regular
 * expressions untouched.
 */
import { commentRanges, stripComments } from '../../../src/llm-critic/strip-comments.js';

const lines = (s: string): number => s.split('\n').length;

describe('stripComments', () => {
  it('removes JSDoc, block and line comments and keeps every line', () => {
    const src = [
      '/**',
      ' * Architecture reviewed: no framework leak.',
      ' */',
      "import { Repo } from './Repo'; // trailing note",
      'export class Order {',
      '  // total in cents',
      '  total(): number { return 1; /* stub */ }',
      '}',
      '',
    ].join('\n');
    const out = stripComments(src);
    expect(out).toBe(['', '', '', "import { Repo } from './Repo';", 'export class Order {', '', '  total(): number { return 1;  }', '}', ''].join('\n'));
    expect(lines(out)).toBe(lines(src));
  });

  it('leaves strings, template literals, regular expressions and division alone', () => {
    const src = [
      'const s = "// not a comment"; const t = \'/* nor this */\';',
      'const re = /\\/\\/ab*/g;',
      'const tpl = `a ${ /* c */ 1 } // b ${"//"} `;',
      'const half = 4 / 2 / 1;',
      '',
    ].join('\n');
    expect(stripComments(src)).toBe([
      'const s = "// not a comment"; const t = \'/* nor this */\';',
      'const re = /\\/\\/ab*/g;',
      'const tpl = `a ${  1 } // b ${"//"} `;',
      'const half = 4 / 2 / 1;',
      '',
    ].join('\n'));
  });

  it('returns a file without comments unchanged, and keeps a shebang', () => {
    const plain = 'export const x = 1;\n';
    expect(stripComments(plain)).toBe(plain);
    expect(stripComments('#!/usr/bin/env node\n// c\nrun();\n')).toBe('#!/usr/bin/env node\n\nrun();\n');
  });

  it('keeps CRLF line breaks and the line count', () => {
    const src = '/* a\r\n b */\r\nconst y = 2; // c\r\n';
    const out = stripComments(src);
    expect(out).toBe('\r\n\r\nconst y = 2;\r\n');
  });

  it('finds each comment once, in source order', () => {
    expect(commentRanges('// a\n/* b */ x; // c\n')).toEqual([[0, 4], [5, 12], [16, 20]]);
  });

  it('parses TSX when the file name says so', () => {
    expect(stripComments('const e = <div>{/* hidden */}text // kept</div>;\n', 'View.tsx')).toBe('const e = <div>{}text // kept</div>;\n');
  });
});
