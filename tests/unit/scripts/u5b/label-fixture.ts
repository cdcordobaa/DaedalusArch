/**
 * U5b labeller test helpers: the fixture label plan (built from committed fixture reports and fixture sources) and a
 * scripted Mock labeller. The Mock describes itself as provider `mock`, so U4's cassette decorator keys it like the
 * Mock judge; it answers by item scenario, run index and the presented (possibly permuted) option order.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../../../src/shared/types/evaluation.js';
import type { JudgeGraphView } from '../../../../src/llm-critic/judge-graph.js';
import {
  POPULATION_CAPS, buildItems, judgeUnitCandidates, p1Candidate, sampleCandidates, violationCandidates,
} from '../../../../scripts/lib/label-context.js';
import type { Candidate, MissedSeedCandidate } from '../../../../scripts/lib/label-context.js';
import type { LabelPlanFile } from '../../../../scripts/llm-label.js';
import { ROOT } from './score-fixture.js';

export const LABEL_FIXTURE_DIR = 'tests/fixtures/u5b/labels';
export const LABEL_CASSETTE_DIR = 'tests/fixtures/u5b/cassettes';
export const FIXTURE_SEED = 20261008;
export const FIXTURE_MODEL = 'gemini-fixture-pinned';
export const FIXTURE_BUDGET = 200;
const EMPTY_VIEW: JudgeGraphView = { files: [], classes: [], interfaces: [], edges: [] };
const TREE = 'f'.repeat(40);

export const describeFn = (id: string): string => `fitness function ${id} of specs/clean-arch.yaml`;

function report(id: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/u5b/reports', `${id}.json`), 'utf8')) as unknown;
}

/** The fixture candidates: P1 (one), P2 (variant-a-structural), P4 (two correct-reference units), MS (one). */
export function fixtureCandidates(): Candidate[] {
  const p2 = violationCandidates(report('variant-a-structural'), {
    population: 'P2', projectId: 'variant-a-structural', treeSha: TREE, stratumOwner: 'variant-a-structural',
    sourceRoot: join(ROOT, 'fixtures/variant-a-structural'), describe: describeFn,
  });
  const p1 = p1Candidate({
    itemKey: JSON.stringify(['FF-S01', 'src/domain/entities/Task.ts', 'src/infrastructure/repositories/InMemoryTaskRepository.ts', []]),
    projectId: 'correct-reference', treeSha: TREE, sourceRoot: join(ROOT, 'fixtures/correct-reference'), line: 1, describe: describeFn,
  });
  const neural = {
    neuralResults: [
      { functionId: 'FF-N02', dimension: 'semantic', unitResults: [{ unitId: 'src/domain/entities/Task.ts', unitKind: 'file', layer: 'domain', filePaths: ['src/domain/entities/Task.ts'] }] },
      { functionId: 'FF-N01', dimension: 'integrity', unitResults: [{ unitId: 'src/domain/entities', unitKind: 'module', layer: 'domain', filePaths: ['src/domain/entities/Category.ts', 'src/domain/entities/Task.ts'] }] },
    ],
  };
  const p4 = judgeUnitCandidates(neural, { projectId: 'correct-reference', treeSha: TREE, stratumOwner: 'correct-reference', sourceRoot: join(ROOT, 'fixtures/correct-reference'), view: EMPTY_VIEW });
  const ms: MissedSeedCandidate = {
    kind: 'missed-seed', population: 'MS', projectId: 'correct-reference', treeSha: TREE, stratumOwner: 'correct-reference',
    sourceRoot: join(ROOT, 'fixtures/correct-reference'), seedId: 'correct-reference:MO-S01:0',
    key: JSON.stringify(['FF-S01', 'src/domain/entities/Category.ts', 'src/infrastructure/repositories/InMemoryTaskRepository.ts', ['IMPORTS']]),
    fields: { functionId: 'FF-S01', functionDescription: describeFn('FF-S01'), filePath: 'src/domain/entities/Category.ts', line: 1, target: 'src/infrastructure/repositories/InMemoryTaskRepository.ts' },
  };
  return [p1, ...p2, ...p4, ms];
}

export function fixturePlan(): LabelPlanFile {
  const samples = sampleCandidates(fixtureCandidates(), POPULATION_CAPS, FIXTURE_SEED);
  const built = buildItems(samples);
  if (!built.ok) throw new Error(built.detail);
  return {
    version: 1, permutationSeed: FIXTURE_SEED, budgetCalls: FIXTURE_BUDGET,
    strata: samples.map((s) => ({ population: s.population, stratum: s.stratum, size: s.size, cap: s.cap })),
    items: built.items,
  };
}

/** Numbered list under `## <heading>` of a rendered prompt. */
export function presentedList(prompt: string, heading: string): string[] {
  const at = prompt.indexOf(`## ${heading}\n`);
  if (at < 0) return [];
  const out: string[] = [];
  for (const line of prompt.slice(at).split('\n').slice(1)) {
    const m = /^\s*(\d+)\. (.+)$/.exec(line);
    if (m !== null) out.push(m[2] ?? '');
    else if (out.length > 0) break;
  }
  return out;
}

type Scenario = 'agree-tp' | 'agree-fp' | 'disagree' | 'invalid-then-valid' | 'unseeded' | 'invalid-twice';

/** Scenario of a violation item, from the hash of its `## Item` section (stable across runs and permutations). */
export function scenarioOf(prompt: string): Scenario {
  const item = prompt.slice(prompt.indexOf('## Item'), prompt.indexOf('## Label options'));
  const b = createHash('sha256').update(item).digest()[0] ?? 0;
  return (['agree-tp', 'agree-fp', 'disagree', 'invalid-then-valid', 'unseeded', 'invalid-twice'] as const)[b % 6] ?? 'agree-tp';
}

/** A scripted labeller answering in the presented order. */
export class ScriptedLabeller implements LLMProvider {
  readonly name = 'scripted-mock';
  readonly calls: { prompt: string; options: LLMOptions; call: LLMCallContext | undefined }[] = [];

  describe(): ProviderDescription {
    return { provider: 'mock', model: 'mock-model' };
  }

  evaluate(prompt: string, options: LLMOptions, call?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    this.calls.push({ prompt, options, call });
    const opts = presentedList(prompt, 'Label options');
    const rcs = presentedList(prompt, 'Root causes');
    const o = (label: string): number => opts.indexOf(label) + 1;
    const r = (code: string): number => rcs.indexOf(code) + 1;
    const reasked = prompt.includes('## Your previous answer was invalid');
    const run = call?.runIndex ?? 0;
    let answer: Record<string, unknown>;
    if (opts.includes('pass')) {
      const fail = prompt.includes('src/domain/entities/Category.ts');
      answer = { option: o(fail ? 'fail' : 'pass'), rootCause: null, rationale: `unit read from source (${fail ? 'fail' : 'pass'})` };
    } else if (opts.includes('FN')) {
      answer = { option: o('FN'), rootCause: r('RC-LAYER-MAP'), rationale: 'the file sits outside the mapped domain globs' };
    } else {
      const s = scenarioOf(prompt);
      if (s === 'agree-tp') answer = { option: o('TP'), rootCause: null, rationale: 'the import crosses the layer boundary' };
      else if (s === 'agree-fp') answer = { option: o('FP'), rootCause: r('RC-TEMPLATE-OVERAPPROX'), rationale: 'the construct is allowed' };
      else if (s === 'disagree') answer = run === 0 ? { option: o('TP'), rootCause: null, rationale: 'violates' } : { option: o('FP'), rootCause: r('RC-TEST-CODE'), rationale: 'test code' };
      else if (s === 'invalid-then-valid') answer = reasked ? { option: o('FP'), rootCause: r('RC-SPEC-PARAM'), rationale: 'threshold effect' } : { option: o('FP'), rootCause: null, rationale: 'missing cause' };
      else if (s === 'unseeded') answer = { option: o('unseeded-TP'), rootCause: r('RC-GENUINE-UNSEEDED'), rationale: 'real but original' };
      else answer = { option: o('FP'), rootCause: r('RC-OTHER'), note: '', rationale: 'other without note' };
    }
    const content = JSON.stringify(answer);
    return Promise.resolve(DomainResult.ok({ content, model: 'mock-model', usage: { inputTokens: Math.ceil(prompt.length / 4), outputTokens: Math.ceil(content.length / 4) }, usedOptions: {}, ignoredOptions: Object.keys(options) as (keyof LLMOptions)[] }));
  }
}

/** A provider that must never be called (replay with the provider disabled). */
export const DISABLED: LLMProvider = {
  name: 'disabled',
  describe: () => ({ provider: 'mock', model: 'mock-model' }),
  evaluate: () => Promise.reject(new Error('provider disabled in replay')),
};
