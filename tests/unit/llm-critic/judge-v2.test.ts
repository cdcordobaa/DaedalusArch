import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { evaluateNeuronal, withV2Rubric } from '../../../src/llm-critic/llm-critic.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { NeuronalInstruction } from '../../../src/shared/types/evaluation.js';
import type { JudgeGraphView } from '../../../src/llm-critic/judge-graph.js';
import type { CheapFlag } from '../../../src/apg-enrich/cheap/types.js';
import { DEFAULT_NEURONAL_RUN_OPTIONS } from '../../../src/llm-critic/types.js';
import { FROZEN_SHA256, JUDGE_PERSONA, computeFrozenSha256 } from '../../../src/llm-critic/frozen.js';
import { FF_N02_RUBRIC, PROBE_CONSTRUCTION_VOCABULARY } from '../../../src/llm-critic/rubric.js';
import {
  CANDIDATE_FLAGS_HEADER, DEFAULT_JUDGE_VERSION, FF_N01_RUBRIC_V2, FF_N02_RUBRIC_V2, JUDGE_V2_PERSONA, JUDGE_V2_SHA256,
  JUDGE_V2_VALUES, PROMPT_INSTRUCTIONS_V2, computeJudgeV2Sha256,
} from '../../../src/llm-critic/judge-v2.js';
import { candidateFlagsOf, relativiseTypeText, renderCandidateFlags, renderNeighbourhood } from '../../../src/llm-critic/context-v2.js';
import { parseLLMOptions } from '../../../src/cli/llm-options.js';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-v2-'));
fs.mkdirSync(path.join(ROOT, 'src/domain'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'src/app'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'src/domain/a.ts'), "import { Request } from 'express';\nexport class A {\n  run(r?: Request): number { return 1; }\n}\n");
fs.writeFileSync(path.join(ROOT, 'src/app/b.ts'), "import { A } from '../domain/a';\nexport class B { constructor(private readonly a: A) {} }\n");
const CASSETTES = fs.mkdtempSync(path.join(os.tmpdir(), 'judge-v2-cas-'));
afterAll(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.rmSync(CASSETTES, { recursive: true, force: true });
});

const VIEW: JudgeGraphView = {
  files: [{ path: 'src/app/b.ts', layer: 'application', isBarrel: false }, { path: 'src/domain/a.ts', layer: 'domain', isBarrel: false }],
  classes: [{ name: 'B', file: 'src/app/b.ts' }, { name: 'A', file: 'src/domain/a.ts' }],
  interfaces: [],
  edges: [
    { type: 'CONSTRUCTOR_INJECTS', from: 'B@src/app/b.ts', to: 'A@src/domain/a.ts' },
    { type: 'IMPORTS', from: 'src/app/b.ts', to: 'src/domain/a.ts' },
    { type: 'IMPORTS', from: 'src/domain/a.ts', to: 'express' },
  ],
};
const LAYERS = [
  { name: 'domain', kind: 'domain', directories: ['src/domain/**'] },
  { name: 'application', kind: 'application', directories: ['src/app/**'] },
] as never;
const FLAG: CheapFlag = {
  proxy: 'framework-in-core', kind: 'framework-type-parameter', score: 1,
  evidence: { file: 'src/domain/a.ts', startLine: 3, endLine: 3 }, className: 'A', methodName: 'run',
  message: 'method A.run parameter r: Request (express)',
};
const OTHER: CheapFlag = { ...FLAG, evidence: { file: 'src/app/b.ts', startLine: 2, endLine: 2 }, message: 'elsewhere' };
const COMMUNITY: CheapFlag = { ...FLAG, proxy: 'communities', kind: 'community-component-mismatch', message: 'diagnostic' };

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

describe('judge v2: selection and freeze', () => {
  it('keeps v1 frozen and the default', () => {
    expect(computeFrozenSha256()).toBe(FROZEN_SHA256);
    expect(DEFAULT_JUDGE_VERSION).toBe('v1');
    expect(DEFAULT_NEURONAL_RUN_OPTIONS.judgeVersion).toBe('v1');
  });

  it('anchors the v2 texts with their own hash', () => {
    expect(computeJudgeV2Sha256()).toBe(JUDGE_V2_SHA256);
  });

  it('keeps the v2 texts free of the probe-construction vocabulary (BR-U4-RUB-01)', () => {
    const text = JSON.stringify(JUDGE_V2_VALUES).toLowerCase();
    for (const word of PROBE_CONSTRUCTION_VOCABULARY) expect(text).not.toContain(word);
  });

  it('parses --judge-version (v1 default leaves the settings unchanged)', () => {
    const base = ['--llm-provider=mock'];
    const v1 = parseLLMOptions(base, {});
    expect(v1.success && v1.data.run.judgeVersion).toBe(undefined);
    const v2 = parseLLMOptions([...base, '--judge-version=v2'], {});
    expect(v2.success && v2.data.run.judgeVersion).toBe('v2');
    expect(parseLLMOptions([...base, '--judge-version=v9'], {}).success).toBe(false);
  });

  it('replaces only the rubric of FF-N01 and FF-N02', () => {
    const v2 = withV2Rubric(n02());
    expect(v2.semanticCriteria.rubric.fail).toBe(FF_N02_RUBRIC_V2.fail);
    expect(v2.semanticCriteria.rule).toBe(FF_N02_RUBRIC_V2.rule);
    const other = { ...n02(), functionId: functionId('FF-X99') };
    expect(withV2Rubric(other)).toBe(other);
    expect(FF_N01_RUBRIC_V2.rule).toBeTruthy();
  });
});

describe('judge v2: context', () => {
  it('renders the neighbourhood with layers, kinds, packages and injections', () => {
    const text = renderNeighbourhood(['src/domain/a.ts'], VIEW, LAYERS);
    expect(text).toContain('src/domain/a.ts (layer domain, kind domain)');
    expect(text).toContain('imports: package express');
    expect(text).toContain('imported by: src/app/b.ts (layer application, kind application)');
    expect(text).toContain('A is injected into B in src/app/b.ts');
  });

  it('keeps prompts free of absolute paths from checker type text (CTX-08)', () => {
    expect(relativiseTypeText('r: Request<import("/Volumes/x/node_modules/@types/express-serve-static-core/index").ParamsDictionary>'))
      .toBe('r: Request<import("@types/express-serve-static-core").ParamsDictionary>');
    expect(relativiseTypeText('t: import("/Users/a/b/src/x").X')).toBe('t: import("<abs>").X');
  });

  it('keeps only the unit\'s flags of the candidate proxies', () => {
    const flags = candidateFlagsOf(['src/domain/a.ts'], [OTHER, COMMUNITY, FLAG, FLAG]);
    expect(flags).toEqual([FLAG]);
    const related = candidateFlagsOf(['src/app/b.ts'], [{ ...FLAG, related: { file: 'src/app/b.ts', startLine: 1, endLine: 1 } }]);
    expect(related).toHaveLength(1);
    expect(renderCandidateFlags([])).toBe(`${CANDIDATE_FLAGS_HEADER}\n(none)`);
    expect(renderCandidateFlags(flags)).toContain('framework-in-core/framework-type-parameter at src/domain/a.ts:3: method A.run');
  });
});

describe('judge v2: evaluateNeuronal', () => {
  const run = async (judgeVersion: 'v1' | 'v2'): Promise<MockLLMProvider> => {
    const provider = new MockLLMProvider();
    const result = await evaluateNeuronal({
      instructions: [n02()], graphRepository: graphRepo, provider, projectRoot: ROOT, graphView: VIEW, knownSecrets: [],
      cheapFlags: [FLAG, OTHER],
      options: {
        judgeVersion, runsPerEvaluation: 1, evaluatorSpecLayers: LAYERS,
        cassette: { mode: 'record', dir: fs.mkdtempSync(path.join(CASSETTES, 'run-')), omitPrompt: false },
        baseline: [{ functionId: functionId('FF-N02'), candidateUnitIds: ['src/app/b.ts', 'src/domain/a.ts'], selectedUnitIds: ['src/domain/a.ts'], source: 'own' }] as never,
      },
    });
    expect(result.success).toBe(true);
    return provider;
  };

  it('v2 sends the v2 rubric, neighbourhood, flags and persona; the schema is v1\'s', async () => {
    const provider = await run('v2');
    const prompt = provider.getPrompts()[0] ?? '';
    expect(prompt).toContain(FF_N02_RUBRIC_V2.fail);
    expect(prompt).toContain('## Neighbourhood');
    expect(prompt).toContain('## Candidate flags');
    expect(prompt).toContain('method A.run parameter r: Request (express)');
    expect(prompt).not.toContain('elsewhere');
    expect(prompt).not.toContain('## Graph excerpt');
    expect(prompt).toContain(PROMPT_INSTRUCTIONS_V2);
    expect(provider.getLastCall()?.systemPrompt).toBe(JUDGE_V2_PERSONA);
    expect(provider.getLastCall()?.responseSchema).toBeUndefined();
  });

  it('v1 is unchanged: frozen rubric, graph excerpt, no flags, frozen persona', async () => {
    const provider = await run('v1');
    const prompt = provider.getPrompts()[0] ?? '';
    expect(prompt).toContain(FF_N02_RUBRIC.fail);
    expect(prompt).toContain('## Graph excerpt');
    expect(prompt).not.toContain('## Candidate flags');
    expect(provider.getLastCall()?.systemPrompt ?? JUDGE_PERSONA).toBe(JUDGE_PERSONA);
  });
});
