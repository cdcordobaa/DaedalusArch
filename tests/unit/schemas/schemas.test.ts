/**
 * Report schema (frozen at U3-R10, FR-14) and manifest draft (U0 Step 29, FR-24).
 * The report fixtures are scored and assembled as the pipeline does (`computeScores` was removed
 * at U3-R10); the U3 schema rules themselves are tested in tests/unit/scoring-engine/report-schema.test.ts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Ajv } from 'ajv';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { scoreAndAssemble, stubNeuralRows } from '../scoring-engine/assembled-report-fixture.js';
import { formatJSON } from '../../../src/scoring-engine/report-formatter.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { DIMENSIONS, EDGE_TYPES, NODE_TYPES } from '../../../src/shared/types/enums.js';
import { BUILT_IN_VIOLATION_TYPES } from '../../../src/shared/taxonomy/violation-types.js';
import { ahsScore, avrScore, confidence, functionId, runId } from '../../../src/shared/types/value-objects.js';
import type { EvaluationReport, NeuronalFunctionResult, SymbolicFunctionResult } from '../../../src/shared/types/evaluation.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { ConfidenceThresholds, ScoringWeights, VerdictThresholds } from '../../../src/shared/types/spec.js';
import type { Dimension } from '../../../src/shared/types/enums.js';

const SCHEMAS_DIR = resolve(__dirname, '../../../schemas');

function loadSchema(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(SCHEMAS_DIR, name), 'utf8')) as Record<string, unknown>;
}

const reportSchema = loadSchema('report.schema.json');
const manifestSchema = loadSchema('manifest.schema.json');

function newAjv(): Ajv {
  // Union types (`["integer","null"]`) are part of the frozen report schema (U3-R10).
  const ajv = new Ajv({ strict: true, allErrors: true, allowUnionTypes: true, strictRequired: false });
  addFormats(ajv);
  return ajv;
}

function errorsOf(validate: ValidateFunction): string {
  return JSON.stringify(validate.errors ?? []);
}

// --- scoring-engine fixture (same shape as tests/unit/scoring-engine/scoring-engine.test.ts) ---

const WEIGHTS: ScoringWeights = {
  structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, integrity: 0,
};
const FULL_WEIGHTS: ScoringWeights = {
  structural: 0.32, coupling: 0.18, pattern: 0.27, solid: 0.1, convention: 0.05, semantic: 0.04, integrity: 0.04,
};
const THRESHOLDS: VerdictThresholds = { pass: 0.8, warning: 0.65, softBlock: 0.5 };
const CONF_THRESHOLDS: ConfidenceThresholds = { high: 0.85, medium: 0.6, iccMinimum: 0.7 };

function mockGraphRepo(): GraphRepository {
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      return Promise.resolve(DomainResult.ok({ records: [{ cnt: 0, val: 0 }], summary: { counters: {} } }));
    },
    clearGraph() {
      return Promise.resolve(DomainResult.ok(undefined));
    },
    healthCheck() {
      return Promise.resolve(true);
    },
    close() {
      return Promise.resolve();
    },
  };
}

const symResult = (id: string, dim: Dimension, passed: boolean): SymbolicFunctionResult => ({
  functionId: functionId(id),
  dimension: dim,
  passed,
  violations: passed
    ? []
    : [{
        id: `v-${id}`, type: 'LAYER_VIOLATION', dimension: dim, severity: 'critical',
        functionId: functionId(id), route: 'symbolic', filePath: 'src/test.ts',
        sourceLayer: 'domain', targetLayer: 'infrastructure',
        message: 'test violation', evidence: ['src/test.ts -> src/infra.ts'], deterministic: true,
      }],
  executionTimeMs: 10,
  deterministic: true,
});

const neurResult = (id: string, dim: Dimension, verdict: 'pass' | 'fail', conf: number): NeuronalFunctionResult => ({
  functionId: functionId(id),
  dimension: dim,
  verdict,
  confidence: confidence(conf),
  confidenceStdDev: 0.05,
  icc: 0,
  reasoning: 'test',
  evidence: [],
  violations: verdict === 'fail'
    ? [{
        id: `nv-${id}`, type: 'SEMANTIC_RULE_VIOLATION', dimension: dim, severity: 'major',
        functionId: functionId(id), route: 'neuronal', filePath: 'src/test.ts',
        message: 'semantic violation', deterministic: false,
      }]
    : [],
  runs: [{ runIndex: 0, verdict, confidence: confidence(conf), reasoning: 'test' }],
  deterministic: false,
  flaggedUnstable: false,
  unitResults: [],
  unitsSelected: 0,
  unitsCapped: 0,
});

async function formattedReport(mode: 'symbolic-only' | 'full'): Promise<unknown> {
  const result = await scoreAndAssemble({
    evaluationResults: {
      symbolicResults: [
        symResult('FF-S01', 'structural', true),
        symResult('FF-P01', 'pattern', false),
      ],
      neuronalResults: mode === 'full' ? [neurResult('FF-SEM01', 'semantic', 'fail', 0.9)] : [],
    },
    scoringWeights: WEIGHTS,
    ...(mode === 'full' ? { fullModeWeights: FULL_WEIGHTS } : {}),
    confidenceThresholds: CONF_THRESHOLDS,
    verdictThresholds: THRESHOLDS,
    mode,
    projectPath: '/test/project',
    specVersion: '1.0.0',
    graphRepository: mockGraphRepo(),
    fitnessFunctions: [],
    compiled: { symbolicQueries: [], neuronalInstructions: [], hybridPairs: [], totalCompiled: 0, disabledFunctions: [], warnings: [] },
    noJudgeUnits: [],
  });
  if (!result.success) {
    throw new Error(`scoreAndAssemble failed: ${JSON.stringify(result.errors)}`);
  }
  return JSON.parse(formatJSON(result.data)) as unknown;
}

// Every D-U0-2 optional field with its full sub-shape, plus every optional Violation field.
const fullReport: EvaluationReport = {
  runId: runId('run-full-shape'),
  projectPath: '/test/project',
  specVersion: '1.0.0',
  ahsDeterministic: ahsScore(0.82),
  ahsCombined: ahsScore(0.8),
  ahsNeuronal: ahsScore(0.7),
  verdict: 'pass',
  scoring: {
    weights: WEIGHTS,
    fullModeWeights: FULL_WEIGHTS,
    thresholds: THRESHOLDS,
    confidenceThresholds: CONF_THRESHOLDS,
    verdictSource: 'ahsCombined',
  },
  perDimensionScores: [
    { dimension: 'structural', avr: avrScore(1), violatedWeight: 2, weight: 0.35, effectiveWeight: 0.5, violationCount: 0, functionCount: 2 },
    { dimension: 'integrity', avr: avrScore(0.5), violatedWeight: 0.5, weight: 0.1, effectiveWeight: 0.5, violationCount: 1, functionCount: 1 },
  ],
  violations: [
    {
      id: 'v-1', type: 'DOMAIN_STATE_PURITY_VIOLATION', dimension: 'structural', severity: 'major',
      functionId: functionId('FF-S09'), route: 'symbolic', filePath: 'src/domain/order.ts',
      sourceLayer: 'domain', targetLayer: 'infrastructure', message: 'flows to infrastructure',
      evidence: ['order.ts:12'], deterministic: true, line: 12, lines: [12, 14], target: 'src/infra/db.ts',
      isTypeOnly: false, tag: 'topological', discriminator: ['src/domain/order.ts', 'src/infra/db.ts'],
    },
    {
      id: 'v-2', type: 'CUSTOM_TEAM_RULE', dimension: 'integrity', severity: 'minor',
      functionId: functionId('FF-I01'), route: 'neuronal', filePath: 'src/app/service.ts',
      message: 'integrity issue', deterministic: false, unitId: 'OrderService@src/app/service.ts',
    },
  ],
  universalMetrics: {
    cyclicDependencyCount: 0, maxFanOut: 4, maxFanIn: 3, abstractionRatio: 0.25, averageInstability: 0.4, orphanFileCount: 1,
  },
  evaluationMode: 'full',
  durationMs: 1234,
  warnings: [{ code: 'EVAL_001', message: 'query failed', stage: 'evaluation', context: { functionId: 'FF-X' } }],
  functionExecution: {
    declared: 3,
    adrDerived: 0,
    compiled: 3,
    disabled: 1,
    dropped: [],
    skippedByMode: 0,
    noJudgeUnits: [],
    executed: 2,
    failed: [{ functionId: functionId('FF-X'), name: 'broken', code: 'EVAL_001', message: 'syntax error' }],
  },
  functionResults: [
    {
      functionId: functionId('FF-S09'), name: 'domain-state-purity', dimension: 'structural', route: 'symbolic',
      tag: 'topological', passed: false, violationCount: 1, executionTimeMs: 12.5, truncated: false,
    },
    {
      functionId: functionId('FF-I01'), name: 'integrity', dimension: 'integrity', route: 'neuronal',
      passed: false, violationCount: 1, executionTimeMs: 900, truncated: false,
    },
  ],
  disabledFunctions: [{ functionId: functionId('FF-P05'), name: 'repository-pattern', reason: 'disabled in spec' }],
  graphStats: {
    nodeCount: 10,
    edgeCount: 12,
    layerCoverage: 0.9,
    nodeCountByType: { File: 5, Class: 3, Package: 2 },
    edgeCountByType: { IMPORTS: 8, FLOWS_TO: 2, RE_EXPORTS: 2 },
  },
  layerAnnotation: { mapped: 4, unmapped: 1, unmappedFiles: ['src/misc.ts'] },
  parseCoverage: { total: 5, parsed: 4, percentage: 80, skipped: [{ filePath: 'src/bad.ts', reason: 'parse error' }] },
  importResolution: { resolvedInternal: 6, external: 2, unresolved: 1, unsupportedDynamic: 0, externalOutOfRootAlias: 0, droppedNoFileNode: 0 },
  timings: {
    stages: [
      { name: 'extract', durationMs: 100, status: 'success' },
      { name: 'critic', durationMs: 0, status: 'skipped' },
    ],
    totalMs: 1234,
  },
  droppedDimensions: [{ dimension: 'coupling', reason: 'execution_failure', declared: 2, executed: 0 }],
  judge: { provider: 'claude-cli', model: 'claude-model', effort: 'high', cliVersion: '1.0.0', cassetteMode: 'replay', runsPerUnit: 3 },
  neuralResults: stubNeuralRows([neurResult('FF-I01', 'integrity', 'fail', 0.9)]),
};

describe('schema drafts', () => {
  it('both compile under Ajv strict mode with ajv-formats', () => {
    const ajv = newAjv();
    expect(() => ajv.compile(reportSchema)).not.toThrow();
    expect(() => ajv.compile(manifestSchema)).not.toThrow();
  });

  it('are draft-07 schemas with the agreed $id values; the report schema is frozen (U3-R10), the manifest a draft', () => {
    expect(reportSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(manifestSchema.$schema).toBe('http://json-schema.org/draft-07/schema#');
    expect(reportSchema.$id).toBe('https://daedalus-arch.local/schemas/report.schema.json');
    expect(manifestSchema.$id).toBe('https://daedalus-arch.local/schemas/manifest.schema.json');
    expect(String(reportSchema.$comment)).toMatch(/^FROZEN at U3-R10 /);
    expect(String(manifestSchema.$comment)).toMatch(/^FROZEN \(U5a\)\. /);
  });
});

describe('report.schema.json', () => {
  const validate = newAjv().compile(reportSchema);
  const definitions = reportSchema.definitions as Record<string, Record<string, unknown>>;

  it('takes its enums from NODE_TYPES, EDGE_TYPES, DIMENSIONS and BUILT_IN_VIOLATION_TYPES', () => {
    expect(definitions.nodeType?.enum).toEqual([...NODE_TYPES]);
    expect(definitions.edgeType?.enum).toEqual([...EDGE_TYPES]);
    expect(definitions.dimension?.enum).toEqual([...DIMENSIONS]);
    const anyOf = definitions.violationType?.anyOf as Record<string, unknown>[];
    expect(anyOf[0]?.enum).toEqual([...BUILT_IN_VIOLATION_TYPES]);
  });

  it('requires every run-level field (D-U0-2, BR-U3-55; frozen at U3-R10)', () => {
    expect(reportSchema.required).toEqual([
      'runId', 'projectPath', 'specVersion', 'evaluationMode', 'durationMs', 'verdict', 'scoring', 'perDimensionScores',
      'droppedDimensions', 'violations', 'functionExecution', 'functionResults', 'disabledFunctions', 'universalMetrics',
      'graphStats', 'layerAnnotation', 'parseCoverage', 'importResolution', 'timings', 'judge', 'warnings',
    ]);
  });

  it.each([['symbolic-only' as const], ['full' as const]])(
    'validates the formatJSON output of a scored and assembled fixture (%s)',
    async (mode) => {
      const report = await formattedReport(mode);
      const ok = validate(report);
      expect(errorsOf(validate)).toBe('[]');
      expect(ok).toBe(true);
    },
  );

  it('validates a full-shape sample report with every new field', () => {
    const ok = validate(JSON.parse(JSON.stringify(fullReport)));
    expect(errorsOf(validate)).toBe('[]');
    expect(ok).toBe(true);
  });

  it('rejects a report missing a required field, an unknown dimension, or an unknown property', () => {
    const base = JSON.parse(JSON.stringify(fullReport)) as Record<string, unknown>;
    const { verdict: _verdict, ...noVerdict } = base;
    expect(validate(noVerdict)).toBe(false);
    expect(validate({ ...base, perDimensionScores: [{ dimension: 'speed', avr: 1, weight: 1, violationCount: 0, functionCount: 0 }] })).toBe(false);
    expect(validate({ ...base, extra: true })).toBe(false);
    expect(validate({ ...base, graphStats: { ...fullReport.graphStats, nodeCountByType: { Module: 1 } } })).toBe(false);
  });

  it('rejects a report whose importResolution lacks droppedNoFileNode (U2 Q5)', () => {
    const base = JSON.parse(JSON.stringify(fullReport)) as Record<string, unknown>;
    const { droppedNoFileNode: _dropped, ...importResolution } = base.importResolution as Record<string, unknown>;
    expect(validate({ ...base, importResolution })).toBe(false);
    expect(errorsOf(validate)).toContain('droppedNoFileNode');
  });
});

describe('manifest.schema.json', () => {
  // FROZEN (U5a) manifest cases (U5a plan Step 5; BR-U5a-02, 20, 22, 26, 31, 32, 34, 55; D-U5a-14).
  const validate = newAjv().compile(manifestSchema);
  type Json = Record<string, unknown>;
  const SHA1 = '7cd15b4b7c364284a468e6fcf12c1577633ed1fa';
  const SHA256 = 'a'.repeat(64);

  const key = (over: Json = {}): Json => ({
    functionId: 'FF-S01',
    filePath: 'src/domain/entities/Task.ts',
    target: 'src/infrastructure/InMemoryTaskRepository.ts',
    discriminator: ['IMPORTS'],
    lineRule: 'site-line',
    line: 3,
    ...over,
  });
  const cycleCollateral = (): Json => ({
    kind: 'site',
    template: 'no-cyclic-deps',
    functionId: 'FF-S02',
    cause: 'cycle',
    key: key({
      functionId: 'FF-S02',
      filePath: 'src/a.ts,src/b.ts,src/a.ts',
      target: 'src/b.ts',
      discriminator: ['["src/a.ts","src/b.ts","src/a.ts"]'],
      lineRule: 'first-edge-line',
    }),
  });
  const positive = (over: Json = {}): Json => ({
    functionIds: ['FF-S01', 'FF-S04'],
    disabledFunctionIds: [],
    absentTemplates: [],
    dimension: 'structural',
    keys: [key()],
    collateral: [cycleCollateral()],
    coverage: 'in',
    ...over,
  });
  const twin = (over: Json = {}): Json => ({
    negative: true,
    twinOf: 'MO-S01',
    functionIds: [],
    keys: [],
    collateral: [],
    coverage: 'in',
    ...over,
  });
  const judgeProbe = (over: Json = {}): Json =>
    positive({ functionIds: [], keys: [], collateral: [], dimension: 'semantic', coverage: 'outside', judgeProbe: 'semantic', ...over });
  const row = (over: Json = {}): Json => ({
    seedId: 'correct-reference:MO-S01:0',
    projectId: 'correct-reference',
    baseKind: 'fixture',
    baseCommit: SHA1,
    baseTreeSha: SHA1,
    specPath: 'specs/clean-arch.yaml',
    specSha256: SHA256,
    split: 'dev',
    operatorId: 'MO-S01',
    catalogueVersion: SHA256,
    rngSeed: 42,
    seedDerivation: { projectId: 'correct-reference', operatorId: 'MO-S01', k: 0 },
    siteIndex: 0,
    siteSelection: 'forced',
    site: { filePath: 'src/domain/entities/Task.ts', line: 3, kind: 'import-edge', detail: { targetFile: 'src/infrastructure/InMemoryTaskRepository.ts' } },
    editedFiles: ['src/domain/entities/Task.ts'],
    createdFiles: [],
    lineShifts: [{ filePath: 'src/domain/entities/Task.ts', afterLine: 2, delta: 1 }],
    expected: positive(),
    provisionedStubs: [],
    typecheck: { tscPath: '/repo/node_modules/typescript/lib/tsc.js', tscVersion: '5.9.3', baseErrors: 0, mutantErrors: 0 },
    appliedAt: '2026-10-08T12:00:00Z',
    ...over,
  });
  const rejection = (reason: string, over: Json = {}): Json => ({
    operatorId: 'MO-S01',
    projectId: 'correct-reference',
    reason,
    detail: 'scrubbed detail',
    appliedAt: '2026-10-08T12:00:00Z',
    ...over,
  });
  const manifestOf = (rows: Json[], over: Json = {}): Json => ({
    schemaVersion: '1',
    catalogueVersion: SHA256,
    masterSeed: 20261008,
    cycleStrategy: 'simple-cycles',
    rows,
    rejections: [],
    ...over,
  });
  const valid = (m: Json): boolean => validate(m);
  const rowValid = (r: Json): boolean => valid(manifestOf([r]));
  const without = (o: Json, field: string): Json => Object.fromEntries(Object.entries(o).filter(([k]) => k !== field));

  it('validates a complete positive row, a twin row, a judge-probe row and each rejection kind', () => {
    const m = manifestOf(
      [
        row(),
        row({ seedId: 'correct-reference:MO-S01n:0', operatorId: 'MO-S01n', expected: twin() }),
        row({ seedId: 'correct-reference:MO-X02:0', operatorId: 'MO-X02', expected: judgeProbe(), site: { filePath: 'src/application/x.ts', line: 1, kind: 'guard-move', detail: {} } }),
      ],
      {
        rejections: [
          rejection('no-site'),
          rejection('precondition'),
          rejection('typecheck', { rngSeed: 7, seedDerivation: { projectId: 'correct-reference', operatorId: 'MO-S01', k: 1 } }),
          rejection('apply-error'),
        ],
      },
    );
    const ok = valid(m);
    expect(errorsOf(validate)).toBe('[]');
    expect(ok).toBe(true);
  });

  it('requires the header cycleStrategy and accepts only its two values (D-U5a-14)', () => {
    expect(valid(without(manifestOf([row()]), 'cycleStrategy'))).toBe(false);
    expect(valid(manifestOf([row()], { cycleStrategy: 'tarjan' }))).toBe(false);
    expect(valid(manifestOf([row()], { cycleStrategy: 'scc' }))).toBe(true);
  });

  it.each(['schemaVersion', 'catalogueVersion', 'masterSeed', 'cycleStrategy', 'rows', 'rejections'])(
    'rejects a manifest without %s',
    (field) => {
      expect(valid(without(manifestOf([row()]), field))).toBe(false);
    },
  );

  it.each([
    'seedId', 'projectId', 'baseKind', 'baseTreeSha', 'specPath', 'specSha256', 'split', 'operatorId',
    'catalogueVersion', 'rngSeed', 'seedDerivation', 'siteIndex', 'siteSelection', 'site', 'editedFiles',
    'createdFiles', 'lineShifts', 'expected', 'provisionedStubs', 'typecheck', 'appliedAt', 'baseCommit',
  ])('rejects a fixture row without %s (BR-U5a-31, 32)', (field) => {
    expect(rowValid(without(row(), field))).toBe(false);
  });

  it('accepts a row without installLockSha256 and with a 64-hex one; rejects a short one', () => {
    expect(rowValid(row({ installLockSha256: SHA256 }))).toBe(true);
    expect(rowValid(row({ installLockSha256: 'abc' }))).toBe(false);
  });

  it('rejects an extra property on a row and in site, expected, lineShifts[] and keys[]', () => {
    const base = row();
    expect(rowValid({ ...base, extra: 1 })).toBe(false);
    expect(rowValid(row({ site: { ...(base.site as Json), extra: 1 } }))).toBe(false);
    expect(rowValid(row({ expected: positive({ extra: 1 }) }))).toBe(false);
    expect(rowValid(row({ expected: twin({ extra: 1 }) }))).toBe(false);
    expect(rowValid(row({ lineShifts: [{ filePath: 'a.ts', afterLine: 1, delta: 1, extra: 1 }] }))).toBe(false);
    expect(rowValid(row({ expected: positive({ keys: [key({ extra: 1 })] }) }))).toBe(false);
  });

  it('rejects a site kind outside SiteKind and a lineShift with delta 0', () => {
    expect(rowValid(row({ site: { filePath: 'a.ts', line: 1, kind: 'rename', detail: {} } }))).toBe(false);
    expect(rowValid(row({ lineShifts: [{ filePath: 'a.ts', afterLine: 1, delta: 0 }] }))).toBe(false);
    expect(rowValid(row({ lineShifts: [{ filePath: 'a.ts', afterLine: 1, delta: -2 }] }))).toBe(true);
  });

  it.each([
    ['fixture', 'held-out', false],
    ['corpus', 'dev', false],
    ['generated', 'probe', false],
    ['fixture', 'dev', true],
    ['fixture', 'probe', true],
    ['corpus', 'held-out', true],
    ['generated', 'held-out', true],
  ])('baseKind %s with split %s: valid = %s (BR-U5a-02)', (baseKind, split, ok) => {
    const r = row({ baseKind, split, siteSelection: 'sampled' });
    expect(rowValid(baseKind === 'generated' ? without({ ...r, baseGenerationTreeSha: SHA1 }, 'baseCommit') : r)).toBe(ok);
  });

  it('enforces provenance by base kind (BR-U5a-32)', () => {
    const generated = without(row({ baseKind: 'generated', split: 'held-out', siteSelection: 'sampled', baseGenerationTreeSha: SHA1 }), 'baseCommit');
    expect(rowValid(generated)).toBe(true);
    expect(rowValid({ ...generated, baseCommit: SHA1 })).toBe(false);
    expect(rowValid(without(generated, 'baseGenerationTreeSha'))).toBe(false);
    expect(rowValid(row({ baseGenerationTreeSha: SHA1 }))).toBe(false);
    expect(rowValid(without(row({ baseKind: 'corpus', split: 'held-out', siteSelection: 'sampled' }), 'baseCommit'))).toBe(false);
  });

  it.each([
    ['short', '7cd15b4'],
    ['uppercase', '7CD15B4B7C364284A468E6FCF12C1577633ED1FA'],
    ['non-hex', 'z'.repeat(40)],
  ])('rejects a %s baseCommit', (_label, baseCommit) => {
    expect(rowValid(row({ baseCommit }))).toBe(false);
    expect(JSON.stringify(validate.errors)).toContain('baseCommit');
  });

  it('rejects a bad appliedAt, a non-uint32 rngSeed and a wrong schemaVersion', () => {
    expect(rowValid(row({ appliedAt: 'yesterday' }))).toBe(false);
    expect(rowValid(row({ rngSeed: 1.5 }))).toBe(false);
    expect(rowValid(row({ rngSeed: -1 }))).toBe(false);
    expect(rowValid(row({ rngSeed: 4294967296 }))).toBe(false);
    expect(valid(manifestOf([row()], { schemaVersion: '2' }))).toBe(false);
  });

  it("rejects dimension 'data-flow' (BR-U5a-21)", () => {
    expect(rowValid(row({ expected: positive({ dimension: 'data-flow' }) }))).toBe(false);
  });

  it('requires lineRule on every key and line exactly when lineRule is not none (BR-U5a-20)', () => {
    expect(rowValid(row({ expected: positive({ keys: [without(key(), 'lineRule')] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ keys: [key({ lineRule: 'none' })] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ keys: [without(key({ lineRule: 'site-line' }), 'line')] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ keys: [without(key({ lineRule: 'none' }), 'line')] }) }))).toBe(true);
  });

  it('requires a key on collateral except project-metric, and metric exactly on metric-crossing (BR-U5a-14)', () => {
    expect(rowValid(row({ expected: positive({ collateral: [without(cycleCollateral(), 'key')] }) }))).toBe(false);
    const projectMetric: Json = { kind: 'site', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' };
    expect(rowValid(row({ expected: positive({ collateral: [projectMetric] }) }))).toBe(true);
    const crossing: Json = {
      kind: 'site',
      template: 'module-fan-out',
      functionId: 'FF-C02',
      cause: 'metric-crossing',
      key: without(key({ functionId: 'FF-C02', target: '', discriminator: [], lineRule: 'none' }), 'line'),
      metric: { base: null, mutant: 11, threshold: 10 },
    };
    expect(rowValid(row({ expected: positive({ collateral: [crossing] }) }))).toBe(true);
    expect(rowValid(row({ expected: positive({ collateral: [without(crossing, 'metric')] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ collateral: [{ ...cycleCollateral(), metric: { base: 1, mutant: 2, threshold: 1 } }] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ collateral: [{ ...cycleCollateral(), kind: 'operator' }] }) }))).toBe(false);
  });

  it('enforces the negative-twin shape (BR-U5a-22)', () => {
    expect(rowValid(row({ expected: without(twin(), 'twinOf') }))).toBe(false);
    expect(rowValid(row({ expected: twin({ functionIds: ['FF-S01'] }) }))).toBe(false);
    expect(rowValid(row({ expected: twin({ keys: [key()] }) }))).toBe(false);
  });

  it('enforces the judge-probe and outside-coverage invariants (BR-U5a-26)', () => {
    expect(rowValid(row({ expected: judgeProbe({ functionIds: ['FF-N02'] }) }))).toBe(false);
    expect(rowValid(row({ expected: judgeProbe({ coverage: 'in' }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ coverage: 'outside', functionIds: [] }) }))).toBe(false);
    expect(rowValid(row({ expected: positive({ coverage: 'outside' }) }))).toBe(true);
  });

  it('forbids a forced site on a held-out row (BR-U5a-55)', () => {
    const corpus = { baseKind: 'corpus', split: 'held-out' };
    expect(rowValid(row({ ...corpus, siteSelection: 'forced' }))).toBe(false);
    expect(rowValid(row({ ...corpus, siteSelection: 'sampled' }))).toBe(true);
    expect(rowValid(row({ siteSelection: 'forced', split: 'dev' }))).toBe(true);
    expect(rowValid(row({ siteSelection: 'chosen' }))).toBe(false);
  });

  it('rejects an unknown rejection reason and an extra rejection property (BR-U5a-34)', () => {
    expect(valid(manifestOf([], { rejections: [rejection('timeout')] }))).toBe(false);
    expect(valid(manifestOf([], { rejections: [rejection('no-site', { extra: 1 })] }))).toBe(false);
  });
});
