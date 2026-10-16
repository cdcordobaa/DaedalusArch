/**
 * Loop replay (Docs/v1.3/loop-replay.md): the whole firewall-in-the-loop harness, end to end, with the scripted agent
 * of `scripts/lib/loop/replay.ts` in place of the model. No LLM is called.
 *
 * Needs a scratch Neo4j 5.26 + APOC: the golden suite's guard (`resolveGoldenEnv`: NEO4J_PASSWORD set, a localhost
 * URI unless GOLDEN_ALLOW_WIPE=1); skips cleanly without it. The evaluator wipes the graph.
 * Run: `npm run test:loop-replay` (jest --maxWorkers=2).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext } from '../../../src/mcp-server/context.js';
import { iseDddFreezer } from '../../../scripts/lib/loop/specs.js';
import { REPLAY_TAPES } from '../../../scripts/lib/loop/replay-tapes.js';
import { readRunSteps, runReplay } from '../../../scripts/lib/loop/replay.js';
import type { ReplayResult } from '../../../scripts/lib/loop/replay.js';
import { compareReplays, verifyReplay } from '../../../scripts/lib/loop/replay-verify.js';
import type { ReplayVerification, ReproCheck } from '../../../scripts/lib/loop/replay-verify.js';
import { resolveGoldenEnv } from '../../golden/golden-env.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const env = resolveGoldenEnv();
if (!env.enabled) console.warn(`[loop-replay] skipped: ${env.reason}`);
const describeNeo4j = env.enabled ? describe : describe.skip;
const STEPS = 4;
const TIMEOUT = 30 * 60 * 1000;

/** Per task: the steps the tape scripts as violating, and the rules each violation's full evaluation reports. */
const EXPECTED: Readonly<Record<string, { readonly step: number; readonly rules: readonly string[]; readonly mcpSeesIt: boolean }>> = {
  'market-vendors': { step: 2, rules: ['FF-S01', 'FF-S04'], mcpSeesIt: true },
  // Known tool gap (loop-replay.md §4): check_file / check_diff do not check the hexagonal graph rules or the DDD
  // context rules, so the daedalus-mcp agent gets no feedback there. If the tools learn them, flip these and the doc.
  'shelter-adoptions': { step: 3, rules: ['FF-S01', 'FF-S04'], mcpSeesIt: false },
  'relief-volunteers': { step: 2, rules: ['FF-DS02'], mcpSeesIt: false },
};

function scratch(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

describe('DDD spec freeze (no Neo4j)', () => {
  it('rejects at freeze a spec whose blocking DDD rules cannot bind (no aggregate folder), instead of failing every evaluation', async () => {
    const dir = scratch('loop-replay-flat-');
    try {
      const write = (rel: string, text: string): void => {
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), text);
      };
      write('src/registry/domain/volunteer.ts', 'export class Volunteer {\n  constructor(readonly id: string) {}\n}\n');
      write('src/registry/application/register.ts', "import { Volunteer } from '../domain/volunteer';\nexport const make = (id: string): Volunteer => new Volunteer(id);\n");
      write('src/deployment/domain/shift.ts', 'export class Shift {\n  constructor(readonly id: string) {}\n}\n');
      const r = await iseDddFreezer(REPO_ROOT)(dir, [
        { root: 'src/registry/', part: 'the volunteer registry' },
        { root: 'src/deployment/', part: 'deployment planning' },
      ]);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.errors[0]?.code).toBe('LOOP_SPEC_FREEZE_FAILED');
        expect(r.errors[0]?.message).toMatch(/BR-SPEC-10 FF-DT0[12]: aggregates/);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});

describeNeo4j('loop replay: scripted agent through none, daedalus-mcp and gate (no LLM)', () => {
  const roots: string[] = [];
  let a: ReplayResult;
  let v: ReplayVerification;
  let repro: ReproCheck;

  async function replay(label: string): Promise<{ outRoot: string; result: ReplayResult }> {
    if (!env.enabled) throw new Error('unreachable');
    const base = scratch(`loop-replay-${label}-`);
    roots.push(base);
    const evalEnv: NodeJS.ProcessEnv = { NEO4J_URI: env.neo4j.uri, NEO4J_USER: env.neo4j.user, NEO4J_PASSWORD: env.neo4j.password, APG_STORE_PATH: path.join(base, 'apg-store') };
    const outRoot = path.join(base, 'out');
    const r = await runReplay({ repoRoot: REPO_ROOT, outRoot, harnessRoot: path.join(base, 'harness'), evaluatorEnv: evalEnv, evaluateDeps: buildContext({}, evalEnv).evaluateDeps, tapes: REPLAY_TAPES });
    if (!r.success) throw new Error(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
    return { outRoot, result: r.data };
  }

  beforeAll(async () => {
    const first = await replay('A');
    const second = await replay('B');
    a = first.result;
    repro = compareReplays(first.outRoot, second.outRoot);
    const s = scratch('loop-replay-verify-');
    roots.push(s);
    v = await verifyReplay(a, REPLAY_TAPES, REPO_ROOT, s);
  }, TIMEOUT);

  afterAll(() => {
    for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
  });

  it('runs every tape under every arm, with no model call (no tokens, no cost) and every snapshot evaluated', () => {
    expect(a.runs.map((r) => `${r.spec.taskId}/${r.spec.arm}`)).toEqual(
      ['market-vendors', 'shelter-adoptions', 'relief-volunteers'].flatMap((t) => ['none', 'daedalus-mcp', 'gate'].map((arm) => `${t}/${arm}`)),
    );
    for (const run of a.runs) {
      expect(run.result.kind).toBe('completed');
      for (const s of readRunSteps(run.runDir, STEPS)) {
        expect(s.schema).toBe('loop-step/v1');
        expect(s.evaluatorSpec?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(s.cost.costUsd).toBeNull();
        expect(s.cost.inputTokens).toBeNull();
        for (const t of s.turns) {
          expect(t.result.status).toBe('completed');
          expect(t.snapshot.evaluationError).toBeUndefined();
          expect(t.snapshot.typecheck).toEqual({ errors: 0, codes: [] });
          expect(t.snapshot.evaluation?.advisoryByRule).toBeDefined();
          for (const f of t.snapshot.evaluation?.blockingFindings ?? []) {
            expect(f.template).not.toBe('');
            expect(f.violationId).toBeDefined();
          }
          const report = path.join(run.runDir, 'turns', `step-${String(s.stepIndex + 1).padStart(2, '0')}`, `report-${t.turnId}.json`);
          expect(fs.existsSync(report)).toBe(true);
        }
      }
    }
  });

  it('records the memo §3 primary outcome: new blocking findings exactly at the scripted steps, per arm', () => {
    for (const o of v.outcomes) {
      const e = EXPECTED[o.taskId];
      if (e === undefined) throw new Error(o.taskId);
      // none: the violation stays in step k's final snapshot; daedalus-mcp: only when the tools miss it; gate: never.
      const visible = o.arm === 'none' || (o.arm === 'daedalus-mcp' && !e.mcpSeesIt);
      const expected = [2, 3, 4].map((step) => (visible && step === e.step ? e.rules.length : 0));
      expect({ run: o.runId, counts: o.newBlocking.map((s) => s.count) }).toEqual({ run: o.runId, counts: expected });
      if (visible) expect(o.newBlocking.find((s) => s.step === e.step)?.findings.map((f) => f.ruleId).sort()).toEqual([...e.rules]);
    }
  });

  it('records the memo §4 secondary outcomes (advisory slope with and without FF-CV05, repair success, cost and time, guards)', () => {
    for (const o of v.outcomes) {
      expect(o.advisoryPerKloc).toHaveLength(STEPS);
      expect(o.advisoryPerKloc.every((x) => x !== null)).toBe(true);
      expect(o.advisorySlopePerKloc).not.toBeNull();
      expect(o.advisorySlopePerKlocWithoutCv05).not.toBeNull();
      expect(o.guards.map((g) => g.evaluationError)).toEqual([null, null, null, null]);
      expect(o.guards.every((g) => g.skeletonIntact && g.typecheckErrors === 0 && g.files > 0 && g.loc > 0)).toBe(true);
      expect(o.costTime.every((c) => c.stepTurn.costUsd === null && c.interruptions === 0 && c.stepTurn.wallMs >= 0)).toBe(true);
      const e = EXPECTED[o.taskId];
      if (o.arm === 'gate') {
        expect(o.gateRepair).toEqual({ failingSteps: [e?.step], cleared: 1, share: 1, meanReduction: e?.rules.length, introduced: 0 });
        expect(o.costTime.filter((c) => c.repairTurn !== null).map((c) => c.step)).toEqual([e?.step]);
      } else {
        expect(o.gateRepair).toBeNull();
      }
    }
    for (const u of v.unmatched) expect(u.share).toBe(0);
  });

  it('gate: repairs exactly the scripted violating steps, and each repair removes every finding it was shown', () => {
    for (const g of v.gate) expect(g).toEqual({ ...g, exact: true });
    for (const run of a.runs.filter((r) => r.spec.arm === 'gate')) {
      for (const s of readRunSteps(run.runDir, STEPS)) {
        if (s.repair?.attempted !== true) continue;
        expect(s.repair.cleared).toBe(true);
        expect(s.repairOutcome).toMatchObject({ remaining: 0, introduced: 0 });
        expect(s.repairOutcome?.findings.every((f) => f.shown && f.removed)).toBe(true);
      }
    }
  });

  it('daedalus-mcp: the agent follows the tools\' feedback with the scripted fix; tool findings vs the full evaluation', () => {
    for (const m of v.mcp) {
      const e = EXPECTED[m.taskId];
      expect(m.toolErrors.filter((x) => !x.includes('frozen after step 1'))).toEqual([]);
      expect(m.unfollowed).toBe(false);
      if (m.step === e?.step) {
        expect(m.fullBlocking.length).toBeGreaterThan(0);
        if (e.mcpSeesIt) {
          expect(m.toolReported).toEqual(m.fullBlocking);
          expect(m.fixApplied).toBe(true);
        } else {
          expect(m.toolReported).toEqual([]);
          expect(m.fixApplied).toBe(false);
        }
      } else {
        expect({ step: m.step, tool: m.toolReported, full: m.fullBlocking, fix: m.fixApplied }).toEqual({ step: m.step, tool: [], full: [], fix: false });
      }
    }
  });

  it('consistency: every snapshot\'s recorded findings equal a full evaluation of a fresh checkout of its commit', () => {
    expect(v.consistency.length).toBeGreaterThan(36);
    for (const c of v.consistency) expect({ turn: `${c.runId} ${c.turnId}`, equal: c.equal, d: c.difference }).toEqual({ turn: `${c.runId} ${c.turnId}`, equal: true, d: undefined });
  });

  it('labels every new blocking finding `correct` with the check-correct checker (memo §3)', () => {
    for (const o of v.outcomes) expect({ run: o.runId, unscored: o.unscoredSteps }).toEqual({ run: o.runId, unscored: [] });
    const total = v.outcomes.reduce((n, o) => n + (o.newBlockingTotal ?? 0), 0);
    expect(v.labels).toHaveLength(total);
    for (const l of v.labels) expect(l).toEqual({ ...l, verdict: 'correct' });
  });

  it('captures per-step latency (step turn, tool calls, type-check, evaluation)', () => {
    expect(v.latency).toHaveLength(a.runs.length * STEPS);
    for (const l of v.latency) {
      expect(l.evaluateMs.every((ms) => ms > 0)).toBe(true);
      expect(l.typecheckMs.length).toBe(l.evaluateMs.length);
      if (l.arm === 'daedalus-mcp' && !(l.taskId === 'relief-volunteers' && l.step === 1)) expect(l.toolCalls).toBeGreaterThan(0);
      if (l.arm !== 'daedalus-mcp') expect(l.toolCalls).toBe(0);
    }
  });

  it('is byte-reproducible: a second replay gives the same files (timing fields aside) and the same snapshot commits', () => {
    expect(repro.differing).toEqual([]);
    expect(repro.identical).toBe(true);
    expect(repro.files).toBeGreaterThan(100);
  });
});
