/**
 * U4 plan Step 24: persisted neural result rows and the baseline selection reader (DE §4.8;
 * BR-U4-SEL-07, AGG-04; OI-U4-8 settled by BR-U3-65; D-U4-8; T25).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { GraphRepository } from '../../../src/shared/interfaces/graph-repository.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import type { NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import { REPORT_SCHEMA } from '../../../src/scoring-engine/report-schema.js';
import { evaluateNeuronal } from '../../../src/llm-critic/llm-critic.js';
import type { NeuronalEvalOutput } from '../../../src/llm-critic/llm-critic.js';
import type { NeuronalRunOptions } from '../../../src/llm-critic/types.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import { FF_N01_RUBRIC, FF_N02_RUBRIC } from '../../../src/llm-critic/rubric.js';
import { resolveBaselineSelection } from '../../../src/llm-critic/judge-unit-selector.js';
import {
  NEURAL_RESULT_ROW_SCHEMA, neuralResultRowProblem, readBaselineSelections, toNeuralResultRows,
} from '../../../src/llm-critic/neural-result-rows.js';

const REPO = path.resolve(__dirname, '../../..');
const ROOT = path.join(REPO, 'fixtures/correct-reference');
const VIEW = JSON.parse(fs.readFileSync(path.join(REPO, 'tests/fixtures/judge-graph/correct-reference.view.json'), 'utf8')) as JudgeGraphView;
const LAYERS: LayerDefinition[] = [
  { name: 'domain', directories: ['src/domain/**'], naming: [], role: 'domain', kind: 'domain' },
  { name: 'application', directories: ['src/application/**'], naming: [], role: 'application', kind: 'application' },
  { name: 'infrastructure', directories: ['src/infrastructure/**'], naming: [], role: 'infrastructure', kind: 'infrastructure' },
];

function instruction(id: 'FF-N01' | 'FF-N02'): NeuronalInstruction {
  const rubric = id === 'FF-N01' ? FF_N01_RUBRIC : FF_N02_RUBRIC;
  return {
    functionId: functionId(id), name: id, dimension: id === 'FF-N01' ? 'integrity' : 'semantic', severity: 'major', route: 'neuronal',
    semanticCriteria: { rule: rubric.rule, rubric: { pass: rubric.pass, fail: rubric.fail, evidenceRequired: rubric.evidenceRequired } },
    contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true }, shadowModeEligible: false, source: 'fitness-function',
    judgeUnit: id === 'FF-N01' ? 'module' : 'file',
  };
}

const dirs: string[] = [];
function tmpDir(): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'u4-rows-'));
  dirs.push(d);
  return d;
}
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

async function mockRun(options: Partial<NeuronalRunOptions> = {}, instructions = [instruction('FF-N02'), instruction('FF-N01')]): Promise<NeuronalEvalOutput> {
  const result = await evaluateNeuronal({
    instructions, graphRepository: {} as GraphRepository, provider: new MockLLMProvider(), projectRoot: ROOT, graphView: VIEW, knownSecrets: [],
    options: { evaluatorSpecLayers: LAYERS, cassette: { mode: 'record', dir: tmpDir(), omitPrompt: false }, ...options },
  });
  if (!result.success) throw new Error(result.errors[0]?.code);
  return result.data;
}

function writeJson(value: unknown): string {
  const file = path.join(tmpDir(), 'report.json');
  fs.writeFileSync(file, JSON.stringify(value));
  return file;
}

describe('toNeuralResultRows (DE §4.8)', () => {
  it('maps a recorded Mock output to closed rows, sorted by functionId, without reasoning or absolute paths', async () => {
    const out = await mockRun({ unitCap: 3 });
    const rows = toNeuralResultRows(out.results);
    expect(rows.map((r) => String(r.functionId))).toEqual(['FF-N01', 'FF-N02']);
    for (const row of rows) expect(neuralResultRowProblem(row)).toBeNull();
    const text = JSON.stringify(rows);
    expect(text).not.toContain(ROOT);
    expect(text).not.toContain('reasoning');
    expect(text).not.toContain('Mock evidence');
    const n02 = rows[1];
    const result = out.results.find((r) => String(r.functionId) === 'FF-N02');
    expect(n02).toEqual(expect.objectContaining({
      dimension: 'semantic', aggregationRule: 'majority-of-valid-units-v1', unitsSelected: 3, unitsCapped: 7, candidateCount: 10,
      removedByVariant: [], selection: { source: 'own', candidateUnitIds: result?.selection?.candidateUnitIds, selectedUnitIds: result?.selection?.selectedUnitIds },
    }));
    expect(n02?.singleFileModules).toBeUndefined();
    expect(rows[0]?.singleFileModules).toBeDefined();
    expect(n02?.unitResults.map((u) => Object.keys(u).sort())).toEqual(n02?.unitResults.map(() => [
      'confidence', 'confidenceStdDev', 'filePaths', 'flaggedUnstable', 'layer', 'status', 'unitId', 'unitKind', 'validRunCount', 'verdict',
    ]));
  });

  it('round trip: rows written as a report are read back as the baseline selection a variant reuses (SEL-07)', async () => {
    const base = await mockRun({ unitCap: 3 });
    const file = writeJson({ runId: 'r1', evaluationMode: 'full', judge: { provider: 'mock', model: 'm', runsPerUnit: 3 }, neuralResults: toNeuralResultRows(base.results) });
    const selections = readBaselineSelections(file);
    expect(selections.success).toBe(true);
    if (!selections.success) return;
    expect(selections.data.map((s) => String(s.functionId))).toEqual(['FF-N01', 'FF-N02']);
    const variant = await mockRun({ baseline: selections.data });
    for (const r of variant.results) {
      const own = base.results.find((b) => b.functionId === r.functionId);
      expect(r.selection?.source).toBe('baseline');
      expect(r.unitResults.map((u) => u.unitId)).toEqual(own?.selection?.selectedUnitIds);
    }
    expect(toNeuralResultRows(variant.results).every((row) => row.selection.source === 'baseline')).toBe(true);
  });

  it('a function without a result (failure or no units) has no row', () => {
    expect(toNeuralResultRows([])).toEqual([]);
  });
});

describe('readBaselineSelections (BR-U4-SEL-07)', () => {
  it('reads a minimal {neuralResults: [...]} object', async () => {
    const rows = toNeuralResultRows((await mockRun({ unitCap: 2 }, [instruction('FF-N02')])).results);
    const read = readBaselineSelections(writeJson({ neuralResults: rows }));
    expect(read.success).toBe(true);
    if (read.success) {
      expect(read.data).toEqual([{
        functionId: 'FF-N02', candidateUnitIds: rows[0]?.selection.candidateUnitIds, selectedUnitIds: rows[0]?.selection.selectedUnitIds, source: 'own',
      }]);
    }
  });

  it('a function the variant judges without a baseline row → LLM_BASELINE_SELECTION_MISSING', async () => {
    const rows = toNeuralResultRows((await mockRun({ unitCap: 2 }, [instruction('FF-N02')])).results);
    const read = readBaselineSelections(writeJson({ neuralResults: rows }));
    if (!read.success) throw new Error('read failed');
    const missing = resolveBaselineSelection(functionId('FF-N01'), read.data);
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
  });

  it.each([
    ['an unreadable file', null],
    ['a file without neuralResults', { runId: 'r' }],
    ['a row that is not a neural result row', { neuralResults: [{ functionId: 'FF-N02' }] }],
  ])('%s → LLM_BASELINE_SELECTION_MISSING', (_label, content) => {
    const file = content === null ? path.join(tmpDir(), 'absent.json') : writeJson(content);
    const read = readBaselineSelections(file);
    expect(read.success).toBe(false);
    if (!read.success) expect(read.errors[0]?.code).toBe('LLM_BASELINE_SELECTION_MISSING');
  });
});

describe('NEURAL_RESULT_ROW_SCHEMA', () => {
  it('rejects an extra property on a row and on a unit row', async () => {
    const [row] = toNeuralResultRows((await mockRun({ unitCap: 1 }, [instruction('FF-N02')])).results);
    expect(row).toBeDefined();
    if (row === undefined) return;
    expect(neuralResultRowProblem({ ...row, reasoning: 'x' })).toContain('must NOT have additional properties');
    expect(neuralResultRowProblem({ ...row, unitResults: [{ ...row.unitResults[0], prompt: 'x' }] })).not.toBeNull();
    const { removedByVariant: _dropped, ...withoutRequired } = row;
    expect(neuralResultRowProblem(withoutRequired)).toContain('removedByVariant');
  });

  it('matches the neuralResultRow and neuralUnitRow definitions of U3\'s frozen report schema', () => {
    const defs = (REPORT_SCHEMA as unknown as { definitions: Record<string, { required: string[]; properties: unknown }> }).definitions;
    const u3Row = defs.neuralResultRow;
    const u3Unit = defs.neuralUnitRow;
    expect(NEURAL_RESULT_ROW_SCHEMA.properties).toEqual(u3Row?.properties);
    expect(NEURAL_RESULT_ROW_SCHEMA.required).toEqual(u3Row?.required);
    expect(NEURAL_RESULT_ROW_SCHEMA.definitions.neuralUnitRow.properties).toEqual(u3Unit?.properties);
    expect(NEURAL_RESULT_ROW_SCHEMA.definitions.neuralUnitRow.required).toEqual(u3Unit?.required);
    for (const name of ['count', 'unitInterval', 'nonNegativeNumber', 'dimension'] as const) {
      expect(NEURAL_RESULT_ROW_SCHEMA.definitions[name]).toEqual(defs[name]);
    }
  });
});
