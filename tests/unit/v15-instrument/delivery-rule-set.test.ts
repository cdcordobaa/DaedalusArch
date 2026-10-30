/**
 * Blocking gate (2026-10-29, instrument v1.5.1): for each style, the rule ids the delivery hub delivers by push and by
 * pull are exactly the rule ids the final-study scorer runs (admitted + exploratory rows), all from the one rule list
 * (`src/v15-instrument/rule-set.ts`). The hub's two checks are wrapped (test seams) to record the rule ids each channel
 * runs, on a real edit and a real pull over the MCP socket. A rule added to the scorer alone (or to the hub alone)
 * fails it. Second part: a fixture violating each Hexagonal rule gets a hub finding of that rule on both channels.
 * Zero model calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkConsistency } from '../../../src/v15-instrument/consistency.js';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';
import { checkLayers } from '../../../src/v15-instrument/edit-gate/layers.js';
import { loadRules } from '../../../src/v15-instrument/graph.js';
import { RULE_LABELS, RULE_TEXT } from '../../../src/v15-instrument/rule-messages.js';
import { mirrorKeyOf, type MirrorAnswer, type MirrorJudge } from '../../../src/v15-instrument/mirror-sem.js';
import { cypherRules, frozenRules, INSTRUMENT_ID, scoredRules, type Style } from '../../../src/v15-instrument/rule-set.js';
import { HEXAGONAL_RULE_TIERS, RULE_TIERS } from '../../../src/scoring-engine/rule-tiers.js';
import { admittedRules as scorerAdmitted, exploratoryRules as scorerExploratory } from '../../../experiments/v15-study/score-study.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DUMMY = path.join(REPO, 'experiments', 'edit-gate', 'fixtures', 'dummy');
const MUSEUM = path.join(REPO, 'experiments', 'hcal-03', 'museum-loans');
const SOLAR = path.join(REPO, 'experiments', 'hcal-03', 'solar-coop');
const DENTAL = path.join(REPO, 'experiments', 'hcal-05', 'dental-lab');
const FX = path.join(REPO, 'tests', 'fixtures', 'v15-hub-rules');
const SEM = path.join(REPO, 'experiments', 'sem-mirror-dev', 'cases');

/** A minimal MCP client: newline-delimited JSON-RPC over the hub's socket. */
class Client {
  private buf = '';
  private readonly waiting = new Map<number, (v: unknown) => void>();
  private id = 0;
  private constructor(private readonly sock: net.Socket) {
    sock.on('data', (c: Buffer) => {
      this.buf += c.toString('utf8');
      let nl: number;
      while ((nl = this.buf.indexOf('\n')) >= 0) {
        const m = JSON.parse(this.buf.slice(0, nl)) as { id?: number };
        this.buf = this.buf.slice(nl + 1);
        if (typeof m.id === 'number') this.waiting.get(m.id)?.(m);
      }
    });
  }
  static async open(p: string): Promise<Client> {
    const sock = net.createConnection(p);
    await new Promise<void>((resolve) => sock.on('connect', () => resolve()));
    const c = new Client(sock);
    await c.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    sock.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
    return c;
  }
  request(method: string, params: unknown): Promise<{ result: { content: { text: string }[]; isError?: boolean; structuredContent?: { findings?: { rule: string; file: string; ruleText: string; why: string; fix: string; delivery: string }[] } } }> {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve as (v: unknown) => void);
      this.sock.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  call(name: string, args: Record<string, unknown> = {}) { return this.request('tools/call', { name, arguments: args }); }
  close(): void { this.sock.destroy(); }
}

const post = (cwd: string, file: string): string =>
  JSON.stringify({ session_id: 's', cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(cwd, file), content: 'x' } });
const pushedText = (reply: string): string => (reply === '' ? '' : (JSON.parse(reply) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext);

/** A hub whose two checks record the rule ids they are asked to run, per channel. */
function recordingHub(tmp: string, name: string) {
  const ran = { push: new Set<string>(), pull: new Set<string>() };
  const baselines = { push: new Set<string | undefined>(), pull: new Set<string | undefined>() };
  let channel: 'push' | 'pull' = 'push';
  const hub = new DeliveryHub(path.join(tmp, 'sock', `${name}.hook.sock`), path.join(tmp, 'sock', `${name}.mcp.sock`), path.join(tmp, `logs-${name}`), {
    check: async (o) => { for (const r of o.rules ?? []) ran[channel].add(r); baselines[channel].add(o.baseline); return checkConsistency(o); },
    checkLayers: async (o) => { for (const r of o.rules ?? []) ran[channel].add(r); return checkLayers(o); },
  });
  return { hub, ran, baselines, setChannel: (c: 'push' | 'pull'): void => { channel = c; } };
}

/** A stub model fact (zero calls): every candidate gets the same answer. */
function stubJudge(mirror: MirrorAnswer): MirrorJudge {
  const stats = { asked: 0, session: 0, disk: 0, calls: 0, misses: 0, errors: 0, callMs: 0 };
  return { stats, judge: async (c) => { stats.asked++; return { verdict: { mirror, reason: 'stub' }, key: mirrorKeyOf(c), from: 'call', ms: 0 }; } };
}

const scorerSet = (style: Style): string[] => [...new Set([...scorerAdmitted(style), ...scorerExploratory(style)])].sort();

describe('delivery hub rule set: push == pull == scored (blocking gate)', () => {
  let tmp: string;
  beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-ruleset-')); });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('the one list equals what the scorer module runs, and every v1.5 id has a Cypher file and a message', () => {
    const cypherIds = new Set(loadRules().map((r) => r.id));
    for (const style of ['ddd', 'hexagonal'] as const) {
      expect(scoredRules(style)).toEqual(scorerSet(style));
      expect([...cypherRules(style), ...frozenRules(style)].sort()).toEqual(scorerSet(style));
      for (const id of cypherRules(style)) expect(cypherIds.has(id)).toBe(true);
      for (const id of scoredRules(style)) { expect(RULE_LABELS[id]).toBeDefined(); expect(RULE_TEXT[id]).toBeDefined(); }
    }
    expect(INSTRUMENT_ID).toMatch(/^v1\.5\.4/);
  });

  const cases: [Style, string, string, string, string][] = [
    // style, seed, spec, edited file, the edit (copied over the seed's file)
    ['ddd', path.join(DUMMY, 'seed'), path.join(DUMMY, 'spec.yaml'), 'src/billing/application/SettleInvoices.ts', path.join(DUMMY, 'edits', 'SettleInvoices.violating.ts')],
    ['hexagonal', path.join(MUSEUM, 'base'), path.join(MUSEUM, 'base', 'spec.yaml'), 'src/adapters/in/http/loan.controller.ts', path.join(MUSEUM, 'cases', 'H03-pos1', 'src', 'adapters', 'in', 'http', 'loan.controller.ts')],
  ];
  it.each(cases)('%s: the rule ids run by push and by pull equal the scorer\'s set', async (style, seed, spec, file, edit) => {
    const { hub, ran, baselines, setChannel } = recordingHub(tmp, style);
    const work = path.join(tmp, `work-${style}`);
    fs.cpSync(seed, work, { recursive: true });
    await hub.start();
    try {
      await hub.setCell({ id: `gate-${style}`, session: null, step: 's1', turn: 't1', spec, project: work, baseline: seed });
      ran.push.clear(); baselines.push.clear(); // the warm-up check at setCell is not a channel
      expect(hub.delivered).toMatchObject({ style });
      fs.copyFileSync(edit, path.join(work, file));
      setChannel('push');
      await hub.handleHook(post(work, file));
      setChannel('pull');
      const client = await Client.open(path.join(tmp, 'sock', `${style}.mcp.sock`));
      const r = await client.call('check_consistency');
      client.close();
      expect(r.result.isError).not.toBe(true);
      expect([...ran.push].sort()).toEqual(scorerSet(style));
      expect([...ran.pull].sort()).toEqual(scorerSet(style));
      // v1.5.3: both channels' v1.5 checks take the session's seed (its copy) as the baseline, as the scorer does
      for (const ch of ['push', 'pull'] as const) {
        expect(baselines[ch].size).toBe(1);
        const b = [...baselines[ch]][0];
        expect(b).toBeDefined();
        expect(fs.readFileSync(path.join(b!, file), 'utf8')).toBe(fs.readFileSync(path.join(seed, file), 'utf8'));
      }
      // the frozen tools' answers are numbered for the same frozen rules
      expect([...hub.delivered!.frozen].sort()).toEqual(scorerSet(style).filter((x) => x.startsWith('FF-')));
    } finally {
      await hub.stop();
    }
  }, 180_000);
});

/**
 * Hexagonal: a violating fixture per rule (calibration cases, read-only, overlaid on their base). FF-S03 and FF-P02
 * are advisory under the Hexagonal tier table (`rule-tiers.ts`), so neither the scorer (blocking findings only) nor the
 * hub can ever report them; the test pins that set, so a tier change shows up here.
 */
describe('delivery hub: a fixture violating each Hexagonal rule produces a hub finding on both channels', () => {
  const FIXTURES: Record<string, [base: string, overlay: string, file: string]> = {
    'FF-S01': [MUSEUM, path.join(MUSEUM, 'cases', 'H01-pos1'), 'src/domain/loan-policy.ts'],
    'FF-S04': [MUSEUM, path.join(MUSEUM, 'cases', 'H01-pos1'), 'src/domain/loan-policy.ts'],
    'FF-P01': [MUSEUM, path.join(MUSEUM, 'cases', 'H01-pos2'), 'src/domain/condition-report.ts'],
    'FF-P03': [MUSEUM, path.join(FX, 'ff-p03'), 'src/adapters/out/courier/stub-courier.gateway.ts'],
    'R-INJ': [MUSEUM, path.join(MUSEUM, 'cases', 'H05-pos1'), 'src/application/request-loan.use-case.ts'],
    'R-AXA': [MUSEUM, path.join(MUSEUM, 'cases', 'H03-pos1'), 'src/adapters/in/http/loan.controller.ts'],
    'R-H5': [MUSEUM, path.join(MUSEUM, 'cases', 'H04-pos1'), 'src/application/ports/out/loan-repository.port.ts'],
    'R-ADAPTER-RULE': [SOLAR, path.join(SOLAR, 'cases', 'H06-pos1'), 'src/adapters/out/payment/payment-provider.gateway.ts'],
    'R-TRANSPORT': [MUSEUM, path.join(MUSEUM, 'cases', 'H07-pos1'), 'src/domain/insurance-declined.error.ts'],
    'R-LOCATOR': [MUSEUM, path.join(MUSEUM, 'cases', 'H08-pos1'), 'src/application/approve-loan.use-case.ts'],
    'R-COREIO': [MUSEUM, path.join(MUSEUM, 'cases', 'H09-pos1'), 'src/application/request-loan.use-case.ts'],
    'R-ENTITY-OUT': [MUSEUM, path.join(MUSEUM, 'cases', 'H10-pos1'), 'src/adapters/in/http/loan.controller.ts'],
    'R-MIRROR': [DENTAL, path.join(DENTAL, 'cases', 'H11-pos1'), 'src/domain/rescan-policy.ts'],
    'R-MIRROR2': [DENTAL, path.join(DENTAL, 'cases', 'H11-pos2'), 'src/application/scan-job-tracking.ts'],
    // v1.5.4, neuro-symbolic: the seed is the coarse twin, the edit brings the mirrored set; the model fact is a stub (yes)
    'R-MIRROR-SEM': [path.join(SEM, 'parcel-coarse', 'tree'), path.join(SEM, 'parcel-mirror', 'tree'), 'src/domain/parcel.ts'],
  };
  const tierOf = (id: string): string | undefined => [...HEXAGONAL_RULE_TIERS.values()].find((t) => t.ruleId === id)?.tier ?? (RULE_TIERS.get(id)?.tier as string | undefined);
  const advisory = scoredRules('hexagonal').filter((id) => id.startsWith('FF-') && tierOf(id) === 'advisory').sort();

  let tmp: string;
  let hub: DeliveryHub;
  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-hexrules-'));
    hub = new DeliveryHub(path.join(tmp, 'sock', 'h.sock'), path.join(tmp, 'sock', 'm.sock'), path.join(tmp, 'logs'), { mirrorJudge: () => stubJudge('yes') });
    await hub.start();
  });
  afterAll(async () => { await hub.stop(); fs.rmSync(tmp, { recursive: true, force: true }); });

  it('every Hexagonal rule has a fixture, except the advisory-tier frozen rules (pinned)', () => {
    expect(advisory).toEqual(['FF-P02', 'FF-S03']);
    expect(Object.keys(FIXTURES).sort()).toEqual(scoredRules('hexagonal').filter((r) => !advisory.includes(r)).sort());
  });

  it.each(Object.keys(FIXTURES).sort())('%s', async (rule) => {
    const [base, overlay, file] = FIXTURES[rule]!;
    const seed = fs.existsSync(path.join(base, 'base')) ? path.join(base, 'base') : base;
    const work = path.join(tmp, rule);
    fs.cpSync(seed, work, { recursive: true });
    fs.cpSync(overlay, work, { recursive: true });
    const spec = [path.join(work, 'spec.yaml'), path.join(seed, 'spec.yaml'), path.join(path.dirname(seed), 'spec.yaml')].find((f) => fs.existsSync(f))!;
    await hub.setCell({ id: rule, session: null, step: 's1', turn: 't1', spec, project: work, baseline: seed });
    const pushed = pushedText(await hub.handleHook(post(work, file)));
    expect(pushed).toMatch(/^Architecture check: /m);
    expect(hub.ledger!.table().some((x) => x.rule === rule && x.first.channel === 'push')).toBe(true);
    const client = await Client.open(path.join(tmp, 'sock', 'm.sock'));
    const r = await client.call('check_consistency');
    client.close();
    const mine = (r.result.structuredContent?.findings ?? []).filter((f) => f.rule === rule);
    expect(mine.length).toBeGreaterThan(0);
    for (const f of mine) {
      // the three message parts; the why names the code at file:line
      expect(f.ruleText.length).toBeGreaterThan(20);
      expect(f.why).toContain(`${f.file}:`);
      expect(f.fix.length).toBeGreaterThan(20);
    }
    // the pushed finding is the same identity on the pull side
    expect(mine.some((f) => f.delivery === 'already reported')).toBe(true);
    hub.closeCell();
  }, 120_000);
});
