/**
 * v1.4 U2 post-seal overlay (design `aidlc-docs/construction/v1.4/U2/functional-design/design.md` BR-U2-02, BR-U2-03,
 * BR-U2-10; plan step 9.1). No Neo4j, no network, no model: the pipeline runs on cypher-interp, symbolic-only.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileFunctions, V13_COMPILE_OPTIONS, V13_SEALED_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import { applyPostSealRules, HTTP_DELIVERY_PACKAGES, POST_SEAL_RULES, withPostSealRules } from '../../../src/fitness-compiler/post-seal-rules.js';
import { parseInstrumentVersion } from '../../../src/fitness-compiler/role-exemptions.js';
import { withAnswers } from '../../../src/shared/construct-switches.js';
import { functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { FitnessFunction, ParsedSpec } from '../../../src/shared/types/spec.js';
import type { CompiledFunctions } from '../../../src/shared/types/evaluation.js';
import { CompileCommand } from '../../../src/pipeline/commands/compile-command.js';
import type { CompileFactsHolder } from '../../../src/pipeline/commands/compile-command.js';
import { FirewallContext } from '../../../src/shared/context/firewall-context.js';
import { loadReference, REFERENCE_STYLES } from '../../../scripts/v1.3/lib/reference-model.js';
import { must, presetSpec, PRESET_STYLES, ROOT, runPipeline, specAt } from './helpers.js';

const V2 = must(parseInstrumentVersion('v2'), 'instrument v2');

function compile(spec: ParsedSpec, options: CompileOptions): CompiledFunctions {
  const r = compileFunctions(compilerInputFromSpec(spec), options);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

const ids = (c: CompiledFunctions): string[] => c.symbolicQueries.map((q) => String(q.functionId));
const count = (c: CompiledFunctions, id: string): number => ids(c).filter((x) => x === id).length;

const ffp07 = (extra: Partial<FitnessFunction> = {}): FitnessFunction => ({
  id: functionId('FF-P07'), name: 'application-purity', dimension: 'pattern', severity: 'critical', route: 'symbolic',
  isBuiltIn: false, validated: true, enabled: true, excludePaths: [], ...extra,
});

describe('without the option the compile is unchanged (BR-U2-02)', () => {
  it.each([...PRESET_STYLES.map((s) => `presets/${s}.yaml`), 'specs/clean-arch.yaml'])('%s: no options equals postSealRules false; no FF-P07, no added FF-S02', async (rel) => {
    const spec = await specAt(rel);
    const frozen = compile(spec, {});
    expect(JSON.stringify(compile(spec, { postSealRules: false }))).toBe(JSON.stringify(frozen));
    expect(ids(frozen)).not.toContain('FF-P07');
    if (!spec.fitnessFunctions.some((f) => String(f.id) === 'FF-S02')) expect(ids(frozen)).not.toContain('FF-S02');
  });

  it('V13_SEALED_COMPILE_OPTIONS is the pre-U2 V13_COMPILE_OPTIONS: the five presets compile exactly as the committed baseline', async () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'results/v1.4-u2/baseline.json'), 'utf8')) as { presets: Record<string, unknown> };
    for (const style of PRESET_STYLES) {
      const c = compile(await presetSpec(style), { ...V13_SEALED_COMPILE_OPTIONS, instrumentVersion: V2 });
      expect({ style, compiled: JSON.parse(JSON.stringify(c)) as unknown }).toEqual({ style, compiled: baseline.presets[style] });
    }
  });

  it('V13_COMPILE_OPTIONS is the sealed set plus postSealRules', () => {
    expect({ ...V13_COMPILE_OPTIONS, postSealRules: false }).toEqual(V13_SEALED_COMPILE_OPTIONS);
    expect(V13_COMPILE_OPTIONS.postSealRules).toBe(true);
  });
});

describe('with the option (BR-U2-03)', () => {
  const expected: Record<string, { p07: boolean; s02Added: boolean }> = {
    'clean-architecture': { p07: true, s02Added: false },
    layered: { p07: false, s02Added: false },
    nestjs: { p07: true, s02Added: false },
    hexagonal: { p07: true, s02Added: false },
    ddd: { p07: true, s02Added: true },
  };

  it.each(PRESET_STYLES)('%s: per-style membership', async (style) => {
    const spec = await presetSpec(style);
    const on = compile(spec, V13_COMPILE_OPTIONS);
    const sealed = compile(spec, V13_SEALED_COMPILE_OPTIONS);
    const e = must(expected[style], style);
    expect(count(on, 'FF-P07')).toBe(e.p07 ? 1 : 0);
    expect(count(on, 'FF-S02') - count(sealed, 'FF-S02')).toBe(e.s02Added ? 1 : 0);
    expect(count(on, 'FF-S02')).toBeLessThanOrEqual(1);
    if (e.p07) {
      const q = must(on.symbolicQueries.find((x) => String(x.functionId) === 'FF-P07'), 'FF-P07');
      expect(q.params.forbiddenImports).toEqual([...HTTP_DELIVERY_PACKAGES]);
      expect(q.name).toBe('application-purity');
      // The resolved edge view (as domain-purity): reExportHop edges are left out.
      expect(q.cypher).toContain('NOT coalesce(i.reExportHop, false)');
    }
  });

  it.each(PRESET_STYLES)('%s: every pre-existing query keeps its text and params, and its position', async (style) => {
    const spec = await presetSpec(style);
    const on = compile(spec, V13_COMPILE_OPTIONS);
    const sealed = compile(spec, V13_SEALED_COMPILE_OPTIONS);
    for (const q of sealed.symbolicQueries) {
      const same = must(on.symbolicQueries.find((x) => x.functionId === q.functionId), String(q.functionId));
      expect({ id: q.functionId, cypher: same.cypher, params: same.params }).toEqual({ id: q.functionId, cypher: q.cypher, params: q.params });
    }
    const sealedIds = ids(sealed);
    expect(ids(on).filter((id) => sealedIds.includes(id))).toEqual(sealedIds);
  });

  it('a spec-declared FF-P07 wins: disabled stays disabled, its own list is kept', async () => {
    const spec = await presetSpec('clean-architecture');
    const disabled = compile({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, ffp07({ enabled: false, disabledReason: 'framework married (ch. 32)' })] }, V13_COMPILE_OPTIONS);
    expect(ids(disabled)).not.toContain('FF-P07');
    expect(disabled.disabledFunctions.map((d) => String(d.id))).toContain('FF-P07');
    const own = compile({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, ffp07({ forbiddenImports: ['express'] })] }, V13_COMPILE_OPTIONS);
    expect(count(own, 'FF-P07')).toBe(1);
    expect(own.symbolicQueries.find((q) => String(q.functionId) === 'FF-P07')?.params.forbiddenImports).toEqual(['express']);
  });

  it('an unstyled spec gets nothing', async () => {
    const spec = await presetSpec('clean-architecture');
    const { style: _s, ...unstyled } = spec;
    const input = compilerInputFromSpec(unstyled);
    expect(input.style).toBeUndefined();
    expect(applyPostSealRules(input)).toBe(input);
    expect(withPostSealRules(unstyled)).toBe(unstyled);
  });

  it('application-purity declared under another id: no FF-P07, and a warning naming both ids (BR-U2-03.6)', async () => {
    const spec = await presetSpec('hexagonal');
    const c = compile({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, ffp07({ id: functionId('FF-X01'), forbiddenImports: ['express'] })] }, V13_COMPILE_OPTIONS);
    expect(ids(c)).not.toContain('FF-P07');
    expect(count(c, 'FF-X01')).toBe(1);
    const w = c.warnings.filter((x) => x.message.includes('FF-P07') && x.message.includes('FF-X01'));
    expect(w).toHaveLength(1);
    expect(w[0]?.code).toBe('COMPILER_004');
  });

  it('BR-SPEC-10 guards the post-seal template too: application-purity under another id with no forbidden list fails to compile', async () => {
    const spec = await presetSpec('hexagonal');
    const r = compileFunctions(compilerInputFromSpec({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, ffp07({ id: functionId('FF-X01') })] }), V13_COMPILE_OPTIONS);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors.map((e) => e.message)).toEqual(['BR-SPEC-10 FF-X01: forbiddenImports']);
  });

  it('a ddd no-cyclic-deps under a custom id: no FF-S02 added', async () => {
    const spec = await presetSpec('ddd');
    const custom: FitnessFunction = { ...ffp07(), id: functionId('FF-X02'), name: 'no-cyclic-deps', dimension: 'structural' };
    const c = compile({ ...spec, fitnessFunctions: [...spec.fitnessFunctions, custom] }, V13_COMPILE_OPTIONS);
    expect(ids(c)).not.toContain('FF-S02');
    expect(count(c, 'FF-X02')).toBe(1);
  });

  it('Q16 B together with the overlay gives exactly one FF-S02 in ddd (BR-U2-07)', async () => {
    const spec = await presetSpec('ddd');
    const c = compile(spec, { ...V13_COMPILE_OPTIONS, constructSwitches: withAnswers({ Q16: 'B' }) });
    expect(count(c, 'FF-S02')).toBe(1);
    expect(c.symbolicQueries.find((q) => String(q.functionId) === 'FF-S02')?.name).toBe('no-cyclic-deps');
  });

  it('the table is the single source: two rules, the ADR ids and decisions', () => {
    expect(POST_SEAL_RULES.map((r) => [r.ruleId, r.name, r.decision, r.adr, [...r.styles]])).toEqual([
      ['FF-S02', 'no-cyclic-deps', 'D5', 'ADR-V14-01', ['ddd']],
      ['FF-P07', 'application-purity', 'N3', 'ADR-V14-02', ['clean-architecture', 'hexagonal', 'nestjs', 'ddd']],
    ]);
  });
});

describe('identity I1 and the compile facts (BR-U2-03.7)', () => {
  it('CompileCommand counts the overlay functions as declared and lists them in postSealAdded', async () => {
    for (const [style, added] of [['ddd', ['FF-S02', 'FF-P07']], ['clean-architecture', ['FF-P07']], ['layered', []]] as const) {
      const spec = await presetSpec(style);
      const context = new FirewallContext(runId(`u2-${style}`));
      context.setParsedSpec(spec);
      const holder: CompileFactsHolder = {};
      const res = await new CompileCommand(holder).execute(context);
      expect(res.success).toBe(true);
      expect(holder.facts?.postSealRules).toBe(true);
      expect(holder.facts?.postSealAdded).toEqual(added);
      expect(holder.facts?.declared).toBe(spec.fitnessFunctions.length + added.length);
      const off: CompileFactsHolder = {};
      const sealedContext = new FirewallContext(runId(`u2-${style}-off`));
      sealedContext.setParsedSpec(spec);
      await new CompileCommand(off, undefined, undefined, undefined, false).execute(sealedContext);
      expect(off.facts).toMatchObject({ declared: spec.fitnessFunctions.length, postSealRules: false, postSealAdded: [] });
    }
  });

  it.each(REFERENCE_STYLES)('%s reference (clean variant): a v1.3 run with post-seal rules on ends without REPORT_COUNTS_INCONSISTENT', async (style) => {
    const ref = loadReference(ROOT, style);
    const projectDir = ref.format === 'overlay' ? ref.projectDir : path.join(ref.dir, 'project');
    const r = await runPipeline(projectDir, ref.specPath);
    if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
    const spec = await specAt(path.relative(ROOT, ref.specPath));
    const added = POST_SEAL_RULES.filter((x) => x.styles.includes(style) && !spec.fitnessFunctions.some((f) => String(f.id) === x.ruleId));
    expect(r.data.tiers?.tierTable).toBe('Docs/v1.3/rule-tiers.md; Docs/v1.4/rule-tiers-post-seal.md');
    const sealed = await runPipeline(projectDir, ref.specPath, { postSealRules: false });
    if (!sealed.success) throw new Error(sealed.errors.map((e) => e.message).join('; '));
    expect(sealed.data.tiers?.tierTable).toBe('Docs/v1.3/rule-tiers.md');
    expect(r.data.functionExecution.declared - sealed.data.functionExecution.declared).toBe(added.length);
  }, 120_000);
});

describe('reference scope is gated (BR-U2-08)', () => {
  it.each(REFERENCE_STYLES)('%s: loadReference without postSeal gives the pre-U2 scope; with it, the post-seal rules are added once', (style) => {
    const plain = loadReference(ROOT, style);
    const withScope = loadReference(ROOT, style, undefined, { postSeal: true });
    const before = plain.descriptor.scopeRules.map((r) => r.ruleId);
    expect(before).not.toContain('FF-P07');
    if (style === 'ddd') expect(before).not.toContain('FF-S02');
    const after = withScope.descriptor.scopeRules.map((r) => r.ruleId);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(new Set(after).size).toBe(after.length);
    if (style !== 'layered') expect(after).toContain('FF-P07');
    if (style === 'ddd') expect(after).toContain('FF-S02');
  });
});
