/**
 * U6 plan Step 10: the operator run under the applied construct answers. The engine passthrough of `cliEvaluate`
 * (default neo4j, unchanged), the `--engine` argument, construct-aware tiers that equal the sealed tiers at the status
 * quo, and the expected-key options for MO-H03 (Q5 C or D) and MO-H02 (Q6 B). No evaluation runs here.
 */
import * as path from 'node:path';
import { cliEvaluate } from '../../../../scripts/lib/freeze-gate-main.js';
import { engineOf } from '../../../../scripts/v1.3/operators-hexddd-run.js';
import { applyConstructKeys, constructKeyOptions } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import type { ExpectedKey } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import { constructRuleTier } from '../../../../src/construct-switches/tiers.js';
import { ruleTier } from '../../../../src/scoring-engine/rule-tiers.js';
import { STATUS_QUO_ANSWERS, withAnswers } from '../../../../src/shared/construct-switches.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';

const REPO = path.resolve(__dirname, '../../../..');

describe('cliEvaluate engine passthrough', () => {
  const capture = (): { seen: { args: readonly string[]; options: ProcessRunOptions }[]; runner: ProcessRunner } => {
    const seen: { args: readonly string[]; options: ProcessRunOptions }[] = [];
    const runner: ProcessRunner = {
      run: (_command, args, options) => {
        seen.push({ args, options });
        return Promise.resolve(DomainResult.ok({ exitCode: 0, stdout: JSON.stringify({ violations: [] }), stderr: '', timedOut: false, durationMs: 1 }));
      },
    };
    return { seen, runner };
  };
  const env = { PATH: '/bin', HOME: '/h', NEO4J_URI: 'bolt://localhost:7691', NEO4J_USER: 'u', NEO4J_PASSWORD: 'p' };

  it('defaults to neo4j with the caller\'s URI', async () => {
    const c = capture();
    await cliEvaluate(c.runner, REPO, env)('/tmp/copy', 'spec.yaml');
    expect(c.seen[0]?.args.slice(-4)).toEqual(['--neo4j-uri', 'bolt://localhost:7691', '--engine', 'neo4j']);
    expect(c.seen[0]?.options.env.NEO4J_URI).toBe('bolt://localhost:7691');
  });

  it('cypher-interp blanks NEO4J_URI in the child and on the command line', async () => {
    const c = capture();
    await cliEvaluate(c.runner, REPO, env, 'cypher-interp')('/tmp/copy', 'spec.yaml');
    expect(c.seen[0]?.args.slice(-4)).toEqual(['--neo4j-uri', '', '--engine', 'cypher-interp']);
    expect(c.seen[0]?.options.env.NEO4J_URI).toBe('');
  });
});

describe('operators-hexddd-run --engine', () => {
  it('reads neo4j by default, accepts cypher-interp, refuses anything else', () => {
    expect(engineOf([])).toBe('neo4j');
    expect(engineOf(['--engine', 'cypher-interp'])).toBe('cypher-interp');
    expect(engineOf(['--engine', 'memgraph'])).toBeUndefined();
  });
});

describe('construct-aware tiers', () => {
  const RULES = ['FF-S01', 'FF-S02', 'FF-S03', 'FF-S04', 'FF-S05', 'FF-P01', 'FF-P02', 'FF-P03', 'FF-P06', 'FF-DS01', 'FF-DS02', 'FF-DT01', 'FF-DT05'];
  it('equal the sealed ruleTier at the status quo, so earlier operator figures are unchanged', () => {
    for (const style of ['hexagonal', 'ddd']) {
      for (const r of RULES) expect([style, r, constructRuleTier(r, style, STATUS_QUO_ANSWERS).tier]).toEqual([style, r, ruleTier(r, style).tier]);
    }
  });
  it('under Q5 D an FF-S05 row is blocking, which the sealed tier would miss', () => {
    expect(constructRuleTier('FF-S05', 'hexagonal', withAnswers({ Q5: 'D' })).tier).toBe('blocking');
  });
});

describe('expected-key options (Q5, Q6)', () => {
  const k = (template: string, functionId: string): ExpectedKey => ({ template, functionId, filePath: 'src/a.ts', target: 'src/b.ts' });
  it('are derived from the answers', () => {
    expect(constructKeyOptions(STATUS_QUO_ANSWERS)).toEqual({});
    expect(constructKeyOptions(withAnswers({ Q5: 'C', Q6: 'B' }))).toEqual({ mo03To: 'FF-S01', mo02AlsoS04: true });
    expect(constructKeyOptions(withAnswers({ Q5: 'D' }))).toEqual({ mo03To: 'FF-S05' });
  });
  it('MO-H03: the layer-skip key moves to FF-S01 under C (FF-S05 under D)', () => {
    expect(applyConstructKeys('MO-H03', [k('layer-skip-graph', 'FF-S03')], { mo03To: 'FF-S01' })).toEqual([k('dependency-direction-graph', 'FF-S01')]);
    expect(applyConstructKeys('MO-H03', [k('layer-skip-graph', 'FF-S03')], { mo03To: 'FF-S05' })).toEqual([k('adapter-isolation', 'FF-S05')]);
    expect(applyConstructKeys('MO-H03', [k('layer-skip-graph', 'FF-S03')], {})).toEqual([k('layer-skip-graph', 'FF-S03')]);
  });
  it('MO-H02: FF-S04 is added on the same edge under Q6 B; other operators are untouched', () => {
    expect(applyConstructKeys('MO-H02', [k('dependency-direction-graph', 'FF-S01')], { mo02AlsoS04: true })).toEqual([k('dependency-direction-graph', 'FF-S01'), k('core-isolation', 'FF-S04')]);
    expect(applyConstructKeys('MO-H01', [k('dependency-direction-graph', 'FF-S01')], { mo03To: 'FF-S01', mo02AlsoS04: true })).toEqual([k('dependency-direction-graph', 'FF-S01')]);
  });
});
