/**
 * K8 (FR-35; BR-U1-32, BR-U1-44): exclude anchors replace the RETURN splice.
 * Graph semantics and EXPLAIN on Neo4j live in tests/golden/u1-templates.test.ts.
 */
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { EXCLUDE_MARKER_RE } from '../../../src/fitness-compiler/exclude-injector.js';
import { ROLE_EXEMPTIONS } from '../../../src/fitness-compiler/role-exemptions.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const ALIAS_PRED = (a: string): string => `AND NONE(ep IN $excludePatterns WHERE ${a}.filePath =~ ep)`;

async function goldenInput(): Promise<CompilerInput> {
  const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'specs/clean-arch.yaml') });
  if (!parsed.success) throw new Error('specs/clean-arch.yaml did not parse');
  return compilerInputFromSpec(parsed.data);
}

/** The golden input with `exclude_paths` set on the functions using the named templates. */
async function withExcludes(templates: readonly string[], excludes: readonly string[] = ['src/x/**']): Promise<CompilerInput> {
  const input = await goldenInput();
  return {
    ...input,
    fitnessFunctions: input.fitnessFunctions.map((ff) => (templates.includes(ff.name) ? { ...ff, excludePaths: excludes } : ff)),
  };
}

function query(queries: readonly CypherQuery[], name: string): CypherQuery {
  const q = queries.find((c) => c.name === name);
  if (!q) throw new Error(`${name} not compiled`);
  return q;
}

/** Removes parenthesised groups and `{ … }` bodies, innermost first. */
function stripGroups(text: string): string {
  let prev = '';
  let out = text;
  while (out !== prev) {
    prev = out;
    out = out.replace(/\([^(){}]*\)/g, '').replace(/\{[^{}]*\}/g, '');
  }
  return out;
}

describe('exclude anchors (BR-U1-32)', () => {
  it('23 templates carry exactly one anchor; abstraction-ratio has none', () => {
    for (const [name, t] of CYPHER_TEMPLATES) {
      const count = [...t.template.matchAll(EXCLUDE_MARKER_RE)].length;
      expect({ name, count }).toEqual({ name, count: name === 'abstraction-ratio' ? 0 : 1 });
    }
  });

  it('without excludes no anchor survives compilation and no excludePatterns is bound (role-exempt templates aside, ADR-026)', async () => {
    const compiled = compileFunctions(await goldenInput());
    if (!compiled.success) throw new Error('golden spec did not compile');
    for (const q of compiled.data.symbolicQueries.filter((c) => !(c.name in ROLE_EXEMPTIONS))) {
      expect({ id: String(q.functionId), marker: q.cypher.includes('/*EXCLUDE:') }).toEqual({ id: String(q.functionId), marker: false });
      expect(q.params).not.toHaveProperty('excludePatterns');
    }
  });

  it('(c) repository-pattern with excludes contains the predicate exactly once; excludePatterns is the last key', async () => {
    const compiled = compileFunctions(await withExcludes(['repository-pattern']));
    if (!compiled.success) throw new Error('did not compile');
    const q = query(compiled.data.symbolicQueries, 'repository-pattern');
    expect(q.cypher.split(ALIAS_PRED('c')).length - 1).toBe(1);
    expect(q.cypher).not.toContain('/*EXCLUDE:');
    expect(Object.keys(q.params).at(-1)).toBe('excludePatterns');
    expect(q.params.excludePatterns).toEqual(['^src/x/.*$']);
  });

  it('the cycle anchor becomes the nodes(p) predicate', async () => {
    const compiled = compileFunctions(await withExcludes(['no-cyclic-deps']));
    if (!compiled.success) throw new Error('did not compile');
    expect(query(compiled.data.symbolicQueries, 'no-cyclic-deps').cypher)
      .toContain('AND NONE(n IN nodes(p) WHERE ANY(ep IN $excludePatterns WHERE n.filePath =~ ep))');
  });

  it('(d) abstraction-ratio with excludes fails with COMPILATION_FAILED and the exact message', async () => {
    const compiled = compileFunctions(await withExcludes(['abstraction-ratio']));
    expect(compiled.success).toBe(false);
    if (compiled.success) return;
    expect(compiled.errors.map((e) => [e.code, e.message])).toEqual([
      ['COMPILATION_FAILED', 'FF-C06: exclude_paths not supported by template abstraction-ratio'],
    ]);
  });
});

describe('marker shape (BR-U1-44 a)', () => {
  it.each([...CYPHER_TEMPLATES.entries()].filter(([, t]) => t.template.includes('/*EXCLUDE:')))(
    '%s: the WHERE holding the anchor is a top-level conjunction',
    (_name, t) => {
      // Groups and subquery bodies go first, so the last WHERE left is the top-level one holding the anchor.
      const head = stripGroups(t.template.slice(0, t.template.indexOf('/*EXCLUDE:')));
      const where = head.lastIndexOf('WHERE');
      expect(where).toBeGreaterThan(-1);
      expect(head.slice(where)).not.toMatch(/\sOR\s/);
    },
  );

  it('single-responsibility-proxy parenthesises its OR in front of the anchor', () => {
    expect(CYPHER_TEMPLATES.get('single-responsibility-proxy')?.template)
      .toContain('WHERE (methodCount > $maxPublicMethods OR depCount > $maxDependencies) /*EXCLUDE:c*/');
  });
});
