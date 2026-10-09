/**
 * Instrument v2 role exemptions (ADR-026): library-level path exemptions per template, merged after the
 * function's own exclude_paths (C9, BR-U1-32).
 */
import * as path from 'node:path';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { hasExcludeMarker } from '../../../src/fitness-compiler/exclude-injector.js';
import { compileFunctions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { globToRegex } from '../../../src/fitness-compiler/glob-to-regex.js';
import {
  COMPOSITION_ROOT_GLOBS, DECLARATION_ONLY_GLOBS, INSTRUMENT_V1_LAST_COMMIT, INSTRUMENT_VERSION, ROLE_EXEMPTIONS,
  parseInstrumentVersion, roleExemptionGlobs, roleExemptionPatterns,
} from '../../../src/fitness-compiler/role-exemptions.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');

function matches(templateName: string, filePath: string): boolean {
  return roleExemptionPatterns(templateName).some((re) => new RegExp(re).test(filePath));
}

describe('role exemptions (instrument v2, ADR-026)', () => {
  it('is instrument v2 and exempts exactly three templates', () => {
    expect(INSTRUMENT_VERSION).toBe(2);
    expect(Object.keys(ROLE_EXEMPTIONS).sort()).toEqual(['component-instability', 'module-fan-out', 'test-file-pairing']);
    expect(roleExemptionGlobs('test-file-pairing')).toEqual([...DECLARATION_ONLY_GLOBS, ...COMPOSITION_ROOT_GLOBS]);
    expect(roleExemptionGlobs('module-fan-out')).toEqual(COMPOSITION_ROOT_GLOBS);
    expect(roleExemptionGlobs('component-instability')).toEqual(COMPOSITION_ROOT_GLOBS);
  });

  it('leaves structural, cycle, data-flow and seeded templates without exemptions', () => {
    for (const name of [
      'dependency-direction', 'no-cyclic-deps', 'no-layer-skip', 'no-domain-outward-dep', 'domain-state-purity',
      'domain-purity', 'single-responsibility-proxy', 'interface-segregation-proxy', 'no-orphan-files',
      'naming-services', 'abstraction-ratio',
    ]) {
      expect({ name, globs: roleExemptionGlobs(name) }).toEqual({ name, globs: [] });
    }
  });

  it('every exempted template exists and holds an exclude anchor', () => {
    for (const name of Object.keys(ROLE_EXEMPTIONS)) {
      expect(hasExcludeMarker(CYPHER_TEMPLATES.get(name)?.template ?? '')).toBe(true);
    }
  });

  it.each([
    ['test-file-pairing', 'src/user/dto/update-user.dto.ts', true],
    ['test-file-pairing', 'src/delivery/orders/dtos/x.ts', true],
    ['test-file-pairing', 'src/orders/order.interface.ts', true],
    ['test-file-pairing', 'src/shared/money.types.ts', true],
    ['test-file-pairing', 'src/shared/status.enum.ts', true],
    ['test-file-pairing', 'src/orders/index.ts', false], // barrels: the template's own isBarrel test (review fix 1)
    ['test-file-pairing', 'src/app.module.ts', true],
    ['test-file-pairing', 'src/main.ts', true],
    ['test-file-pairing', 'src/article/article.service.ts', false],
    ['test-file-pairing', 'src/article/article.controller.ts', false],
    ['test-file-pairing', 'src/article/article.entity.ts', false],
    ['test-file-pairing', 'src/domain.ts', false],
    ['test-file-pairing', 'src/reindex.ts', false],
    ['test-file-pairing', 'src/userdto/x.ts', false],
    ['component-instability', 'src/app.module.ts', true],
    ['component-instability', 'apps/api/src/main.ts', true],
    ['component-instability', 'src/cron/cron.service.ts', false],
    ['component-instability', 'src/article/article.controller.ts', false],
    ['module-fan-out', 'src/app/admin/admin.module.ts', true],
    ['module-fan-out', 'src/app/portfolio/portfolio.service.ts', false],
  ])('%s exempts %s: %s', (template, filePath, expected) => {
    expect(matches(template, filePath)).toBe(expected);
  });

  it('segmentGlobstar is opt-in: the default keeps the v1 regex', () => {
    expect(globToRegex('**/main.ts')).toBe('^.*main\\.ts$');
    expect(globToRegex('**/main.ts', { segmentGlobstar: true })).toBe('^(?:.*/)?main\\.ts$');
    expect(globToRegex('**/dto/**', { segmentGlobstar: true })).toBe('^(?:.*/)?dto/.*$');
    expect(globToRegex('src/**', { segmentGlobstar: true })).toBe('^src/.*$');
  });

  it('compiles the exemptions after the spec exclude_paths, binding the predicate', async () => {
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'specs/clean-arch.yaml') });
    if (!parsed.success) throw new Error('specs/clean-arch.yaml did not parse');
    const input = compilerInputFromSpec(parsed.data);
    const withSpecExclude = {
      ...input,
      fitnessFunctions: input.fitnessFunctions.map((ff) => (ff.name === 'module-fan-out' ? { ...ff, excludePaths: ['src/x/**'] } : ff)),
    };
    const compiled = compileFunctions(withSpecExclude);
    if (!compiled.success) throw new Error('did not compile');
    const byName = (n: string): CypherQuery => {
      const found = compiled.data.symbolicQueries.find((c) => c.name === n);
      if (!found) throw new Error(`${n} not compiled`);
      return found;
    };
    const q = byName('module-fan-out');
    expect(q.params.excludePatterns).toEqual(['^src/x/.*$', ...roleExemptionPatterns('module-fan-out')]);
    expect(q.cypher).toContain('AND NONE(ep IN $excludePatterns WHERE f.filePath =~ ep)');
    for (const name of ['test-file-pairing', 'component-instability']) {
      expect(byName(name).params.excludePatterns).toEqual(roleExemptionPatterns(name));
    }
    expect(byName('single-responsibility-proxy').params).not.toHaveProperty('excludePatterns');
  });

  it('declares no index.ts glob (barrels stay with the template, ADR-026 review fix 1)', () => {
    expect(DECLARATION_ONLY_GLOBS).not.toContain('**/index.ts');
  });

  it('parses the --instrument values and names the last v1 commit', () => {
    expect([parseInstrumentVersion('v1'), parseInstrumentVersion('V2'), parseInstrumentVersion('2'), parseInstrumentVersion('v3')])
      .toEqual([1, 2, 2, undefined]);
    expect(INSTRUMENT_V1_LAST_COMMIT).toBe('febc918');
  });

  it('instrument v1 empties every exemption and compiles exactly the v1 queries', async () => {
    for (const name of Object.keys(ROLE_EXEMPTIONS)) expect(roleExemptionGlobs(name, 1)).toEqual([]);
    const parsed = await parseSpec({ specFilePath: path.join(ROOT, 'corpus/specs/realworld-test.yaml') });
    if (!parsed.success) throw new Error('realworld spec did not parse');
    const v1 = compileFunctions(compilerInputFromSpec(parsed.data), { instrumentVersion: 1 });
    const v2 = compileFunctions(compilerInputFromSpec(parsed.data), { instrumentVersion: 2 });
    if (!v1.success || !v2.success) throw new Error('did not compile');
    for (const [a, b] of v1.data.symbolicQueries.map((q, i) => [q, v2.data.symbolicQueries[i]] as const)) {
      if (b === undefined) throw new Error('query count differs');
      if (a.name in ROLE_EXEMPTIONS) {
        // v1: the function's own exclude_paths only (none for these three in the corpus specs), so no predicate.
        expect({ name: a.name, params: a.params }).toEqual({ name: a.name, params: Object.fromEntries(Object.entries(b.params).filter(([k]) => k !== 'excludePatterns')) });
        expect(a.cypher).not.toContain('$excludePatterns');
      } else {
        expect(a).toEqual(b);
      }
    }
  });
});
