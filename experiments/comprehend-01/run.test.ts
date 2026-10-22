/**
 * Unit tests of the COMPREHEND-01 runner, scorer and arms (zero model calls; in-repo trees only).
 * Run: `npx tsx --test experiments/comprehend-01/run.test.ts`
 */
import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { armArgs, buildPrompt, GRAPH_ALLOW_RULES } from './lib/arms.js';
import { loadBank } from './lib/bank.js';
import { FakeModelRunner, perturb } from './lib/runners.js';
import type { FakeBehaviour, FakeScript } from './lib/runners.js';
import { scorePayload, scoreText } from './lib/score.js';
import { confinement, PLANNED_SESSIONS, plan, runAll, summarise } from './run.js';

const { bank, conventions } = loadBank();
const IN_REPO = ['p1-seed', 'p2-seed', 'p4-seed', 'fx-p05-positive', 'fx-p07-positive', 'fx-p08-positive', 'fx-p09-legit'];
const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'comprehend-01-test-'));

describe('scorer', () => {
  it('scores every key 1 and every perturbed key below 1', () => {
    for (const item of bank.items) {
      assert.equal(scorePayload(item, item.key).primary, 1, `${item.id} key`);
      assert.ok(scorePayload(item, perturb(item.key)).primary < 1, `${item.id} perturbed`);
    }
  });
  it('reads the ANSWER line, and scores a missing one 0', () => {
    const item = bank.items.find((i) => i.id === 'P2-W1')!;
    assert.equal(scoreText(item, 'Reasoning.\nANSWER: {"aggregates":["order"]}').primary, 1);
    const miss = scoreText(item, 'no answer here');
    assert.equal(miss.parse, 'missing'); assert.equal(miss.primary, 0);
  });
  it('gives chain credit for required hops in order, with extra hops allowed', () => {
    const item = bank.items.find((i) => i.id === 'P2-C1')!;
    const ok = { chain: ['PlaceOrder.execute', 'MembershipDirectory.exists', 'card', 'GetMemberCard.execute', 'InMemoryMemberRepository.byId'], endFile: 'src/membership/infrastructure/InMemoryMemberRepository.ts' };
    assert.equal(scorePayload(item, ok).primary, 1);
    const swapped = { ...ok, chain: ['PlaceOrder.execute', 'GetMemberCard.execute', 'MembershipDirectory.exists', 'InMemoryMemberRepository.byId'] };
    assert.equal(scorePayload(item, swapped).primary, 0);
    assert.ok(scorePayload(item, swapped).secondary > 0.5);
  });
  it('gives half credit to a path in the right context but the wrong folder', () => {
    const item = bank.items.find((i) => i.id === 'P1-P1')!;
    assert.equal(scorePayload(item, { path: 'src/ledger/application/ReceiveTransfer.ts' }).primary, 1);
    assert.equal(scorePayload(item, { path: 'src/ledger/domain/' }).primary, 0.5);
    assert.equal(scorePayload(item, { path: 'src/main.ts' }).primary, 0);
  });
});

describe('plan and arms', () => {
  it('plans 62 sessions, every item in both arms once, reproducibly', () => {
    const a = plan(bank.items); const b = plan(bank.items);
    assert.equal(a.length, PLANNED_SESSIONS);
    assert.deepEqual(a, b);
    for (const i of bank.items) for (const arm of ['F', 'FG']) assert.equal(a.filter((c) => c.item === i.id && c.arm === arm).length, 1);
  });
  it('F has no MCP config; FG loads one config and allows exactly the four graph tools', () => {
    const item = bank.items[0]!;
    const p = buildPrompt('F', item, 'architecture:\n  style: ddd\n', conventions);
    const f = armArgs('F', p);
    assert.ok(f.ok && !f.args.includes('--mcp-config') && f.args.includes('--strict-mcp-config'));
    const g = armArgs('FG', buildPrompt('FG', item, 'architecture:\n  style: ddd\n', conventions), '/abs/mcp.json');
    assert.ok(g.ok);
    assert.equal(g.args.filter((x) => x === '--mcp-config').length, 1);
    assert.deepEqual(g.args.filter((x) => x.startsWith('mcp__')), [...GRAPH_ALLOW_RULES]);
    assert.equal(GRAPH_ALLOW_RULES.length, 4);
    assert.equal(armArgs('FG', p, 'relative.json').ok, false);
    assert.ok(buildPrompt('FG', item, '', conventions).includes('who_writes'));
    assert.ok(!buildPrompt('F', item, '', conventions).includes('who_writes'));
  });
  it('flags confinement leaks', () => {
    assert.deepEqual(confinement('F', [{ name: 'mcp__daedalus-graph__trace', input: {} }], '/t'), ['F called mcp__daedalus-graph__trace']);
    assert.equal(confinement('FG', [{ name: 'mcp__other__x', input: {} }], '/t').length, 1);
    assert.equal(confinement('FG', [{ name: 'Read', input: { file_path: '/etc/hostname' } }], '/t').length, 1);
    assert.equal(confinement('F', [{ name: 'Read', input: { file_path: '/t/src/a.ts' } }], '/t').length, 0);
    assert.equal(confinement('F', [{ name: 'Bash', input: {} }], '/t').length, 1);
  });
});

/** A fake script: answer the key, with per-session behaviours. */
const script = (behave: (sid: string, attempt: number) => FakeBehaviour): FakeScript => ({
  answerFor: (sid) => bank.items.find((i) => sid.startsWith(`${i.id}-`))?.key ?? null,
  behaviourFor: behave,
  graphCallsFor: () => [{ name: 'context_map', input: {} }],
  readsFor: () => [],
  usageFor: () => ({ input: 10, cacheCreation: 10, cacheRead: 10, output: 10 }),
});

describe('runner', () => {
  it('scores a clean dry run 1.0 in both arms and writes a ledger line per spawn', async () => {
    const out = tmp();
    const runner = new FakeModelRunner(script(() => 'answer'));
    const r = await runAll({ out, runner, clones: undefined, harness: tmp(), onlyTrees: IN_REPO });
    const s = summarise(r.rows, null) as { accuracy: Record<string, number> };
    assert.deepEqual(s.accuracy, { F: 1, FG: 1 });
    assert.equal(fs.readFileSync(path.join(out, 'ledger.jsonl'), 'utf8').trim().split('\n').length, r.spawns);
    assert.equal(r.spawns, runner.spawned.length);
  });
  it('re-runs a leak once, spends at most the re-run allowance, and stops on a second leak', async () => {
    const leakOnce = new FakeModelRunner(script((sid, attempt) => (attempt === 1 && sid.endsWith('-F') ? 'leak-mcp-in-F' : 'answer')));
    const r = await runAll({ out: tmp(), runner: leakOnce, clones: undefined, harness: tmp(), onlyTrees: IN_REPO });
    assert.ok(r.refused.some((x) => x.includes('re-run allowance spent')));
    assert.equal(r.rows.filter((x) => x.attempt === 2).length, 4);
    const leakTwice = new FakeModelRunner(script((sid) => (sid === 'P2-W1-F' ? 'leak-outside-tree' : 'answer')));
    const r2 = await runAll({ out: tmp(), runner: leakTwice, clones: undefined, harness: tmp(), onlyTrees: IN_REPO });
    assert.ok(r2.refused.some((x) => x.includes('the pilot stops')));
  });
  it('refuses to spawn past the hard cap', async () => {
    const runner = new FakeModelRunner(script(() => 'answer'));
    const r = await runAll({ out: tmp(), runner, clones: undefined, harness: tmp(), onlyTrees: IN_REPO, hardCap: 5 });
    assert.equal(runner.spawned.length, 5);
    assert.ok(r.refused.some((x) => x.includes('hard cap 5 reached')));
  });
  it('scores a cap hit 0 and a missing answer 0, and counts FG sessions without a graph call', async () => {
    const runner = new FakeModelRunner(script((sid) => (sid === 'P2-W1-F' ? 'over-turns' : sid === 'P2-O1-F' ? 'no-answer' : sid === 'P2-W1-FG' ? 'no-graph' : 'answer')));
    const r = await runAll({ out: tmp(), runner, clones: undefined, harness: tmp(), onlyTrees: ['p2-seed'] });
    const s = summarise(r.rows, null) as { capHits: string[]; formatFailures: string[]; fgSessionsWithoutGraphCall: number };
    assert.deepEqual(s.capHits, ['P2-W1-F: turns']);
    assert.deepEqual(s.formatFailures, ['P2-O1-F']);
    assert.equal(s.fgSessionsWithoutGraphCall, 1);
  });
});
