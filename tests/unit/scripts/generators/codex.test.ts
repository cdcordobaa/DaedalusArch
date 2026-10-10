/**
 * Codex arm of the generator (ADR-029; SECURITY-11; `Docs/generator-protocol.md` §12): confined argument set,
 * sandbox read denials, child environment, config-home check, event and rollout reading, usage limits, the
 * adapter end to end over a fake CLI, and the registered Codex plan. No real CLI, no network.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { typecheckCommand } from '../../../../scripts/lib/generators/argv.js';
import { CodexCliAdapter, codexAttemptDisposition } from '../../../../scripts/lib/generators/codex-adapter.js';
import {
  CODEX_CLI_ADAPTER_ID,
  CODEX_DISABLED_FEATURES,
  CODEX_SHELL_FEATURES,
  FORBIDDEN_CODEX_FLAGS,
  buildCodexArgs,
  buildCodexChildEnv,
  checkCodexHome,
  codexPermissionsToml,
  codexReadDenies,
  createCodexCliConfig,
  parseCodexVersion,
} from '../../../../scripts/lib/generators/codex-cli.js';
import type { CodexCliConfig } from '../../../../scripts/lib/generators/codex-cli.js';
import {
  codexUsageLimit,
  parseCodexRun,
  rateLimitResetAt,
  rolloutModelUsage,
  sanitiseRollout,
  takeRollout,
} from '../../../../scripts/lib/generators/codex-events.js';
import { codexConfigFromPlan } from '../../../../scripts/lib/generators/codex-plan.js';
import { judgeModelUsage } from '../../../../scripts/lib/generators/model-usage.js';
import {
  E1_CODEX_GENERATOR_PLAN,
  E1_GENERATOR_PLAN,
  armPlanPathsFor,
  e1ArmsMismatches,
  guardE1Plan,
  protocolMismatches,
  readRegisteredPlan,
} from '../../../../scripts/lib/generators/registered-plan.js';
import { CODEX_SCHEDULE_JSON, SCHEDULE_JSON, codexBlockProblems, loadGeneratorPlanFile, scheduleFileName, scheduleGrid } from '../../../../scripts/lib/generators/schedule.js';
import type { PromptProvider } from '../../../../scripts/lib/generators/types.js';
import { FakeGeneratorRunner, MODEL, REPO, makeHarness, request, sourceFiles } from './fake-generator-runner.js';
import type { Harness } from './fake-generator-runner.js';

const FIXTURES = path.join(REPO, 'tests', 'fixtures', 'codex-cli');
const CATALOG = path.join(REPO, 'scripts', 'generator', 'codex', 'model-catalog.json');

let h: Harness;
let codex: CodexCliConfig;
let codexHome: string;
let userHome: string;
let realHome: string;

beforeEach(() => {
  h = makeHarness();
  codexHome = path.join(h.tmp, 'codex-home');
  userHome = path.join(h.tmp, 'codex-userhome');
  realHome = path.join(h.tmp, 'home');
  for (const d of [codexHome, userHome, realHome]) fs.mkdirSync(d, { recursive: true });
  const c = createCodexCliConfig({ base: h.config, codexHome, userHome, realHome, reasoningEffort: 'medium', cliVersion: '0.162.1', modelCatalog: CATALOG }, REPO);
  if (!c.success) throw new Error(c.errors.map((e) => e.code).join(','));
  codex = c.data;
});
afterEach(() => {
  h.cleanup();
});

const prompts: PromptProvider = (req, cmd) =>
  DomainResult.ok({
    promptTemplateId: req.promptTemplateId,
    promptTemplateSha256: 'c'.repeat(64),
    prompt: `Build ${req.taskId}. Type-check with: ${cmd}`,
    promptSha256: 'd'.repeat(64),
  });

// --- fake codex output -------------------------------------------------------------------------------------------

const THREAD = '01a12714-4667-72d2-ab12-af4c111deb45';

function stdoutOf(o: { thread?: string; error?: string; message?: string } = {}): string {
  const lines: unknown[] = [{ type: 'thread.started', thread_id: o.thread ?? THREAD }, { type: 'turn.started' }];
  if (o.error !== undefined) {
    lines.push({ type: 'error', message: o.error }, { type: 'turn.failed', error: { message: o.error } });
  } else {
    lines.push(
      { type: 'item.completed', item: { id: 'item_0', type: 'agent_message', text: o.message ?? 'done' } },
      { type: 'turn.completed', usage: { input_tokens: 100, output_tokens: 50 } },
    );
  }
  return lines.map((l) => JSON.stringify(l)).join('\n') + '\n';
}

function rolloutOf(o: { model?: string; tokens?: number; reroute?: string; rerouteTokens?: number; usedPercent?: number } = {}): Record<string, unknown>[] {
  const recs: Record<string, unknown>[] = [
    { type: 'session_meta', payload: { id: THREAD, creator_user_id: 'user-x', creator_account_id: 'acct-x', base_instructions: { text: 'You are Codex.' }, cli_version: '0.162.1' } },
    { type: 'turn_context', payload: { model: o.model ?? MODEL, effort: 'medium', multi_agent_version: 'disabled' } },
    { type: 'world_state', payload: { full: true, state: { agents_md: {} } } },
    { type: 'response_item', payload: { type: 'custom_tool_call', call_id: 'c1', name: 'exec', input: 'await tools.exec_command({cmd:"ls"})' } },
    { type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'c1', output: [{ type: 'input_text', text: 'zsh:1: operation not permitted: ../x' }] } },
    { type: 'response_item', payload: { type: 'reasoning', encrypted_content: 'gAAAAsecret' } },
    { type: 'token_usage_record', payload: { usage: { output_tokens: o.tokens ?? 5000 } } },
  ];
  if (o.reroute !== undefined) {
    recs.push({ type: 'event_msg', payload: { type: 'model_reroute', from_model: o.model ?? MODEL, to_model: o.reroute } });
    recs.push({ type: 'token_usage_record', payload: { usage: { output_tokens: o.rerouteTokens ?? 9000 } } });
  }
  recs.push({
    type: 'event_msg',
    payload: { type: 'token_count', rate_limits: { primary: { used_percent: o.usedPercent ?? 10, window_minutes: 43200, resets_at: 1794248760 }, plan_type: 'free', rate_limit_reached_type: null } },
  });
  recs.push({ type: 'event_msg', payload: { type: 'task_complete', duration_ms: 1234 } });
  return recs;
}

function writeRollout(home: string, thread: string, recs: readonly Record<string, unknown>[]): void {
  const dir = path.join(home, 'sessions', '2026', '10', '10');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `rollout-2026-10-10T13-30-02-${thread}.jsonl`), recs.map((r) => JSON.stringify(r)).join('\n') + '\n');
}

// --- argument set ------------------------------------------------------------------------------------------------

describe('buildCodexArgs (ADR-029; SECURITY-11)', () => {
  it('emits exec --json with the locked context, the sandbox profile and the prompt on stdin', () => {
    const cwd = path.join(h.outRoot, 'x');
    const args = buildCodexArgs(codex, cwd, ['/deny/a']);
    expect(args.slice(0, 9)).toEqual(['exec', '--json', '--skip-git-repo-check', '--ignore-user-config', '--ignore-rules', '-m', MODEL, '-C', cwd]);
    expect(args[args.length - 1]).toBe('-');
    const c = args.filter((_, i) => args[i - 1] === '-c');
    expect(c).toEqual(
      expect.arrayContaining([
        `model_catalog_json=${JSON.stringify(CATALOG)}`,
        'model_reasoning_effort="medium"',
        'approval_policy="never"',
        'project_doc_max_bytes=0',
        'project_root_markers=[]',
        'skills.include_instructions=false',
        'skills.bundled.enabled=false',
        'include_apps_instructions=false',
        'web_search="disabled"',
        'check_for_update_on_startup=false',
        'default_permissions="daedalus_gen"',
      ]),
    );
    const disabled = args.filter((_, i) => args[i - 1] === '--disable');
    expect(disabled).toEqual([...CODEX_DISABLED_FEATURES]);
    for (const f of FORBIDDEN_CODEX_FLAGS) expect(args).not.toContain(f);
    expect(args).not.toContain('--ephemeral');
    expect(args).not.toContain('--sandbox');
    expect(args.join(' ')).not.toMatch(/danger-full-access|sandbox_mode/);
  });

  it('the no-shell variant (allowBash false) also disables the shell features', () => {
    const args = buildCodexArgs({ ...codex, allowBash: false }, path.join(h.outRoot, 'x'), []);
    const disabled = args.filter((_, i) => args[i - 1] === '--disable');
    expect(disabled).toEqual([...CODEX_DISABLED_FEATURES, ...CODEX_SHELL_FEATURES]);
  });

  it('the permission profile: workspace writes only, tmp read-only, skeleton read-only, network off, denies listed', () => {
    const toml = codexPermissionsToml(['/a b/c', '/d']);
    expect(toml).toBe(
      'permissions={daedalus_gen={extends=":workspace", filesystem={":tmpdir"="read", ":slash_tmp"="read", "/a b/c"="deny", "/d"="deny", ' +
        '":workspace_roots"={"node_modules"="read","package.json"="read"}}, network={enabled=false}}}',
    );
  });
});

describe('codexReadDenies', () => {
  it('denies every sibling from the anchor down to cwd, the credential homes, never cwd, its ancestors or the harness', () => {
    const anchor = h.tmp;
    for (const d of ['repo', 'corpus', 'out/claude-a/task-management', 'out/.staging/m/task-management/none/run-1', 'out/pilot']) fs.mkdirSync(path.join(anchor, d), { recursive: true });
    fs.writeFileSync(path.join(h.outRoot, 'schedule.json'), '{}');
    const cwd = path.join(h.outRoot, '.staging', 'm', 'task-management', 'none', 'run-0');
    fs.mkdirSync(cwd, { recursive: true });
    const denies = codexReadDenies(codex, cwd, anchor);
    for (const p of ['repo', 'corpus', 'out/claude-a', 'out/pilot', 'out/schedule.json', 'out/.staging/m/task-management/none/run-1']) expect(denies).toContain(path.join(anchor, p));
    expect(denies).toContain(codexHome);
    expect(denies).toContain(path.join(realHome, '.claude'));
    expect(denies).toContain(path.join(realHome, '.firewall'));
    for (const p of [cwd, h.outRoot, path.join(h.outRoot, '.staging'), h.harnessRoot]) expect(denies).not.toContain(p);
    expect(denies.some((p) => p === h.harnessRoot || p.startsWith(h.harnessRoot + path.sep))).toBe(false);
    expect([...denies]).toEqual([...denies].sort());
  });

  it('without an anchor above cwd the walk starts at the parent of outputRoot', () => {
    const cwd = path.join(h.outRoot, 'm', 'run-0');
    fs.mkdirSync(cwd, { recursive: true });
    fs.mkdirSync(path.join(h.tmp, 'sibling'));
    const denies = codexReadDenies(codex, cwd, '/nonexistent-anchor');
    expect(denies).toContain(path.join(h.tmp, 'sibling'));
  });
});

describe('buildCodexChildEnv, checkCodexHome, parseCodexVersion', () => {
  it('keeps the allow-list, replaces HOME, sets CODEX_HOME and drops API keys and *_TOKEN/*_KEY', () => {
    const env = buildCodexChildEnv(
      { HOME: '/real', PATH: '/bin', USER: 'u', OPENAI_API_KEY: 'sk-x', CODEX_API_KEY: 'k', GITHUB_TOKEN: 't', SECRET_STUFF: 's' },
      codex,
    );
    expect(env).toEqual({ HOME: userHome, PATH: '/bin', USER: 'u', CODEX_HOME: codexHome });
  });

  it('fails closed on config.toml, AGENTS.md, rules, plugins or a user skill; accepts the bundled .system skills', () => {
    fs.mkdirSync(path.join(codexHome, 'skills', '.system'), { recursive: true });
    fs.writeFileSync(path.join(codexHome, 'auth.json'), '{}');
    expect(checkCodexHome(codexHome).success).toBe(true);
    for (const bad of ['config.toml', 'AGENTS.md']) {
      fs.writeFileSync(path.join(codexHome, bad), '');
      const r = checkCodexHome(codexHome);
      expect(r.success ? [] : r.errors.map((e) => e.code)).toEqual(['GEN_CODEX_HOME_FORBIDDEN']);
      fs.rmSync(path.join(codexHome, bad));
    }
    fs.mkdirSync(path.join(codexHome, 'skills', 'mine'));
    expect(checkCodexHome(codexHome).success).toBe(false);
    expect(checkCodexHome(path.join(h.tmp, 'missing')).success).toBe(false);
  });

  it('reads the CLI version', () => {
    expect(parseCodexVersion('codex-cli 0.162.1\n')).toBe('0.162.1');
    expect(parseCodexVersion('claude 2.1.294')).toBeNull();
  });

  it('createCodexCliConfig refuses homes inside the repository and unknown efforts', () => {
    const bad = createCodexCliConfig({ base: h.config, codexHome: path.join(REPO, 'x'), userHome, realHome, reasoningEffort: 'turbo', cliVersion: '0.162', modelCatalog: CATALOG }, REPO);
    expect(bad.success ? [] : bad.errors.map((e) => e.code).sort()).toEqual(['GEN_CODEX_CONFIG_INVALID', 'GEN_CODEX_CONFIG_INVALID']);
    const inside = createCodexCliConfig({ base: h.config, codexHome: path.join(REPO, 'x'), userHome, realHome, reasoningEffort: 'medium', cliVersion: '0.162.1', modelCatalog: CATALOG }, REPO);
    expect(inside.success ? [] : inside.errors.map((e) => e.code)).toEqual(['GEN_CODEX_HOME_INSIDE_REPO']);
  });
});

// --- events and rollout ------------------------------------------------------------------------------------------

describe('parseCodexRun and the model-usage rule', () => {
  it('a completed run with its rollout: success, steps, denials, duration and modelUsage from turn_context', () => {
    const r = parseCodexRun(stdoutOf(), rolloutOf({ tokens: 700 }), []);
    if (!r.success) throw new Error('unreadable');
    expect(r.data.summary).toMatchObject({ isError: false, subtype: 'success', numTurns: 2, durationMs: 1234, sessionId: THREAD, modelUsage: { [MODEL]: { outputTokens: 700 } } });
    expect(r.data.summary.permissionDenials).toHaveLength(1);
    expect(judgeModelUsage(MODEL, r.data.summary)).toMatchObject({ valid: true, resolvedModelId: MODEL });
    expect(r.data.scrubbed.format).toBe('codex-exec-jsonl+rollout');
    expect(r.data.scrubbed.result).toBe('done');
  });

  it('a reroute moves later tokens to the served model, so the pinned model can fail strict dominance', () => {
    const recs = rolloutOf({ tokens: 100, reroute: 'other-model', rerouteTokens: 900 });
    expect(rolloutModelUsage(recs)).toEqual({ [MODEL]: { outputTokens: 100 }, 'other-model': { outputTokens: 900 } });
    const r = parseCodexRun(stdoutOf(), recs, []);
    if (!r.success) throw new Error('unreadable');
    expect(judgeModelUsage(MODEL, r.data.summary)).toMatchObject({ valid: false, reason: 'pinned-not-dominant' });
    expect(r.data.scrubbed.reroutes).toEqual([{ from: MODEL, to: 'other-model' }]);
  });

  it('without a rollout there is no modelUsage: the rule fails closed (no-model-usage)', () => {
    const r = parseCodexRun(stdoutOf(), null, []);
    if (!r.success) throw new Error('unreadable');
    expect(r.data.summary.modelUsage).toBeUndefined();
    expect(judgeModelUsage(MODEL, r.data.summary)).toMatchObject({ valid: false, reason: 'no-model-usage' });
  });

  it('the recorded Gate calls: an unsupported model is an error run; the canary run completed', () => {
    const unsupported = parseCodexRun(fs.readFileSync(path.join(FIXTURES, 'call01-model-unavailable.stdout.jsonl'), 'utf8'), null, []);
    if (!unsupported.success) throw new Error('unreadable');
    expect(unsupported.data.summary).toMatchObject({ isError: true, subtype: 'turn-failed' });
    expect(String(unsupported.data.scrubbed.result)).toContain('not supported when using Codex with a ChatGPT account');
    const canary = parseCodexRun(fs.readFileSync(path.join(FIXTURES, 'call02-canary-ephemeral.stdout.jsonl'), 'utf8'), null, []);
    if (!canary.success) throw new Error('unreadable');
    expect(canary.data.summary.isError).toBe(false);
    expect(String(canary.data.scrubbed.result)).toContain('no AGENTS.md');
    expect(String(canary.data.scrubbed.result)).not.toContain('PINEAPPLE');
  });

  it('stdout without a JSON event is unreadable', () => {
    const r = parseCodexRun('Reading additional input from stdin...\n', null, []);
    expect(r.success ? '' : r.errors[0]?.code).toBe('GEN_ENVELOPE_UNREADABLE');
  });

  it('sanitiseRollout drops account ids, hashes the base instructions and drops encrypted reasoning', () => {
    const s = sanitiseRollout(rolloutOf());
    const meta = s[0]?.payload as Record<string, unknown>;
    expect(meta.creator_user_id).toBeUndefined();
    expect(meta.creator_account_id).toBeUndefined();
    expect(meta.base_instructions).toEqual({ sha256: crypto.createHash('sha256').update('You are Codex.').digest('hex'), chars: 14 });
    expect(JSON.stringify(s)).not.toContain('gAAAAsecret');
  });

  it('takeRollout reads and removes the thread rollout from CODEX_HOME', () => {
    writeRollout(codexHome, THREAD, rolloutOf());
    const recs = takeRollout(codexHome, THREAD);
    expect(recs).toHaveLength(rolloutOf().length);
    expect(fs.readdirSync(path.join(codexHome, 'sessions', '2026', '10', '10'))).toEqual([]);
    expect(takeRollout(codexHome, THREAD)).toBeNull();
    expect(takeRollout(codexHome, '../../etc')).toBeNull();
  });
});

describe('usage limits (BR-U5a-50 for the Codex arm)', () => {
  const cli = (exitCode: number, stdout: string, stderr = ''): Parameters<typeof codexUsageLimit>[0] => ({ exitCode, stdout, stderr, timedOut: false, durationMs: 1 });

  it('an erroring call naming the usage limit pauses until the reported reset', () => {
    const out = stdoutOf({ error: "You've hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase more credits" });
    const env = parseCodexRun(out, rolloutOf({ usedPercent: 100 }), []);
    const e = env.success ? env.data : null;
    expect(codexUsageLimit(cli(1, out), e)).toEqual({ subtype: 'usage-limit', resetAt: 1794248760 * 1000 });
    expect(codexAttemptDisposition(cli(1, out), e, 0)).toMatchObject({ kind: 'usage-limit' });
  });

  it('a 429 without a reset is a rate limit with the default pause; a successful run mentioning limits is not', () => {
    const out = stdoutOf({ error: 'unexpected status 429 Too Many Requests' });
    const env = parseCodexRun(out, null, []);
    expect(codexUsageLimit(cli(1, out), env.success ? env.data : null)).toEqual({ subtype: 'rate-limit' });
    const ok = stdoutOf({ message: 'Added a rate limit middleware; usage limit config done.' });
    const okEnv = parseCodexRun(ok, rolloutOf(), []);
    expect(codexUsageLimit(cli(0, ok), okEnv.success ? okEnv.data : null)).toBeNull();
  });

  it('rateLimitResetAt reads only a binding window', () => {
    expect(rateLimitResetAt({ primary: { used_percent: 40, resets_at: 10 }, rate_limit_reached_type: null })).toBeUndefined();
    expect(rateLimitResetAt({ primary: { used_percent: 100, resets_at: 10 } })).toBe(10_000);
  });
});

// --- adapter -----------------------------------------------------------------------------------------------------

describe('CodexCliAdapter over a fake CLI', () => {
  function adapter(runner: FakeGeneratorRunner, sleeps: number[] = []): CodexCliAdapter {
    return new CodexCliAdapter({
      runner,
      config: codex,
      repoRoot: REPO,
      install: () => h.install,
      prompts,
      parentEnv: { PATH: '/usr/bin:/bin', HOME: '/real', OPENAI_API_KEY: 'sk-should-not-pass' },
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
      clock: { now: () => 1_000_000 },
      tmpRoot: h.tmp,
    });
  }

  it('one call: prompt on stdin, confined argv, rollout taken out of CODEX_HOME, codex-cli outcome, model-valid', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [
      { files: sourceFiles(22), stdout: stdoutOf(), effect: () => { writeRollout(codexHome, THREAD, rolloutOf()); } },
    ]);
    const req = request(h);
    const r = await adapter(runner).generate(req);
    if (!r.success) throw new Error(r.errors.map((e) => e.message).join(';'));
    expect(r.data).toMatchObject({ status: 'ok', adapterId: CODEX_CLI_ADAPTER_ID, requestedModelId: MODEL, resolvedModelId: MODEL, fileCount: 22, fileCountInRange: true, permissionDenials: 1 });
    const call = runner.cliCalls[0];
    expect(call?.options.stdin).toBe(`Build task-management. Type-check with: ${typecheckCommand(h.harnessRoot, req.runId)}`);
    expect(call?.options.cwd).toBe(req.outputDir);
    expect(call?.options.env).toEqual({ PATH: '/usr/bin:/bin', HOME: userHome, CODEX_HOME: codexHome });
    expect(call?.args.slice(0, 2)).toEqual(['exec', '--json']);
    expect(fs.readdirSync(path.join(codexHome, 'sessions', '2026', '10', '10'))).toEqual([]);
    const env = JSON.parse(fs.readFileSync(path.join(req.outputDir, 'envelope.json'), 'utf8')) as Record<string, unknown>;
    expect(env.format).toBe('codex-exec-jsonl+rollout');
    expect(JSON.stringify(env)).not.toContain('acct-x');
  });

  it('a usage limit consumes no attempt: the cell moves to interruptions/ and the same cell resumes', async () => {
    const limit = "You've hit your usage limit. Upgrade to Plus to continue using Codex";
    const runner = new FakeGeneratorRunner(h.binary, [
      { stdout: stdoutOf({ error: limit }), exitCode: 1 },
      { files: sourceFiles(21), stdout: stdoutOf(), effect: () => { writeRollout(codexHome, THREAD, rolloutOf()); } },
    ]);
    const sleeps: number[] = [];
    const r = await adapter(runner, sleeps).generate(request(h));
    if (!r.success) throw new Error('failed');
    expect(r.data.status).toBe('ok');
    expect(r.data.attempts).toHaveLength(1);
    expect(r.data.interruptions).toHaveLength(1);
    expect(r.data.interruptions[0]?.subtype).toBe('usage-limit');
    expect(sleeps).toEqual([30 * 60 * 1000]);
  });

  it('a rerouted run is failed-agent, model-mismatch; an unsupported-model error is agent-error', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [
      { files: sourceFiles(21), stdout: stdoutOf(), effect: () => { writeRollout(codexHome, THREAD, rolloutOf({ tokens: 10, reroute: 'cheaper-model', rerouteTokens: 90 })); } },
    ]);
    const r = await adapter(runner).generate(request(h));
    expect(r.success ? [r.data.status, r.data.failureReason] : []).toEqual(['failed-agent', 'model-mismatch']);
    const h2 = request(h, { runIndex: 1 });
    const runner2 = new FakeGeneratorRunner(h.binary, [
      { files: sourceFiles(1), stdout: stdoutOf({ error: "The 'x' model is not supported when using Codex with a ChatGPT account." }), exitCode: 1, effect: () => { writeRollout(codexHome, THREAD, rolloutOf()); } },
    ]);
    const r2 = await adapter(runner2).generate(h2);
    expect(r2.success ? [r2.data.status, r2.data.failureReason] : []).toEqual(['failed-agent', 'agent-error']);
  });

  it('a forbidden entry in CODEX_HOME stops the cell before any call (fail closed)', async () => {
    fs.writeFileSync(path.join(codexHome, 'AGENTS.md'), 'instructions');
    const runner = new FakeGeneratorRunner(h.binary, []);
    const r = await adapter(runner).generate(request(h));
    expect(r.success ? '' : r.errors[0]?.code).toBe('GEN_CODEX_HOME_FORBIDDEN');
    expect(runner.cliCalls).toHaveLength(0);
  });

  it('isAvailable requires the pinned version', async () => {
    const runner = new FakeGeneratorRunner(h.binary, [{ stdout: 'codex-cli 0.162.1\n' }, { stdout: 'codex-cli 0.163.0\n' }]);
    const a = adapter(runner);
    expect(await a.isAvailable()).toBe(true);
    expect(await a.isAvailable()).toBe(false);
  });
});

// --- registered Codex plan ---------------------------------------------------------------------------------------

describe('the registered Codex-arm plan (ADR-029)', () => {
  const local = { binary: '/x/codex', harnessRoot: '/tmp/h-codex' };

  it('loads, pins the catalog by sha256, and writes its own schedule file', () => {
    const p = loadGeneratorPlanFile(path.join(REPO, E1_CODEX_GENERATOR_PLAN), REPO, local);
    if (!p.success) throw new Error(p.errors.map((e) => e.message).join(';'));
    expect(p.data.adapters.map((a) => a.adapterId)).toEqual([CODEX_CLI_ADAPTER_ID]);
    expect(p.data.orderSeed).not.toBe(20261008);
    expect(scheduleFileName(p.data)).toBe(CODEX_SCHEDULE_JSON);
    const claude = loadGeneratorPlanFile(path.join(REPO, E1_GENERATOR_PLAN), REPO, local);
    expect(claude.success && scheduleFileName(claude.data)).toBe(SCHEDULE_JSON);
    const catalog = fs.readFileSync(CATALOG);
    expect(crypto.createHash('sha256').update(catalog).digest('hex')).toBe(p.data.codex?.modelCatalogSha256);
    const models = (JSON.parse(catalog.toString('utf8')) as { models: Record<string, unknown>[] }).models;
    expect(models.map((m) => m.slug)).toEqual(p.data.adapters.map((a) => a.modelId));
    expect(models.every((m) => !('multi_agent_version' in m))).toBe(true);
    const cfg = codexConfigFromPlan(p.data, p.data.adapters[0]?.modelId ?? '', REPO, { codexHome, userHome, realHome });
    expect(cfg.success).toBe(true);
    const block = p.data.codex;
    if (block === undefined) throw new Error('no codex block');
    const tampered = codexConfigFromPlan({ ...p.data, codex: { ...block, modelCatalogSha256: '0'.repeat(64) } }, 'm', REPO, { codexHome, userHome, realHome });
    expect(tampered.success ? '' : tampered.errors[0]?.code).toBe('GEN_CODEX_CATALOG_CHANGED');
  });

  it('a codex adapter needs a valid codex block; a Claude plan may not carry one', () => {
    expect(codexBlockProblems(undefined, true)).toEqual(['a codex-cli adapter needs a codex block']);
    expect(codexBlockProblems({ cliVersion: '0.162.1' }, false)).toEqual(['codex block given but no codex-cli adapter is listed']);
    expect(codexBlockProblems({ cliVersion: 'x', reasoningEffort: '', modelCatalog: '/abs', modelCatalogSha256: 'z', extra: 1 }, true)).toHaveLength(5);
  });

  it('the Claude schedule is unchanged by the Codex arm: each arm schedules its own cells from its own seed', () => {
    const claude = readRegisteredPlan(path.join(REPO, E1_GENERATOR_PLAN), REPO);
    const codexArm = readRegisteredPlan(path.join(REPO, E1_CODEX_GENERATOR_PLAN), REPO);
    if (!claude.ok || !codexArm.ok) throw new Error('unreadable');
    const cells = scheduleGrid(codexArm.plan);
    expect(cells).toHaveLength(18);
    expect(new Set(cells.map((c) => c.modelId))).toEqual(new Set(codexArm.plan.adapters.map((a) => a.modelId)));
    expect(scheduleGrid(claude.plan)).toHaveLength(54);
    expect(claude.plan.orderSeed).toBe(20261008);
  });

  it('protocolMismatches sees a codex-block change; the guard accepts each registered arm file only', () => {
    const codexArm = readRegisteredPlan(path.join(REPO, E1_CODEX_GENERATOR_PLAN), REPO);
    if (!codexArm.ok) throw new Error('unreadable');
    expect(protocolMismatches(codexArm.plan, codexArm.plan)).toEqual([]);
    expect(protocolMismatches({ ...codexArm.plan, codex: { reasoningEffort: 'high' } }, codexArm.plan)).toEqual(['codex']);
    const sha = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    const file = path.join(REPO, E1_CODEX_GENERATOR_PLAN);
    const ok = guardE1Plan(file, codexArm.plan, REPO, (rel) => (rel === E1_CODEX_GENERATOR_PLAN ? sha(file) : undefined), sha);
    expect(ok).toEqual({ ok: true, e1: true });
    const changed = guardE1Plan(file, codexArm.plan, REPO, () => 'a'.repeat(64), sha);
    expect(changed.ok ? '' : changed.detail).toContain(`${E1_CODEX_GENERATOR_PLAN} changed since its registration`);
  });

  it('the E1 plan carries both arms: arm plans beside it, model sets disjoint and covering e1.models', () => {
    expect(armPlanPathsFor('experiments/e1-grid/plan.json', REPO)).toEqual([E1_GENERATOR_PLAN, E1_CODEX_GENERATOR_PLAN]);
    const arms = [E1_GENERATOR_PLAN, E1_CODEX_GENERATOR_PLAN].map((p) => readRegisteredPlan(path.join(REPO, p), REPO));
    const plans = arms.map((a) => {
      if (!a.ok) throw new Error('unreadable');
      return a.plan;
    });
    const e1 = (JSON.parse(fs.readFileSync(path.join(REPO, 'experiments/e1-grid/plan.json'), 'utf8')) as { e1: Parameters<typeof e1ArmsMismatches>[1] }).e1;
    expect(e1ArmsMismatches(plans, e1, REPO)).toEqual([]);
    expect(e1ArmsMismatches(plans.slice(0, 1), e1, REPO)).toEqual(['models']);
    expect(e1ArmsMismatches([], e1, REPO)).toEqual(['no arm plan']);
  });
});
