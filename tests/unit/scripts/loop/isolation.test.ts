/**
 * Loop generator pins and isolation (gate S2, S3; `Docs/v1.3/loop-isolation.md` §3 P1–P5). A stub `claude` (a shell
 * script printing a version and dumping its environment) or the fake runner stands in for the CLI; no model, no login.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { buildGeneratorChildEnv } from '../../../../scripts/lib/generators/env.js';
import { GENERATOR_ENV_ALLOW } from '../../../../scripts/lib/generators/types.js';
import { ClaudeStepAgent } from '../../../../scripts/lib/loop/agents.js';
import { ISOLATION_ENV_NAMES, checkIsolationPaths, probeHomeOf, runHomeOf } from '../../../../scripts/lib/loop/isolation.js';
import type { ClaudeIsolation } from '../../../../scripts/lib/loop/isolation.js';
import { main } from '../../../../scripts/lib/loop/main.js';
import type { LoopMainDeps } from '../../../../scripts/lib/loop/main.js';
import { LOCAL, loadLoopPlan, validatePlan } from '../../../../scripts/lib/loop/plan.js';
import type { TurnInput } from '../../../../scripts/lib/loop/types.js';
import { FakeGeneratorRunner, MODEL, REPO, envelope, makeHarness } from '../generators/fake-generator-runner.js';
import type { Harness } from '../generators/fake-generator-runner.js';

const PINNED = '2.1.294';
/** Recorded Claude CLI usage-limit text (the E1 envelope form, `agents.test.ts`). */
const USAGE_LIMIT_TEXT = "You've hit your limit · resets 3pm|1767225600";
const PARENT: NodeJS.ProcessEnv = {
  HOME: '/home/author',
  USER: 'author',
  PATH: '/usr/bin:/bin',
  LANG: 'en_US.UTF-8',
  ANTHROPIC_API_KEY: 'sk-ant-secret',
  GITHUB_TOKEN: 'ghp_secret',
  NEO4J_PASSWORD: 'pw',
  CLAUDE_CONFIG_DIR: '/home/author/.claude',
};

let h: Harness;
let runId: string;
let cwd: string;
let iso: ClaudeIsolation;

function writeStub(file: string, version: string, envDump?: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const dump = envDump !== undefined ? `env > ${envDump}\n` : '';
  fs.writeFileSync(file, `#!/bin/sh\n${dump}echo "${version} (Claude Code)"\n`, { mode: 0o755 });
}

beforeEach(() => {
  h = makeHarness();
  runId = `claude-code-cli/${MODEL}/todo-list/gate/run-0`;
  cwd = path.join(h.outRoot, 'runs', ...runId.split('/'), 'work');
  fs.mkdirSync(cwd, { recursive: true });
  const configDir = path.join(h.tmp, 'generator-claude-config');
  fs.mkdirSync(configDir);
  fs.writeFileSync(path.join(configDir, '.claude.json'), '{}\n');
  fs.writeFileSync(path.join(configDir, 'settings.json'), '{"env":{"DISABLE_AUTOUPDATER":"1"}}\n');
  iso = { configDir };
});
afterEach(() => {
  h.cleanup();
});

function input(over: Partial<TurnInput> = {}): TurnInput {
  return {
    runId,
    turnId: 'step-01',
    taskId: 'todo-list',
    kind: 'step',
    stepIndex: 0,
    arm: 'gate',
    cwd,
    prompt: 'Step 1 of the demo todo list.',
    recordDir: path.join(h.outRoot, 'records'),
    changedFiles: () => 1,
    restore: () => DomainResult.ok(undefined),
    archive: (i) => DomainResult.ok(`interruptions/${runId}/step-01/${String(i)}`),
    ...over,
  };
}

function expectIsolatedEnv(env: Readonly<Record<string, string>> | undefined, home: string): void {
  expect(env).toBeDefined();
  const e = env ?? {};
  expect(e.HOME).toBe(home);
  expect(e.CLAUDE_CONFIG_DIR).toBe(iso.configDir);
  expect(e.DISABLE_AUTOUPDATER).toBe('1');
  const allowed = new Set([...GENERATOR_ENV_ALLOW, ...ISOLATION_ENV_NAMES]);
  expect(Object.keys(e).filter((k) => !allowed.has(k))).toEqual([]);
  expect(Object.values(e).some((v) => v.includes('secret'))).toBe(false);
  expect(Object.keys(e).some((k) => k.startsWith('NEO4J') || k.startsWith('ANTHROPIC'))).toBe(false);
}

describe('P1: the Claude CLI version pin (stub binary)', () => {
  it('the probe refuses a different version and accepts the pinned one', async () => {
    const runner = new NodeProcessRunner();
    writeStub(h.binary, '2.1.300');
    const drifted = await new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT, cliVersion: PINNED }).probe();
    expect(drifted.success).toBe(false);
    if (!drifted.success) {
      expect(drifted.errors[0]?.code).toBe('LOOP_CLI_VERSION_MISMATCH');
      expect(drifted.errors[0]?.context).toEqual({ found: '2.1.300', pinned: PINNED });
    }
    writeStub(h.binary, PINNED);
    const ok = await new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT, cliVersion: PINNED }).probe();
    expect(ok.success && ok.data.cliVersion).toBe(PINNED);
  });

  it('unpinned: any answering binary is available, as before', async () => {
    writeStub(h.binary, '9.9.9');
    const agent = new ClaudeStepAgent(h.config, { runner: new NodeProcessRunner(), parentEnv: PARENT });
    expect(await agent.isAvailable()).toBe(true);
  });

  it('the grid refuses to start on a version mismatch (exit 1, before any install or turn)', async () => {
    writeStub(h.binary, '2.1.300');
    const plan = path.join(h.tmp, 'plan.json');
    fs.writeFileSync(
      plan,
      JSON.stringify({
        description: 'test plan',
        tasksFile: path.join(REPO, 'experiments/loop-demo/demo-tasks.json'),
        adapters: [{ adapterId: 'claude-code-cli', modelId: MODEL, cliVersion: PINNED }],
        arms: ['none'],
        runs: 1,
        orderSeed: 1,
        outRoot: h.outRoot,
        binary: h.binary,
        harnessRoot: path.join(h.tmp, 'h2'),
        allowBash: true,
        evaluatorSpec: 'specs/clean-arch.yaml',
      }),
    );
    const stderr: string[] = [];
    const deps: LoopMainDeps = {
      runner: new NodeProcessRunner(),
      clock: { now: () => 0 },
      sleep: () => Promise.resolve(),
      now: () => new Date(0),
      parentEnv: PARENT,
      out: () => undefined,
      err: (t) => stderr.push(t),
      evaluateDeps: () => Promise.reject(new Error('not reached')),
    };
    expect(await main(['--plan', plan], REPO, deps)).toBe(1);
    expect(stderr.join('')).toContain('LOOP_CLI_VERSION_MISMATCH');
    expect(fs.existsSync(path.join(h.tmp, 'h2', 'skeleton-install'))).toBe(false);
    expect(fs.existsSync(path.join(h.outRoot, 'schedule.json'))).toBe(false);
  });
});

describe('P2: plan validation', () => {
  const base = {
    description: 'd',
    tasksFile: 't.json',
    adapters: [{ adapterId: 'claude-code-cli', modelId: 'm' }],
    arms: ['none'],
    runs: 1,
    orderSeed: 1,
    outRoot: '/o',
    binary: '/b',
    harnessRoot: '/h',
    allowBash: true,
    evaluatorSpec: 's.yaml',
  };
  const codes = (raw: unknown): string[] => {
    const r = validatePlan(raw);
    return r.success ? [] : r.errors.map((e) => e.message);
  };

  it('accepts the plan without pins (OFF by default) and with a well-formed pin and isolation', () => {
    expect(codes(base)).toEqual([]);
    expect(codes({ ...base, adapters: [{ adapterId: 'claude-code-cli', modelId: 'm', cliVersion: PINNED }], generatorIsolation: { claudeConfigDir: '/c' } })).toEqual([]);
  });

  it('refuses a malformed pin, a Codex pin that differs from codex.cliVersion, and isolation without a Claude pin', () => {
    expect(codes({ ...base, adapters: [{ adapterId: 'claude-code-cli', modelId: 'm', cliVersion: 'latest' }] }).join()).toContain('must be x.y.z');
    const codex = { cliVersion: '0.162.1', reasoningEffort: 'high', modelCatalog: 'c.json', modelCatalogSha256: '0'.repeat(64) };
    expect(codes({ ...base, adapters: [{ adapterId: 'codex-cli', modelId: 'm', cliVersion: '0.162.2' }], codex }).join()).toContain('differs from codex.cliVersion');
    expect(codes({ ...base, adapters: [{ adapterId: 'codex-cli', modelId: 'm', cliVersion: '0.162.1' }], codex })).toEqual([]);
    expect(codes({ ...base, generatorIsolation: { claudeConfigDir: '/c' } }).join()).toContain('needs cliVersion');
    expect(codes({ ...base, adapters: [{ adapterId: 'claude-code-cli', modelId: 'm', cliVersion: PINNED }], generatorIsolation: { dir: '/c' } }).join()).toContain('{ claudeConfigDir }');
  });

  it('--claude-config-dir fills a "<local>" claudeConfigDir only', () => {
    const plan = path.join(h.tmp, 'p.json');
    const raw = { ...base, tasksFile: path.join(REPO, 'experiments/loop-demo/demo-tasks.json'), adapters: [{ adapterId: 'claude-code-cli', modelId: 'm', cliVersion: PINNED }], generatorIsolation: { claudeConfigDir: LOCAL } };
    fs.writeFileSync(plan, JSON.stringify(raw));
    const filled = loadLoopPlan(plan, REPO, { claudeConfigDir: iso.configDir });
    expect(filled.success && filled.data.plan.generatorIsolation).toEqual({ claudeConfigDir: iso.configDir });
    fs.writeFileSync(plan, JSON.stringify({ ...raw, generatorIsolation: { claudeConfigDir: '/pinned' } }));
    expect(loadLoopPlan(plan, REPO, { claudeConfigDir: iso.configDir }).success).toBe(false);
    fs.writeFileSync(plan, JSON.stringify(base));
    expect(loadLoopPlan(plan, REPO, { claudeConfigDir: iso.configDir }).success).toBe(false);
  });

  it('the config dir must lie outside the repository, outRoot, <H>/runs and the real ~/.claude', () => {
    const where = { repoRoot: REPO, outRoot: h.outRoot, harnessRoot: h.harnessRoot, realHome: path.join(h.tmp, 'realhome') };
    expect(checkIsolationPaths(iso, where)).toEqual([]);
    for (const bad of [path.join(REPO, '.cfg'), path.join(h.outRoot, 'cfg'), path.join(h.harnessRoot, 'runs', 'cfg'), path.join(h.tmp, 'realhome', '.claude'), path.join(h.tmp, 'realhome'), 'relative/cfg']) {
      expect(checkIsolationPaths({ configDir: bad }, where).length).toBeGreaterThan(0);
    }
  });
});

describe('P3: every isolated spawn runs with the per-run HOME, the dedicated config dir and auto-update off', () => {
  it('the probe (real spawn of the stub binary) sees exactly the isolated environment', async () => {
    const dump = path.join(h.tmp, 'probe-env.txt');
    writeStub(h.binary, PINNED, dump);
    const r = await new ClaudeStepAgent(h.config, { runner: new NodeProcessRunner(), parentEnv: PARENT, cliVersion: PINNED, isolation: iso }).probe();
    expect(r.success).toBe(true);
    // The shell adds PWD, SHLVL and `_`; everything else must come from the harness.
    const shellAdded = new Set(['PWD', 'SHLVL', '_', 'OLDPWD']);
    const seen: Record<string, string> = {};
    for (const line of fs.readFileSync(dump, 'utf8').split('\n')) {
      const at = line.indexOf('=');
      if (at > 0 && !shellAdded.has(line.slice(0, at))) seen[line.slice(0, at)] = line.slice(at + 1);
    }
    expectIsolatedEnv(seen, probeHomeOf(h.harnessRoot));
  });

  it('a step turn and a repair turn spawn with the isolated env and record it in env-<turnId>.json', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: `${PINNED} (Claude Code)` }, { stdout: envelope() }, { stdout: envelope() }]);
    const agent = new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT, cliVersion: PINNED, isolation: iso });
    expect((await agent.probe()).success).toBe(true);
    const step = await agent.runTurn(input());
    const repair = await agent.runTurn(input({ turnId: 'step-01-repair', kind: 'repair' }));
    expect(step.success && step.data.status).toBe('completed');
    expect(repair.success && repair.data.status).toBe('completed');
    expect(runner.cliCalls).toHaveLength(3);
    expectIsolatedEnv(runner.cliCalls[0]?.options.env, probeHomeOf(h.harnessRoot));
    expectIsolatedEnv(runner.cliCalls[1]?.options.env, runHomeOf(h.harnessRoot, runId));
    expectIsolatedEnv(runner.cliCalls[2]?.options.env, runHomeOf(h.harnessRoot, runId));
    expect(fs.statSync(runHomeOf(h.harnessRoot, runId)).mode & 0o777).toBe(0o700);
    for (const turnId of ['step-01', 'step-01-repair']) {
      const rec = JSON.parse(fs.readFileSync(path.join(h.outRoot, 'records', `env-${turnId}.json`), 'utf8')) as Record<string, unknown>;
      expect(rec.schema).toBe('loop-turn-env/v1');
      expect(rec.cliVersion).toBe(PINNED);
      expect(rec.set).toEqual({ HOME: runHomeOf(h.harnessRoot, runId), CLAUDE_CONFIG_DIR: iso.configDir, DISABLE_AUTOUPDATER: '1' });
      expect(typeof rec.configListingSha256).toBe('string');
      expect(JSON.stringify(rec)).not.toContain('/usr/bin');
    }
  });

  it.each([
    ['a hooks dir in the config dir', (): void => {
      fs.mkdirSync(path.join(iso.configDir, 'hooks'));
    }],
    ['a CLAUDE.md in the config dir', (): void => {
      fs.writeFileSync(path.join(iso.configDir, 'CLAUDE.md'), 'x');
    }],
    ['settings.json with hooks', (): void => {
      fs.writeFileSync(path.join(iso.configDir, 'settings.json'), '{"hooks":{}}');
    }],
    ['a .claude in the run HOME', (): void => {
      fs.mkdirSync(path.join(runHomeOf(h.harnessRoot, runId), '.claude'), { recursive: true });
    }],
    ['a missing config dir', (): void => {
      fs.rmSync(iso.configDir, { recursive: true });
    }],
  ])('%s stops the turn before any spawn', async (_label, poison) => {
    poison();
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: envelope() }]);
    const r = await new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT, cliVersion: PINNED, isolation: iso }).runTurn(input());
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('LOOP_ISOLATION');
    expect(runner.cliCalls).toHaveLength(0);
  });

  it('a poisoned config dir also stops the probe', async () => {
    fs.mkdirSync(path.join(iso.configDir, 'skills'));
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: `${PINNED} (Claude Code)` }]);
    const r = await new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT, cliVersion: PINNED, isolation: iso }).probe();
    expect(r.success).toBe(false);
    expect(runner.cliCalls).toHaveLength(0);
  });
});

describe('P4: without the new fields nothing changes', () => {
  it('the turn env is the E1 env exactly and no env record is written', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: '1.0.0' }, { stdout: envelope() }]);
    const agent = new ClaudeStepAgent(h.config, { runner, parentEnv: PARENT });
    expect(await agent.isAvailable()).toBe(true);
    const r = await agent.runTurn(input());
    expect(r.success).toBe(true);
    expect(runner.cliCalls[0]?.options.env).toEqual(buildGeneratorChildEnv(PARENT));
    expect(runner.cliCalls[1]?.options.env).toEqual(buildGeneratorChildEnv(PARENT));
    expect(runner.cliCalls[1]?.options.env.HOME).toBe('/home/author');
    expect(fs.existsSync(path.join(h.outRoot, 'records', 'env-step-01.json'))).toBe(false);
    expect(fs.existsSync(runHomeOf(h.harnessRoot, runId))).toBe(false);
  });
});

describe('P5: usage limits at the repair turn and at an isolated turn (S1 call sites)', () => {
  it.each([
    ['repair turn, E1 env', false],
    ['step turn, isolated', true],
    ['repair turn, isolated', true],
  ])('%s: classified as a pause, no attempt consumed, the same turn resumes', async (label, isolated) => {
    const kind = label.startsWith('repair') ? 'repair' : 'step';
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: envelope({ isError: true, result: USAGE_LIMIT_TEXT }), exitCode: 1 }, { stdout: envelope() }]);
    const sleeps: number[] = [];
    let now = 1_767_220_000_000;
    const agent = new ClaudeStepAgent(h.config, {
      runner,
      parentEnv: PARENT,
      clock: { now: () => (now += 1000) },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      ...(isolated ? { cliVersion: PINNED, isolation: iso } : {}),
    });
    const r = await agent.runTurn(input({ kind, turnId: kind === 'repair' ? 'step-01-repair' : 'step-01' }));
    if (!r.success) throw new Error(r.errors.map((e) => e.code).join(','));
    expect(r.data.status).toBe('completed');
    expect(r.data.interruptions).toHaveLength(1);
    expect(r.data.attempts.map((a) => a.outcome)).toEqual(['completed']);
    expect(sleeps).toHaveLength(1);
    expect(runner.cliCalls).toHaveLength(2);
  });
});
