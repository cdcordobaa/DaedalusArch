/**
 * ADR-021 SO3-5: the judge cassette entries carry the run's project id, so judge repetition reliability is measured
 * within one unit of one project. The id flows run-experiment `cliArgv` -> `--cassette-project-id` ->
 * `parseLLMOptions` run settings -> `prepareJudgeStage` -> the cassette decorator.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseLLMOptions } from '../../../src/cli/llm-options.js';
import { prepareJudgeStage } from '../../../src/llm-critic/judge-stage.js';
import { MockLLMProvider } from '../../../src/llm-critic/mock-provider.js';
import { cliArgv } from '../../../scripts/run-experiment.js';
import type { ExperimentPlan } from '../../../scripts/run-experiment.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'cassette-project-id-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('--cassette-project-id (ADR-021 SO3-5)', () => {
  it('parseLLMOptions puts the id into the run cassette settings; without the flag there is none', () => {
    const withId = parseLLMOptions(['--llm-provider', 'mock', '--cassette-project-id', 'cell-a'], {}, { homeDir: dir });
    expect(withId.success && withId.data.run.cassette).toEqual({ mode: 'record', dir: './.firewall/cassettes', omitPrompt: false, projectId: 'cell-a' });
    const without = parseLLMOptions(['--llm-provider', 'mock'], {}, { homeDir: dir });
    expect(without.success && 'projectId' in without.data.run.cassette).toBe(false);
  });

  it('the judge stage writes the id on every recorded entry', async () => {
    const prepared = await prepareJudgeStage(new MockLLMProvider('{"pass":true,"confidence":0.9,"rationale":"ok","evidence":[]}'), {
      projectRoot: dir, specSha: 's', knownSecrets: [], holder: {},
      run: { llm: { model: 'mock-model', effort: 'high', maxTokens: 100 }, repetition: 0, cassette: { mode: 'record', dir, omitPrompt: false, projectId: 'cell-a' } },
    }, undefined);
    if (!prepared.success) throw new Error(prepared.errors[0]?.message);
    const r = await prepared.data.provider.judge('prompt', { model: 'mock-model', maxTokens: 100 }, { runIndex: 0, repetition: 0, functionId: 'FF-N02', unitId: 'src/a.ts' });
    expect(r.kind).toBe('final');
    expect(r.kind === 'final' && r.entry.projectId).toBe('cell-a');
  });

  it('run-experiment passes the entry project id to judge runs only', () => {
    const plan = (mode: ExperimentPlan['mode']): ExperimentPlan => ({
      id: 'p', experiment: 'E7', mode, judge: { provider: 'claude-cli', model: 'claude-opus-5-5' }, seeds: { sampling: 1, bootstrap: 2, permutation: 3 },
      cassetteDir: 'experiments/p/cassettes', outDir: 'results/p', projects: [],
    });
    const entry = { index: 0, projectId: 'cell-a', path: 'p/a', specPath: 's.yaml' };
    const full = cliArgv(plan('full'), entry);
    expect(full.slice(full.indexOf('--cassette-project-id'), full.indexOf('--cassette-project-id') + 2)).toEqual(['--cassette-project-id', 'cell-a']);
    expect(cliArgv(plan('symbolic-only'), entry)).not.toContain('--cassette-project-id');
  });
});
