/**
 * R15 (Docs/v1.3/post-merge-review-2026-10-16.md): `=~` is Java `Pattern.matches` (Docs/v1.3/cypher-interpreter.md T12).
 * Java-only constructs are rejected, not approximated; constructs whose JavaScript meaning differs are translated to the
 * Java meaning or rejected. Every pattern the compiler and the parity sweep bind must keep compiling and matching.
 */
import { MemoryGraphRepository } from '../../../src/cypher-interp/repository.js';
import { javaRegex } from '../../../src/cypher-interp/functions.js';
import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';
import { compilePattern } from '../../../src/fitness-compiler/pattern-compiler.js';
import { SETTER_NAME_PATTERN } from '../../../src/fitness-compiler/ddd-templates.js';
import { COMPOSITION_ROOT_GLOBS, DECLARATION_ONLY_GLOBS } from '../../../src/fitness-compiler/role-exemptions.js';
import {
  APG2_COMPOSITION_ROOT_NAME_PATTERNS, APG2_TEST_COMPOSITION_ROOT_PATTERNS, APG2_TEST_FILE_PATTERNS,
} from '../../../src/shared/apg2-scope.js';

const repo = new MemoryGraphRepository();

/** `$s =~ $p` on the interpreter: true/false/null, or the error code. */
async function match(s: string, p: string): Promise<unknown> {
  const r = await repo.executeQuery('RETURN $s =~ $p AS x', { s, p });
  if (!r.success) return r.errors[0]?.code;
  return r.data.records[0]?.x;
}

const UNSUPPORTED = 'CypherInterp.Unsupported';
const c = (...cps: number[]): string => String.fromCodePoint(...cps);

describe('cypher-interp: Java regular expressions (R15)', () => {
  it('R15: (?m) does not relax the whole-input match', async () => {
    expect(await match('a\nb', '(?m)b')).toBe(false);
    expect(await match('a\nb', '(?m)a')).toBe(false);
    expect(await match('a\nb', '(?m)a$\\n^b')).toBe(true);
    expect(await match('a\nb', 'a$\\n^b')).toBe(false);
    expect(await match('b', '(?m)b')).toBe(true);
  });
  it('R15: (?s) lets . match a line terminator, and . alone does not', async () => {
    expect(await match('a\nb', '(?s)a.b')).toBe(true);
    expect(await match('a\nb', 'a.b')).toBe(false);
    expect(await match(`a${c(0x85)}b`, 'a.b')).toBe(false); // NEL is a Java line terminator
    expect(await match(`a${c(0x85)}b`, '(?s)a.b')).toBe(true);
  });
  it('R15: . and glob ? match one code point, not one UTF-16 unit', async () => {
    const path = `src/${c(0x1f600)}.ts`;
    expect(await match(path, '^src/.\\.ts$')).toBe(true);
    expect(await match(path, globToRegex('src/?.ts'))).toBe(true);
    expect(await match(path, '^src/..\\.ts$')).toBe(false);
    expect(await match(c(0x1f600), '[^/]')).toBe(true);
  });
  it('R15: rejects Java-only escapes and class operators instead of reading them as JavaScript', async () => {
    for (const p of ['\\p{Lu}.*', '\\P{L}', '\\h', '\\H', '\\R', '\\X', '\\v', '\\V', '\\x{41}', '[a-z&&[^e]]', '[a[b]]', '\\G', '\\0101', '\\cA', '[\\h]', '[\\p{L}]', '[\\v]']) {
      expect([p, await match('Order', p)]).toEqual([p, UNSUPPORTED]);
    }
  });
  it('R15: still rejects \\Q \\E \\A \\Z \\z, possessive quantifiers, atomic groups and inline flags mid-pattern', async () => {
    for (const p of ['\\Qa.b\\E', 'a\\E', '\\Aa', 'a\\Z', 'a\\z', 'a*+', 'a++', 'a?+', 'a{2}+', '(?>a)', 'a(?i)b', '(?i:a)', '(?x)a', '(?d)a']) {
      expect([p, await match('a', p)]).toEqual([p, UNSUPPORTED]);
    }
  });
  it('R15: an escaped backslash followed by Q, E, A, Z or z is a literal backslash, not \\Q', async () => {
    expect(await match('a\\Q', 'a\\\\Q')).toBe(true);
    expect(await match('\\E', '\\\\E')).toBe(true);
    expect(await match('x\\z', 'x\\\\z')).toBe(true);
    expect(await match('\\Z', '[\\\\]Z')).toBe(true);
  });
  it('R15: (?i) is ASCII-only unless (?u) is given', async () => {
    expect(await match('ABC', '(?i)a[b-c]+')).toBe(true);
    expect(await match(c(0xc9), `(?i)${c(0xe9)}`)).toBe(false);
    expect(await match(c(0xc9), `(?iu)${c(0xe9)}`)).toBe(true);
    expect(await match(c(0x212a), '(?i)k')).toBe(false); // KELVIN SIGN folds to k only under Unicode case
    expect(await match(c(0x17f), '(?i)[r-t]')).toBe(false); // LONG S
    expect(await match('K', '(?i)[^k]')).toBe(false);
    expect(await match('Q', '(?i)\\x71')).toBe(true);
    expect(await match('setX', SETTER_NAME_PATTERN)).toBe(true);
  });
  it('R15: \\s is the ASCII whitespace class, as in Java', async () => {
    expect(await match(' \t', '\\s+')).toBe(true);
    expect(await match(c(0x2003), '\\s')).toBe(false);
    expect(await match(c(0xa0), '[\\s]')).toBe(false);
    expect(await match(c(0x2003), '\\S')).toBe(true);
    expect(await match('a', '[\\S]')).toBe(UNSUPPORTED);
  });
  it('R15: Java identity escapes and lone } or ] are literals, as in Java', async () => {
    expect(await match('a-b', 'a\\-b')).toBe(true);
    expect(await match('<x>', '\\<x\\>')).toBe(true);
    expect(await match('a@b#c', 'a\\@b\\#c')).toBe(true);
    expect(await match('a}', 'a}')).toBe(true);
    expect(await match('a]', 'a]')).toBe(true);
    expect(await match('a/b', 'a\\/b')).toBe(true);
    expect(await match('a-', '[a\\-]+')).toBe(true);
    expect(await match('<', '[\\<]')).toBe(true);
  });
  it('R15: an invalid pattern is a runtime error, not an internal error', async () => {
    expect(await match('a', 'a(')).toBe('Neo.ClientError.Statement.ArgumentError');
    expect(await match('a', '\\y')).toBe('Neo.ClientError.Statement.ArgumentError');
  });

  /**
   * Every `=~` operand the templates receive: `globToRegex` / `compilePattern` output, the fixed literals and the
   * parity sweep's bindings. Each must compile and match exactly as the previous (non-`u`, `^(?:...)$`) translation did
   * on BMP strings without line terminators, so no catalogue result changes.
   */
  it('R15: every compiler, template and sweep pattern compiles and matches as before', () => {
    const printable = Array.from({ length: 0x7f - 0x20 }, (_, i) => String.fromCharCode(0x20 + i));
    const globs = [
      ...printable, ...printable.map((ch) => `src/${ch}x/**`), ...printable.map((ch) => `**/a${ch}?.ts`),
      ...COMPOSITION_ROOT_GLOBS, ...DECLARATION_ONLY_GLOBS,
      'src/domain/**', 'src/**/*.spec.ts', '**/*.{ts,tsx}', 'src/[abc]/x.ts', 'src/(a|b)/x+y$.ts', 'a\\b', `src/caf${c(0xe9)}/*.ts`, '?', '*', '**',
    ];
    const patterns = [
      ...globs.map((g) => globToRegex(g)), ...globs.map((g) => globToRegex(g, { segmentGlobstar: true })),
      ...['*Service', '*Repository|*Repo', 'I*', '*Service|*UseCase|*Handler', 'set?*', 'A.B|C+D', '[x]|(y)|{z}|^w$'].map(compilePattern),
      SETTER_NAME_PATTERN, '.*', '.*(Repository|Repo)(Impl)?',
      ...APG2_TEST_FILE_PATTERNS, ...APG2_TEST_COMPOSITION_ROOT_PATTERNS, ...APG2_COMPOSITION_ROOT_NAME_PATTERNS,
      // scripts/v1.3/memory-parity.ts sweep bindings
      '^[A-Z][A-Za-z0-9]*$', '^[A-Z].*', '.*(Service|UseCase|Handler)$', '.*\\.spec\\.ts$', '.*/main\\.ts$', '.*/index\\.ts$', '.*/acl/.*',
      'src/ctx\\.a/.*domain.*', '.*[Rr]epositor.*', '.*(domain|model).*', '.*(application|service).*', '^set[A-Z].*', '^$', '^__no_such_path__$',
    ];
    const subjects = [
      '', 'a', 'src/domain/order.ts', 'src/domain/order.spec.ts', 'src/main.ts', 'apps/x/src/app.module.ts', 'src/dto/a.dto.ts',
      'src/__tests__/a.ts', 'src/test/a.ts', 'src/testContainer.ts', 'src/TestContainer.ts', 'src/container.ts', 'src/acl/x.ts',
      'src/a/index.ts', 'OrderService', 'OrderRepository', 'OrderRepoImpl', 'setX', 'set', 'setx', 'IOrder', 'A.B', 'C+D', '[x]', '(y)', '{z}',
      `src/caf${c(0xe9)}/a.ts`, 'src/ctx.a/x/domain/y.ts', ...printable, ...printable.map((ch) => `src/${ch}x/a.ts`), ...printable.map((ch) => `q/a${ch}b.ts`),
    ];
    for (const p of patterns) {
      let re: RegExp;
      try {
        re = javaRegex(p);
      } catch (e) {
        throw new Error(`${JSON.stringify(p)} no longer compiles: ${String(e)}`);
      }
      const old = new RegExp(`^(?:${p})$`);
      for (const s of subjects) {
        if (re.test(s) !== old.test(s)) throw new Error(`${JSON.stringify(p)} on ${JSON.stringify(s)}: ${String(re.test(s))}, was ${String(old.test(s))}`);
      }
    }
  });
});
