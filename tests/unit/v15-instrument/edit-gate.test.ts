/**
 * v1.5 instrument (Stage 0): the promoted edit gate and `check_consistency`, ported from the prototype's own unit
 * tests (`experiments/edit-gate/test/unit.ts`). Zero model calls, no socket, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkConsistency, formatText, type ConsistencyFinding } from '../../../src/v15-instrument/consistency.js';
import { GateState, MAX_FINDINGS_PER_MESSAGE, MAX_LINES_PER_FINDING, TRANSIENT_NOTE, editMessage, formatFinding, insideTree, keyOf, parseHookEvent, postToolUseReply, stopMessage, stopReply } from '../../../src/v15-instrument/edit-gate/gate.js';
import { GateHub, type GateLogLine } from '../../../src/v15-instrument/edit-gate/hub.js';
import { GATE_MATCHER, gateSettings, withGateSettings } from '../../../src/v15-instrument/edit-gate/settings.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DUMMY = path.join(REPO, 'experiments', 'edit-gate', 'fixtures', 'dummy');
const SPEC = path.join(DUMMY, 'spec.yaml');
const VIOLATING = path.join(DUMMY, 'edits', 'SettleInvoices.violating.ts');
const TARGET = 'src/billing/application/SettleInvoices.ts';
const P6 = path.join(REPO, 'experiments', 'puzzle-03', 'puzzles', 'p6-workshop-jobs');

const post = (file: string, tool = 'Write'): string =>
  JSON.stringify({ session_id: 's', transcript_path: '/srv/gh/x.jsonl', cwd: '/srv/w/c01/work', hook_event_name: 'PostToolUse', tool_name: tool, tool_input: { file_path: file, content: 'x' }, tool_response: { success: true } });
const stopEv = (active = false): string => JSON.stringify({ session_id: 's', hook_event_name: 'Stop', stop_hook_active: active });
const fakeFinding = (o: Partial<ConsistencyFinding> = {}): ConsistencyFinding => ({ file: 'src/a/app/Cmd.ts', line: 10, rule: 'R-D4', ruleText: 'One command saves one aggregate.', why: 'Cmd.execute (src/a/app/Cmd.ts:10) saves more than one aggregate instance in the same call: Account: from, to.', fix: 'Record an event.', writes: ['src/a/app/Cmd.ts:12 AccountRepository.save(…) via Cmd.execute → AccountRepository.save'], ...o });
const ctxOf = (reply: string): string => (JSON.parse(reply) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;

let tmp: string;
let n = 0;
const cell = (seed: string): string => {
  const dir = path.join(tmp, `w${String(++n)}`);
  fs.cpSync(seed, dir, { recursive: true });
  return dir;
};
beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-gate-')); });
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('edit gate: hook format, messages, de-duplication', () => {
  it('reads PostToolUse and Stop events and drops everything else', () => {
    expect(parseHookEvent(post('/srv/w/c01/work/src/x.ts', 'Edit'))).toEqual({ event: 'PostToolUse', tool: 'Edit', filePath: '/srv/w/c01/work/src/x.ts', cwd: '/srv/w/c01/work', stopHookActive: false });
    expect(parseHookEvent(stopEv(true))?.stopHookActive).toBe(true);
    expect(parseHookEvent('not json')).toBeNull();
    expect(parseHookEvent(JSON.stringify({ hook_event_name: 'PreToolUse' }))?.event).toBe('other');
  });

  it('writes the hook replies, and nothing when there is nothing to say', () => {
    expect(JSON.parse(postToolUseReply('t'))).toEqual({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: 't' } });
    expect(JSON.parse(stopReply('r'))).toEqual({ decision: 'block', reason: 'r' });
    expect(postToolUseReply('')).toBe('');
    expect(stopReply('')).toBe('');
  });

  it('caps a message at 12 lines per finding and 3 findings, with the transient note', () => {
    const f = fakeFinding({ writes: Array.from({ length: 20 }, (_, i) => `src/a/x.ts:${String(i)} Repo.save(…) via A → B`) });
    expect(formatFinding(f).length).toBeLessThanOrEqual(MAX_LINES_PER_FINDING);
    expect(formatFinding(f).join('\n')).toMatch(/and \d+ more/);
    const five = Array.from({ length: 5 }, (_, i) => keyOf(fakeFinding({ file: `src/a/C${String(i)}.ts`, why: `C${String(i)}.run (src/a/C${String(i)}.ts:1) saves: Account: a, b.` }), ['Account']));
    const text = editMessage(new GateState().update(five));
    expect((text.match(/^Architecture check:/gm) ?? []).length).toBe(MAX_FINDINGS_PER_MESSAGE);
    expect(text).toMatch(/… and 2 more/);
    expect(text.endsWith(TRANSIENT_NOTE)).toBe(true);
    expect(stopMessage(five)).toMatch(/^Architecture check: 5 findings still open/);
  });

  it('shows a finding once, keeps its key across a line shift, resolves it once, and claims Stop once per turn', () => {
    const s = new GateState();
    const a = keyOf(fakeFinding(), ['Account', 'Transfer']);
    expect(a.key).toBe('R-D4|src/a/app/Cmd.ts|Cmd.execute|Account');
    expect(s.update([a]).fresh).toHaveLength(1);
    expect(editMessage(s.update([a]))).toBe('');
    const shifted = keyOf(fakeFinding({ line: 14, why: 'Cmd.execute (src/a/app/Cmd.ts:14) saves more than one aggregate instance in the same call: Account: from, to.' }), ['Account']);
    expect(shifted.key).toBe(a.key);
    expect(editMessage(s.update([shifted]))).toBe('');
    const d = s.update([]);
    expect(d.resolved).toHaveLength(1);
    expect(editMessage(d)).toMatch(/^resolved: src\/a\/app\/Cmd.ts:14 \[one aggregate per command\]$/);
    expect(s.claimStop('step-01')).toBe(true);
    expect(s.claimStop('step-01')).toBe(false);
    expect(s.claimStop('step-02')).toBe(true);
  });

  it('maps a path into the work tree, and refuses anything outside it', () => {
    const w = cell(path.join(DUMMY, 'seed'));
    expect(insideTree(w, path.join(w, 'src/main.ts'))).toBe('src/main.ts');
    expect(insideTree(w, path.join(w, 'src/new/dir/NotYet.ts'))).toBe('src/new/dir/NotYet.ts');
    expect(insideTree(w, '/etc/passwd')).toBeNull();
    expect(insideTree(w, path.join(w, 'src', '..', '..', 'x.ts'))).toBeNull();
  });

  it('builds the hook settings: hooks on, one relay command for PostToolUse and Stop; exactly one argv value replaced', () => {
    const relay = { nodeBinary: '/opt/node22/bin/node', relay: '/srv/h/bin/gate-relay.cjs', socket: '/srv/m/g.sock' };
    const s = gateSettings(relay) as { disableAllHooks: boolean; hooks: { PostToolUse: { matcher: string; hooks: { command: string }[] }[]; Stop: unknown[] } };
    expect(s.disableAllHooks).toBe(false);
    expect(s.hooks.PostToolUse[0]?.matcher).toBe(GATE_MATCHER);
    expect(s.hooks.PostToolUse[0]?.hooks[0]?.command).toBe('/opt/node22/bin/node /srv/h/bin/gate-relay.cjs /srv/m/g.sock');
    expect(s.hooks.Stop).toHaveLength(1);
    const frozen = ['-p', '--settings', JSON.stringify({ autoMemoryEnabled: false, disableAllHooks: true }), '--setting-sources', ''];
    const arm = withGateSettings(frozen, relay);
    expect(arm.map((a, i) => (a === frozen[i] ? -1 : i)).filter((i) => i >= 0)).toEqual([2]);
    expect(() => withGateSettings(['-p'], relay)).toThrow(/no --settings/);
  });
});

describe('check_consistency and the hub with the real checker (dummy project)', () => {
  it('is clean on the seed and reports R-D4 + R-XCTX on the violating edit', async () => {
    const w = cell(path.join(DUMMY, 'seed'));
    const clean = await checkConsistency({ root: w, spec: SPEC, scratch: path.join(tmp, 's1') });
    expect(clean.status).toBe('clean');
    fs.copyFileSync(VIOLATING, path.join(w, TARGET));
    const bad = await checkConsistency({ root: w, spec: SPEC, scratch: path.join(tmp, 's1') });
    expect(bad.status).toBe('violations');
    expect(bad.findings.map((f) => `${f.rule} ${f.file}:${String(f.line)}`)).toEqual([`R-D4+R-XCTX ${TARGET}:9`]);
    expect(formatText(bad)).toMatch(/one aggregate per command; cross-context write/);
    const onlyOther = await checkConsistency({ root: w, spec: SPEC, files: ['src/shared-kernel/Money.ts'], scratch: path.join(tmp, 's1') });
    expect(onlyOther.findings).toHaveLength(0);
  }, 120_000);

  it('hub: edit gives the finding once, Stop blocks once per turn, the fix resolves it, refusals run no check', async () => {
    let checks = 0;
    const counted: typeof checkConsistency = async (o) => { checks++; return checkConsistency(o); };
    const hub = new GateHub(path.join(tmp, 'hub', 'g.sock'), path.join(tmp, 'hub', 'log'), counted);
    const w = cell(path.join(DUMMY, 'seed'));
    await hub.setCell({ id: 'u1', turn: 'step-01', spec: SPEC, project: w });
    const target = path.join(w, TARGET);
    const original = fs.readFileSync(target, 'utf8');
    fs.copyFileSync(VIOLATING, target);
    const r1 = await hub.handle(post(target));
    expect(r1).not.toContain(SPEC);
    expect(ctxOf(r1)).toMatch(/^Architecture check: src\/billing\/application\/SettleInvoices.ts:9 \[one aggregate per command; cross-context write\]/);
    expect(await hub.handle(post(target, 'Edit'))).toBe('');
    expect((JSON.parse(await hub.handle(stopEv())) as { decision: string }).decision).toBe('block');
    expect(await hub.handle(stopEv())).toBe('');
    hub.setTurn('step-02');
    fs.writeFileSync(target, original);
    expect(ctxOf(await hub.handle(post(target, 'Edit')))).toMatch(/^resolved: src\/billing\/application\/SettleInvoices.ts:9 /);
    const before = checks;
    for (const raw of [post('/etc/passwd'), post(SPEC), JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }), '{"hook_event_name":']) {
      expect(await hub.handle(raw)).toBe('');
    }
    expect(checks).toBe(before);
    const log = fs.readFileSync(hub.logFile('u1'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as GateLogLine & Record<string, unknown>);
    expect(log.every((l) => !('transcript_path' in l))).toBe(true);
    expect(log.slice(-4).every((l) => l.refused !== null)).toBe(true);
  }, 120_000);

  it('hub fails open: a checker error gives no reply and is logged', async () => {
    const bad = new GateHub(path.join(tmp, 'hub', 'b.sock'), path.join(tmp, 'hub', 'log'), () => Promise.reject(new Error('boom')));
    const w = cell(path.join(DUMMY, 'seed'));
    await bad.setCell({ id: 'u3', turn: 'step-01', spec: SPEC, project: w });
    fs.copyFileSync(VIOLATING, path.join(w, TARGET));
    expect(await bad.handle(post(path.join(w, TARGET)))).toBe('');
    const l = JSON.parse(fs.readFileSync(bad.logFile('u3'), 'utf8').trim()) as { failOpen: boolean; error: string };
    expect(l.failOpen).toBe(true);
    expect(l.error).toBe('boom');
  }, 60_000);

  it('hub with layer rules: the P6 trap is flagged by FF-S03, the planted seed import is never shown; the clean line is silent', async () => {
    const hub = new GateHub(path.join(tmp, 'hub', 'l.sock'), path.join(tmp, 'hub', 'log-layers'), checkConsistency, { layers: true });
    const replay = async (sol: string, id: string): Promise<{ keys: string[]; stop: string }> => {
      const w = cell(path.join(P6, 'seed'));
      await hub.setCell({ id, turn: 'step-01', spec: path.join(P6, 'spec.yaml'), project: w });
      const files = (fs.readdirSync(sol, { recursive: true }) as string[]).filter((f) => fs.statSync(path.join(sol, f)).isFile()).sort();
      const keys: string[] = [];
      for (const f of files) {
        fs.mkdirSync(path.dirname(path.join(w, f)), { recursive: true });
        fs.copyFileSync(path.join(sol, f), path.join(w, f));
        await hub.handle(post(path.join(w, f)));
        keys.push(...(JSON.parse(fs.readFileSync(hub.logFile(id), 'utf8').trim().split('\n').pop() as string) as GateLogLine).newKeys);
      }
      const stop = await hub.handle(stopEv());
      hub.clear();
      return { keys, stop };
    };
    const t = await replay(path.join(P6, 'solutions', 'trap'), 'p6-t');
    expect(t.keys.length).toBeGreaterThanOrEqual(1);
    expect(t.keys.every((k) => k.startsWith('FF-S03|src/presentation/ReportsController.ts|'))).toBe(true);
    expect(t.keys.some((k) => k.includes('MechanicGateway'))).toBe(true);
    expect(t.keys.some((k) => k.includes('JobGateway'))).toBe(false);
    expect((JSON.parse(t.stop) as { reason: string }).reason).toMatch(/\[FF-S03 no-layer-skip\]/);
    const c = await replay(path.join(P6, 'solutions', 'clean'), 'p6-c');
    expect(c.keys).toEqual([]);
    expect(c.stop).toBe('');
  }, 240_000);
});
