import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { parseSpec } from '../../../../src/spec-parser/index.js';
import { resolveTemplate } from '../../../../src/spec-parser/template-registry.js';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../../src/fitness-compiler/compiler-input.js';
import {
  completeSpec, confusion, globLiteral, inexpressibleEdges, isLayerRule, ourKeys, ruleForbids, selectLayerRules,
  sideMatches, theirKeys, toSpecYaml, translate,
} from '../../../../scripts/v1.3/human-rules-pilot/lib.js';
import type { DcRule } from '../../../../scripts/v1.3/human-rules-pilot/lib.js';
import picomatch from 'picomatch';

// The two layer rules of TalanLabs/bookadesk back/.dependency-cruiser.js, verbatim.
const BOOKADESK: DcRule[] = [
  { name: 'no-dep-from-domain', from: { path: 'src/domain' }, to: { path: 'src', pathNot: 'src/domain' } },
  {
    name: 'no-dep-from-usecase',
    from: { path: 'src/usecase', pathNot: '\\.spec\\.(js|ts)$|\\.d\\.ts$' },
    to: { path: 'src', pathNot: 'src/domain|src/usecase' },
  },
];
const FILES = ['src/domain/domain.ts', 'src/usecase/BookPlace.ts', 'src/usecase/ports/BookingRepo.ts', 'src/adapters/PgRepo.ts', 'src/index.ts'];

describe('human-rules pilot: rule selection', () => {
  it('keeps path-only rules and drops preset and non-path rules, with reasons', () => {
    const s = selectLayerRules([
      ...BOOKADESK,
      { name: 'no-circular', from: {}, to: { circular: true } },
      { name: 'not-to-spec', from: {}, to: { path: '\\.spec\\.ts$' } },
      { name: 'custom-orphans', from: { orphan: true }, to: {} },
      { name: 'any-to-any', from: {}, to: {} },
    ]);
    expect(s.layer.map((r) => r.name)).toEqual(['no-dep-from-domain', 'no-dep-from-usecase']);
    expect(s.excluded).toEqual([
      { name: 'no-circular', reason: 'dependency-cruiser recommended preset' },
      { name: 'not-to-spec', reason: 'dependency-cruiser recommended preset' },
      { name: 'custom-orphans', reason: 'non-path condition: orphan' },
      { name: 'any-to-any', reason: 'no path predicate' },
    ]);
  });
  it('a pathNot-only side counts as a path predicate', () => {
    expect(isLayerRule({ name: 'x', from: { path: 'domain' }, to: { pathNot: 'domain' } })).toBe(true);
  });
});

describe('human-rules pilot: dependency-cruiser path semantics', () => {
  it('arrays are alternations, regexes are unanchored, absent predicates match all', () => {
    expect(sideMatches({ path: ['controller', 'dto\\.ts$'] }, 'src/x/a.dto.ts')).toBe(true);
    expect(sideMatches({ path: 'src/domain' }, 'lib/src/domainX/a.ts')).toBe(true);
    expect(sideMatches({ path: 'src', pathNot: 'src/domain' }, 'src/domain/a.ts')).toBe(false);
    expect(sideMatches({}, 'anything.ts')).toBe(true);
  });
  it('ruleForbids reads both sides', () => {
    const [domain, usecase] = BOOKADESK as [DcRule, DcRule];
    expect(ruleForbids(domain, 'src/domain/domain.ts', 'src/usecase/BookPlace.ts')).toBe(true);
    expect(ruleForbids(domain, 'src/domain/domain.ts', 'src/domain/errors.ts')).toBe(false);
    expect(ruleForbids(usecase, 'src/usecase/BookPlace.ts', 'src/domain/domain.ts')).toBe(false);
    expect(ruleForbids(usecase, 'src/usecase/BookPlace.ts', 'src/adapters/PgRepo.ts')).toBe(true);
  });
});

describe('human-rules pilot: resolved-atoms translation', () => {
  const t = translate(BOOKADESK, FILES);
  const atomOf = (f: string): string => t.atoms.find((a) => a.files.includes(f))?.name ?? '';

  it('groups files by rule signature into a partition', () => {
    expect(t.atoms).toHaveLength(3);
    expect(atomOf('src/usecase/BookPlace.ts')).toBe(atomOf('src/usecase/ports/BookingRepo.ts'));
    expect(atomOf('src/adapters/PgRepo.ts')).toBe(atomOf('src/index.ts'));
    expect(t.unconstrained).toEqual([]);
  });

  it('an atom pair is forbidden exactly when some file pair across it is forbidden by a rule', () => {
    for (const from of FILES) {
      for (const to of FILES) {
        const a = atomOf(from); const b = atomOf(to);
        if (a === b) continue;
        const pairForbidden = t.forbidden.some((x) => x.from === a && x.to === b);
        expect(pairForbidden).toBe(BOOKADESK.some((r) => ruleForbids(r, from, to)));
      }
    }
    expect(t.forbidden.length + t.allowed.length).toBe(t.atoms.length * (t.atoms.length - 1));
  });

  it('files on no rule side stay unconstrained; same-atom forbidden edges are reported as inexpressible', () => {
    const rules: DcRule[] = [{ name: 'no-domain-to-api', from: { path: 'domain' }, to: { path: ['controller', 'dto\\.ts$'] } }];
    const files = ['src/domain/a.dto.ts', 'src/domain/b.dto.ts', 'src/x/y.ts'];
    const tr = translate(rules, files);
    expect(tr.unconstrained).toEqual(['src/x/y.ts']);
    expect(tr.selfForbidden).toHaveLength(1);
    expect(inexpressibleEdges(rules, tr, ['src/domain/a.dto.ts|src/domain/b.dto.ts', 'src/x/y.ts|src/domain/a.dto.ts'])).toEqual(['src/domain/a.dto.ts|src/domain/b.dto.ts']);
  });

  it('literal globs match only their own path', () => {
    const f = 'src/app/[id]/(group)/page+x.ts';
    expect(picomatch(globLiteral(f), { dot: true })(f)).toBe(true);
    expect(picomatch(globLiteral(f), { dot: true })('src/app/i/(group)/page+x.ts')).toBe(false);
  });
});

describe('human-rules pilot: emitted specs parse and compile', () => {
  const builtIns = resolveTemplate('hexagonal')?.functions ?? [];

  async function compiledIds(yaml: string): Promise<string[]> {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hr-pilot-'));
    const file = path.join(dir, 'spec.yaml');
    fs.writeFileSync(file, yaml);
    try {
      const parsed = await parseSpec({ specFilePath: file });
      if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
      const compiled = compileFunctions(compilerInputFromSpec(parsed.data), V13_COMPILE_OPTIONS);
      if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
      return compiled.data.symbolicQueries.map((q) => String(q.functionId)).sort();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it('the resolved spec compiles to FF-S01 and FF-S03 only', async () => {
    const yaml = toSpecYaml(translate(BOOKADESK, FILES), ['test'], builtIns);
    expect(await compiledIds(yaml)).toEqual(['FF-S01', 'FF-S03']);
  });

  it('completeSpec turns an architecture section into a runnable spec and refuses a full spec', async () => {
    const arch = [
      'architecture:', '  style: hexagonal', '  layers:',
      '    - { name: d, kind: domain, roles: [e], directories: ["src/domain/**"] }',
      '    - { name: a, kind: application, roles: [u], directories: ["src/usecase/**"] }',
      '    - { name: i, kind: infrastructure, roles: [r], directories: ["src/**"] }',
      '    - { name: p, kind: presentation, roles: [c], directories: ["__none__/**"] }',
      '  allowed_dependencies:', '    - { from: a, to: [d] }', '    - { from: i, to: [d, a] }',
    ].join('\n');
    expect(await compiledIds(completeSpec(arch, builtIns))).toEqual(['FF-S01', 'FF-S03']);
    expect(() => completeSpec(`${arch}\nscoring: {}`, builtIns)).toThrow(/architecture section only/);
  });
});

describe('human-rules pilot: comparison', () => {
  it('kappa over the edge universe, null when both tools are constant', () => {
    const u = new Set(['a|b', 'b|c', 'c|d', 'd|e']);
    const c = confusion(u, new Set(['a|b', 'b|c']), new Set(['a|b']));
    expect(c).toMatchObject({ both: 1, oursOnly: 1, theirsOnly: 0, neither: 2 });
    expect(c.kappa).toBeCloseTo(0.5, 6);
    expect(confusion(u, new Set(), new Set()).kappa).toBeNull();
  });

  it('keys keep only in-scope layer findings; type-only imports can be dropped', () => {
    const scope = new Set(['a.ts', 'b.ts']);
    expect([...theirKeys([
      { from: 'a.ts', to: 'b.ts', rule: { name: 'L' } },
      { from: 'a.ts', to: 'b.ts', rule: { name: 'no-orphans' } },
      { from: 'a.ts', to: 'x.spec.ts', rule: { name: 'L' } },
    ], new Set(['L']), scope)]).toEqual(['a.ts|b.ts']);
    const ours = [
      { functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', isTypeOnly: true },
      { functionId: 'FF-S03', filePath: 'b.ts', target: 'a.ts' },
      { functionId: 'FF-S02', filePath: 'a.ts', target: 'b.ts' },
    ];
    expect([...ourKeys(ours, scope)].sort()).toEqual(['a.ts|b.ts', 'b.ts|a.ts']);
    expect([...ourKeys(ours, scope, { dropTypeOnly: true })]).toEqual(['b.ts|a.ts']);
  });
});
