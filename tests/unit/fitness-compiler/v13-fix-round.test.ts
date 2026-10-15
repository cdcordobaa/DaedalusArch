/**
 * v1.3 fix round (aidlc-docs/construction/v1.3-fixes/fixes-notes.md): the compile options added after the U-E baseline.
 * - styleApplicability: FF-P06 domain-state-purity is not applicable in `layered` (ADR-V13-02 draft);
 * - roleTokens: role detection by the class name's last camel-case token(s);
 * - edgeViews + DDD: context-isolation reads the literal barrel edge without the M1 clause (fix 6).
 * Each is off without its option, so the v1.2E compile (`{}`) is the frozen text.
 */
import * as path from 'node:path';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { CYPHER_TEMPLATES } from '../../../src/fitness-compiler/cypher-templates.js';
import { HEXAGONAL_TEMPLATES } from '../../../src/fitness-compiler/hexagonal-templates.js';
import { DDD_LITERAL_VIEW_TEMPLATES, DDD_TEMPLATES } from '../../../src/fitness-compiler/ddd-templates.js';
import { applyRoleTokens, V13_ROLE_NAME_REWRITES } from '../../../src/fitness-compiler/v13-role-names.js';
import { V13_STYLE_APPLICABILITY, v13InapplicableReason } from '../../../src/fitness-compiler/v13-applicability.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';

const ROOT = path.resolve(__dirname, '../../..');
const SPECS = ['specs/clean-arch.yaml', 'presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/layered.yaml', 'presets/hexagonal.yaml', 'presets/ddd.yaml'];

async function compile(specRel: string, options: CompileOptions): Promise<CompiledFunctions> {
  const parsed = await parseSpec({ specFilePath: path.join(ROOT, specRel) });
  if (!parsed.success) throw new Error(parsed.errors.map((e) => e.message).join('; '));
  const r = compileFunctions(compilerInputFromSpec(parsed.data), options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}
const queryOf = (c: CompiledFunctions, name: string): string | undefined => c.symbolicQueries.find((q) => q.name === name)?.cypher;

describe('v1.2E compile is unchanged', () => {
  it.each(SPECS)('%s: every new option off compiles exactly as {}', async (spec) => {
    const off = await compile(spec, { edgeViews: false, styleApplicability: false, roleTokens: false });
    expect(JSON.stringify(off)).toBe(JSON.stringify(await compile(spec, {})));
  });

  it.each(SPECS)('%s: without options every query is the frozen template text (no v1.3 rewrite)', async (spec) => {
    const c = await compile(spec, {});
    for (const q of c.symbolicQueries) {
      expect(q.cypher).not.toMatch(/viaReExport|reExportHop|ENDS WITH role|\(Repository\|Repo\)/);
    }
  });

  it('V13_COMPILE_OPTIONS turns every v1.3 rewrite on', () => {
    expect(V13_COMPILE_OPTIONS).toEqual({ edgeViews: true, styleApplicability: true, roleTokens: true });
  });
});

describe('fix 3: FF-P06 style applicability (ADR-V13-02 draft)', () => {
  it('the table names the styles with an isolated domain', () => {
    expect(V13_STYLE_APPLICABILITY.get('domain-state-purity')?.styles).toEqual(['clean-architecture', 'hexagonal', 'ddd', 'nestjs']);
    expect([...V13_STYLE_APPLICABILITY.keys()]).toEqual(['domain-state-purity']);
    expect(v13InapplicableReason('domain-state-purity', 'layered')).toMatch(/^not applicable to style layered/);
    expect(v13InapplicableReason('domain-state-purity', undefined)).toBeUndefined();
    expect(v13InapplicableReason('dependency-direction', 'layered')).toBeUndefined();
  });

  it('layered: FF-P06 is disabled with the reason under v1.3, compiled without the option', async () => {
    const v13 = await compile('presets/layered.yaml', V13_COMPILE_OPTIONS);
    expect(queryOf(v13, 'domain-state-purity')).toBeUndefined();
    expect(v13.disabledFunctions.find((d) => String(d.id) === 'FF-P06')?.reason).toMatch(/not applicable to style layered \(v1\.3/);
    expect(v13.warnings.some((w) => w.code === 'COMPILER_004' && w.functionId === 'FF-P06')).toBe(true);
    expect(queryOf(await compile('presets/layered.yaml', {}), 'domain-state-purity')).toBeDefined();
  });

  // presets/ddd.yaml declares no FF-P06 (its framework-free rule is FF-DT04).
  it.each(['presets/clean-architecture.yaml', 'presets/nestjs.yaml', 'presets/hexagonal.yaml', 'specs/clean-arch.yaml'])(
    '%s: FF-P06 stays applicable and unchanged', async (spec) => {
      const v13 = await compile(spec, V13_COMPILE_OPTIONS);
      expect(queryOf(v13, 'domain-state-purity')).toBe(queryOf(await compile(spec, {}), 'domain-state-purity'));
      expect(queryOf(v13, 'domain-state-purity')).toBeDefined();
    },
  );

  it('only FF-P06 changes applicability: the same function set otherwise', async () => {
    for (const spec of SPECS) {
      const a = (await compile(spec, V13_COMPILE_OPTIONS)).symbolicQueries.map((q) => q.name);
      const b = (await compile(spec, {})).symbolicQueries.map((q) => q.name).filter((n) => !(spec === 'presets/layered.yaml' && n === 'domain-state-purity'));
      expect([spec, a]).toEqual([spec, b]);
    }
  });
});

/** JS reading of the rewritten predicates (Cypher `=~` is a full match; ENDS WITH is a suffix test). */
const repoMatch = (name: string): boolean => /^.*(Repository|Repo)(Impl)?$/.test(name);
const roleMatch = (name: string, roles: readonly string[]): boolean => roles.some((r) => name.endsWith(r) || name.endsWith(`${r}Impl`));
const ADAPTER_ROLES = ['Repository', 'Repo', 'Adapter', 'Gateway'];

describe('fix 4: role detection by the last camel-case token(s)', () => {
  it('repository-pattern: CsvReportWriter is no repository; suffix names (and their Impl) are', () => {
    for (const n of ['OrderRepository', 'UserRepo', 'InMemoryOrderRepository', 'OrderRepositoryImpl', 'TypeOrmTaskRepository']) expect([n, repoMatch(n)]).toEqual([n, true]);
    for (const n of ['CsvReportWriter', 'RepositoryFactory', 'ReportService', 'Reporter', 'RepoSyncJob']) expect([n, repoMatch(n)]).toEqual([n, false]);
  });

  it('port-adapter-pattern: GatewayRetryPolicy is no adapter; PaymentGateway and HttpAdapter are', () => {
    for (const n of ['PaymentGateway', 'HttpAdapter', 'InMemoryBookingRepository', 'StripeGatewayImpl']) expect([n, roleMatch(n, ADAPTER_ROLES)]).toEqual([n, true]);
    for (const n of ['GatewayRetryPolicy', 'AdapterRegistry', 'CsvReportWriter']) expect([n, roleMatch(n, ADAPTER_ROLES)]).toEqual([n, false]);
  });

  it('the rewrite replaces exactly the substring tests of the four role-selecting templates', () => {
    const catalogue = new Map([...CYPHER_TEMPLATES, ...HEXAGONAL_TEMPLATES]);
    expect([...V13_ROLE_NAME_REWRITES.keys()].sort()).toEqual(['controller-no-entity', 'port-adapter-pattern', 'repository-pattern', 'use-case-isolation']);
    for (const [name, rewrites] of V13_ROLE_NAME_REWRITES) {
      const text = catalogue.get(name)?.template ?? '';
      const out = applyRoleTokens(name, text);
      for (const [from, to] of rewrites) {
        expect(text).toContain(from);
        expect(out).not.toContain(from);
        expect(out).toContain(to);
      }
      expect(out).not.toMatch(/name CONTAINS/);
    }
    // the naming conventions keep their substring selection (their construct is the name itself)
    for (const n of ['naming-services', 'naming-repos']) {
      const t = CYPHER_TEMPLATES.get(n)?.template ?? '';
      expect(applyRoleTokens(n, t)).toBe(t);
      expect(t).toMatch(/CONTAINS/);
    }
  });

  it('a template that drifted from the rewrite source fails loudly', () => {
    expect(() => applyRoleTokens('repository-pattern', 'MATCH (c:Class) RETURN c')).toThrow(/no longer contains/);
  });

  it('compiled v1.3 queries carry the rewrite; v1.2E ones do not', async () => {
    const v13 = await compile('presets/clean-architecture.yaml', V13_COMPILE_OPTIONS);
    expect(queryOf(v13, 'repository-pattern')).toContain("c.name =~ '.*(Repository|Repo)(Impl)?'");
    expect(queryOf(await compile('presets/clean-architecture.yaml', {}), 'repository-pattern')).toContain("c.name CONTAINS 'Repo'");
    const hex = await compile('presets/hexagonal.yaml', V13_COMPILE_OPTIONS);
    expect(queryOf(hex, 'port-adapter-pattern')).toContain('c.name ENDS WITH role');
  });
});

describe('fix 6: DDD context-isolation reads the literal barrel edge (M2)', () => {
  it('under the edge views the M1 clause is dropped and the literal predicate is applied', async () => {
    const v13 = queryOf(await compile('presets/ddd.yaml', V13_COMPILE_OPTIONS), 'context-isolation') ?? '';
    const frozen = queryOf(await compile('presets/ddd.yaml', {}), 'context-isolation') ?? '';
    expect(frozen).toContain('MATCH (api:File)-[:RE_EXPORTS*1..]->(tgt)');
    expect(v13).not.toContain('MATCH (api:File)');
    expect(v13).toContain('[i:IMPORTS|RE_EXPORTS WHERE NOT coalesce(i.viaReExport, false)]');
    expect(DDD_LITERAL_VIEW_TEMPLATES.get('context-isolation')).toBe(
      DDD_TEMPLATES.get('context-isolation')?.template.replace(/ {2}AND NOT EXISTS \{\n {4}MATCH \(api:File\)[\s\S]*?\n {2}\}\n/, ''),
    );
  });
});
