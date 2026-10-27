/**
 * v1.5 combined delivery hub (design note §1.2, §4; step 2 "done when"): both channels on one ledger, over real Unix
 * sockets, on the edit-gate dummy fixture. Zero model calls: the "agent" is scripted hook events and a minimal
 * JSON-RPC client on the MCP socket.
 */
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const DUMMY = path.join(REPO, 'experiments', 'edit-gate', 'fixtures', 'dummy');
const SPEC = path.join(DUMMY, 'spec.yaml');
const VIOLATING = path.join(DUMMY, 'edits', 'SettleInvoices.violating.ts');
const TARGET = 'src/billing/application/SettleInvoices.ts';

let tmp: string;
let work: string;
let hub: DeliveryHub;
const hookSock = (): string => path.join(tmp, 'sock', 'hook.sock');
const mcpSock = (): string => path.join(tmp, 'sock', 'mcp.sock');

const post = (file: string, session = 's1', cwd = work): string =>
  JSON.stringify({ session_id: session, cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: file, content: 'x' } });
const stop = (session = 's1'): string => JSON.stringify({ session_id: session, cwd: work, hook_event_name: 'Stop', stop_hook_active: false });
const ctx = (reply: string): string => (JSON.parse(reply) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
const lines = (cell: string, kind: string): Record<string, unknown>[] =>
  fs.readFileSync(path.join(tmp, 'logs', `${cell}.${kind}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, unknown>);

/** A minimal MCP client: newline-delimited JSON-RPC over the socket. */
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
  request(method: string, params: unknown): Promise<{ result: { content: { text: string }[]; isError?: boolean; tools?: { name: string }[]; structuredContent?: Record<string, unknown> } }> {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.waiting.set(id, resolve as (v: unknown) => void);
      this.sock.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });
  }
  call(name: string, args: Record<string, unknown> = {}) { return this.request('tools/call', { name, arguments: args }); }
  close(): void { this.sock.destroy(); }
}

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-hub-'));
  work = path.join(tmp, 'work');
  fs.cpSync(path.join(DUMMY, 'seed'), work, { recursive: true });
  hub = new DeliveryHub(hookSock(), mcpSock(), path.join(tmp, 'logs'));
  await hub.start();
  await hub.setCell({ id: 'c1', session: 's1', step: 'step-01', turn: 't1', spec: SPEC, project: work });
}, 60_000);
afterAll(async () => {
  await hub.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('delivery hub: push and pull share one finding identity', () => {
  let client: Client;
  afterAll(() => client.close());

  it('push shows a new finding with its number', async () => {
    fs.copyFileSync(VIOLATING, path.join(work, TARGET));
    const reply = await hub.handleHook(post(path.join(work, TARGET)));
    expect(ctx(reply)).toMatch(/^Architecture check: .*\(finding 1\)$/m);
  }, 60_000);

  it('pull lists the tools and marks the pushed finding "already reported"', async () => {
    client = await Client.open(mcpSock());
    const tools = (await client.request('tools/list', {})).result.tools!.map((t) => t.name);
    expect(tools).toEqual(expect.arrayContaining(['check_consistency', 'check_file', 'check_diff']));
    const r = await client.call('check_consistency');
    expect(r.result.content[0]!.text).toMatch(/\(finding 1, already reported\)/);
    const calls = lines('c1', 'calls');
    expect(calls.at(-1)).toMatchObject({ channel: 'pull', tool: 'check_consistency', findings: [{ finding: 1, status: 'already reported' }] });
  }, 60_000);

  it('a pull outside the work tree is refused by the frozen confinement', async () => {
    const r = await client.call('check_consistency', { project: os.tmpdir() });
    expect(r.result.isError).toBe(true);
  }, 60_000);

  it('Stop blocks once per turn on the open finding', async () => {
    const first = await hub.handleHook(stop());
    expect((JSON.parse(first) as { decision: string; reason: string }).reason).toMatch(/1 finding still open[\s\S]*\(finding 1\)/);
    expect(await hub.handleHook(stop())).toBe('');
  }, 60_000);

  it('refuses events from another session or another cwd', async () => {
    expect(await hub.handleHook(post(path.join(work, TARGET), 'intruder'))).toBe('');
    expect(await hub.handleHook(post(path.join(work, TARGET), 's1', os.tmpdir()))).toBe('');
    const refusals = lines('c1', 'push').map((l) => l.refused).filter(Boolean);
    expect(refusals).toEqual(expect.arrayContaining(["not this cell's session", 'cwd outside the work tree']));
  }, 60_000);

  it('the fix is pushed as resolved with the same number, and the ledger attributes it', async () => {
    fs.copyFileSync(path.join(DUMMY, 'seed', TARGET), path.join(work, TARGET));
    const reply = await hub.handleHook(post(path.join(work, TARGET)));
    expect(ctx(reply)).toMatch(/^resolved: .*\(finding 1\)$/m);
    const row = hub.ledger!.table()[0]!;
    expect(row).toMatchObject({ number: 1, open: false, resolvedBy: 'push' });
    expect(row.exposures.map((e) => e.channel)).toEqual(['push', 'pull']);
    const pushes = lines('c1', 'push').filter((l) => l.event === 'PostToolUse' && l.refused === null);
    expect(pushes.map((l) => l.pushed)).toEqual([[1], []]);
  }, 60_000);
});
