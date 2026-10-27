/**
 * F11 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P5 oracle (`experiments/puzzle-03/puzzles/p5-ferry-seats/oracle.ts`): the same runtime method, with
 * its own marina scenario, aggregate roots, courier and one sub-goal per step.
 *
 * The rule (ARCHITECTURE.md 1): a command changes and saves one aggregate; an aggregate of the other context follows
 * through an event that context reacts to. The oracle runs a fixed season through the tree's `createApp` and records
 * every change of a `Pontoon` (context berthing) and a `Membership` (context membership) with the call stack, using
 * the PUZZLE-03 tracer (`../../puzzle-03/tools/runtime-trace.ts`: a prototype method of the root that leaves the
 * instance different, or a write-named method, such as `put`, of a store class under the context folder). A change
 * of the other context's aggregate, during a call started by one context, passes only when the courier
 * (`src/bus/Courier.ts`, `dispatchOutstanding`) delivered it and no frame of the starting context is a caller of that
 * dispatch. Frames of the starting context inside the dispatch are a listener the courier called, which is allowed
 * wherever its file lives.
 * SG1 (seasonal-contract): during `signContract`, the membership command never changes a pontoon.
 * SG2 (storm-closure): during `closePontoon`, the berthing command never changes a membership.
 * SG3 (resign): during `resign`, the membership command never changes a pontoon.
 * A write placed in the composition root (`src/main.ts`) during a command but outside the dispatch fails ("no
 * delivery on the stack"), as do a renamed write, a "batch" store call and a listener run directly inside the command.
 * Calls the tree does not have yet (the seed has no closePontoon or resign) are skipped. An aggregate root class that
 * cannot be found fails every sub-goal with that reason (not checkable; hand read).
 *
 * Limits (stated, not hidden): only the scenario's paths are exercised (a write on a path the scenario does not take
 * is not seen); the roots must stay at the declared files with the declared class names; a store is seen only when its
 * class name ends in Repository / Repo / Store / UnitOfWork / Database / Db and it lives under the context's folder; a
 * courier rewritten to run listeners before the command writes its change, or a second `dispatchOutstanding` in
 * `src/bus/Courier.ts` called from outside the context folders, is not separated from the seed's; a change by direct
 * field assignment from outside the root's prototype methods is seen only through a store write; the oracle judges
 * where a write happens, not where the fit, fee or credit rules sit (ARCHITECTURE.md 3 is not checked). Every failure
 * on an agent tree is hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f11-ddd-marina/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';
import { Tracer, type Change, type Frame } from '../../puzzle-03/tools/runtime-trace';

interface App {
  addPontoon(name: string, berthLengthsM: number[]): string;
  moorVisitor(pontoonId: string, boatName: string, boatLengthM: number): number;
  join(owner: string, boatName: string, boatLengthM: number): string;
  payFees(memberId: string, amount: number): void;
  signContract(memberId: string, pontoonId: string): void;
  closePontoon?(pontoonId: string): void;
  resign?(memberId: string): string;
}

const COURIER = 'src/bus/Courier.ts';

/** Changes of the other context's aggregate during `call` that the courier did not deliver after the command. */
function outsideDelivery(changes: readonly Change[], call: string, initiator: string): string[] {
  const out: string[] = [];
  const where = (f: Frame): string => `${f.file}:${String(f.line)} ${f.fn}`;
  for (const c of changes) {
    if (c.call !== call || c.context === initiator) continue;
    const d = c.frames.findIndex((f) => f.file === COURIER && /dispatchOutstanding/.test(f.fn));
    const callers = (d < 0 ? c.frames : c.frames.slice(d + 1)).filter((f) => f.file.startsWith(`src/${initiator}/`));
    const root = c.frames.filter((f) => f.file === 'src/main.ts');
    if (d < 0) {
      const inside = callers.length > 0 ? `, inside ${where(callers[callers.length - 1]!)}` : root.length > 0 ? `, in the composition root ${where(root[0]!)}` : '';
      out.push(`${call}: ${c.what} (${c.context}) changed with no delivery on the stack${inside}`);
    } else if (callers.length > 0) {
      out.push(`${call}: ${c.what} (${c.context}) changed in a delivery started inside ${where(callers[callers.length - 1]!)}`);
    }
  }
  return [...new Set(out)];
}

async function main(): Promise<number> {
  const treeArg = process.argv[2];
  if (treeArg === undefined) {
    process.stderr.write('usage: oracle.ts <tree>\n');
    return 2;
  }
  const t = new Tracer(path.resolve(treeArg));
  await t.hook([
    { context: 'berthing', file: 'src/berthing/domain/pontoon/Pontoon.ts', className: 'Pontoon' },
    { context: 'membership', file: 'src/membership/domain/membership/Membership.ts', className: 'Membership' },
  ]);
  const entry = await t.load('src/main.ts');
  const app = (entry.createApp as () => App)();
  const run = <R>(label: string, f: () => R): R | undefined => t.run(label, f);

  const pA = run('addPontoon', () => app.addPontoon('A', [8, 10, 12])) ?? 'PT-1';
  const pB = run('addPontoon', () => app.addPontoon('B', [10])) ?? 'PT-2';
  run('moorVisitor', () => app.moorVisitor(pA, 'Sea Breeze', 7));
  const ana = run('join', () => app.join('Ana', 'Kittiwake', 9.5)) ?? 'M-01';
  const ben = run('join', () => app.join('Ben', 'Osprey', 11)) ?? 'M-02';
  const cy = run('join', () => app.join('Cy', 'Tern', 12.5)) ?? 'M-03';
  const di = run('join', () => app.join('Di', 'Puffin', 9)) ?? 'M-04';
  run('signContract', () => app.signContract(ana, pA)); // berth 2 (10 m)
  run('signContract', () => app.signContract(ben, pA)); // berth 3 (12 m)
  run('signContract', () => app.signContract(cy, pA)); // nothing fits
  run('signContract', () => app.signContract(di, pB)); // berth 1 (10 m)
  run('signContract', () => app.signContract(ana, pB)); // refused today: already has a contract
  if (typeof app.closePontoon === 'function') {
    run('closePontoon', () => app.closePontoon!(pB));
    run('closePontoon', () => app.closePontoon!(pB));
  }
  const ed = run('join', () => app.join('Ed', 'Gull', 6)) ?? 'M-05';
  run('signContract', () => app.signContract(ed, pB)); // closed pontoon (when the tree has closures)
  if (typeof app.resign === 'function') {
    run('resign', () => app.resign!(ana)); // refused: fees due
    run('payFees', () => app.payFees(ana, 1500));
    run('resign', () => app.resign!(ana)); // frees berth 2 on A
    run('resign', () => app.resign!(ana));
    run('resign', () => app.resign!(cy)); // waitlisted, nothing held
    run('payFees', () => app.payFees(di, 1350));
    run('resign', () => app.resign!(di)); // storm-closed berth on B
  }
  const fi = run('join', () => app.join('Fi', 'Shag', 9)) ?? 'M-06';
  run('signContract', () => app.signContract(fi, pA)); // takes the berth Ana left

  const sg = (call: string, initiator: string): string[] => [...t.missing, ...outsideDelivery(t.changes, call, initiator)];
  const sg1 = sg('signContract', 'membership');
  const sg2 = sg('closePontoon', 'berthing');
  const sg3 = sg('resign', 'membership');
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4 cross-context', pass: sg2.length === 0, evidence: sg2 },
    { id: 'SG3', family: 'D4 cross-context', pass: sg3.length === 0, evidence: sg3 },
  ];
  return report('f11-ddd-marina', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
