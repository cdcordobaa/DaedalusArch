/**
 * DRIFT-01 unit tests (zero calls): v1.5 identities, command renames, the exposure counter, and the run plan.
 *   npx tsx experiments/drift-01/test/unit.ts [--out <file.json>]
 */
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import type { CommandFact, RootInfo } from '../../detect-02/lib/facts.js';
import type { Finding } from '../../detect-02/lib/graph.js';
import { keysFor } from '../../../scripts/lib/drift/identity.js';
import { driftRun } from '../../../scripts/lib/drift/study2-d.js';
import { STUDY2_S2D01 } from '../../../scripts/lib/drift/types.js';
import { v15Exposure, v15Identities, withCommandRenames } from '../lib/v15-identity.js';
import { buildPlan, type PlanInput } from '../plan.js';

const root = (name: string, file: string, context: string | null): RootInfo => ({ name, file, line: 1, context, declared: true, module: file });
const write = (r: string, line = 10) => ({ root: r, instance: `x:${r}`, many: false, file: 'src/a/application/Cmd.ts', line, sink: 'Repo.save', sinkSite: '', via: [], inScope: false });
const cmd = (name: string, file: string, context: string, writes: ReturnType<typeof write>[], extra: Partial<CommandFact> = {}): CommandFact => ({ id: `${file}#${name}`, name, file, line: 5, context, eventHandler: false, published: false, writes, delegatesTo: [], ...extra });
const finding = (rule: string, file: string, subject: string, status: Finding['status'] = 'violation'): Finding => ({ rule, family: 'D4', file, line: 5, subject, evidence: '', path: [], status });

const roots = [root('Invoice', 'src/billing/domain/Invoice.ts', 'billing'), root('Order', 'src/ordering/domain/Order.ts', 'ordering')];
const pay = cmd('RecordPayment.execute', 'src/billing/application/RecordPayment.ts', 'billing', [write('Invoice'), write('Order', 12)]);
const results: { name: string; ok: boolean; error?: string }[] = [];
const test = (name: string, fn: () => void): void => {
  try { fn(); results.push({ name, ok: true }); } catch (e) { results.push({ name, ok: false, error: e instanceof Error ? e.message : String(e) }); }
};

test('R-D4 gives one edge per written root; R-XCTX only the foreign root; the two share the foreign edge', () => {
  const ids = v15Identities([finding('R-D4', pay.file, pay.name), finding('R-XCTX', pay.file, pay.name)], { roots, commands: [pay] });
  const keys = new Set(ids.flatMap((f) => keysFor(f, STUDY2_S2D01)));
  assert.deepEqual([...keys].sort(), ['src/billing/application/RecordPayment.ts#RecordPayment.execute|src/billing/domain/Invoice.ts', 'src/billing/application/RecordPayment.ts#RecordPayment.execute|src/ordering/domain/Order.ts']);
});

test('an allowed or info finding is never an identity; other rules are ignored', () => {
  assert.equal(v15Identities([finding('R-D4', pay.file, pay.name, 'allowed'), finding('R-D4', pay.file, pay.name, 'info'), finding('R-D5', pay.file, pay.name)], { roots, commands: [pay] }).length, 0);
});

test('v1.5 edges never merge with a frozen import edge between the same files', () => {
  const ids = v15Identities([finding('R-XCTX', pay.file, pay.name)], { roots, commands: [pay] });
  const imp = keysFor({ functionId: 'FF-DS02', filePath: pay.file, target: 'src/ordering/domain/Order.ts' }, STUDY2_S2D01);
  assert.ok(!ids.flatMap((f) => keysFor(f, STUDY2_S2D01)).some((k) => imp.includes(k)));
});

test('an unresolvable command keeps one pseudo edge', () => {
  const ids = v15Identities([finding('R-D4', 'src/x.ts', 'X.run')], { roots, commands: [] });
  assert.equal(ids.length, 1);
  assert.equal(ids[0]?.target, 'src/x.ts.unresolved.ts');
});

test('a renamed command file keeps its v1.5 lineage (D = 0, not 1)', () => {
  const before = v15Identities([finding('R-D4', pay.file, pay.name)], { roots, commands: [pay] });
  const moved = cmd(pay.name, 'src/billing/app/RecordPayment.ts', 'billing', pay.writes);
  const after = v15Identities([finding('R-D4', moved.file, moved.name)], { roots, commands: [moved] });
  const rho = withCommandRenames(new Map([[pay.file, moved.file]]), before);
  const snap = (id: string, findings: typeof before) => ({ id, contextId: 'c', ok: true, findings });
  const d = driftRun([{ step: 1, final: snap('1', before) }, { step: 2, final: snap('2', after), rename: rho }, { step: 3, final: snap('3', after) }, { step: 4, final: snap('4', after) }, { step: 5, final: snap('5', after) }], STUDY2_S2D01);
  assert.equal(d.D, 0);
  const noRho = driftRun([{ step: 1, final: snap('1', before) }, { step: 2, final: snap('2', after), rename: new Map([[pay.file, moved.file]]) }, { step: 3, final: snap('3', after) }, { step: 4, final: snap('4', after) }, { step: 5, final: snap('5', after) }], STUDY2_S2D01);
  assert.equal(noRho.D, 2);
});

test('exposure: writing commands are opportunities; handlers and same-site delegates are not; flagged ones count', () => {
  const handler = cmd('OnPaid.handle', 'src/ordering/application/OnPaid.ts', 'ordering', [write('Order')], { eventHandler: true });
  const inner = cmd('Place.run', 'src/ordering/application/Place.ts', 'ordering', [write('Order', 20)]);
  const outer = cmd('Place.execute', 'src/ordering/application/Place.ts', 'ordering', [write('Order', 20)], { delegatesTo: [inner.id] });
  const reader = cmd('Report.get', 'src/ordering/application/Report.ts', 'ordering', []);
  const e = v15Exposure([finding('R-D4', pay.file, pay.name), finding('R-XCTX', pay.file, pay.name)], { commands: [pay, handler, inner, outer, reader] });
  assert.equal(e.opportunities, 2);
  assert.equal(e.violations, 1);
});

test('plan: 2 tasks x 3 reps = 6 shared step-1 sessions and 18 arm sessions, 78 turns, arms interleaved per replicate', () => {
  const input: PlanInput = { tasks: [{ id: 't1', steps: 5 }, { id: 't2', steps: 5 }], replicates: 3, arms: ['none', 'pull', 'gate'], orderSeed: 20261023 };
  const p = buildPlan(input);
  assert.equal(p.filter((s) => s.kind === 'shared').length, 6);
  assert.equal(p.filter((s) => s.kind === 'arm').length, 18);
  assert.equal(p.reduce((a, s) => a + s.steps.length, 0), 78);
  for (const s of p.filter((x) => x.kind === 'arm')) {
    const shared = p.find((x) => x.kind === 'shared' && x.taskId === s.taskId && x.rep === s.rep);
    assert.ok(shared !== undefined && p.indexOf(shared) < p.indexOf(s), 'shared step 1 runs before its arms');
    assert.deepEqual(s.steps, [2, 3, 4, 5]);
  }
  assert.equal(new Set(p.map((s) => s.id)).size, p.length);
  assert.deepEqual(buildPlan(input), p, 'deterministic');
});

const failed = results.filter((r) => !r.ok);
for (const r of results) process.stdout.write(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.error ? `: ${r.error}` : ''}\n`);
const i = process.argv.indexOf('--out');
if (i >= 0) fs.writeFileSync(process.argv[i + 1] as string, `${JSON.stringify({ schema: 'drift-01-unit/v1', passed: results.length - failed.length, failed: failed.length, results }, null, 2)}\n`);
process.exitCode = failed.length > 0 ? 1 : 0;
