/**
 * Advisory post-filters (v1.3 advisory-noise proposal): source facts, each option's decision, the blocking guard, and
 * the report-level filter (blocking rows and every other report field unchanged; the result still matches the schema).
 */
import {
  ADVISORY_FILTER_OPTIONS, applyAdvisoryFilter, parseAdvisoryFilterOptions,
} from '../../../src/advisory-filter/advisory-filter.js';
import type { AdvisoryFilterOption, FilterableFinding, LayerInfo, ProjectView } from '../../../src/advisory-filter/advisory-filter.js';
import { advisoryTierOf } from '../../../src/advisory-filter/project-view.js';
import { filterReportAdvisory } from '../../../src/advisory-filter/report.js';
import { sourceFacts } from '../../../src/advisory-filter/source-facts.js';
import { validateReport } from '../../../src/scoring-engine/report-schema-validator.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { Dimension } from '../../../src/shared/types/enums.js';
import type { EvaluationReport, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { LAYERED_TEMPLATE } from '../../../src/spec-parser/template-registry.js';
import { scoreAndAssemble } from '../scoring-engine/assembled-report-fixture.js';

const SOURCES: Record<string, string> = {
  'src/domain/types.ts': 'export interface Order { id: string }\nexport type State = "a" | "b";\nexport type { Order as O } from "./x";\n',
  'src/domain/index.ts': 'export * from "./types";\nexport { Order } from "./order";\n',
  'src/domain/errors.ts': 'export class DomainError extends Error {\n  constructor(readonly code: string, message: string) {\n    super(message);\n    this.name = "DomainError";\n  }\n}\nexport enum Kind { A, B }\nexport const LIMITS = { max: 3 } as const;\n',
  'src/domain/order.ts': 'export class Order {\n  constructor(private qty: number) {}\n  add(n: number): void {\n    if (n <= 0) throw new Error("bad");\n    this.qty += n;\n  }\n}\n',
  'src/infrastructure/repo.ts': 'import type { Order } from "../domain/order";\nexport class Repo {\n  private rows = new Map<string, Order>();\n  find(id: string): Order | undefined {\n    return this.rows.get(id);\n  }\n}\n',
  'src/infrastructure/wiring.ts': 'import { Repo } from "./repo";\nimport { PlaceOrder } from "../application/place-order";\nexport function build() {\n  const repo = new Repo();\n  return new PlaceOrder(repo);\n}\n',
  'src/infrastructure/routes.ts': 'import { Repo } from "./repo";\nimport { PlaceOrder } from "../application/place-order";\nexport function build(x: number) {\n  if (x > 1) return null;\n  return new PlaceOrder(new Repo());\n}\n',
  'src/application/place-order.ts': 'import type { Port } from "./port";\nimport { Repo } from "../infrastructure/repo";\nimport { Order } from "../domain/order";\nimport type { State } from "../domain/types";\nexport class PlaceOrder {\n  constructor(private readonly repo: Repo) {}\n  run(): void {\n    if (this.repo) new Order(1);\n  }\n}\n',
  'src/application/port.ts': 'export interface Port { save(): void }\n',
  'src/application/service.ts': 'export class Service {\n  constructor(private readonly logger: Logger, private readonly a: A, private readonly b: B) {}\n  get name(): string { return "s"; }\n  onModuleInit(): void {}\n  toJSON(): unknown { return {}; }\n  run(): void {}\n}\n',
  'src/config/container.ts': 'export const x = 1;\n',
  'src/main.ts': 'console.log("hi");\n',
};

const LAYERS: Record<string, LayerInfo> = {
  domain: { name: 'domain', kind: 'domain', role: 'core' },
  application: { name: 'application', kind: 'application', role: 'service' },
  infrastructure: { name: 'infrastructure', kind: 'infrastructure', role: 'adapter' },
};

const view = (extra: Partial<ProjectView> = {}): ProjectView => ({
  readSource: (f) => SOURCES[f],
  layerOf: (f) => LAYERS[f.split('/')[1] ?? ''],
  param: () => undefined,
  fileCount: 20,
  ...extra,
});

const row = (fid: string, file: string, evidence?: string[], discriminator?: string[]): FilterableFinding => ({
  functionId: fid, filePath: file, ...(evidence !== undefined && { evidence }), ...(discriminator !== undefined && { discriminator }),
});

const advisory = (): 'advisory' => 'advisory';
const run = (findings: FilterableFinding[], options: AdvisoryFilterOption[], v: ProjectView = view()): string[] =>
  applyAdvisoryFilter(findings, options, advisory, v).suppressed.map((s) => `${s.finding.functionId} ${s.finding.filePath}`);

describe('sourceFacts', () => {
  it('classifies type-only files, barrels and data-only files as having no logic', () => {
    expect(sourceFacts(SOURCES['src/domain/types.ts'] ?? '')).toMatchObject({ typesOnly: true, noLogic: true });
    expect(sourceFacts(SOURCES['src/domain/index.ts'] ?? '')).toMatchObject({ barrel: true, noLogic: true });
    expect(sourceFacts(SOURCES['src/domain/errors.ts'] ?? '')).toMatchObject({ typesOnly: false, barrel: false, noLogic: true });
  });

  it('sees logic in branches and in method bodies, and thin delegation as no branching', () => {
    expect(sourceFacts(SOURCES['src/domain/order.ts'] ?? '')).toMatchObject({ noLogic: false, noBranching: false, controlFlow: true });
    expect(sourceFacts(SOURCES['src/infrastructure/repo.ts'] ?? '')).toMatchObject({ noLogic: false, noBranching: true, controlFlow: false });
  });

  it('records type-only imports, instantiations and framework members', () => {
    const f = sourceFacts(SOURCES['src/application/place-order.ts'] ?? '');
    expect(f.imports.filter((i) => i.typeOnly).map((i) => i.specifier)).toEqual(['./port', '../domain/types']);
    expect(f.instantiated).toEqual(['Order']);
    const s = sourceFacts(SOURCES['src/application/service.ts'] ?? '').members[0];
    expect(s?.excludedMethods).toEqual(['name (accessor)', 'onModuleInit', 'toJSON']);
    expect(s?.constructorParamTypes).toEqual(['Logger', 'A', 'B']);
  });
});

describe('applyAdvisoryFilter', () => {
  it('keeps every row, in order, with no option', () => {
    const rows = [row('FF-CV05', 'src/domain/types.ts'), row('FF-S01', 'src/domain/order.ts')];
    const r = applyAdvisoryFilter(rows, [], advisory, view());
    expect(r.kept).toEqual(rows);
    expect(r.suppressed).toEqual([]);
  });

  it('never removes a blocking row, whatever an option would say', () => {
    const rows = [row('FF-CV05', 'src/domain/types.ts')];
    const r = applyAdvisoryFilter(rows, [...ADVISORY_FILTER_OPTIONS], () => 'blocking', view());
    expect(r.kept).toEqual(rows);
  });

  it('touches only its own rules', () => {
    expect(run([row('FF-C03', 'src/domain/types.ts'), row('FF-P02', 'src/domain/types.ts')], ['cv05-no-logic'])).toEqual([]);
  });

  it('cv05-no-logic: types, barrels, data classes, config; not logic files', () => {
    const rows = ['src/domain/types.ts', 'src/domain/index.ts', 'src/domain/errors.ts', 'src/domain/order.ts', 'src/infrastructure/repo.ts', 'src/config/app.config.ts']
      .map((f) => row('FF-CV05', f));
    expect(run(rows, ['cv05-no-logic'])).toEqual([
      'FF-CV05 src/domain/types.ts', 'FF-CV05 src/domain/index.ts', 'FF-CV05 src/domain/errors.ts', 'FF-CV05 src/config/app.config.ts',
    ]);
    expect(run(rows, ['cv05-no-branching'])).toContain('FF-CV05 src/infrastructure/repo.ts');
    expect(run(rows, ['cv05-no-branching'])).not.toContain('FF-CV05 src/domain/order.ts');
  });

  it('composition-roots: by name and by structure (class-free, no control flow, two layers)', () => {
    const rows = [row('FF-C03', 'src/config/container.ts'), row('FF-C03', 'src/infrastructure/wiring.ts'),
      row('FF-C03', 'src/infrastructure/routes.ts'), row('FF-C03', 'src/application/place-order.ts')];
    expect(run(rows, ['composition-roots'])).toEqual(['FF-C03 src/config/container.ts', 'FF-C03 src/infrastructure/wiring.ts']);
  });

  it('c03-core-only: keeps domain-kind files, removes other kinds, keeps unknown layers', () => {
    const rows = [row('FF-C03', 'src/domain/order.ts'), row('FF-C03', 'src/application/place-order.ts'), row('FF-C03', 'lib/x.ts')];
    expect(run(rows, ['c03-core-only'])).toEqual(['FF-C03 src/application/place-order.ts']);
  });

  it('c02-abstract-imports: subtracts type-only targets and compares with the threshold', () => {
    const r = row('FF-C02', 'src/application/place-order.ts', ['fanOut=12']);
    expect(run([r], ['c02-abstract-imports'])).toEqual(['FF-C02 src/application/place-order.ts']);
    expect(run([row('FF-C02', 'src/application/place-order.ts', ['fanOut=13'])], ['c02-abstract-imports'])).toEqual([]);
    expect(run([r], ['c02-abstract-imports'], view({ param: () => 9 }))).toEqual([]);
  });

  it('c02-size-scaled: raises the threshold only for projects above 40 files', () => {
    const r = row('FF-C02', 'src/application/place-order.ts', ['fanOut=12']);
    expect(run([r], ['c02-size-scaled'])).toEqual([]);
    expect(run([r], ['c02-size-scaled'], view({ fileCount: 160 }))).toEqual(['FF-C02 src/application/place-order.ts']);
  });

  it('c04-entry-points: root entry files, package.json entries and composition roots', () => {
    const rows = [row('FF-C04', 'src/main.ts'), row('FF-C04', 'src/cli/run.ts'), row('FF-C04', 'src/domain/order.ts')];
    expect(run(rows, ['c04-entry-points'], view({ entryPoints: ['src/cli/run.ts'] }))).toEqual(['FF-C04 src/main.ts', 'FF-C04 src/cli/run.ts']);
  });

  it('so-framework-members: recounts without accessors, lifecycle hooks and framework injections', () => {
    const over = row('FF-SO01', 'src/application/service.ts', ['methodCount=12', 'depCount=6'], ['Service']);
    expect(run([over], ['so-framework-members'])).toEqual(['FF-SO01 src/application/service.ts']);
    const still = row('FF-SO01', 'src/application/service.ts', ['methodCount=14', 'depCount=3'], ['Service']);
    expect(run([still], ['so-framework-members'])).toEqual([]);
  });

  it('cv05-rollup: one row per project when the rule fires on most files; nothing below the share', () => {
    const files = ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts', 'src/e.ts', 'src/domain/types.ts'];
    const rows = [row('FF-C03', 'src/a.ts'), ...files.map((f) => row('FF-CV05', f))];
    const r = applyAdvisoryFilter(rows, ['cv05-no-logic', 'cv05-rollup'], advisory, view({ fileCount: 7 }));
    expect(r.kept.map((x) => `${x.functionId} ${x.filePath}`)).toEqual(['FF-C03 src/a.ts', 'FF-CV05 src/a.ts']);
    expect(r.suppressed.map((x) => x.option)).toEqual(['cv05-no-logic', 'cv05-rollup', 'cv05-rollup', 'cv05-rollup', 'cv05-rollup']);
    expect(applyAdvisoryFilter(rows, ['cv05-rollup'], advisory, view({ fileCount: 8 })).suppressed).toEqual([]);
    expect(applyAdvisoryFilter(rows, ['cv05-rollup'], advisory, view({ fileCount: undefined })).suppressed).toEqual([]);
  });

  it('parses option lists', () => {
    expect(parseAdvisoryFilterOptions('none')).toEqual([]);
    expect(parseAdvisoryFilterOptions('all')).toEqual([...ADVISORY_FILTER_OPTIONS]);
    expect(parseAdvisoryFilterOptions('c03-core-only, cv05-no-logic,c03-core-only')).toEqual(['c03-core-only', 'cv05-no-logic']);
    expect(() => parseAdvisoryFilterOptions('cv05')).toThrow(/unknown advisory filter option/);
  });

  it('advisoryTierOf: the sealed table per style, and a blocking set wins', () => {
    expect(advisoryTierOf('layered', undefined)({ functionId: 'FF-S03' })).toBe('blocking');
    expect(advisoryTierOf('clean-architecture', undefined)({ functionId: 'FF-S03' })).toBe('advisory');
    expect(advisoryTierOf('clean-architecture', new Set(['FF-CV05']))({ functionId: 'FF-CV05' })).toBe('blocking');
  });
});

describe('filterReportAdvisory', () => {
  const graph = (): GraphRepository => ({
    executeQuery: (): Promise<DomainResult<QueryResult>> =>
      Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } })),
    clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
    healthCheck: () => Promise.resolve(true),
    close: () => Promise.resolve(),
  });
  const v = (id: string, dim: Dimension, file: string): Violation => ({
    id: `v-${id}-${file}`, type: 'LAYER_VIOLATION', dimension: dim, severity: 'critical', functionId: functionId(id),
    route: 'symbolic', filePath: file, message: `row ${file}`, deterministic: true,
  });
  const sym = (id: string, dim: Dimension, rows: Violation[]): SymbolicFunctionResult =>
    ({ functionId: functionId(id), dimension: dim, passed: rows.length === 0, violations: rows, executionTimeMs: 1, deterministic: true });

  async function report(): Promise<EvaluationReport> {
    const r = await scoreAndAssemble({
      evaluationResults: {
        symbolicResults: [
          sym('FF-S01', 'structural', [v('FF-S01', 'structural', 'src/domain/types.ts')]),
          sym('FF-CV05', 'convention', [v('FF-CV05', 'convention', 'src/domain/types.ts'), v('FF-CV05', 'convention', 'src/domain/order.ts')]),
        ],
        neuronalResults: [],
      },
      scoringWeights: { structural: 0.35, coupling: 0.20, pattern: 0.30, solid: 0.10, convention: 0.05, semantic: 0, integrity: 0 },
      confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
      verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
      mode: 'symbolic-only', projectPath: '/p', specVersion: '1.0.0', graphRepository: graph(),
      fitnessFunctions: LAYERED_TEMPLATE.functions,
      compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
      noJudgeUnits: [], scoringMode: 'v1.3', style: 'layered',
    });
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
    return r.data;
  }

  it('is the identity with no option', async () => {
    const r = await report();
    expect(filterReportAdvisory(r, [], view())).toBe(r);
  });

  it('moves matched advisory rows to advisoryFilter and leaves everything else byte-identical', async () => {
    const r = await report();
    const f = filterReportAdvisory(r, ['cv05-no-logic'], view());
    expect(f.violations.map((x) => `${x.functionId} ${x.filePath}`)).toEqual(['FF-S01 src/domain/types.ts', 'FF-CV05 src/domain/order.ts']);
    expect(f.advisoryFilter?.suppressed.map((s) => [s.option, s.violation.filePath])).toEqual([['cv05-no-logic', 'src/domain/types.ts']]);
    const { violations: _a, advisoryFilter: _b, ...rest } = f;
    const { violations: _c, ...before } = r;
    expect(JSON.stringify(rest)).toBe(JSON.stringify(before));
    const blocking = (x: EvaluationReport): string => JSON.stringify(x.violations.filter((y) => y.functionId === 'FF-S01'));
    expect(blocking(f)).toBe(blocking(r));
    expect(validateReport(f).success).toBe(true);
  });
});
