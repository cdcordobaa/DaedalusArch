import {
  apiVisibleInImports, apg2Claim, cheapClaim, cell, diverseSample, excerpt, flattenTsconfig, memberLine, relativePosix, resolvePosix,
} from '../../../../scripts/v1.3/lib/wild.js';
import { mulberry32 } from '../../../../scripts/v1.3/lib/graph-fidelity.js';

describe('wild: path helpers', () => {
  it('resolves and relativises POSIX paths', () => {
    expect(resolvePosix('/a/b', '../c/./d')).toBe('/a/c/d');
    expect(resolvePosix('/a/b', '/x')).toBe('/x');
    expect(relativePosix('/r/pkg', '/r/pkg/src')).toBe('src');
    expect(relativePosix('/r/pkg', '/r/pkg')).toBe('.');
    expect(relativePosix('/r/apps/api', '/r')).toBe('../..');
  });
});

describe('wild: flattenTsconfig', () => {
  const files: Record<string, Record<string, unknown>> = {
    '/r/tsconfig.base.json': { compilerOptions: { target: 'ES2018', module: 'ESNext', baseUrl: '.', paths: { '@x/*': ['libs/x/*'] }, outDir: 'dist', types: ['jest'] } },
    '/r/apps/api/tsconfig.json': { extends: '../../tsconfig.base.json', compilerOptions: { strictNullChecks: true } },
    '/r/apps/api/tsconfig.app.json': { extends: ['./tsconfig.json', '@tsconfig/node20'], compilerOptions: { module: 'commonjs', experimentalDecorators: true, composite: true } },
  };
  const reader = { read: (p: string): Record<string, unknown> | undefined => files[p] };

  it('merges the relative extends chain base first, child options winning', () => {
    const r = flattenTsconfig('/r/apps/api/tsconfig.app.json', '/r/apps/api', reader);
    expect(r.chain).toEqual(['/r/tsconfig.base.json', '/r/apps/api/tsconfig.json', '/r/apps/api/tsconfig.app.json']);
    const co = r.tsconfig.compilerOptions;
    expect(co.module).toBe('commonjs');
    expect(co.target).toBe('ES2018');
    expect(co.strictNullChecks).toBe(true);
    expect(co.experimentalDecorators).toBe(true);
  });

  it('drops build and type-package options and forces a no-emit, ts-only program', () => {
    const co = flattenTsconfig('/r/apps/api/tsconfig.app.json', '/r/apps/api', reader).tsconfig.compilerOptions;
    for (const k of ['outDir', 'types', 'composite']) expect(co).not.toHaveProperty(k);
    expect(co).toMatchObject({ noEmit: true, skipLibCheck: true, allowJs: false });
  });

  it('rebases baseUrl to the analysis root', () => {
    expect(flattenTsconfig('/r/apps/api/tsconfig.app.json', '/r/apps/api', reader).tsconfig.compilerOptions.baseUrl).toBe('../..');
  });

  it('records a package extends it cannot follow, and follows one the reader resolves', () => {
    expect(flattenTsconfig('/r/apps/api/tsconfig.app.json', '/r/apps/api', reader).notes.join(' ')).toMatch(/@tsconfig\/node20.*not followed/);
    const files2: Record<string, Record<string, unknown>> = {
      '/r/p/tsconfig.json': { extends: '@s/config/base.json', compilerOptions: {} },
      '/r/config/base.json': { compilerOptions: { target: 'ESNext' } },
    };
    const r = flattenTsconfig('/r/p/tsconfig.json', '/r/p', { read: (p) => files2[p], resolvePackage: (s) => (s === '@s/config/base.json' ? '/r/config/base.json' : undefined) });
    expect(r.tsconfig.compilerOptions.target).toBe('ESNext');
    expect(r.chain[0]).toBe('/r/config/base.json');
  });

  it('gives paths without baseUrl the directory of the config that declared them', () => {
    const f: Record<string, Record<string, unknown>> = { '/r/tsconfig.json': { compilerOptions: { paths: { 'src/*': ['./src/*'] } } } };
    expect(flattenTsconfig('/r/tsconfig.json', '/r', { read: (p) => f[p] }).tsconfig.compilerOptions.baseUrl).toBe('.');
  });

  it('aligns moduleResolution with module nodenext', () => {
    const f: Record<string, Record<string, unknown>> = { '/r/tsconfig.json': { compilerOptions: { module: 'nodenext', moduleResolution: 'node' } } };
    const r = flattenTsconfig('/r/tsconfig.json', '/r', { read: (p) => f[p] });
    expect(r.tsconfig.compilerOptions.moduleResolution).toBe('nodenext');
    expect(r.notes.join(' ')).toMatch(/replaced/);
  });

  it('includes src only by default, a given include otherwise, and always excludes tests', () => {
    const f: Record<string, Record<string, unknown>> = { '/r/tsconfig.json': { compilerOptions: {} } };
    expect(flattenTsconfig('/r/tsconfig.json', '/r', { read: (p) => f[p] }).tsconfig.include).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
    const r = flattenTsconfig('/r/tsconfig.json', '/r', { read: (p) => f[p] }, ['src/node/**/*.ts']);
    expect(r.tsconfig.include).toEqual(['src/node/**/*.ts']);
    expect(r.tsconfig.exclude).toContain('**/*.spec.ts');
  });

  it('notes a missing config', () => {
    expect(flattenTsconfig('/nope.json', '/', { read: () => undefined }).notes[0]).toMatch(/not found/);
  });
});

describe('wild: memberLine', () => {
  const src = [
    'import { X } from "x";',
    'export class Other {',
    '  find(): void {}',
    '}',
    '@Injectable()',
    'export class UserService {',
    '  private readonly repo: Repo;',
    '  constructor(repo: Repo) {}',
    '  async find(id: string): Promise<User> {',
    '    return this.repo.find(id);',
    '  }',
    '  get name(): string { return ""; }',
    '  handler = async (e: E) => {};',
    '}',
    'export function topLevel<T>(x: T) {}',
    'export const arrow = (a: number) => a;',
  ].join('\n');

  it('finds a method after its own class header, not a same-named one in another class', () => {
    expect(memberLine(src, 'UserService.find')).toBe(9);
    expect(memberLine(src, 'Other.find')).toBe(3);
  });
  it('finds accessors, arrow fields and top-level functions', () => {
    expect(memberLine(src, 'UserService.name')).toBe(12);
    expect(memberLine(src, 'UserService.handler')).toBe(13);
    expect(memberLine(src, 'topLevel')).toBe(15);
    expect(memberLine(src, 'arrow')).toBe(16);
  });
  it('returns 0 for an unknown class or member', () => {
    expect(memberLine(src, 'Nope.find')).toBe(0);
    expect(memberLine(src, 'UserService.missing')).toBe(0);
  });
});

describe('wild: excerpt', () => {
  it('numbers lines, marks the target line, and strips comments', () => {
    const text = ['// header comment', 'const a = 1; // trailing', '/* block', ' */', 'const b = "// not a comment";', '', '', 'const c = 3;'].join('\n');
    const ex = excerpt(text, 2, 1, 6);
    expect(ex).toContain('    2> const a = 1;');
    expect(ex).not.toMatch(/header comment|trailing|block/);
    expect(ex).toContain('"// not a comment"');
    // Blank runs collapse to one line: no two consecutive blank lines.
    const blank = ex.split('\n').map((l) => /^\s+\d+>?\s*$/.test(l));
    expect(blank.some((b, i) => b && blank[i + 1] === true)).toBe(false);
  });
  it('clamps at the file edges', () => {
    expect(excerpt('only', 1).split('\n')).toEqual(['    1> only']);
  });
});

describe('wild: diverseSample', () => {
  const pool = ['a1', 'a2', 'a3', 'a4', 'b1', 'c1', 'c2'];
  const repo = (x: string): string => x[0] ?? '';

  it('is deterministic for a seed', () => {
    expect(diverseSample(pool, 5, mulberry32(7), repo)).toEqual(diverseSample(pool, 5, mulberry32(7), repo));
  });
  it('covers every repository before repeating one', () => {
    const s = diverseSample(pool, 3, mulberry32(1), repo);
    expect(new Set(s.map(repo)).size).toBe(3);
  });
  it('returns the whole pool when it is smaller than n, without duplicates', () => {
    const s = diverseSample(pool, 50, mulberry32(3), repo);
    expect([...s].sort()).toEqual([...pool].sort());
  });
});

describe('wild: apg2Claim and cell', () => {
  it('states a claim without the template id', () => {
    const c = apg2Claim('boundary-type-leak', { member: 'UserController.get', positions: ['return'], fromLayer: 'presentation', leakedType: 'UserEntity', toLayer: 'infrastructure', target: 'src/db/user.entity.ts' });
    expect(c).toContain('UserEntity');
    expect(c).not.toContain('boundary-type-leak');
    for (const t of ['component-adp-cycle', 'component-sdp-violation', 'component-main-sequence-distance', 'deep-import-declared-api', 'deep-import-inferred-api', 'undeclared-async-coupling', 'io-outside-adapters', 'nondeterminism-in-core']) {
      expect(apg2Claim(t, {})).not.toContain(t);
    }
  });
  it('escapes markdown table cells', () => {
    expect(cell('a|b\nc')).toBe('a\\|b<br>c');
  });
});

describe('wild: apiVisibleInImports', () => {
  it('sees a package call only when the file imports the package', () => {
    expect(apiVisibleInImports(['@prisma/client:this.prisma.user.count'], new Set(['@prisma/client']))).toBe(true);
    expect(apiVisibleInImports(['@prisma/client:this.prisma.user.count'], new Set(['@nestjs/common']))).toBe(false);
  });
  it('ignores the node: prefix on either side', () => {
    expect(apiVisibleInImports(['fs:readFileSync'], new Set(['node:fs']))).toBe(true);
    expect(apiVisibleInImports(['node:fs:readFileSync'], new Set(['fs']))).toBe(true);
  });
  it('never sees globals', () => {
    expect(apiVisibleInImports(['process.env', 'new Date()', 'Math.random()', 'fetch()'], new Set(['fs']))).toBe(false);
  });
});

describe('wild: cheapClaim', () => {
  it('rewords metric messages without the proxy or kind', () => {
    const b = cheapClaim({ kind: 'broad-responsibility', message: 'TagController: 0 I/O categories, 4 other components' });
    expect(b).toBe('Class `TagController` has too broad a responsibility: it performs 0 kind(s) of I/O and depends on 4 other components.');
    const l = cheapClaim({ kind: 'low-cohesion', message: 'S: LCOM4 3 over 5 methods ({a, b} {c} {d, e})' });
    expect(l).toContain('5 methods fall into 3 groups');
    expect(l).not.toMatch(/LCOM|low-cohesion/);
  });
  it('appends the other end of a two-ended flag', () => {
    expect(cheapClaim({ kind: 'shared-string-literal', message: 'literal "x" also used in component(s) a', related: { file: 'src/a.ts', startLine: 3 } }))
      .toBe('literal "x" also used in component(s) a (other end: src/a.ts:3)');
  });
  it('keeps an unparseable message as is', () => {
    expect(cheapClaim({ kind: 'low-cohesion', message: 'odd' })).toBe('odd');
  });
});
