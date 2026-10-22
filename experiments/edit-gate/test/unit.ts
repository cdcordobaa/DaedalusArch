/**
 * Edit-gate unit tests (zero model calls). Run as root from the repository root:
 *   npx tsx experiments/edit-gate/test/unit.ts [--out results/v1.5-edit-gate-build/unit.json]
 *
 * 1. Hook input and output format (the Claude Code hooks JSON).
 * 2. De-duplication: GateState alone, then the hub with the real checker on the dummy project.
 * 3. Refusal of any path outside the work tree (and of everything that is not a gated edit), with no check run.
 * 4. The arm's argv: exactly the `--settings` value differs from the frozen argv.
 * 5. Latency: hub per edit on the dummy project and on the P1 and P2 seeds with their trap then clean solution
 *    replayed file by file (root side only; the puzzle trees never reach a generator here), and the relay round trip.
 * No reply ever contains the spec path or spec text.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ConsistencyFinding } from '../../detect-02/mcp/consistency.js';
import { checkConsistency } from '../../detect-02/mcp/consistency.js';
import { buildGeneratorArgs } from '../../../scripts/lib/generators/argv.js';
import { GateState, MAX_FINDINGS_PER_MESSAGE, MAX_LINES_PER_FINDING, TRANSIENT_NOTE, editMessage, formatFinding, insideTree, keyOf, parseHookEvent, postToolUseReply, stopMessage, stopReply } from '../gate.js';
import { GateHub } from '../hub.js';
import { editGateArgs, gateSettings } from '../settings.js';

const REPO = process.cwd();
const HERE = path.join(REPO, 'experiments', 'edit-gate');
const DUMMY = path.join(HERE, 'fixtures', 'dummy');
const VIOLATING = path.join(DUMMY, 'edits', 'SettleInvoices.violating.ts');
const TARGET = 'src/billing/application/SettleInvoices.ts';
const PUZZLES = path.join(REPO, 'experiments', 'puzzle-01', 'puzzles');

const results: { name: string; ok: boolean; detail?: unknown }[] = [];
async function test(name: string, fn: () => unknown): Promise<void> {
  try {
    const detail = await fn();
    results.push({ name, ok: true, ...(detail !== undefined ? { detail } : {}) });
  } catch (e) {
    results.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-gate-unit-'));
let n = 0;
function cell(seed: string): string {
  const dir = path.join(tmp, `w${String(++n)}`);
  fs.cpSync(seed, dir, { recursive: true });
  return dir;
}
const post = (file: string, tool = 'Write', extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ session_id: 's', transcript_path: '/srv/gh/.claude/projects/x.jsonl', cwd: '/srv/w/c01/work', permission_mode: 'acceptEdits', hook_event_name: 'PostToolUse', tool_name: tool, tool_input: { file_path: file, content: 'x' }, tool_response: { success: true }, tool_use_id: 'toolu_1', ...extra });
const stopEv = (active = false): string => JSON.stringify({ session_id: 's', transcript_path: '/srv/gh/x.jsonl', cwd: '/srv/w/c01/work', hook_event_name: 'Stop', stop_hook_active: active });
const fakeFinding = (o: Partial<ConsistencyFinding> = {}): ConsistencyFinding => ({ file: 'src/a/app/Cmd.ts', line: 10, rule: 'R-D4', ruleText: 'One command saves one aggregate.', why: 'Cmd.execute (src/a/app/Cmd.ts:10) saves more than one aggregate instance in the same call: Account: from, to.', fix: 'Record an event.', writes: ['src/a/app/Cmd.ts:12 AccountRepository.save(…) via Cmd.execute → AccountRepository.save'], ...o });
const pct = (xs: readonly number[], p: number): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? NaN; };
const stats = (xs: readonly number[]): Record<string, number> => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: Math.max(...xs) });

async function main(): Promise<void> {
  const spec = path.join(DUMMY, 'spec.yaml');
  const specText = fs.readFileSync(spec, 'utf8');
  const specHeader = specText.split('\n')[0] as string;
  const noLeak = (reply: string): void => {
    assert.ok(!reply.includes(spec) && !reply.includes(specHeader) && !reply.includes('spec.yaml'), 'reply leaks the spec');
  };

  // 1. Format
  await test('hook input: PostToolUse fields read, transcript_path and contents dropped', () => {
    const e = parseHookEvent(post('/srv/w/c01/work/src/x.ts', 'Edit'));
    assert.deepEqual(e, { event: 'PostToolUse', tool: 'Edit', filePath: '/srv/w/c01/work/src/x.ts', cwd: '/srv/w/c01/work', stopHookActive: false });
    assert.equal(parseHookEvent(stopEv(true))?.stopHookActive, true);
    assert.equal(parseHookEvent('not json'), null);
    assert.equal(parseHookEvent(JSON.stringify({ hook_event_name: 'PreToolUse' }))?.event, 'other');
  });
  await test('hook output: PostToolUse additionalContext, Stop decision block, nothing when empty', () => {
    assert.deepEqual(JSON.parse(postToolUseReply('t')), { hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 't' } });
    assert.deepEqual(JSON.parse(stopReply('r')), { decision: 'block', reason: 'r' });
    assert.equal(postToolUseReply(''), '');
    assert.equal(stopReply(''), '');
  });
  await test('message: at most 12 lines per finding, 3 findings, "and N more", transient note', () => {
    const many = Array.from({ length: 20 }, (_, i) => `src/a/x.ts:${String(i)} Repo.save(…) via A → B`);
    const f = fakeFinding({ writes: many });
    assert.ok(formatFinding(f).length <= MAX_LINES_PER_FINDING);
    assert.match(formatFinding(f).join('\n'), /and \d+ more/);
    const fs5 = Array.from({ length: 5 }, (_, i) => keyOf(fakeFinding({ file: `src/a/C${String(i)}.ts`, why: `C${String(i)}.run (src/a/C${String(i)}.ts:1) saves: Account: a, b.` }), ['Account']));
    const s = new GateState();
    const text = editMessage(s.update(fs5));
    assert.equal((text.match(/^Architecture check:/gm) ?? []).length, MAX_FINDINGS_PER_MESSAGE);
    assert.match(text, /… and 2 more/);
    assert.ok(text.endsWith(TRANSIENT_NOTE));
    assert.match(stopMessage(fs5), /^Architecture check: 5 findings still open/);
    return { sample: formatFinding(fakeFinding()) };
  });

  // 2. De-duplication
  await test('de-dup: new shown once, line shift is the same key, resolved once, reappearing is new', () => {
    const s = new GateState();
    const a = keyOf(fakeFinding(), ['Account', 'Transfer']);
    assert.equal(a.key, 'R-D4|src/a/app/Cmd.ts|Cmd.execute|Account');
    assert.equal(s.update([a]).fresh.length, 1);
    assert.equal(editMessage(s.update([a])), '');
    const shifted = keyOf(fakeFinding({ line: 14, why: 'Cmd.execute (src/a/app/Cmd.ts:14) saves more than one aggregate instance in the same call: Account: from, to.' }), ['Account']);
    assert.equal(shifted.key, a.key);
    assert.equal(editMessage(s.update([shifted])), '');
    const d = s.update([]);
    assert.equal(d.resolved.length, 1);
    assert.match(editMessage(d), /^resolved: src\/a\/app\/Cmd.ts:14 \[one aggregate per command\]$/);
    assert.equal(editMessage(s.update([])), '');
    assert.equal(s.update([a]).fresh.length, 1);
    assert.equal(s.claimStop('step-01'), true);
    assert.equal(s.claimStop('step-01'), false);
    assert.equal(s.claimStop('step-02'), true);
  });

  const hubDir = path.join(tmp, 'hub');
  let checks = 0;
  const counted: typeof checkConsistency = async (o) => { checks++; return checkConsistency(o); };
  const hub = new GateHub(path.join(hubDir, 'g.sock'), path.join(hubDir, 'log'), counted);
  await hub.start();

  await test('hub de-dup with the real checker on the dummy project (edit → finding, repeat → nothing, fix → resolved, Stop once per turn)', async () => {
    const w = cell(path.join(DUMMY, 'seed'));
    await hub.setCell({ id: 'u1', turn: 'step-01', spec, project: w });
    const target = path.join(w, TARGET);
    const original = fs.readFileSync(target, 'utf8');
    // An unrelated edit on a clean tree: nothing.
    fs.appendFileSync(path.join(w, 'src/shared-kernel/Money.ts'), '\n// note\n');
    assert.equal(await hub.handle(post(path.join(w, 'src/shared-kernel/Money.ts'), 'Edit')), '');
    fs.copyFileSync(VIOLATING, target);
    const r1 = await hub.handle(post(target));
    noLeak(r1);
    const ctx = (JSON.parse(r1) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    assert.match(ctx, /^Architecture check: src\/billing\/application\/SettleInvoices.ts:9 \[one aggregate per command; cross-context write\]/);
    assert.equal(await hub.handle(post(target, 'Edit')), '', 'same finding repeated');
    fs.writeFileSync(target, `// moved\n${fs.readFileSync(target, 'utf8')}`);
    assert.equal(await hub.handle(post(target, 'Edit')), '', 'line shift repeated');
    const st = await hub.handle(stopEv());
    noLeak(st);
    assert.equal((JSON.parse(st) as { decision: string }).decision, 'block');
    assert.equal(await hub.handle(stopEv()), '', 'second Stop in the same turn');
    hub.setTurn('step-02');
    assert.equal(await hub.handle(stopEv(true)), '', 'stop_hook_active');
    fs.writeFileSync(target, original);
    const r2 = await hub.handle(post(target, 'Edit'));
    assert.match((JSON.parse(r2) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext, /^resolved: src\/billing\/application\/SettleInvoices.ts:10 \[one aggregate per command; cross-context write\]$/);
    assert.equal(await hub.handle(stopEv()), '', 'clean tree at Stop');
    const log = fs.readFileSync(hub.logFile('u1'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);
    assert.ok(log.every((l) => !('transcript_path' in l)));
    return { reply: ctx.split('\n'), events: log.map((l) => ({ event: l.event, new: (l.newKeys as unknown[]).length, resolved: (l.resolvedKeys as unknown[]).length, replied: l.replied, stopBlock: l.stopBlock, ms: l.ms })) };
  });

  // 3. Refusal
  await test('refusal: outside path, traversal, symlink out of the tree, node_modules, other tools, other events, a tree holding an escaping symlink, no cell', async () => {
    const w = cell(path.join(DUMMY, 'seed'));
    await hub.setCell({ id: 'u2', turn: 'step-01', spec, project: w });
    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside, { recursive: true });
    fs.writeFileSync(path.join(outside, 'x.ts'), 'export {}\n');
    fs.symlinkSync(outside, path.join(w, 'src', 'link'));
    fs.mkdirSync(path.join(w, 'node_modules', 'p'), { recursive: true });
    assert.equal(insideTree(w, path.join(w, 'src/main.ts')), 'src/main.ts');
    assert.equal(insideTree(w, path.join(w, 'src/new/dir/NotYet.ts')), 'src/new/dir/NotYet.ts');
    const before = checks;
    const cases: [string, string][] = [
      ['/etc/passwd', post('/etc/passwd')],
      ['spec path', post(spec)],
      ['traversal', post(path.join(w, 'src', '..', '..', 'outside', 'x.ts'))],
      ['symlink', post(path.join(w, 'src', 'link', 'x.ts'))],
      ['tree root', post(w)],
      ['node_modules', post(path.join(w, 'node_modules', 'p', 'i.js'))],
      ['relative traversal', post('../../outside/x.ts')],
      ['Bash', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'cat /srv/o/specs/t1.yaml' } })],
      ['Read', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: spec } })],
      ['no file_path', JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: {} })],
      ['PreToolUse', JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: path.join(w, 'src/main.ts') } })],
      ['garbage', '{"hook_event_name":'],
    ];
    const replies = await Promise.all(cases.map(async ([k, raw]) => [k, await hub.handle(raw)] as const));
    for (const [k, r] of replies) assert.equal(r, '', `${k} got a reply`);
    assert.equal(checks, before, 'a refused event ran the check');
    const log = fs.readFileSync(hub.logFile('u2'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { refused: string | null });
    assert.equal(log.length, cases.length);
    assert.ok(log.every((l) => l.refused !== null));
    // A symlink out of the tree anywhere: the tree is not checked at all, even for an edit inside it.
    fs.copyFileSync(VIOLATING, path.join(w, TARGET));
    const before2 = checks;
    assert.equal(await hub.handle(post(path.join(w, TARGET))), '', 'tree with an escaping symlink was checked');
    assert.equal(checks, before2);
    assert.match(String((JSON.parse(fs.readFileSync(hub.logFile('u2'), 'utf8').trim().split('\n').pop() as string) as { refused: string }).refused), /^symlink out of the work tree: src\/link$/);
    fs.rmSync(path.join(w, 'src', 'link'));
    assert.match(await hub.handle(post(path.join(w, TARGET))), /additionalContext/);
    hub.clear();
    assert.equal(await hub.handle(post(path.join(w, 'src/main.ts'))), '', 'no current cell');
    return { refused: log.map((l, i) => `${cases[i]?.[0] ?? '?'}: ${String(l.refused)}`) };
  });

  await test('fail open: a checker error gives no reply and is logged', async () => {
    const bad = new GateHub(path.join(hubDir, 'b.sock'), path.join(hubDir, 'log'), () => Promise.reject(new Error('boom')));
    const w = cell(path.join(DUMMY, 'seed'));
    await bad.setCell({ id: 'u3', turn: 'step-01', spec, project: w });
    fs.copyFileSync(VIOLATING, path.join(w, TARGET));
    assert.equal(await bad.handle(post(path.join(w, TARGET))), '');
    const l = JSON.parse(fs.readFileSync(bad.logFile('u3'), 'utf8').trim()) as { failOpen: boolean; error: string };
    assert.equal(l.failOpen, true);
    assert.equal(l.error, 'boom');
  });

  // 4. argv
  await test('argv: only the --settings value differs from the frozen argv; hooks on; setting sources stay empty', () => {
    const cfg = { binary: '/srv/bin/gclaude', modelId: 'claude-sonnet-5-5', timeoutMs: 1_200_000, outputRoot: '/srv/w', harnessRoot: '/srv/h', allowBash: true };
    const relay = { nodeBinary: '/opt/node22/bin/node', relay: '/srv/h/bin/gate-relay.cjs', socket: '/srv/m/g.sock' };
    const frozen = buildGeneratorArgs(cfg, { runId: 'c/c01' }, 'P');
    const arm = editGateArgs(cfg, 'c/c01', 'P', relay);
    assert.equal(arm.length, frozen.length);
    const diff = arm.map((a, i) => (a === frozen[i] ? -1 : i)).filter((i) => i >= 0);
    assert.deepEqual(diff, [frozen.indexOf('--settings') + 1]);
    assert.equal(arm[arm.indexOf('--setting-sources') + 1], '');
    const s = JSON.parse(arm[diff[0] as number] as string) as ReturnType<typeof gateSettings> & { hooks: { PostToolUse: { matcher: string; hooks: { command: string }[] }[] } };
    assert.equal(s.disableAllHooks, false);
    assert.equal(s.hooks.PostToolUse[0]?.matcher, 'Edit|Write|MultiEdit');
    assert.equal(s.hooks.PostToolUse[0]?.hooks[0]?.command, '/opt/node22/bin/node /srv/h/bin/gate-relay.cjs /srv/m/g.sock');
    return { settings: s };
  });

  // 5. Latency
  const latency: Record<string, unknown> = {};
  await test('latency: dummy project, 20 edits alternating violating and clean (every edit differs from the seed, so every edit runs the check)', async () => {
    const w = cell(path.join(DUMMY, 'seed'));
    await hub.setCell({ id: 'lat-dummy', turn: 'step-01', spec, project: w });
    const original = fs.readFileSync(path.join(w, TARGET), 'utf8');
    const ms: number[] = [];
    for (let i = 0; i < 20; i++) {
      fs.writeFileSync(path.join(w, TARGET), i % 2 === 0 ? fs.readFileSync(VIOLATING, 'utf8') : `${original}\n// clean edit ${String(i)}\n`);
      const t = performance.now();
      await hub.handle(post(path.join(w, TARGET)));
      ms.push(Math.round(performance.now() - t));
    }
    latency.dummy = stats(ms);
    return latency.dummy;
  });
  for (const p of ['p1-transfers', 'p2-loyalty']) {
    await test(`latency and replay: ${p} seed, trap solution then clean solution, file by file (root side)`, async () => {
      const dir = path.join(PUZZLES, p);
      const w = cell(path.join(dir, 'seed'));
      await hub.setCell({ id: `lat-${p}`, turn: 'step-01', spec: path.join(dir, 'spec.yaml'), project: w });
      const ms: number[] = [];
      const seen: { phase: string; file: string; new: number; resolved: number }[] = [];
      for (const phase of ['trap', 'clean']) {
        const sol = path.join(dir, 'solutions', phase);
        const files = (fs.readdirSync(sol, { recursive: true }) as string[]).filter((f) => fs.statSync(path.join(sol, f)).isFile()).sort();
        for (const f of files) {
          fs.mkdirSync(path.dirname(path.join(w, f)), { recursive: true });
          fs.copyFileSync(path.join(sol, f), path.join(w, f));
          const t = performance.now();
          const r = await hub.handle(post(path.join(w, f)));
          ms.push(Math.round(performance.now() - t));
          noLeak(r);
          const ctx = r === '' ? '' : (JSON.parse(r) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
          seen.push({ phase, file: f, new: (ctx.match(/^Architecture check:/gm) ?? []).length, resolved: (ctx.match(/^resolved:/gm) ?? []).length });
        }
        if (phase === 'trap') {
          // The clean solution's files replace the trap's; a trap-only file is removed first, as an agent would.
          for (const f of files) if (!fs.existsSync(path.join(dir, 'solutions', 'clean', f))) fs.rmSync(path.join(w, f));
        }
      }
      latency[p] = stats(ms);
      const totalNew = seen.filter((s) => s.phase === 'trap').reduce((a, s) => a + s.new, 0);
      const totalResolved = seen.filter((s) => s.phase === 'clean').reduce((a, s) => a + s.resolved, 0);
      assert.ok(totalNew >= 1, 'the trap replay shows no finding');
      assert.equal(totalResolved, totalNew, 'the clean replay does not resolve every finding');
      return { latency: latency[p], replay: seen };
    });
  }
  await test('latency: relay round trip (relay process + socket + hub), 20 edits on the dummy project', async () => {
    const w = cell(path.join(DUMMY, 'seed'));
    await hub.setCell({ id: 'lat-relay', turn: 'step-01', spec, project: w });
    const original = fs.readFileSync(path.join(w, TARGET), 'utf8');
    const ms: number[] = [];
    let lastReply = '';
    for (let i = 0; i < 20; i++) {
      fs.writeFileSync(path.join(w, TARGET), i % 2 === 0 ? fs.readFileSync(VIOLATING, 'utf8') : `${original}\n// clean edit ${String(i)}\n`);
      const t = performance.now();
      lastReply = await relay(path.join(hubDir, 'g.sock'), post(path.join(w, TARGET)));
      ms.push(Math.round(performance.now() - t));
    }
    assert.match(lastReply, /resolved:/);
    latency.relay = stats(ms);
    return latency.relay;
  });
  await hub.stop();
  fs.rmSync(tmp, { recursive: true, force: true });

  const out = { schema: 'edit-gate-unit/v1', at: new Date().toISOString(), calls: 0, node: process.version, passed: results.every((r) => r.ok), latency, results };
  const i = process.argv.indexOf('--out');
  if (i >= 0) {
    const file = path.resolve(process.argv[i + 1] as string);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
  }
  for (const r of results) process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : `: ${String(r.detail)}`}\n`);
  process.stdout.write(`latency ms: ${JSON.stringify(latency)}\n`);
  process.exitCode = out.passed ? 0 : 1;
}

export function relay(socket: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [path.join(HERE, 'gate-relay.cjs'), socket], { stdio: ['pipe', 'pipe', 'inherit'] });
    let o = '';
    c.stdout.on('data', (d: Buffer) => { o += d.toString('utf8'); });
    c.on('error', reject);
    c.on('exit', () => resolve(o));
    c.stdin.end(input);
  });
}

void main();
