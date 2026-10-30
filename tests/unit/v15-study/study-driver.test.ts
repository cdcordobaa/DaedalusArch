/**
 * v1.5 final study driver (`experiments/v15-study/`): the zero-call parts. Design note
 * `ops/notes/v15-combined-delivery-design-2026-10-26.md` §6 item 8 and §7 steps 5–8, plus the scorer's outcome and
 * attribution functions on a tiny fixture. No model call, no socket, no Neo4j.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../src/shared/interfaces/process-runner.js';
import { buildGeneratorArgs } from '../../../scripts/lib/generators/argv.js';
import { createGeneratorCliConfig } from '../../../scripts/lib/generators/config.js';
import { gateSettings } from '../../../src/v15-instrument/edit-gate/settings.js';
import type { LedgerRow } from '../../../src/v15-instrument/delivery/ledger.js';
import { framePrompt } from '../../../experiments/puzzle-01-baseline/run-baseline.js';
import { FRAME_COMBINED_SHA256, MCP_ALLOW_RULE, argvDiff, compareArgv, argvFor, loadCombinedSentence, mcpConfigJson, promptFor, type ArmSockets } from '../../../experiments/v15-study/lib/arms.js';
import { LedgerRunner, VersionGuard, VersionMismatchStop, integrityOf, p95, type TurnObservation } from '../../../experiments/v15-study/lib/guards.js';
import { ARMS, ORDER_SEED, buildPlan, capsFor, plannedTurns, redrawFits } from '../../../experiments/v15-study/lib/plan.js';
import { ADMITTED_DDD_ROWS, ADMITTED_HEX_ROWS, admittedRules, attributionTable, dOverSteps, doubleReports, evasionCandidates, exploratoryRules, identity, isEvasionPath, neutralise, outcomeY, testsPass, trapFailed, type Hit } from '../../../experiments/v15-study/score-study.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const OPTS = {} as ProcessRunOptions;
const tasks25 = Array.from({ length: 25 }, (_, i) => ({ id: `t${String(i + 1).padStart(2, '0')}`, steps: 3 }));

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-study-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

const cfgOf = () => {
  const c = createGeneratorCliConfig({ binary: '/srv/bin/gclaude', modelId: 'claude-sonnet-5-5', outputRoot: '/srv/w', harnessRoot: '/srv/h', allowBash: true, timeoutMs: 1_200_000 }, REPO);
  if (!c.success) throw new Error(JSON.stringify(c.errors));
  return c.data;
};
const sockets: ArmSockets = {
  gate: { nodeBinary: '/usr/bin/node', relay: '/srv/h/bin/gate-relay.cjs', socket: '/srv/m/g.sock' },
  mcp: { nodeBinary: '/usr/bin/node', relay: '/srv/h/bin/mcp-relay.cjs', socket: '/srv/m/m.sock' },
};

describe('arms: prompt and argv (§1.4, §6 item 8, §7 step 5)', () => {
  it('none is the frozen argv byte for byte; combined differs only in --settings and the MCP config', () => {
    const cfg = cfgOf();
    const d = argvDiff(cfg, 'c/c001', '<prompt>', sockets);
    expect(d).toMatchObject({ noneIdentical: true, combinedOnlyTwoChanges: true, settingsIsGate: true, mcpIsRelay: true });
    expect(argvFor('none', cfg, 'c/c001', 'p', null)).toEqual(buildGeneratorArgs(cfg, { runId: 'c/c001' }, 'p'));
    const combined = argvFor('combined', cfg, 'c/c001', 'p', sockets);
    const settings = JSON.parse(combined[combined.indexOf('--settings') + 1] as string) as Record<string, unknown>;
    expect(settings).toEqual(gateSettings(sockets.gate));
    expect(settings.disableAllHooks).toBe(false);
    expect(combined[combined.indexOf('--mcp-config') + 1]).toBe(mcpConfigJson(sockets.mcp));
    expect(combined.filter((a) => a === MCP_ALLOW_RULE)).toHaveLength(1);
    // the frozen flags that keep agent-written settings out stay in both arms
    for (const a of [argvFor('none', cfg, 'c/c001', 'p', null), combined]) {
      expect(a[a.indexOf('--setting-sources') + 1]).toBe('');
      expect(a).toContain('--strict-mcp-config');
    }
  });

  it('a combined argv with any other change is caught', () => {
    const cfg = cfgOf();
    const frozen = buildGeneratorArgs(cfg, { runId: 'c/c001' }, '<prompt>');
    const combined = argvFor('combined', cfg, 'c/c001', '<prompt>', sockets);
    expect(compareArgv(frozen, frozen, [...combined, '--dangerously-skip-permissions'], sockets).combinedOnlyTwoChanges).toBe(false);
    const noStrict = combined.filter((a) => a !== '--strict-mcp-config');
    expect(compareArgv(frozen, frozen, noStrict, sockets).combinedOnlyTwoChanges).toBe(false);
    expect(compareArgv(frozen, [...frozen, '--x'], combined, sockets).noneIdentical).toBe(false);
    const otherSettings = [...combined];
    otherSettings[otherSettings.indexOf('--settings') + 1] = JSON.stringify({ disableAllHooks: false });
    expect(compareArgv(frozen, frozen, otherSettings, sockets).settingsIsGate).toBe(false);
    expect(argvFor('none', cfg, 'c/c001', 'p', null)).not.toContain('--mcp-config');
    expect(() => argvFor('combined', cfg, 'c/c001', 'p', null)).toThrow(/sockets/);
  });

  it('the none prompt is the baseline frame; combined appends the frozen sentence', () => {
    const sentence = loadCombinedSentence(REPO);
    expect(FRAME_COMBINED_SHA256).toMatch(/^[0-9a-f]{64}$/);
    expect(sentence.startsWith('An architecture tool is available to you as an MCP server.')).toBe(true);
    expect(sentence.endsWith('The same checks also run automatically after each file you create or edit, and report new findings to you.')).toBe(true);
    expect(promptFor('none', 'Add X.', 'tc', sentence)).toBe(framePrompt('Add X.', 'tc'));
    expect(promptFor('combined', 'Add X.', 'tc', sentence)).toBe(`${framePrompt('Add X.', 'tc').replace(/\s+$/, '')}\n\n${sentence}\n`);
  });

  it('refuses a frame file whose hash changed', () => {
    const fake = path.join(tmp, 'repo');
    fs.mkdirSync(path.join(fake, 'experiments', 'v15-delivery', 'hint-audit'), { recursive: true });
    fs.writeFileSync(path.join(fake, 'experiments', 'v15-delivery', 'hint-audit', 'frame-combined.txt'), 'edited\n');
    expect(() => loadCombinedSentence(fake)).toThrow(/frozen/);
  });
});

describe('plan: shuffle and interleave (§3)', () => {
  const input = { tasks: tasks25, arms: ARMS, replicates: 3, orderSeed: ORDER_SEED };
  it('is deterministic and covers every task × arm once per round before the next round', () => {
    const a = buildPlan(input);
    expect(buildPlan(input)).toEqual(a);
    expect(a).toHaveLength(150);
    for (let rep = 0; rep < 3; rep++) {
      const round = a.slice(rep * 50, rep * 50 + 50);
      expect(round.every((s) => s.rep === rep)).toBe(true);
      expect(new Set(round.map((s) => `${s.taskId}/${s.arm}`)).size).toBe(50);
    }
    expect(new Set(a.map((s) => s.id)).size).toBe(150);
    expect(a[0]?.id).toBe('c001');
    // a round is shuffled, not in input order, and rounds differ
    expect(a.slice(0, 50).map((s) => s.taskId)).not.toEqual(tasks25.flatMap((t) => [t.id, t.id]));
    expect(a.slice(0, 50).map((s) => `${s.taskId}/${s.arm}`)).not.toEqual(a.slice(50, 100).map((s) => `${s.taskId}/${s.arm}`));
    expect(buildPlan({ ...input, orderSeed: ORDER_SEED + 1 }).map((s) => s.taskId)).not.toEqual(a.map((s) => s.taskId));
  });
  it('turns per replicate are 25 tasks × 2 arms × 3 steps; the sessions cap is planned × 1.06', () => {
    const one = buildPlan({ ...input, replicates: 1 });
    expect(plannedTurns(one)).toBe(150);
    const three = buildPlan(input);
    expect(plannedTurns(three)).toBe(450);
    expect(capsFor(three, ARMS)).toEqual({ smoke: 2, probes: 1, sessions: 477, total: 480 });
    expect(() => buildPlan({ ...input, replicates: 0 })).toThrow();
  });
});

describe('caps (§3 of the plan; the ledger)', () => {
  const ok: DomainResult<ProcessResult> = DomainResult.ok({ exitCode: 0, stdout: '', stderr: '', timedOut: false } as unknown as ProcessResult);
  const inner: ProcessRunner & { n: number } = { n: 0, run() { this.n++; return Promise.resolve(ok); } };
  it('refuses calls past the phase cap and the total cap; --version and other binaries pass uncounted', async () => {
    inner.n = 0;
    const ledger = path.join(tmp, 'calls.jsonl');
    const caps = { smoke: 2, probes: 1, sessions: 2, total: 3 };
    const r = new LedgerRunner(inner, '/srv/bin/gclaude', ledger, 'sessions', caps);
    expect((await r.run('/srv/bin/gclaude', ['-p', 'x'], OPTS)).success).toBe(true);
    expect((await r.run('/srv/bin/gclaude', ['--version'], OPTS)).success).toBe(true);
    expect((await r.run('/usr/bin/other', ['-p'], OPTS)).success).toBe(true);
    expect((await r.run('/srv/bin/gclaude', ['-p', 'y'], OPTS)).success).toBe(true);
    const third = await r.run('/srv/bin/gclaude', ['-p', 'z'], OPTS);
    expect(third.success).toBe(false);
    if (!third.success) expect(third.errors[0]?.message).toMatch(/sessions cap 2/);
    expect(r.counts()).toMatchObject({ sessions: 2, total: 2 });
    const smoke = new LedgerRunner(inner, '/srv/bin/gclaude', ledger, 'smoke', caps);
    expect((await smoke.run('/srv/bin/gclaude', ['-p'], OPTS)).success).toBe(true);
    const over = await smoke.run('/srv/bin/gclaude', ['-p'], OPTS);
    expect(over.success).toBe(false);
    if (!over.success) expect(over.errors[0]?.message).toMatch(/total cap 3/);
    expect(inner.n).toBe(5);
  });
  it('a call lost in a restart is counted', () => {
    const ledger = path.join(tmp, 'calls.jsonl');
    fs.writeFileSync(`${ledger}.pending`, `${JSON.stringify({ phase: 'sessions', state: 'started' })}\n`);
    const r = new LedgerRunner(inner, '/srv/bin/gclaude', ledger, 'sessions', { smoke: 2, probes: 1, sessions: 5, total: 8 });
    r.recoverPending();
    expect(r.counts().sessions).toBe(1);
  });
  it('a redraw is allowed only inside the sessions cap', () => {
    expect(redrawFits(300, 150, 3, { sessions: 477 })).toBe(true);
    expect(redrawFits(326, 150, 3, { sessions: 477 })).toBe(false);
  });
});

describe('version check (§5.1, §7 step 7)', () => {
  it('pins the first version and stops on any change', () => {
    const g = new VersionGuard();
    g.check('2.1.308', 'c001/step-01');
    g.check('2.1.308', 'c001/step-02');
    expect(() => g.check('2.1.309', 'c001/step-03')).toThrow(VersionMismatchStop);
    expect(() => g.check(null, 'c002/step-01')).toThrow(VersionMismatchStop);
  });
  it('honours an input pin from the first turn', () => {
    expect(() => new VersionGuard('2.1.308').check('2.1.310', 'c001/step-01')).toThrow(/2\.1\.310.*2\.1\.308/);
  });
});

describe('integrity monitor (§5.2, §5.3, §7 step 8)', () => {
  const turn = (over: Partial<TurnObservation> = {}): TurnObservation => ({
    turn: 'step-01', changedFiles: ['src/a.ts', 'src/b.ts'], hubAlive: true, calls: [{ ms: 120 }],
    push: [{ event: 'PostToolUse', file: 'src/a.ts', refused: null, ms: 150 }, { event: 'PostToolUse', file: 'src/b.ts', refused: null, ms: 170 }, { event: 'Stop', refused: null, ms: 90 }], ...over,
  });
  it('passes a session where every edit has a hook event', () => {
    const i = integrityOf([turn(), turn({ turn: 'step-02' })]);
    expect(i).toMatchObject({ edits: 4, editsWithHookEvent: 4, coverage: 1, infrastructure: false, flagged: false, mechanismStop: false, failOpen: 0 });
    expect(i.hubP95Ms).toBe(170);
  });
  it('flags a session whose hub socket was killed (edits with no hook event, hub dead)', () => {
    const i = integrityOf([turn(), turn({ turn: 'step-02', push: [], calls: [], hubAlive: false }), turn({ turn: 'step-03', push: [], calls: [], hubAlive: false })]);
    expect(i).toMatchObject({ infrastructure: true, flagged: true });
    expect(i.hubDeadAfter).toEqual(['step-02', 'step-03']);
    expect(i.reasons.join(' ')).toMatch(/hook event 2\/6/);
  });
  it('flags (keeps) fail-open above 5 % and stops on p95 over 5 s', () => {
    const fo = integrityOf([turn({ push: [{ event: 'PostToolUse', file: 'src/a.ts', refused: null, failOpen: true, ms: 10 }, { event: 'PostToolUse', file: 'src/b.ts', refused: null, ms: 10 }] })]);
    expect(fo).toMatchObject({ infrastructure: false, flagged: true });
    expect(fo.failOpenRate).toBe(0.5);
    const slow = integrityOf([turn({ push: [{ event: 'PostToolUse', file: 'src/a.ts', refused: null, ms: 6000 }, { event: 'PostToolUse', file: 'src/b.ts', refused: null, ms: 6000 }], calls: [] })]);
    expect(slow).toMatchObject({ mechanismStop: true, latencyReported: true, infrastructure: false, flagged: false });
    expect(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 100])).toBe(19);
  });
  it('refused hook events do not count as coverage; an uncovered edit is flagged, not redrawn', () => {
    const i = integrityOf([turn({ push: [{ event: 'PostToolUse', file: 'src/a.ts', refused: 'outside the work tree' }, { event: 'PostToolUse', file: 'src/b.ts', refused: null, ms: 1 }] })]);
    expect(i).toMatchObject({ editsWithHookEvent: 1, refused: 1, infrastructure: false, flagged: true });
  });
});

describe('scorer on a tiny fixture (§4, outcome Y)', () => {
  const h = (rule: string, file: string, subject: string, line = 1): Hit => ({ rule, file, subject, line, source: rule.startsWith('FF-') ? 'frozen' : 'v15' });
  it('admits the registered rows only; K10 by R-D5S alone', () => {
    expect(ADMITTED_DDD_ROWS).toEqual(['K01', 'K02', 'K03', 'K05', 'K10', 'K13', 'K14', 'K15', 'K16']);
    expect(ADMITTED_HEX_ROWS).toEqual(['H01', 'H02', 'H03', 'H04', 'H05', 'H07', 'H08', 'H09', 'H10']);
    expect(admittedRules('ddd')).toEqual(expect.arrayContaining(['FF-DS02', 'R-D4', 'R-XCTX', 'R-D5S', 'R-H5', 'R-D9', 'R-INJ', 'R-REF']));
    expect(admittedRules('ddd')).not.toContain('R-D5');
    expect(exploratoryRules('ddd')).toEqual(expect.arrayContaining(['R-D5', 'R-RTX', 'R-LOCK', 'R-D3', 'R-D4R']));
    expect(admittedRules('hexagonal')).toEqual(expect.arrayContaining(['R-AXA', 'R-COREIO', 'R-ENTITY-OUT', 'R-TRANSPORT', 'FF-P03']));
    expect(admittedRules('hexagonal')).toContain('R-LOCATOR');
    // H08 admitted on HCAL-04; H06 (R-ADAPTER-RULE) and H11 (R-MIRROR) not admitted (HCAL-04, HCAL-05)
    expect(exploratoryRules('hexagonal')).toEqual(['R-ADAPTER-RULE', 'R-MIRROR', 'R-MIRROR-SEM', 'R-MIRROR2']);
  });
  it('Y counts admitted identities new against the seed; line shifts and exploratory rules do not count', () => {
    const seed = [h('R-D4', 'src/a.ts', 'A.run', 10), h('R-D5', 'src/b.ts', 'B.x')];
    const final = [h('R-D4', 'src/a.ts', 'A.run', 14), h('R-XCTX', 'src/c.ts', 'C.go'), h('FF-DS02', 'src/c.ts', 'import "../x"'), h('R-D5', 'src/d.ts', 'D.y'), h('R-LOCK', 'src/e.ts', 'E.z')];
    const y = outcomeY(seed, final, 'ddd');
    expect(y.Y).toBe(2);
    expect(y.newIdentities).toEqual([identity(h('FF-DS02', 'src/c.ts', 'import "../x"')), identity(h('R-XCTX', 'src/c.ts', 'C.go'))].sort());
    expect(outcomeY(seed, seed, 'ddd').Y).toBe(0);
    expect(outcomeY([], [h('R-D4', 'src/a.ts', 'A.run')], 'hexagonal').Y).toBe(0);
  });
  it('trap and functional outcomes', () => {
    expect(trapFailed([{ id: 'SG1', pass: true }, { id: 'SG2', pass: false }])).toBe(true);
    expect(trapFailed([{ id: 'SG1', pass: true }])).toBe(false);
    expect(trapFailed(null)).toBeNull();
    expect(testsPass({ passed: 5, failed: 0, cases: [{ name: 'a', ok: true }] })).toBe(true);
    expect(testsPass({ passed: 4, failed: 1, cases: [{ name: 'a', ok: false }] })).toBe(false);
    expect(testsPass(null)).toBe(false);
  });
  it('attributes resolved keys by channel and counts no double report', () => {
    const row = (number: number, key: string, exposures: { channel: 'push' | 'pull'; seq: number }[], resolvedAt: number | null, resolvedBy: 'push' | 'pull' | null = resolvedAt === null ? null : 'push'): LedgerRow => ({ key, number, rule: 'R-D4', file: 'src/a.ts', first: exposures[0] ?? { channel: 'push', seq: 0 }, exposures, resolvedAt, resolvedBy, cameBack: false, open: resolvedAt === null });
    const rows = [
      row(1, 'k1', [{ channel: 'push', seq: 1 }], 5),
      row(2, 'k2', [{ channel: 'pull', seq: 2 }], 6, 'pull'),
      row(3, 'k3', [{ channel: 'push', seq: 3 }, { channel: 'pull', seq: 4 }], 7),
      row(4, 'k4', [{ channel: 'push', seq: 8 }], null),
      row(5, 'k5', [], null),
    ];
    const t = attributionTable(rows, new Set(['k4']));
    expect(t.rows.map((r) => r.attribution)).toEqual(['push only', 'pull only', 'push first, then pull', null, 'unexposed']);
    expect(t.counts).toMatchObject({ 'push only': 1, 'pull only': 1, 'push first, then pull': 1, unexposed: 1, 'open on final tree': 1 });
    expect(doubleReports([{ pushed: [1] }, { resolved: [1] }, { pushed: [1] }, { pushed: [3, 4] }], rows)).toBe(0);
    expect(doubleReports([{ pushed: [4] }, { pushed: [4] }], rows)).toBe(1);
  });
  it('D_v15 sums identities new against the seed and every earlier step, with renames carried; null if a step is unscored', () => {
    const seed = new Set(['R-D4|src/a.ts|A.run']);
    const s1 = new Set(['R-D4|src/a.ts|A.run', 'R-XCTX|src/c.ts|C.go']);
    const s2 = new Set(['R-XCTX|src/c.ts|C.go', 'R-INJ|src/d.ts|D.x']); // seed finding gone: no credit, no penalty
    const s3 = new Set(['R-XCTX|src/c2.ts|C.go', 'R-INJ|src/d.ts|D.x', 'R-D4|src/a.ts|A.run']); // c.ts renamed; a.ts back
    expect(dOverSteps([seed, s1, s2, s3], [undefined, undefined, undefined, new Map([['src/c.ts', 'src/c2.ts']])])).toEqual({ D: 2, perStep: [1, 1, 0] });
    expect(dOverSteps([seed, s1, s2, s3]).D).toBe(3); // without ρ the renamed file counts again
    expect(dOverSteps([seed, s1, null, s3]).D).toBeNull();
  });
});

describe('scorer: agent-written spec, overlay and allow files (evasion candidates)', () => {
  it('matches the overlay, allow lists, spec-shaped files and agent settings, not source', () => {
    for (const p of ['detect02.allow.yaml', 'src/x/detect02.allow.yaml', 'allowlist.json', 'spec.yaml', 'src/arch.yml', '.claude/settings.json', '.claude/settings.local.json']) expect(isEvasionPath(p)).toBe(true);
    for (const p of ['src/billing/Invoice.ts', 'ARCHITECTURE.md', 'src/allowance/Allowance.ts']) expect(isEvasionPath(p)).toBe(false);
  });
  it('reports created and edited candidates and undoes them in the scoring copy', () => {
    const seed = path.join(tmp, 'seed');
    const tree = path.join(tmp, 'tree');
    fs.mkdirSync(path.join(seed, 'src'), { recursive: true });
    fs.writeFileSync(path.join(seed, 'src', 'a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(seed, 'policy.yaml'), 'keep: true\n');
    fs.cpSync(seed, tree, { recursive: true });
    fs.writeFileSync(path.join(tree, 'src', 'a.ts'), 'export const a = 2;\n');
    fs.writeFileSync(path.join(tree, 'detect02.allow.yaml'), 'allow:\n  - rule: R-D4\n    command: src/a.ts#*\n');
    fs.mkdirSync(path.join(tree, '.claude'));
    fs.writeFileSync(path.join(tree, '.claude', 'settings.json'), '{"disableAllHooks":true}');
    fs.writeFileSync(path.join(tree, 'policy.yaml'), 'keep: false\n');
    const c = evasionCandidates(seed, tree);
    expect(c).toEqual([{ path: '.claude/settings.json', kind: 'created' }, { path: 'detect02.allow.yaml', kind: 'created' }, { path: 'policy.yaml', kind: 'edited' }]);
    neutralise(tree, seed, c);
    expect(fs.existsSync(path.join(tree, 'detect02.allow.yaml'))).toBe(false);
    expect(fs.existsSync(path.join(tree, '.claude', 'settings.json'))).toBe(false);
    expect(fs.readFileSync(path.join(tree, 'policy.yaml'), 'utf8')).toBe('keep: true\n');
    expect(fs.readFileSync(path.join(tree, 'src', 'a.ts'), 'utf8')).toBe('export const a = 2;\n'); // source is scored as written
    expect(evasionCandidates(seed, seed)).toEqual([]);
  });
});
