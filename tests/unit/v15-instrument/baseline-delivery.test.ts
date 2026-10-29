/**
 * Instrument v1.5.3 (2026-10-29): the seed is the baseline of every v1.5 check, on the hub's two channels and in the
 * scorers, with one semantics. A rule that reads a baseline (today R-MIRROR2's stoplist, `vendor-lexicon.ts`) counts
 * what the seed already has as the project's own: a step that only keeps the seed's vendor-named code gets no
 * R-MIRROR2 finding from the hub (push, pull) or the study scorer (`scoreTreeV15`), and a step that adds a new vendor
 * literal gets the same one finding from all three (the seed's own four stay silent). Fixtures: HCAL-05 dental-lab base and its H11-pos2 case (an
 * application enum of the vendor's job-status codes), read-only. Zero model calls, no Neo4j.
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';
import { loadRules, runTree } from '../../../src/v15-instrument/graph.js';
import { cypherRules } from '../../../src/v15-instrument/rule-set.js';
import { scoreTreeV15 } from '../../../experiments/v15-study/score-study.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DENTAL = path.join(REPO, 'experiments', 'hcal-05', 'dental-lab');
const BASE = path.join(DENTAL, 'base');
const SPEC = path.join(BASE, 'spec.yaml');
const VENDOR_CASE = path.join(DENTAL, 'cases', 'H11-pos2');
const FILE = 'src/application/scan-job-tracking.ts';
const RULE = 'R-MIRROR2';

/** A minimal MCP client: newline-delimited JSON-RPC over the hub's socket. */
async function pull(sock: string): Promise<{ rule: string; file: string; delivery: string }[]> {
  const conn = net.createConnection(sock);
  await new Promise<void>((resolve) => conn.on('connect', () => resolve()));
  let buf = '';
  const waiting = new Map<number, (v: unknown) => void>();
  conn.on('data', (c: Buffer) => {
    buf += c.toString('utf8');
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const m = JSON.parse(buf.slice(0, nl)) as { id?: number };
      buf = buf.slice(nl + 1);
      if (typeof m.id === 'number') waiting.get(m.id)?.(m);
    }
  });
  const req = (id: number, method: string, params: unknown): Promise<unknown> => new Promise((resolve) => { waiting.set(id, resolve); conn.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`); });
  await req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
  conn.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);
  const r = (await req(2, 'tools/call', { name: 'check_consistency', arguments: {} })) as { result: { structuredContent?: { findings?: { rule: string; file: string; delivery: string }[] } } };
  conn.destroy();
  return r.result.structuredContent?.findings ?? [];
}

const post = (cwd: string, file: string): string =>
  JSON.stringify({ session_id: 's', cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(cwd, file), content: 'x' } });
const pushed = (reply: string): string => (reply === '' ? '' : (JSON.parse(reply) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext);

describe('instrument v1.5.3: the seed is the baseline of hub and scorer alike', () => {
  let tmp: string;
  let hub: DeliveryHub;
  const rules = loadRules().filter((r) => cypherRules('hexagonal').includes(r.id));
  beforeAll(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-baseline-'));
    hub = new DeliveryHub(path.join(tmp, 'sock', 'h.sock'), path.join(tmp, 'sock', 'm.sock'), path.join(tmp, 'logs'));
    await hub.start();
  });
  afterAll(async () => { await hub.stop(); fs.rmSync(tmp, { recursive: true, force: true }); });

  /** A seed that already has the vendor's job-status codes in an application enum (base + H11-pos2). */
  function vendorSeed(): string {
    const seed = path.join(tmp, 'seed-vendor');
    if (!fs.existsSync(seed)) { fs.cpSync(BASE, seed, { recursive: true }); fs.cpSync(VENDOR_CASE, seed, { recursive: true }); }
    return seed;
  }

  /** Hub push (after an edit of FILE) and pull, and the scorer, on `work` with `seed` as the session's seed. */
  async function allThree(id: string, seed: string, work: string): Promise<{ push: number; pull: number; scorer: number; strict: number }> {
    await hub.setCell({ id, session: null, step: 's1', turn: 't1', spec: SPEC, project: work, baseline: seed });
    try {
      const text = pushed(await hub.handleHook(post(work, FILE)));
      const pushedMirror = hub.ledger!.table().filter((x) => x.rule === RULE && x.first.channel === 'push').length;
      if (pushedMirror > 0) expect(text).toMatch(/^Architecture check: /m);
      const pulled = (await pull(path.join(tmp, 'sock', 'm.sock'))).filter((f) => f.rule === RULE);
      const scored = (await scoreTreeV15(work, rules, SPEC, path.join(tmp, `_s-${id}`), seed)).findings.filter((f) => f.rule === RULE && f.status === 'violation');
      const strict = (await runTree(work, rules, { spec: SPEC, scratch: path.join(tmp, `_t-${id}`), withApg: false })).findings.filter((f) => f.rule === RULE && f.status === 'violation');
      return { push: pushedMirror, pull: pulled.length, scorer: new Set(scored.map((f) => `${f.file}|${f.subject}`)).size, strict: strict.length };
    } finally {
      hub.closeCell();
    }
  }

  it('the seed already has the vendor-named code and the step adds nothing new: 0 findings from hub and scorer', async () => {
    const seed = vendorSeed();
    const work = path.join(tmp, 'work-a');
    fs.cpSync(seed, work, { recursive: true });
    fs.appendFileSync(path.join(work, FILE), '\n// the step touches the file but adds no new term\n');
    const n = await allThree('a', seed, work);
    expect(n.strict).toBeGreaterThan(0); // not vacuous: without the seed as baseline the rule fires
    expect(n).toMatchObject({ push: 0, pull: 0, scorer: 0 });
  }, 180_000);

  it('the step adds a new vendor literal to the same seed: the same 1 finding from hub push, hub pull and scorer', async () => {
    const seed = vendorSeed(); // its four vendor status codes stay silent
    const work = path.join(tmp, 'work-b');
    fs.cpSync(seed, work, { recursive: true });
    fs.appendFileSync(path.join(work, FILE), "\nexport const RESCAN_GRADE = 'SF_LOW_RES';\n");
    const n = await allThree('b', seed, work);
    expect(n).toMatchObject({ push: 1, pull: 1, scorer: 1, strict: 5 });
  }, 180_000);
});
