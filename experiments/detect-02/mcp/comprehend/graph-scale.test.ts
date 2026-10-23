/**
 * GRAPH-SCALE (v1.5-exp, U1 groundwork) unit tests: fixes (a)–(e) on the committed tree
 * `experiments/detect-02/fixtures/graph-scale/tree`, plus the DETECT-02 trees the tools already used (no change there).
 * Zero model calls. Run: `npx tsx --test experiments/detect-02/mcp/comprehend/graph-scale.test.ts`
 */
import { strict as assert } from 'node:assert';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { importTypeEdges, importTypeSpecifiers } from '../../lib/import-types.js';
import { writeTsconfig } from '../../lib/graph.js';
import { buildIndex } from './index.js';
import { isWriteMember } from './entities.js';
import { callers, callerSites, impact, ToolInputError, trace, whoWrites } from './tools.js';

const TREE = 'experiments/detect-02/fixtures/graph-scale/tree';
const ix = buildIndex(TREE);
const edges = [...ix.calls.values()].flat();
const P1 = { tree: 'experiments/puzzle-01/puzzles/p1-transfers/seed', spec: 'experiments/puzzle-01/puzzles/p1-transfers/spec.yaml' };

describe('(a) factory and callback units', () => {
  it('a module-level const built by a factory taking a callback is a unit named after the const', () => {
    assert.ok(ix.units.has('src/flows/steps.ts#saveUserStep'));
    assert.ok(ix.units.has('src/flows/register-flow.ts#registerFlow'));
  });
  it('the callback\'s calls are attributed to that unit, and a call to the const resolves to it', () => {
    assert.ok(edges.some((e) => e.from === 'src/flows/steps.ts#saveUserStep' && e.to === 'src/repo/base.repository.ts#BaseRepository.create'));
    assert.ok(edges.some((e) => e.from === 'src/flows/register-flow.ts#registerFlow' && e.to === 'src/flows/steps.ts#saveUserStep'));
  });
  it('trace follows a workflow into its steps', () => {
    const t = trace(ix, 'registerFlow', { full: true });
    const names: string[] = [];
    const walk = (s: typeof t.root): void => { names.push(s.unit); s.children.forEach(walk); };
    walk(t.root);
    assert.deepEqual(names, ['registerFlow', 'saveUserStep', 'BaseRepository.create']);
  });
  it('a plain const (no callback argument) is not a unit', () => {
    assert.equal(ix.units.has('src/models/product.ts#Product'), false);
  });
});

describe('(b) receiver-aware calls and overloads', () => {
  it('an inherited member records the receiver\'s class on the edge', () => {
    const creates = edges.filter((e) => e.from === 'src/app/register-user.ts#RegisterUser.execute' && e.to.endsWith('BaseRepository.create'));
    assert.deepEqual(creates.map((e) => e.receiver).sort(), ['src/repo/job.repository.ts#JobRepository', 'src/repo/user.repository.ts#UserRepository']);
  });
  it('every member call is kept with its declaring owner and receiver, also when it reaches no unit', () => {
    const mc = ix.memberCalls.find((m) => m.unit === 'src/flows/steps.ts#createProductsStep' && m.member === 'IProductModuleService.createProducts');
    assert.ok(mc);
    assert.equal(mc.owner, 'src/models/product.ts#IProductModuleService');
  });
  it('a call to an overloaded method resolves to the implementation', () => {
    assert.ok(edges.some((e) => e.from === 'src/app/catalog.ts#Catalog.addDefaults' && e.to === 'src/app/catalog.ts#Catalog.add'));
  });
});

describe('(c) callers', () => {
  it('lists callers through the port and through its implementation', () => {
    const c = callers(ix, 'Notifier');
    assert.deepEqual(c.callers.shown.map((r) => [r.unit, r.sites.map((s) => s.how).join()]), [['RegisterUser.execute', 'port'], ['remind', 'implementation']]);
    assert.deepEqual(c.implementations.shown, ['src/adapters/email-notifier.ts#EmailNotifier']);
  });
  it('counts an inherited member only when the receiver is the type or a subtype', () => {
    const c = callerSites(ix, 'PermissionsService');
    assert.deepEqual(c.sites.map((s) => [s.at, s.how]), [['src/app/register-user.ts:10', 'inherited']]);
    const u = callerSites(ix, 'UserRepository');
    assert.equal(u.sites.some((s) => s.at === 'src/app/register-user.ts:12'), false, 'jobs.create is not a UserRepository call');
    assert.ok(u.sites.some((s) => s.at === 'src/app/register-user.ts:11' && s.how === 'inherited'));
  });
  it('narrows to one member, takes file#Type, and refuses unknown names', () => {
    assert.deepEqual(callerSites(ix, 'src/repo/user.repository.ts#UserRepository.rename').sites.map((s) => s.at), ['src/app/register-user.ts:20']);
    assert.throws(() => callers(ix, 'Nope'), ToolInputError);
    assert.throws(() => callers(ix, 'Notifier.nope'), ToolInputError);
  });
});

describe('(d) inferred entities and who_writes', () => {
  it('finds entities from a base repository, a schema definition and an ORM decorator, all labelled inferred', () => {
    const got = ix.entities.map((e) => [e.name, e.source, e.evidence.map((v) => v.kind).join()]);
    assert.deepEqual(got, [['Invoice', 'inferred', 'orm-decorator'], ['JobEntity', 'inferred', 'base-repository'], ['Product', 'inferred', 'schema'], ['UserEntity', 'inferred', 'base-repository']]);
  });
  it('who_writes lists the units writing through the entity\'s repository, receiver-aware (no JobRepository write, no read)', () => {
    const w = whoWrites(ix, 'UserEntity');
    assert.equal(w.basis, 'entity stores');
    assert.equal(w.source, 'inferred');
    assert.deepEqual(w.writers.shown.map((r) => r.writes.map((x) => x.at)).flat(), ['src/app/register-user.ts:11', 'src/app/register-user.ts:20', 'src/flows/steps.ts:9', 'src/repo/user.repository.ts:6']);
    assert.ok(w.notes.some((n) => n.includes('inferred entity')));
  });
  it('a schema entity is written through store members named after it, not through its other members', () => {
    const w = whoWrites(ix, 'Product');
    assert.deepEqual(w.writers.shown.map((r) => [r.command, r.writes.map((x) => x.store).join()]), [['createProductsStep', 'IProductModuleService.createProducts']]);
  });
  it('a write member is a mutation verb or a command shape', () => {
    assert.equal(isWriteMember({ name: 'createTask', params: 1, returnsNothing: false, line: 1 }), true);
    assert.equal(isWriteMember({ name: 'heartbeatTask', params: 1, returnsNothing: true, line: 1 }), true);
    assert.equal(isWriteMember({ name: 'getTask', params: 1, returnsNothing: false, line: 1 }), false);
    assert.equal(isWriteMember({ name: 'shutdown', params: 0, returnsNothing: true, line: 1 }), false);
  });
  it('declared aggregates keep the footprint answer (P1, unchanged)', () => {
    const w = whoWrites(buildIndex(P1.tree, { spec: P1.spec }), 'Account');
    assert.equal(w.basis, 'footprint');
    assert.deepEqual(w.writers.shown.map((c) => c.command), ['Deposit.execute', 'OpenAccount.execute', 'Withdraw.execute']);
  });
  it('an unknown name lists the inferred entities too', () => {
    assert.throws(() => whoWrites(ix, 'Nope'), (e: unknown) => e instanceof ToolInputError && /inferred entities: .*UserEntity/.test(e.message));
  });
});

describe('(e) inline import types', () => {
  it('finds the specifier of an inline import type', () => {
    assert.deepEqual(importTypeSpecifiers('x.ts', 'let a: import("./b").B; let c = import("./d");'), [{ specifier: './b', line: 1 }]);
  });
  it('resolves it to a file edge and adds it to the import graph', async () => {
    const tsconfig = writeTsconfig(TREE, path.join(process.env.TMPDIR ?? '/tmp', 'graph-scale-test'));
    assert.deepEqual(importTypeEdges(TREE, tsconfig).map((e) => [e.source, e.target]), [['src/refs.ts', 'src/ports/notifier.ts']]);
    assert.deepEqual(ix.imports.get('src/refs.ts'), ['src/ports/notifier.ts']);
    assert.equal(ix.importTypeEdges, 1);
    const i = await impact(ix, 'src/ports/notifier.ts');
    assert.ok(i.importers.shown.includes('src/refs.ts'));
  });
});
