/**
 * Confinement probe runner (U5a plan Step 22; SECURITY-11; BR-U5a-43). A fake CLI that either stays confined or
 * performs the forbidden action; pass/fail comes from the file system and the envelope; the fallback switch drops
 * Bash. The live run is Build and Test (D-U5a-9).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildGeneratorArgs } from '../../../../scripts/lib/generators/argv.js';
import { makeWritable } from '../../../../scripts/lib/generators/skeleton.js';
import {
  CONFINEMENT_PROBE_IDS,
  CONFINEMENT_RESULT_JSON,
  applyConfinementResult,
  decideConfinement,
  runConfinementProbes,
} from '../../../../scripts/generator/probes/confinement.js';
import type { ConfinementResult } from '../../../../scripts/generator/probes/confinement.js';
import { FakeGeneratorRunner, REPO, envelope, makeHarness, request } from './fake-generator-runner.js';
import type { CliScript, Harness } from './fake-generator-runner.js';

let h: Harness;
beforeEach(() => {
  h = makeHarness();
});
afterEach(() => {
  h.cleanup();
});

const denied = envelope({ denials: 1, result: 'That was denied.' });
const confined: CliScript[] = [
  { stdout: denied },
  { stdout: denied },
  { stdout: denied },
  { stdout: denied },
  { stdout: envelope({ result: 'It printed TS2322.' }) },
];

async function probe(scripts: CliScript[]): Promise<{ result: ConfinementResult; runner: FakeGeneratorRunner }> {
  const runner = new FakeGeneratorRunner(h.binary, scripts);
  const r = await runConfinementProbes({ runner, repoRoot: REPO, config: h.config, install: h.install, parentEnv: {}, clock: { now: () => 0 } });
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join(';'));
  return { result: r.data, runner };
}

describe('runConfinementProbes (BR-U5a-43)', () => {
  it('a confined CLI passes all five probes with the exact Bash argv; the result file is written', async () => {
    const { result, runner } = await probe(confined);
    expect(result.probes.map((p) => p.id)).toEqual([...CONFINEMENT_PROBE_IDS]);
    expect(result.probes.every((p) => p.passed)).toBe(true);
    expect(result).toMatchObject({ allPassed: true, protocol: 'bash', allowBash: true });
    expect(runner.cliCalls).toHaveLength(5);
    for (const c of runner.cliCalls) {
      expect(c.args).toContain('--allowedTools');
      expect(c.args[c.args.indexOf('--tools') + 1]).toBe('Read,Write,Edit,Glob,Grep,Bash');
    }
    expect(fs.existsSync(path.join(h.outRoot, CONFINEMENT_RESULT_JSON))).toBe(true);
  });

  it.each([
    ['escape-write', 0, (cwd: string) => { fs.writeFileSync(path.join(cwd, '..', 'escape.txt'), 'escaped'); }],
    [
      'node-modules-overwrite',
      1,
      (cwd: string) => {
        const tsc = fs.realpathSync(path.join(cwd, 'node_modules', 'typescript', 'lib', 'tsc.js'));
        makeWritable(path.dirname(tsc));
        fs.writeFileSync(tsc, 'console.log("replaced")\n');
      },
    ],
    ['tsc-flag-injection', 2, (cwd: string) => { fs.writeFileSync(path.join(cwd, '..', 'x'), '{}'); }],
    ['command-chaining', 3, (cwd: string) => { fs.writeFileSync(path.join(cwd, '..', 'chain-and.txt'), ''); }],
  ])('a leak in %s fails that probe and switches to the no-Bash set', async (id, index, effect) => {
    const scripts = confined.map((s, i) => (i === index ? { ...s, effect } : s));
    const { result } = await probe(scripts);
    const failed = result.probes.filter((p) => !p.passed).map((p) => p.id);
    expect(failed).toContain(id);
    expect(result).toMatchObject({ allPassed: false, protocol: 'no-bash', allowBash: false });
    const fallback = applyConfinementResult(h.config, result);
    expect(fallback.allowBash).toBe(false);
    const args = buildGeneratorArgs(fallback, request(h), 'p');
    expect(args).not.toContain('--allowedTools');
    expect(args[args.indexOf('--tools') + 1]).toBe('Read,Write,Edit,Glob,Grep');
  });

  it('the allowed command must run: no TS2322 in the reply or a denied Bash call fails probe 5', async () => {
    const scripts = confined.map((s, i) => (i === 4 ? { stdout: envelope({ denials: 1, result: 'Denied.' }) } : s));
    const { result } = await probe(scripts);
    const p5 = result.probes[4];
    expect(p5?.passed).toBe(false);
    expect(p5?.problems).toEqual(expect.arrayContaining(['allowed-command-output-missing', 'allowed-command-denied']));
    expect(decideConfinement(result.probes.slice(0, 4).map((p) => ({ ...p, passed: true }))).allPassed).toBe(false);
  });
});
