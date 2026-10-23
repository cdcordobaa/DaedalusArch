/**
 * Unit tests of the COMPREHEND-01 graph tools on committed trees (puzzle seeds and a DETECT-02 precision fixture).
 * Zero model calls. Run: `npx tsx --test experiments/detect-02/mcp/comprehend/tools.test.ts`
 */
import { strict as assert } from 'node:assert';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildIndex } from './index.js';
import { contextMap, impact, ToolInputError, trace, whoWrites } from './tools.js';
import type { TraceStep } from './tools.js';
import { COMPREHEND_TOOLS, createComprehendServer, GRAPH_SCALE_TOOLS } from '../comprehend-server.js';
import { contextFrom } from '../server.js';

const PUZ = 'experiments/puzzle-01/puzzles';
const P1 = { tree: `${PUZ}/p1-transfers/seed`, spec: `${PUZ}/p1-transfers/spec.yaml` };
const P2 = { tree: `${PUZ}/p2-loyalty/seed`, spec: `${PUZ}/p2-loyalty/spec.yaml` };
const P4 = { tree: `${PUZ}/p4-library-holds/seed`, spec: `${PUZ}/p4-library-holds/spec.yaml` };
const FX = 'experiments/detect-02/fixtures/precision/p08-read-only-cross-context';
const P8POS = { tree: `${FX}/positive`, spec: `${FX}/spec.yaml` };
const P8LEGIT = { tree: `${FX}/legit`, spec: `${FX}/spec.yaml` };

const ix2 = buildIndex(P2.tree, { spec: P2.spec });
const steps = (s: TraceStep): TraceStep[] => [s, ...s.children.flatMap(steps)];

describe('context_map', () => {
  it('lists the declared contexts and the owner of each aggregate (P2)', () => {
    const m = contextMap(ix2);
    assert.deepEqual(m.contexts.map((c) => [c.name, c.source]), [['membership', 'declared'], ['sales', 'declared']]);
    assert.deepEqual(m.aggregates.map((a) => [a.name, a.context, a.source]).sort(), [['Member', 'membership', 'declared'], ['Order', 'sales', 'declared']]);
    assert.ok(m.contexts.find((c) => c.name === 'membership')!.published.includes('src/membership/index.ts'));
    assert.equal(m.aggregatesFrom, 'spec');
  });
  it('says when there is nothing to map (P4, Layered, no DDD block)', () => {
    const m = contextMap(buildIndex(P4.tree, { spec: P4.spec }));
    assert.equal(m.aggregates.length, 0);
    assert.equal(m.aggregatesFrom, 'none');
    assert.ok(m.notes.some((n) => n.includes('who_writes')));
  });
});

describe('who_writes', () => {
  it('lists the commands that save an aggregate, with the store and the chain (P1)', () => {
    const w = whoWrites(buildIndex(P1.tree, { spec: P1.spec }), 'Account');
    assert.deepEqual(w.writers.shown.map((c) => c.command), ['Deposit.execute', 'OpenAccount.execute', 'Withdraw.execute']);
    const d = w.writers.shown[0]!;
    assert.equal(d.writes[0]!.at, 'src/ledger/application/Deposit.ts:13');
    assert.equal(d.writes[0]!.store, 'AccountRepository.save');
    assert.deepEqual(d.writes[0]!.chain, ['Deposit.execute', 'AccountRepository.save']);
    assert.equal(d.crossContext, false);
  });
  it('flags a cross-context write through a published interface (P8 positive) and not the read-only twin', () => {
    const pos = whoWrites(buildIndex(P8POS.tree, { spec: P8POS.spec }), 'Member');
    const place = pos.writers.shown.find((c) => c.command === 'PlaceOrder.execute');
    assert.ok(place, 'PlaceOrder writes Member');
    assert.equal(place.crossContext, true);
    assert.equal(place.context, 'sales');
    assert.ok(place.writes[0]!.chain.includes('{}.awardPoints'));
    const legit = whoWrites(buildIndex(P8LEGIT.tree, { spec: P8LEGIT.spec }), 'Member');
    assert.equal(legit.writers.shown.some((c) => c.command === 'PlaceOrder.execute'), false);
  });
  it('matches the aggregate name case-insensitively and refuses an unknown one', () => {
    assert.equal(whoWrites(ix2, 'order').aggregate, 'Order');
    assert.throws(() => whoWrites(ix2, 'Invoice'), (e: unknown) => e instanceof ToolInputError && /known aggregate roots: .*Member/.test(e.message));
  });
});

describe('trace', () => {
  it('crosses ports to adapters, with the reads and writes at each step (P2 PlaceOrder)', () => {
    const t = trace(ix2, 'PlaceOrder.execute');
    assert.equal(t.isCommand, true);
    assert.equal(t.context, 'sales');
    assert.deepEqual(t.writes.map((w) => [w.aggregate, w.at, w.store]), [['Order', 'src/sales/application/PlaceOrder.ts:26', 'OrderRepository.save']]);
    const all = steps(t.root);
    const acl = all.find((s) => s.unit === 'MembershipDirectory.exists');
    assert.ok(acl, 'the ACL adapter behind the MemberDirectory port is on the chain');
    assert.equal(acl.via, 'interface');
    assert.equal(acl.port, 'MemberDirectory.exists');
    const read = t.reads.find((r) => r.aggregates.includes('Member'));
    assert.ok(read, 'the membership read is seen');
    assert.deepEqual(read.path, ['PlaceOrder.execute', 'MembershipDirectory.exists', '{}.card', 'GetMemberCard.execute']);
    assert.ok(all.some((s) => s.unit === 'InMemoryOrderRepository.save' && s.via === 'interface'));
  });
  it('hides helper steps by default and shows them with full', () => {
    const lean = trace(ix2, 'PlaceOrder.execute');
    const full = trace(ix2, 'PlaceOrder.execute', { full: true });
    assert.ok(full.nodes > lean.nodes);
    assert.ok(lean.hidden > 0);
    assert.equal(steps(lean.root).some((s) => s.unit.startsWith('Money.')), false);
  });
  it('accepts file#Class.method and rejects an unknown command', () => {
    assert.equal(trace(ix2, 'src/sales/application/PlaceOrder.ts#PlaceOrder.execute').command, 'PlaceOrder.execute');
    assert.throws(() => trace(ix2, 'Nope.execute'), ToolInputError);
  });
});

describe('impact', () => {
  it('lists importers, reaching commands and the rules at risk for an aggregate file (P2 Order.ts)', async () => {
    const i = await impact(ix2, 'src/sales/domain/order/Order.ts');
    assert.deepEqual(i.importers.shown, ['src/sales/application/PlaceOrder.ts', 'src/sales/domain/order/OrderRepository.ts', 'src/sales/infrastructure/InMemoryOrderRepository.ts']);
    assert.deepEqual(i.kind, ['aggregate']);
    assert.equal(i.layer, 'domain');
    assert.deepEqual(i.rulesAtRisk.map((r) => r.rule), ['R-D5', 'R-D9']);
    assert.ok(i.commands.shown.some((c) => c.command === 'PlaceOrder.execute'));
  });
  it('reports a current finding on the file (P8 positive, PlaceOrder)', async () => {
    const i = await impact(buildIndex(P8POS.tree, { spec: P8POS.spec }), 'src/sales/application/PlaceOrder.ts');
    assert.ok(i.rulesAtRisk.some((r) => r.rule === 'R-XCTX' && r.source === 'finding'));
    assert.ok(i.currentFindings.some((f) => f.rule === 'R-D4'));
  });
  it('resolves a symbol to the files that reference it', async () => {
    const i = await impact(ix2, 'src/membership/index.ts#MembershipModule');
    assert.deepEqual(i.references?.shown, ['src/sales/acl/MembershipDirectory.ts']);
    assert.equal(i.symbol, 'MembershipModule');
  });
  it('refuses an unknown file', async () => {
    await assert.rejects(() => impact(ix2, 'src/nowhere.ts'), ToolInputError);
  });
});

describe('determinism', () => {
  it('two builds of the same tree give the same answers', () => {
    const a = buildIndex(P2.tree, { spec: P2.spec });
    const strip = (x: unknown): string => JSON.stringify(x);
    assert.equal(strip(contextMap(a)), strip(contextMap(ix2)));
    assert.equal(strip(whoWrites(a, 'Member')), strip(whoWrites(ix2, 'Member')));
    assert.equal(strip(trace(a, 'PlaceOrder.execute')), strip(trace(ix2, 'PlaceOrder.execute')));
  });
});

describe('MCP layer', () => {
  const connect = async (argv: string[], withCallers = false): Promise<Client> => {
    const server = createComprehendServer(contextFrom(argv, {}), { withCallers });
    const [a, b] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'comprehend-test', version: '0' });
    await Promise.all([server.connect(a), client.connect(b)]);
    return client;
  };
  it('serves exactly the four tools and answers through the protocol', async () => {
    const c = await connect(['--spec', P2.spec, '--project', P2.tree, '--engine', 'cypher-interp', '--confine']);
    const names = (await c.listTools()).tools.map((t) => t.name).sort();
    assert.deepEqual(names, [...COMPREHEND_TOOLS].sort());
    const r = await c.callTool({ name: 'who_writes', arguments: { aggregate: 'Order' } });
    assert.notEqual(r.isError, true);
    assert.match((r.content as { text: string }[])[0]!.text, /PlaceOrder\.execute/);
    const bad = await c.callTool({ name: 'who_writes', arguments: { aggregate: 'Invoice' } });
    assert.equal(bad.isError, true);
    await c.close();
  });
  it('serves callers as a fifth tool with withCallers (GRAPH-SCALE)', async () => {
    const c = await connect(['--spec', P2.spec, '--project', P2.tree, '--engine', 'cypher-interp', '--confine'], true);
    assert.deepEqual((await c.listTools()).tools.map((t) => t.name).sort(), [...GRAPH_SCALE_TOOLS].sort());
    const cr = await c.callTool({ name: 'callers', arguments: { port_or_method: 'OrderRepository' } });
    assert.notEqual(cr.isError, true);
    assert.match((cr.content as { text: string }[])[0]!.text, /PlaceOrder\.execute/);
    await c.close();
  });
  it('refuses another project under --confine', async () => {
    const c = await connect(['--spec', P2.spec, '--project', P2.tree, '--engine', 'cypher-interp', '--confine']);
    const r = await c.callTool({ name: 'context_map', arguments: { project: path.resolve(P1.tree) } });
    assert.equal(r.isError, true);
    await c.close();
  });
});
