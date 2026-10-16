import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { evaluateNeuronal, withV22Rubric, withV2Rubric } from '../../../src/llm-critic/llm-critic.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import type { LayerDefinition } from '../../../src/shared/types/spec.js';
import { FROZEN_SHA256, computeFrozenSha256 } from '../../../src/llm-critic/frozen.js';
import { FF_N01_ID, FF_N02_ID, FF_N02_RUBRIC, PROBE_CONSTRUCTION_VOCABULARY } from '../../../src/llm-critic/rubric.js';
import { FF_N01_RUBRIC_V2, FF_N02_RUBRIC_V2, JUDGE_V2_PERSONA, JUDGE_V2_SHA256, computeJudgeV2Sha256 } from '../../../src/llm-critic/judge-v2.js';
import {
  FF_N01_RUBRIC_V22, FF_N02_RUBRIC_V22, JUDGE_V22_PERSONA, JUDGE_V22_REVISION, JUDGE_V22_SHA256, JUDGE_V22_VALUES,
  computeJudgeV22Sha256, rubricV22Of,
} from '../../../src/llm-critic/judge-v22.js';
import { allowedDependenciesOf, dependencyRuleOf, renderLayerModelV22 } from '../../../src/llm-critic/context-v22.js';
import { renderLayerModel } from '../../../src/llm-critic/context-assembler.js';
import { parseLLMOptions } from '../../../src/cli/llm-options.js';

const layer = (name: string, kind: string, dirs: string[]): LayerDefinition => ({ name, kind, directories: dirs, naming: [], role: '' }) as never;

/** presets/layered.yaml (bottom-up). */
const LAYERED = [
  layer('persistence', 'infrastructure', ['src/persistence/**']),
  layer('business', 'domain', ['src/business/**']),
  layer('presentation', 'presentation', ['src/presentation/**']),
];
/** presets/clean-architecture.yaml (inner to outer). */
const CLEAN = [
  layer('domain', 'domain', ['src/domain/**']),
  layer('application', 'application', ['src/application/**']),
  layer('infrastructure', 'infrastructure', ['src/infrastructure/**']),
];
/** presets/hexagonal.yaml (graph). */
const HEX = [
  layer('domain', 'domain', ['src/domain/**']),
  layer('application', 'application', ['src/application/**']),
  layer('adapters-inbound', 'presentation', ['src/adapters/inbound/**']),
  layer('adapters-outbound', 'infrastructure', ['src/adapters/outbound/**']),
  layer('config', 'application', ['src/config/**']),
];
const HEX_EDGES = [
  { from: 'application', to: 'domain' },
  { from: 'adapters-inbound', to: 'application' }, { from: 'adapters-inbound', to: 'domain' },
  { from: 'adapters-outbound', to: 'application' }, { from: 'adapters-outbound', to: 'domain' },
  { from: 'config', to: 'domain' }, { from: 'config', to: 'application' }, { from: 'config', to: 'adapters-inbound' }, { from: 'config', to: 'adapters-outbound' },
];

describe('judge v2.2: texts and selection', () => {
  it('leaves v1 and v2.1 anchored and anchors v2.2 with its own hash', () => {
    expect(computeFrozenSha256()).toBe(FROZEN_SHA256);
    expect(computeJudgeV2Sha256()).toBe(JUDGE_V2_SHA256);
    expect(JUDGE_V2_SHA256).toBe('0add6562061d6eb7b2466cbeb5c1d194e896c91b77f337fd6239584ff40145f3');
    expect(computeJudgeV22Sha256()).toBe(JUDGE_V22_SHA256);
    expect(JUDGE_V22_REVISION).toBe('v2.2');
  });

  it('keeps the v2.2 texts free of the probe-construction vocabulary (BR-U4-RUB-01)', () => {
    const text = JSON.stringify(JUDGE_V22_VALUES).toLowerCase();
    for (const word of PROBE_CONSTRUCTION_VOCABULARY) expect(text).not.toContain(word);
  });

  it('parses --judge-version v2.2 next to v1 and v2', () => {
    const base = ['--llm-provider=mock'];
    const v22 = parseLLMOptions([...base, '--judge-version=v2.2'], {});
    expect(v22.success && v22.data.run.judgeVersion).toBe('v2.2');
    const v2 = parseLLMOptions([...base, '--judge-version=v2'], {});
    expect(v2.success && v2.data.run.judgeVersion).toBe('v2');
    expect(parseLLMOptions([...base, '--judge-version=v2.3'], {}).success).toBe(false);
  });

  it('scopes the domain I/O clause to direct clients and widens the wiring exemption (FF-N02)', () => {
    const fail = FF_N02_RUBRIC_V22.fail;
    expect(fail).toContain('direct I/O, that is a database, ORM, query, HTTP or file client that the file itself creates, imports from a package or obtains from a global accessor');
    expect(fail).toContain('A call to a class or interface of a layer that this layer may depend on is not misplaced I/O');
    expect(fail).toContain('persistence or I/O done through a class of a layer that the layer model does not let this layer depend on');
    expect(fail).toContain('Constructor parameters of any file are dependency wiring when their types come from the file\'s own layer or from a layer it may depend on');
    // v2.1's kind-only clauses are gone.
    expect(fail).not.toContain('persistence or I/O (queries, database or ORM clients, HTTP or file access)');
    expect(fail).not.toContain('Constructor parameters of an application file');
    expect(FF_N02_RUBRIC_V2.fail).toContain('Constructor parameters of an application file');
  });

  it('keeps v2.1\'s framework ban, delivery clause, evidence and FF-N01', () => {
    expect(FF_N02_RUBRIC_V22.fail).toContain('any framework or ORM type, decorator or base class (dependency injection, routing, persistence mapping), even when the class logic is pure');
    expect(FF_N02_RUBRIC_V22.fail).toContain('in any method or function signature (parameter or return) or thrown, even when the parameter is optional or unused');
    expect(FF_N02_RUBRIC_V22.evidenceRequired).toBe(FF_N02_RUBRIC_V2.evidenceRequired);
    expect(FF_N02_RUBRIC_V22.rule).toBe(FF_N02_RUBRIC_V2.rule);
    expect(FF_N01_RUBRIC_V22).toBe(FF_N01_RUBRIC_V2);
    expect(JUDGE_V22_PERSONA).toBe(JUDGE_V2_PERSONA);
    expect(rubricV22Of(FF_N01_ID)).toBe(FF_N01_RUBRIC_V22);
    expect(rubricV22Of(FF_N02_ID)).toBe(FF_N02_RUBRIC_V22);
    expect(rubricV22Of('FF-X99')).toBeUndefined();
  });
});

describe('judge v2.2: layer model section', () => {
  it('closed layering (layered): each layer may depend on the one listed before it', () => {
    const input = { layers: LAYERED, style: 'layered' };
    expect(dependencyRuleOf(input)).toBe('closed');
    expect(renderLayerModelV22(input)).toBe([
      'Style: layered. Closed layering: layers are listed bottom-up and each layer may depend only on the layer listed directly before it.',
      '- persistence (kind: infrastructure; may depend on: no other layer): src/persistence/**',
      '- business (kind: domain; may depend on: persistence): src/business/**',
      '- presentation (kind: presentation; may depend on: business): src/presentation/**',
    ].join('\n'));
  });

  it('ordered layering (clean-architecture, nestjs, unspecified): every layer listed before', () => {
    const clean = { layers: CLEAN, style: 'clean-architecture' };
    expect(dependencyRuleOf(clean)).toBe('ordered');
    const text = renderLayerModelV22(clean);
    expect(text.split('\n')[0]).toBe('Style: clean-architecture. Layers are listed inner to outer: a layer may depend on the layers listed before it.');
    expect(text).toContain('- domain (kind: domain; may depend on: no other layer): src/domain/**');
    expect(text).toContain('- infrastructure (kind: infrastructure; may depend on: domain, application): src/infrastructure/**');
    expect(renderLayerModelV22({ layers: CLEAN }).split('\n')[0]).toContain('Style: unspecified.');
  });

  it('graph styles (hexagonal, ddd): the declared edges, in layer order', () => {
    const input = { layers: HEX, style: 'hexagonal', allowedDependencies: HEX_EDGES };
    expect(dependencyRuleOf(input)).toBe('graph');
    const deps = allowedDependenciesOf(input);
    expect(deps.get('domain')).toEqual([]);
    expect(deps.get('adapters-outbound')).toEqual(['domain', 'application']);
    expect(deps.get('config')).toEqual(['domain', 'application', 'adapters-inbound', 'adapters-outbound']);
    const text = renderLayerModelV22(input);
    expect(text.split('\n')[0]).toBe('Style: hexagonal. Allowed dependencies are declared per layer: a layer may depend only on the layers it lists.');
    expect(text).toContain('- application (kind: application; may depend on: domain): src/application/**');
  });

  it('keeps file patterns and the empty model as v1 renders them', () => {
    const nest = [{ ...layer('application', 'application', ['src/application/**']), filePatterns: ['**/*.service.ts'] }];
    expect(renderLayerModelV22({ layers: nest, style: 'nestjs' })).toContain('src/application/**; file patterns: **/*.service.ts');
    expect(renderLayerModelV22({ layers: [] })).toBe(renderLayerModel([]));
  });
});

// ── End to end through evaluateNeuronal (mock provider) ──

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-v22-'));
fs.mkdirSync(path.join(ROOT, 'src/business'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'src/persistence'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/persistence/gw.ts'), 'export class Gw {\n  find(id: string): string | undefined { return id; }\n}\n');
fs.writeFileSync(path.join(ROOT, 'src/business/svc.ts'), "import { Gw } from '../persistence/gw';\nexport class Svc {\n  constructor(private readonly gw: Gw) {}\n  get(id: string): string {\n    return this.gw.find(id) ?? '';\n  }\n}\n");
const CASSETTES = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-v22-cas-'));
afterAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.rmSync(CASSETTES, { recursive: true, force: true });
});

const VIEW: JudgeGraphView = {
  files: [{ path: 'src/business/svc.ts', layer: 'business', isBarrel: false }, { path: 'src/persistence/gw.ts', layer: 'persistence', isBarrel: false }],
  classes: [{ name: 'Svc', file: 'src/business/svc.ts' }, { name: 'Gw', file: 'src/persistence/gw.ts' }],
  interfaces: [],
  edges: [
    { type: 'CONSTRUCTOR_INJECTS', from: 'Svc@src/business/svc.ts', to: 'Gw@src/persistence/gw.ts' },
    { type: 'IMPORTS', from: 'src/business/svc.ts', to: 'src/persistence/gw.ts' },
  ],
};
const graphRepo = {
  executeQuery: () => Promise.resolve(DomainResult.ok({ records: [], summary: { counters: {} } })),
  clearGraph: () => Promise.resolve(DomainResult.ok(undefined)),
  healthCheck: () => Promise.resolve(true),
  close: () => Promise.resolve(),
};
const n02 = (): NeuronalInstruction => ({
  functionId: functionId('FF-N02'), name: 'intent-alignment', dimension: 'semantic', severity: 'major', route: 'neuronal',
  semanticCriteria: { rule: FF_N02_RUBRIC.rule, rubric: { pass: FF_N02_RUBRIC.pass, fail: FF_N02_RUBRIC.fail, evidenceRequired: FF_N02_RUBRIC.evidenceRequired } },
  contextAssembly: { includeAPGSubgraph: true, includeSourceCode: true }, shadowModeEligible: false, source: 'fitness-function', judgeUnit: 'file',
});

async function promptOf(judgeVersion: 'v1' | 'v2' | 'v2.2'): Promise<{ prompt: string; system: string | undefined }> {
  const provider = new MockLLMProvider();
  const result = await evaluateNeuronal({
    instructions: [n02()], graphRepository: graphRepo, provider, projectRoot: ROOT, graphView: VIEW, knownSecrets: [], cheapFlags: [],
    options: {
      judgeVersion, runsPerEvaluation: 1, evaluatorSpecLayers: LAYERED, evaluatorSpecStyle: 'layered',
      cassette: { mode: 'record', dir: fs.mkdtempSync(path.join(CASSETTES, 'run-')), omitPrompt: false },
      baseline: [{ functionId: functionId('FF-N02'), candidateUnitIds: ['src/business/svc.ts', 'src/persistence/gw.ts'], selectedUnitIds: ['src/business/svc.ts'], source: 'own' }] as never,
    },
  });
  expect(result.success).toBe(true);
  return { prompt: provider.getPrompts()[0] ?? '', system: provider.getLastCall()?.systemPrompt };
}

const sha = (text: string): string => createHash('sha256').update(text).digest('hex');

describe('judge v2.2: evaluateNeuronal', () => {
  it('v2.2 sends the style, the allowed dependencies and the v2.2 rubric, with v2.1\'s sections and persona', async () => {
    const { prompt, system } = await promptOf('v2.2');
    expect(prompt).toContain('## Layer model\nStyle: layered. Closed layering:');
    expect(prompt).toContain('- business (kind: domain; may depend on: persistence): src/business/**');
    expect(prompt).toContain(FF_N02_RUBRIC_V22.fail);
    expect(prompt).toContain('## Neighbourhood');
    expect(prompt).toContain('## Candidate flags');
    expect(prompt).not.toContain('## Graph excerpt');
    expect(system).toBe(JUDGE_V22_PERSONA);
  });

  it('v2.2 differs from v2.1 only in the rubric and the layer model section', async () => {
    const v2 = (await promptOf('v2')).prompt;
    const v22 = (await promptOf('v2.2')).prompt;
    const strip = (p: string, fail: string, pass: string): string => p
      .replace(fail, '<FAIL>').replace(pass, '<PASS>')
      .replace(/## Layer model\n[\s\S]*?\n\n## Unit/, '## Layer model\n<MODEL>\n\n## Unit');
    expect(strip(v22, FF_N02_RUBRIC_V22.fail, FF_N02_RUBRIC_V22.pass)).toBe(strip(v2, FF_N02_RUBRIC_V2.fail, FF_N02_RUBRIC_V2.pass));
  });

  it('v1 and v2.1 prompts are byte-unchanged by v2.2 (hashes taken before v2.2)', async () => {
    const v1 = await promptOf('v1');
    const v2 = await promptOf('v2');
    expect(v2.prompt).not.toContain('Style:');
    expect(v1.prompt).not.toContain('Style:');
    expect(sha(v1.prompt)).toBe(V1_PROMPT_SHA256);
    expect(sha(v2.prompt)).toBe(V2_PROMPT_SHA256);
    expect(v2.system).toBe(JUDGE_V2_PERSONA);
  });

  it('withV22Rubric swaps FF-N02 only; withV2Rubric still gives v2.1', () => {
    expect(withV22Rubric(n02()).semanticCriteria.rubric.fail).toBe(FF_N02_RUBRIC_V22.fail);
    expect(withV2Rubric(n02()).semanticCriteria.rubric.fail).toBe(FF_N02_RUBRIC_V2.fail);
    const other = { ...n02(), functionId: functionId('FF-X99') };
    expect(withV22Rubric(other)).toBe(other);
  });
});

// sha256 of the v1 and v2 prompts of this file's fixture, computed on origin/v1.3-judge-v2 @ 5f636af3 (before v2.2).
const V1_PROMPT_SHA256 = 'b226d3d24b4268aea34073df0da826f29c82fd5cddb5cec992ee6c0aa5237bf2';
const V2_PROMPT_SHA256 = 'c19ea001d95f6cb04dd3fdcd89da63b2e192642318ba046cdb9b43f39d8a8a77';
