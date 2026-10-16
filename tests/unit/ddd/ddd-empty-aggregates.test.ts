/**
 * Loop-pilot tool defect T1 (`src/fitness-compiler/empty-aggregates.ts`): a ddd spec with no aggregate that keeps
 * FF-DT01/FF-DT02. The default (no option, or `fail`) is the status quo, BR-SPEC-10; each option is opt-in.
 */
import * as path from 'node:path';
import * as os from 'node:os';
import { compileFunctions, V13_COMPILE_OPTIONS } from '../../../src/fitness-compiler/fitness-compiler.js';
import type { CompileOptions } from '../../../src/fitness-compiler/fitness-compiler.js';
import { compilerInputFromSpec } from '../../../src/fitness-compiler/compiler-input.js';
import {
  aggregateRulesWithoutAggregates, EMPTY_AGGREGATE_POLICIES, EMPTY_AGGREGATES_REASON, parseEmptyAggregatePolicy,
} from '../../../src/fitness-compiler/empty-aggregates.js';
import type { CompilerInput } from '../../../src/fitness-compiler/types.js';
import { parseSpec } from '../../../src/spec-parser/spec-parser.js';
import { validateSpecAgainstProject } from '../../../src/spec-parser/spec-validator.js';
import type { ParsedSpec } from '../../../src/shared/types/spec.js';
import { must } from './reference-project.js';

const ROOT = path.resolve(__dirname, '../../..');
const PRESET = path.join(ROOT, 'presets/ddd.yaml');
const V13 = { ...V13_COMPILE_OPTIONS };

async function presetSpec(): Promise<ParsedSpec> {
  const r = await parseSpec({ specFilePath: PRESET }, { strictMode: true });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

function withoutAggregates(spec: ParsedSpec): ParsedSpec {
  return { ...spec, layerModel: { ...spec.layerModel, ddd: { ...must(spec.layerModel.ddd, 'ddd'), aggregates: [] } } };
}

const input = (spec: ParsedSpec): CompilerInput => compilerInputFromSpec(spec);
const compile = (spec: ParsedSpec, options: CompileOptions) => compileFunctions(input(spec), options);
const ids = (xs: readonly { functionId: unknown }[]): string[] => xs.map((q) => String(q.functionId));

describe('T1 empty aggregates: the default is unchanged', () => {
  it('V13_COMPILE_OPTIONS names no policy', () => {
    expect('emptyAggregates' in V13_COMPILE_OPTIONS).toBe(false);
  });

  it('without a policy, and with fail, the compile fails with BR-SPEC-10 on FF-DT01 and FF-DT02', async () => {
    const spec = withoutAggregates(await presetSpec());
    for (const options of [V13, { ...V13, emptyAggregates: 'fail' as const }]) {
      const r = compile(spec, options);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errors.map((e) => e.message)).toEqual(['BR-SPEC-10 FF-DT01: aggregates', 'BR-SPEC-10 FF-DT02: aggregates']);
    }
  });

  it('a spec that declares aggregates compiles identically under every policy', async () => {
    const spec = await presetSpec();
    const base = compile(spec, V13);
    expect(base.success).toBe(true);
    for (const p of EMPTY_AGGREGATE_POLICIES) expect(compile(spec, { ...V13, emptyAggregates: p })).toEqual(base);
  });

  it('a non-ddd input is never touched', () => {
    const fake = { style: 'hexagonal', fitnessFunctions: [], adrRules: [], layerModel: { layers: [] } } as unknown as CompilerInput;
    expect(aggregateRulesWithoutAggregates(fake)).toEqual([]);
  });
});

describe('T1 empty aggregates: the options', () => {
  it('a (not-applicable): FF-DT01/02 disabled with the reason, recorded as COMPILER_004', async () => {
    const r = compile(withoutAggregates(await presetSpec()), { ...V13, emptyAggregates: 'not-applicable' });
    const data = must(r.success ? r.data : undefined, 'compiled');
    expect(ids(data.symbolicQueries)).not.toEqual(expect.arrayContaining(['FF-DT01']));
    expect(ids(data.symbolicQueries)).not.toEqual(expect.arrayContaining(['FF-DT02']));
    const disabled = data.disabledFunctions.filter((d) => ['FF-DT01', 'FF-DT02'].includes(String(d.id)));
    expect(disabled.map((d) => [String(d.id), d.reason])).toEqual([['FF-DT01', EMPTY_AGGREGATES_REASON], ['FF-DT02', EMPTY_AGGREGATES_REASON]]);
    expect(data.warnings.filter((w) => w.code === 'COMPILER_004' && w.message.includes('not-applicable')).map((w) => w.functionId)).toEqual(['FF-DT01', 'FF-DT02']);
  });

  it('c (exclude): FF-DT01/02 neither compiled nor disabled, recorded as COMPILER_006', async () => {
    const r = compile(withoutAggregates(await presetSpec()), { ...V13, emptyAggregates: 'exclude' });
    const data = must(r.success ? r.data : undefined, 'compiled');
    const all = [...ids(data.symbolicQueries), ...data.disabledFunctions.map((d) => String(d.id))];
    expect(all).not.toContain('FF-DT01');
    expect(all).not.toContain('FF-DT02');
    expect(data.warnings.filter((w) => w.code === 'COMPILER_006').map((w) => w.message))
      .toEqual(['FF-DT01, FF-DT02 excluded from scoring: architecture.ddd.aggregates is empty (T1 option c)']);
  });

  it('d (vacuous): FF-DT01/02 compile with an empty aggregates list and nothing records it', async () => {
    const r = compile(withoutAggregates(await presetSpec()), { ...V13, emptyAggregates: 'vacuous' });
    const data = must(r.success ? r.data : undefined, 'compiled');
    const dt = data.symbolicQueries.filter((q) => ['FF-DT01', 'FF-DT02'].includes(String(q.functionId)));
    expect(dt.map((q) => q.params.aggregates)).toEqual([[], []]);
    expect(data.warnings.some((w) => w.message.includes('T1'))).toBe(false);
  });

  it('a, c and d compile the same queries for every other rule', async () => {
    const spec = withoutAggregates(await presetSpec());
    const rest = (p: 'not-applicable' | 'exclude' | 'vacuous') => {
      const r = compile(spec, { ...V13, emptyAggregates: p });
      return must(r.success ? r.data : undefined, p).symbolicQueries.filter((q) => !['FF-DT01', 'FF-DT02'].includes(String(q.functionId)));
    };
    expect(rest('exclude')).toEqual(rest('not-applicable'));
    expect(rest('vacuous')).toEqual(rest('not-applicable'));
  });

  it('b (validator): off by default; on, one DDD_NO_AGGREGATES error per aggregate rule', async () => {
    const spec = withoutAggregates(await presetSpec());
    const codes = (o: { rejectEmptyAggregates?: boolean }) => validateSpecAgainstProject(spec, os.tmpdir(), { rules: 'v1.3', ...o }).errors
      .filter((e) => e.code === 'DDD_NO_AGGREGATES').map((e) => e.message);
    expect(codes({})).toEqual([]);
    expect(codes({ rejectEmptyAggregates: true })).toEqual([
      'FF-DT01 (aggregate-boundary) needs an aggregate, but architecture.ddd.aggregates is empty',
      'FF-DT02 (repository-aggregate-root) needs an aggregate, but architecture.ddd.aggregates is empty',
    ]);
    const declared = validateSpecAgainstProject(await presetSpec(), os.tmpdir(), { rules: 'v1.3', rejectEmptyAggregates: true }).errors;
    expect(declared.filter((e) => e.code === 'DDD_NO_AGGREGATES')).toEqual([]);
  });

  it('the CLI policy names parse, anything else does not', () => {
    for (const p of EMPTY_AGGREGATE_POLICIES) expect(parseEmptyAggregatePolicy(p)).toBe(p);
    expect(parseEmptyAggregatePolicy('drop')).toBeUndefined();
  });
});
