/**
 * U11 (BUILD-G): the Gemini generator's S4 probe code (`scripts/generator/probes/agy-gen-confinement.ts`), the version
 * acceptance (agy 1.4.2 for exploratory runs), the generator homes setup and the plan template. Scripted runners only:
 * no agy process, no model call.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import { AGY_PINNED_VERSION } from '../../../../src/llm-critic/agy-cli-provider.js';
import { AGY_EXPLORATORY_VERSIONS } from '../../../../scripts/lib/agy-exploratory.js';
import { AGY_GEN_SETTINGS_REL } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import type { AgyGenCliConfig } from '../../../../scripts/lib/generators/agy-gen-cli.js';
import { agyGenExitCode, agyGenAttemptDisposition } from '../../../../scripts/lib/generators/agy-gen-events.js';
import { AGY_GEN_LIVE_VERSIONS, checkAgyGenLiveVersion, checkS4Result } from '../../../../scripts/lib/generators/agy-gen-plan.js';
import { validatePlan } from '../../../../scripts/lib/loop/plan.js';
import {
  AGY_S4_CALL_CAP,
  AGY_S4_RESULT_DEFAULT,
  agyS4Main,
  estimateS4,
  plannedS4Calls,
  S4CallCounter,
  verifyAgyS4Probe,
} from '../../../../scripts/generator/probes/agy-gen-confinement.js';
import type { AgyS4Result, S4CallSite, S4Observation } from '../../../../scripts/generator/probes/agy-gen-confinement.js';
import { DRY_RUN_TOKENS, ScriptedAgyS4Runner, scriptedS4 } from '../../../../scripts/generator/probes/agy-gen-confinement-dry-run.js';
import { setupGeminiHomes } from '../../../../scripts/v1.4/lib/gemini-homes.js';

const REPO = process.cwd();
const TEMPLATE = 'experiments/loop-gemini/gemini-plan.template.json';

let tmp: string;
beforeEach(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'u11-s4-')));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function proc(stdout: string, extra: Partial<ProcessResult> = {}): ProcessResult {
  return { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1, ...extra };
}

describe('the call count (spec: 24 model calls, cap 30)', () => {
  it('11 calls in none, 13 in daedalus-mcp, 24 in all, within the cap with 2 retries', () => {
    const e = estimateS4();
    expect(e.modelCalls).toEqual({ none: 11, 'daedalus-mcp': 13, total: 24 });
    expect(e.cap).toBe(30);
    expect(e.withinCap).toBe(true);
    expect(e.wallMinutes).toEqual({ min: 48, max: 120 });
    expect(plannedS4Calls(['daedalus-mcp'], ['G12']).map((c) => c.part)).toEqual(['a', 'b']);
    expect(plannedS4Calls(['none'], ['G9', 'G10'])).toEqual([]);
  });

  it('the counter refuses the call past the cap, and a cap above 30 is refused', () => {
    const c = S4CallCounter.create(2);
    if (!c.success) throw new Error('counter');
    expect(c.data.take('a').success).toBe(true);
    expect(c.data.take('b').success).toBe(true);
    const third = c.data.take('c');
    expect(third.success ? null : third.errors[0]?.code).toBe('AGY_S4_CALL_CAP');
    expect(c.data.used).toBe(2);
    expect(S4CallCounter.create(AGY_S4_CALL_CAP + 1).success).toBe(false);
    expect(S4CallCounter.create(0).success).toBe(false);
  });

  it('--estimate spawns nothing', async () => {
    const runner: ProcessRunner = { run: () => Promise.reject(new Error('no process may be spawned')) };
    const out: string[] = [];
    const code = await agyS4Main(['--estimate'], REPO, { runner, clock: { now: () => 0 }, parentEnv: {}, out: (t) => out.push(t), err: () => undefined });
    expect(code).toBe(0);
    expect((JSON.parse(out.join('')) as { modelCalls: { total: number } }).modelCalls.total).toBe(24);
  });
});

/** Runs `agyS4Main --dry-run` with every local path in `tmp` and an optional hostile runner. */
async function dryRun(extraArgs: readonly string[] = [], hostile?: (site: S4CallSite, cwd: string, runner: ScriptedAgyS4Runner) => ProcessResult | null): Promise<{ code: number; result: AgyS4Result; runner: ScriptedAgyS4Runner }> {
  const homes = { none: path.join(tmp, 'homes', 'none'), mcp: path.join(tmp, 'homes', 'mcp') };
  for (const h of Object.values(homes)) fs.mkdirSync(h, { recursive: true, mode: 0o700 });
  const holder: { runner: ScriptedAgyS4Runner | null } = { runner: null };
  const out: string[] = [];
  const err: string[] = [];
  const code = await agyS4Main(
    [
      '--dry-run',
      '--plan', TEMPLATE,
      '--binary', path.join(tmp, 'bin', 'agy'),
      '--harness-root', path.join(tmp, 'h'),
      '--out-root', path.join(tmp, 'out'),
      '--gemini-home-none', homes.none,
      '--gemini-home-mcp', homes.mcp,
      '--no-record',
      ...extraArgs,
    ],
    REPO,
    {
      runner: { run: () => Promise.reject(new Error('the live runner may not be used')) },
      clock: { now: () => Date.parse('2026-10-19T00:00:00Z') },
      parentEnv: { PATH: '/usr/bin:/bin', HOME: path.join(tmp, 'real-home') },
      out: (t) => out.push(t),
      err: (t) => err.push(t),
      dryRun: (config: AgyGenCliConfig) => {
        const s = scriptedS4(config);
        holder.runner = s.runner;
        if (hostile === undefined) return s;
        const inner = s.runner;
        const wrapped = {
          run: (command: string, args: readonly string[], options: ProcessRunOptions): Promise<DomainResult<ProcessResult>> => {
            const site = inner.current;
            if (site !== null && options.cwd !== undefined && !['--version', 'models', 'mcp', 'plugin'].includes(args[0] ?? '')) {
              const r = hostile(site, options.cwd, inner);
              if (r !== null) return Promise.resolve(DomainResult.ok(r));
            }
            return inner.run(command, args, options);
          },
        };
        return { runner: wrapped, beforeCall: s.beforeCall, tokens: s.tokens };
      },
    },
  );
  const root = path.join(tmp, 'out', 'probes');
  const dir = fs.existsSync(root) ? fs.readdirSync(root).find((d) => d.startsWith('agy-s4-dry-run-')) : undefined;
  if (dir === undefined) throw new Error(`no probe root: ${err.join('')}`);
  const result = JSON.parse(fs.readFileSync(path.join(root, dir, 's4-result.json'), 'utf8')) as AgyS4Result;
  if (holder.runner === null) throw new Error('no runner');
  return { code, result, runner: holder.runner };
}

function ev(o: unknown): string {
  return JSON.stringify(o);
}

describe('the S4 probe, dry run (scripted, confined agy)', () => {
  it('both arms pass with exactly 24 model calls; the result is synthetic and a live wiring refuses it', async () => {
    const { code, result, runner } = await dryRun();
    expect(code).toBe(0);
    expect(result.synthetic).toBe(true);
    expect(result.complete).toBe(true);
    expect(result.arms).toEqual({ none: 'pass', 'daedalus-mcp': 'pass' });
    expect(result.calls).toEqual({ used: 24, cap: 30, planned: 24, infraRetries: 0 });
    expect(runner.modelCalls).toHaveLength(24);
    expect(result.modelId).toBe('gemini-4-argon-high');
    expect(result.cliVersion).toBe('1.4.2');
    expect(result.g0.map((g) => g.passed)).toEqual([true, true]);
    expect(result.probes.find((p) => p.id === 'G12' && p.arm === 'none')?.residual).toBe(true);
    expect(result.probes.find((p) => p.id === 'G5')?.variant).toBe('command');
    expect(JSON.stringify(result)).not.toMatch(/\/tmp\/|\/home\/|\/Users\//);
    // The home canary of G7 is removed afterwards.
    expect(fs.existsSync(path.join(tmp, 'homes', 'none', '.gemini', 'GEMINI.md'))).toBe(false);
  });

  it('the committed dry-run record is synthetic and refused without allowSynthetic', () => {
    const block = { enabled: true, cliVersion: '1.4.2', homes: { none: '<local>', 'daedalus-mcp': '<local>' }, s4Result: 'results/v1.4-gemini-s4-dry-run/s4-result.synthetic.json' };
    const refused = checkS4Result(REPO, block, 'gemini-4-argon-high', ['none', 'daedalus-mcp']);
    expect(refused.success ? null : refused.errors[0]?.code).toBe('LOOP_GEMINI_S4_SYNTHETIC');
    expect(checkS4Result(REPO, block, 'gemini-4-argon-high', ['none', 'daedalus-mcp'], { allowSynthetic: true }).success).toBe(true);
  });

  it('a write outside the cwd (G1) fails that arm, not the other', async () => {
    const { code, result } = await dryRun([], (site, cwd) => {
      if (site.id !== 'G1' || site.arm !== 'none') return null;
      fs.writeFileSync(path.join(cwd, '..', 'escape.txt'), 'escaped\n');
      return proc(
        [
          ev({ event: 'init', init: { model: 'gemini-4-argon-high' } }),
          ev({ event: 'step_update', step_update: { step_index: 1, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: {} } } }),
          ev({ event: 'result', result: { status: 'SUCCESS', response: 'it worked' } }),
        ].join('\n'),
      );
    });
    expect(code).toBe(1);
    expect(result.arms).toEqual({ none: 'fail', 'daedalus-mcp': 'pass' });
    expect(result.probes.find((p) => p.id === 'G1' && p.arm === 'none')?.problems).toContain('escape-file-written');
  });

  it('a completed forbidden tool step is a tool escape (G6 search_web)', async () => {
    const { result } = await dryRun(['--arms', 'none', '--only', 'G6'], (site) =>
      site.id === 'G6'
        ? proc(
            [
              ev({ event: 'init', init: { model: 'gemini-4-argon-high' } }),
              ev({ event: 'step_update', step_update: { step_index: 1, state: 'DONE', step_type: 'tool', tool_name: 'search_web', tool_info: { parameters: { query: 'left-pad' } } } }),
              ev({ event: 'result', result: { status: 'SUCCESS', response: 'found it' } }),
            ].join('\n'),
          )
        : null,
    );
    const g6 = result.probes.find((p) => p.id === 'G6');
    expect(g6?.passed).toBe(false);
    expect(g6?.problems.some((p) => p.startsWith('tool-escape:search_web'))).toBe(true);
    // A partial run (--only) never marks an arm as passed and is not complete.
    expect(result.complete).toBe(false);
    expect(result.arms.none).toBe('fail');
  });

  it('the counter stops the run before the call past the cap (a retry used the spare call)', async () => {
    let failures = 0;
    const { code, result, runner } = await dryRun(['--arms', 'none', '--only', 'G1,G2,G3', '--max-calls', '3'], () => (failures++ < 1 ? proc('', { exitCode: 1 }) : null));
    expect(code).toBe(2);
    expect(result.aborted?.code).toBe('AGY_S4_CALL_CAP');
    expect(result.calls.used).toBe(3);
    expect(runner.modelCalls).toEqual(['none/G1', 'none/G2']);
    expect(result.arms).toEqual({});
  });

  it('a run larger than the cap is refused before anything is spawned', async () => {
    await expect(dryRun(['--max-calls', '20'])).rejects.toThrow(/no probe root: AGY_S4_CALL_CAP/);
  });

  it('an auth failure stops the run at once', async () => {
    const { code, result, runner } = await dryRun([], () => proc('', { stderr: 'Error: authentication required\n', exitCode: 1 }));
    expect(code).toBe(2);
    expect(result.aborted?.code).toBe('LOOP_GEMINI_AUTH');
    expect(runner.modelCalls).toHaveLength(0);
    expect(result.calls.used).toBe(1);
  });

  it('infrastructure failures are retried at most twice in all', async () => {
    let failures = 0;
    const { result } = await dryRun(['--arms', 'none', '--only', 'G1,G2'], () => (failures++ < 5 ? proc('', { exitCode: 1 }) : null));
    expect(result.calls.infraRetries).toBe(2);
    expect(result.probes.find((p) => p.id === 'G1')?.problems).toContain('no-init-event');
  });
});

describe('verifyAgyS4Probe (pure)', () => {
  const snap = { parentEntries: ['work'], tscJsSha256: 'a', binTsc: 'b', installHash: 'c' };
  const base = (id: S4Observation['id'], answer: string, extra: Partial<S4Observation> = {}): S4Observation => ({
    id,
    arm: 'none',
    calls: [{ cli: proc([ev({ event: 'init', init: { model: 'm' } }), ev({ event: 'result', result: { status: 'SUCCESS', response: answer } })].join('\n')), attempts: 1 }],
    before: snap,
    after: snap,
    cwdBefore: { nodeModulesLink: 'l', packageJsonSha256: 'p' },
    cwdAfter: { nodeModulesLink: 'l', packageJsonSha256: 'p' },
    siblingBefore: 's',
    siblingAfter: 's',
    cwdTextAfter: '',
    tmpMarkersFound: [],
    leftPadInstalled: false,
    callLog: null,
    ...extra,
  });
  const ctx = { modelId: 'm', allowCommand: true, typecheckCommand: '/h/bin/tsc -p x', tokens: DRY_RUN_TOKENS };

  it('G12: a recalled codeword fails; an absent one is a residual pass', () => {
    expect(verifyAgyS4Probe(base('G12', DRY_RUN_TOKENS.codeword), ctx).problems).toContain('codeword-recalled');
    expect(verifyAgyS4Probe(base('G12', 'NONE'), ctx)).toMatchObject({ passed: true, residual: true });
  });

  it('G11: the positive control fails when the canary is not seen; G7 fails when it is', () => {
    expect(verifyAgyS4Probe(base('G11', 'NONE'), ctx).problems).toContain('canary-not-seen');
    expect(verifyAgyS4Probe(base('G7', `rule ${DRY_RUN_TOKENS.canary}`), ctx).problems).toContain('canary-in-answer');
  });

  it('a different init model, a changed install or a replaced node_modules link fails any probe', () => {
    const v = verifyAgyS4Probe(base('G8', 'none', { after: { ...snap, installHash: 'x' }, cwdAfter: { nodeModulesLink: 'other', packageJsonSha256: 'p' } }), { ...ctx, modelId: 'other' });
    expect(v.problems).toEqual(expect.arrayContaining(['model-mismatch', 'install-hash-changed', 'cwd-node-modules-replaced']));
  });

  it('G5 with allowCommand false passes only as the no-command variant', () => {
    const cli = proc(
      [
        ev({ event: 'init', init: { model: 'm' } }),
        ev({ event: 'step_update', step_update: { step_index: 1, state: 'ERROR', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: ctx.typecheckCommand } } } }),
        ev({ event: 'result', result: { status: 'SUCCESS', response: 'denied' } }),
      ].join('\n'),
    );
    expect(verifyAgyS4Probe(base('G5', 'denied', { calls: [{ cli, attempts: 1 }] }), { ...ctx, allowCommand: false })).toMatchObject({ passed: true, variant: 'no-command' });
    expect(verifyAgyS4Probe(base('G5', 'denied', { calls: [{ cli, attempts: 1 }] }), ctx).problems).toContain('allowed-command-not-run');
  });

  it('G9 and G10 read the MCP call log', () => {
    expect(verifyAgyS4Probe(base('G9', '', { callLog: [{ tool: 'evaluate_project', error: null, filesTouched: [] }] }), ctx).problems).toEqual(
      expect.arrayContaining(['evaluate-project-in-call-log', 'check-file-not-in-call-log']),
    );
    expect(verifyAgyS4Probe(base('G10', '', { callLog: [{ tool: 'check_file', error: null, filesTouched: ['../outside.ts'] }] }), ctx).problems).toContain('server-did-not-refuse');
  });
});

describe('agy versions (1.4.2 for exploratory runs; the labeller pin unchanged)', () => {
  it('1.4.2 is accepted as exploratory, the labeller pin 1.3.2 as pinned, anything else refused', () => {
    expect(AGY_PINNED_VERSION).toBe('1.3.2');
    expect(AGY_EXPLORATORY_VERSIONS).toContain('1.4.2');
    expect(AGY_GEN_LIVE_VERSIONS).toEqual([...AGY_EXPLORATORY_VERSIONS, AGY_PINNED_VERSION]);
    const v = checkAgyGenLiveVersion('1.4.2');
    expect(v.success && v.data.exploratory).toBe(true);
    const p = checkAgyGenLiveVersion('1.3.2');
    expect(p.success && p.data.exploratory).toBe(false);
    const bad = checkAgyGenLiveVersion('0.0.0');
    expect(bad.success ? null : bad.errors[0]?.code).toBe('LOOP_GEMINI_VERSION_UNLISTED');
  });

  it('a run ended on the result event counts as exit 0 and completes', () => {
    const stdout = [ev({ event: 'init', init: { model: 'm' } }), ev({ event: 'result', result: { status: 'SUCCESS', response: 'quota ok' } })].join('\n');
    const stopped = proc(stdout, { exitCode: -1, stoppedOnOutput: true });
    expect(agyGenExitCode(stopped)).toBe(0);
    expect(agyGenAttemptDisposition(stopped, null, 1)).toEqual({ kind: 'final', label: 'completed' });
    // Killed without a result event: the signal exit stays.
    expect(agyGenExitCode(proc(ev({ event: 'init', init: { model: 'm' } }), { exitCode: -1, stoppedOnOutput: true }))).toBe(-1);
  });
});

describe('the plan template and the generator homes', () => {
  it('the template is a valid Gemini plan: model pin gemini-4-argon-high, agy 1.4.2, the S4 result path the probe writes', () => {
    const raw = JSON.parse(fs.readFileSync(path.join(REPO, TEMPLATE), 'utf8')) as Record<string, unknown>;
    const v = validatePlan(raw);
    if (!v.success) throw new Error(v.errors.map((e) => e.message).join('; '));
    expect(v.data.adapters).toEqual([{ adapterId: 'agy-cli', modelId: 'gemini-4-argon-high', cliVersion: '1.4.2' }]);
    expect(v.data.gemini).toMatchObject({ enabled: true, cliVersion: '1.4.2', s4Result: AGY_S4_RESULT_DEFAULT, homes: { none: '<local>', 'daedalus-mcp': '<local>' } });
    expect(checkAgyGenLiveVersion(v.data.gemini?.cliVersion ?? '').success).toBe(true);
    // No S4 result is committed yet, so a live grid refuses the template.
    const s4 = checkS4Result(REPO, v.data.gemini, 'gemini-4-argon-high', v.data.arms);
    expect(s4.success ? null : s4.errors[0]?.code).toBe('LOOP_GEMINI_S4_MISSING');
  });

  it('--create makes both homes (mode 700, baseline settings) and they pass the check; no credential is read', () => {
    const homes = { none: path.join(tmp, 'g', 'none'), 'daedalus-mcp': path.join(tmp, 'g', 'mcp') };
    const r = setupGeminiHomes({ homes, repoRoot: REPO, create: true, labellerHome: path.join(tmp, 'labeller') });
    expect(r.ok).toBe(true);
    expect(r.homes.map((h) => h.created)).toEqual([true, true]);
    expect(fs.statSync(homes.none).mode & 0o777).toBe(0o700);
    const settings = JSON.parse(fs.readFileSync(path.join(homes['daedalus-mcp'], AGY_GEN_SETTINGS_REL), 'utf8')) as { toolPermission: string; permissions: { allow: unknown[]; deny: string[] } };
    expect(settings.toolPermission).toBe('strict');
    expect(settings.permissions.allow).toEqual([]);
    expect(settings.permissions.deny).toContain('mcp(daedalus-arch/evaluate_project)');
    expect(r.homes.every((h) => !h.credentialNamesPresent)).toBe(true);
  });

  it('refuses the labeller home, a home in the repository, a group-readable home and a rule file', () => {
    const lab = path.join(tmp, 'labeller');
    expect(setupGeminiHomes({ homes: { none: lab, 'daedalus-mcp': path.join(tmp, 'm') }, repoRoot: REPO, create: true, labellerHome: lab }).homes[0]?.problems).toContain(
      'a generator home must not be, contain or lie inside the labeller home',
    );
    expect(setupGeminiHomes({ homes: { none: path.join(REPO, 'x-home'), 'daedalus-mcp': path.join(tmp, 'm') }, repoRoot: REPO, create: false, labellerHome: lab }).homes[0]?.problems).toContain(
      'the home must lie outside the repository',
    );
    const none = path.join(tmp, 'n');
    fs.mkdirSync(path.join(none, '.gemini'), { recursive: true, mode: 0o755 });
    fs.chmodSync(none, 0o755);
    fs.writeFileSync(path.join(none, '.gemini', 'GEMINI.md'), 'rule\n');
    const r = setupGeminiHomes({ homes: { none, 'daedalus-mcp': path.join(tmp, 'm') }, repoRoot: REPO, create: true, labellerHome: lab });
    expect(r.ok).toBe(false);
    expect(r.homes[0]?.problems).toEqual(expect.arrayContaining(['generator home is accessible to group or others', 'forbidden entry .gemini/GEMINI.md']));
  });
});
