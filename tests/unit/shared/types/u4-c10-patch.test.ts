// U4-K1 (U4 plan Step 11; D-U4-5): compile-time shape test for the U4 rows of the bundled C10 patch
// (U3 DE §8 rows 1 optional form, 6, 13, 14, 15). Type-checked by tsconfig.u4-tests.json (Gate T);
// the runtime assertions only pin the literals.

import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { BUILT_IN_VIOLATION_TYPES } from '../../../../src/shared/taxonomy/violation-types.js';
import { confidence, functionId } from '../../../../src/shared/types/value-objects.js';
import type {
  LLMCallContext, LLMOptions, LLMProvider, LLMResponse,
} from '../../../../src/shared/interfaces/llm-provider.js';
import type {
  BaselineSelection, DroppedReason, EvaluationReport, EvaluationResults, ExclusionReason,
  FunctionFailure, InvalidCause, JudgeProvenance, JudgeUnitResult, NeuralResultRow, NeuralUnitRow,
  NeuronalFunctionResult, ProviderDescription, SymbolicFunctionResult,
} from '../../../../src/shared/types/evaluation.js';
import type * as SharedIndex from '../../../../src/shared/index.js';

const EXCLUSIONS: Readonly<Record<ExclusionReason, number>> = {
  unlayered: 1, 'exclude-paths': 0, barrel: 2, 'test-path': 0, 'e2e-spec': 0,
  'generated-path': 0, 'generated-marker': 0,
};

const INVALID_BY_CAUSE: Readonly<Record<InvalidCause | 'INSUFFICIENT_VALID_RUNS', number>> = {
  PARSE_FAILURE: 1, MISSING_CONFIDENCE: 0, MODEL_MISMATCH: 0, TIMEOUT: 0, BAD_ENVELOPE: 0,
  CLI_EXIT: 0, INSUFFICIENT_VALID_RUNS: 0,
};

const SELECTION: BaselineSelection = {
  functionId: functionId('FF-N01'),
  candidateUnitIds: ['src/a', 'src/b'],
  selectedUnitIds: ['src/a'],
  source: 'own',
};

const UNIT: JudgeUnitResult = {
  unitId: 'src/a',
  unitKind: 'module',
  layer: 'domain',
  filePaths: ['src/a/x.ts'],
  status: 'valid',
  verdict: 'pass',
  confidence: confidence(0.8),
  confidenceStdDev: 0,
  flaggedUnstable: false,
  validRunCount: 3,
  invalidRunCauses: ['TIMEOUT'],
  truncated: false,
  origin: 'addedByVariant',
  runs: [],
  violations: [],
};

// A pre-patch JudgeUnitResult literal (U0 fields only) still compiles.
const LEGACY_UNIT: JudgeUnitResult = {
  unitId: 'src/b', unitKind: 'file', verdict: 'fail', confidence: confidence(0.5),
  confidenceStdDev: 0.1, runs: [], violations: [],
};

const NEURAL: NeuronalFunctionResult = {
  functionId: functionId('FF-N01'),
  dimension: 'integrity',
  verdict: 'pass',
  confidence: confidence(0.8),
  confidenceStdDev: 0,
  icc: 0,
  reasoning: '',
  evidence: [],
  violations: [],
  runs: [],
  deterministic: false,
  flaggedUnstable: false,
  unitResults: [UNIT, LEGACY_UNIT],
  unitsSelected: 2,
  unitsCapped: 0,
  unitsInvalidByCause: INVALID_BY_CAUSE,
  singleFileModules: 1,
  candidateExclusions: EXCLUSIONS,
  candidateCount: 2,
  uncoveredFileCount: 1,
  truncatedUnits: 0,
  excerptTruncatedUnits: 0,
  removedByVariant: [],
  selection: SELECTION,
  aggregationRule: 'majority-of-valid-units-v1',
};

const SYMBOLIC: SymbolicFunctionResult = {
  functionId: functionId('FF-S01'),
  dimension: 'structural',
  passed: false,
  violations: [],
  executionTimeMs: 1,
  deterministic: true,
  neuralSkipped: 'symbolic-fail',
};

const FAILURE: FunctionFailure = {
  functionId: functionId('FF-N02'), name: 'intent-alignment', code: 'CRITIC_001', message: 'x',
};

const RESULTS: EvaluationResults = { symbolicResults: [SYMBOLIC], neuronalResults: [NEURAL], failures: [FAILURE] };
// Row 1 is optional in U4's form: a literal without `failures` still compiles.
const RESULTS_LEGACY: EvaluationResults = { symbolicResults: [], neuronalResults: [] };

const ROW_UNIT: NeuralUnitRow = {
  unitId: 'src/a', unitKind: 'module', layer: 'domain', filePaths: ['src/a/x.ts'],
  status: 'valid', verdict: 'pass', confidence: 0.8, confidenceStdDev: 0, flaggedUnstable: false,
  validRunCount: 3,
};

const ROW: NeuralResultRow = {
  functionId: functionId('FF-N01'),
  dimension: 'integrity',
  aggregationRule: 'majority-of-valid-units-v1',
  selection: { source: 'own', candidateUnitIds: ['src/a'], selectedUnitIds: ['src/a'] },
  unitsSelected: 1,
  unitsCapped: 0,
  candidateCount: 1,
  uncoveredFileCount: 0,
  candidateExclusions: EXCLUSIONS,
  unitsInvalidByCause: INVALID_BY_CAUSE,
  truncatedUnits: 0,
  excerptTruncatedUnits: 0,
  removedByVariant: [],
  unitResults: [ROW_UNIT],
};

const NEURAL_RESULTS: NonNullable<EvaluationReport['neuralResults']> = [ROW];

const DROPPED: DroppedReason = 'no-judge-units';

const PROVENANCE: JudgeProvenance = {
  provider: 'claude-cli',
  model: 'claude-opus-5-5',
  effort: 'high',
  cliVersion: '2.1.294',
  cassetteMode: 'record',
  runsPerUnit: 3,
  resolvedModel: 'claude-opus-5-5',
  repetition: 0,
  isolationProbeSha256: 'a'.repeat(64),
  configListingSha256: 'b'.repeat(64),
  provenanceMixed: false,
  seededList: [],
};

// The symbolic-only stub keeps exactly three keys (U4 DE §4.6).
const STUB: JudgeProvenance = { provider: 'none', model: 'none', runsPerUnit: 0 };

const CALL: LLMCallContext = {
  runIndex: 1, repetition: 0, functionId: 'FF-N01', unitId: 'src/a',
  systemPrompt: 'persona', responseSchema: '{}',
};

const RESPONSE: LLMResponse = {
  content: '{}', model: 'm', usage: { inputTokens: 0, outputTokens: 0 }, usedOptions: {}, ignoredOptions: [],
};
const DESCRIPTION: ProviderDescription = { provider: 'mock', model: 'm' };

// A two-parameter implementation still satisfies the port (row 15, U4 DE §3.6).
class TwoParameterProvider implements LLMProvider {
  readonly name = 'two';
  evaluate(_prompt: string, _options: LLMOptions) {
    return Promise.resolve(DomainResult.ok(RESPONSE));
  }
  describe(): ProviderDescription { return DESCRIPTION; }
}

// A three-parameter implementation receives the call context.
class ThreeParameterProvider implements LLMProvider {
  readonly name = 'three';
  seen: LLMCallContext | undefined;
  evaluate(_prompt: string, _options: LLMOptions, call?: LLMCallContext) {
    this.seen = call;
    return Promise.resolve(DomainResult.ok(RESPONSE));
  }
  describe(): ProviderDescription { return DESCRIPTION; }
}

// The new names are exported from the shared barrel (type-level check).
type BarrelNames = [
  SharedIndex.LLMCallContext, SharedIndex.BaselineSelection, SharedIndex.ExclusionReason,
  SharedIndex.InvalidCause, SharedIndex.NeuralUnitRow, SharedIndex.NeuralResultRow,
];
const BARREL_CHECK: BarrelNames | undefined = undefined;

const OPTIONS: LLMOptions = { model: 'm', maxTokens: 8192 };

describe('U4-K1 bundled C10 patch, U4 rows (D-U4-5)', () => {
  it('row 15: JudgeUnitResult and NeuronalFunctionResult accept the new optional fields', () => {
    expect(NEURAL.unitResults[0]?.invalidRunCauses).toEqual(['TIMEOUT']);
    expect(NEURAL.aggregationRule).toBe('majority-of-valid-units-v1');
    expect(NEURAL.selection?.source).toBe('own');
    expect(LEGACY_UNIT.status).toBeUndefined();
  });

  it('row 6: SymbolicFunctionResult accepts neuralSkipped', () => {
    expect(SYMBOLIC.neuralSkipped).toBe('symbolic-fail');
  });

  it('row 1 (optional form): EvaluationResults accepts failures and still compiles without it', () => {
    expect(RESULTS.failures).toHaveLength(1);
    expect(RESULTS_LEGACY.failures ?? []).toEqual([]);
  });

  it('row 13: DroppedReason widens to no-judge-units', () => {
    expect(DROPPED).toBe('no-judge-units');
  });

  it('row 14: EvaluationReport.neuralResults accepts NeuralResultRow', () => {
    expect(NEURAL_RESULTS[0]?.unitResults[0]?.unitId).toBe('src/a');
  });

  it('row 15: JudgeProvenance accepts the new fields and the stub keeps three keys', () => {
    expect(PROVENANCE.seededList).toEqual([]);
    expect(Object.keys(STUB).sort()).toEqual(['model', 'provider', 'runsPerUnit']);
  });

  it('row 15: two- and three-parameter providers both satisfy LLMProvider', async () => {
    const providers: LLMProvider[] = [new TwoParameterProvider(), new ThreeParameterProvider()];
    for (const p of providers) {
      const r = await p.evaluate('x', OPTIONS, CALL);
      expect(r.success).toBe(true);
    }
    expect((providers[1] as ThreeParameterProvider).seen).toEqual(CALL);
    expect(BARREL_CHECK).toBeUndefined();
  });

  it('row 15: INTENT_VIOLATION is kept (BR-U4-VIO-03, BR-U3-30)', () => {
    expect(BUILT_IN_VIOLATION_TYPES).toContain('INTENT_VIOLATION');
  });
});
