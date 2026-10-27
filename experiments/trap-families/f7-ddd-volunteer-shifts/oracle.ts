/**
 * F7 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P5 oracle (`experiments/puzzle-03/puzzles/p5-ferry-seats/oracle.ts`), with the aggregate roots
 * `Shift` (context shifts) and `SignUp` (context signups) in place of `Sailing` and `Booking`.
 *
 * The rule (ARCHITECTURE.md 1): a command changes and saves one aggregate; another context's aggregate follows through
 * a domain event that context handles. The oracle runs a fixed scenario through the tree's `createApp` and records
 * every change of a `Shift` and a `SignUp` with the call stack (`../../puzzle-03/tools/runtime-trace.ts`). A change of
 * the other context's aggregate, during a call started by one context, passes only when the event relay
 * (`src/messaging/EventRelay.ts`, `deliverPending`) delivered it after the command returned: no frame of the starting
 * context may be a caller of that delivery.
 * SG1 (hold-places): during `signUp`, the signups command never changes a shift.
 * SG2 (withdraw-sign-up, shift-cancelled): during `withdraw` the signups command never changes a shift, and during
 * `cancelShift` the shifts command never changes a sign-up.
 * Because the judgement uses the stack at the moment of the change, a renamed write, a "batch" store call and a
 * handler run synchronously inside the command are all seen; a handler the relay calls is not a violation wherever
 * its file lives. A cross-context write placed in the composition root (`src/main.ts`, outside both contexts) during
 * a command, but not under `deliverPending`, is also a failure ("no event delivery on the stack").
 * Calls the tree does not have yet (the seed has no withdraw) are skipped. An aggregate root class that cannot be
 * found fails both sub-goals with that reason (not checkable; hand read).
 *
 * Limits (stated, not hidden): only the scenario's paths are exercised (a write on a path the scenario does not take
 * is not seen); the aggregate roots must sit at the declared files and keep the class names; a store is seen only
 * when its class name ends in Repository / Repo / Store / UnitOfWork / Database / Db and it lives under the context's
 * folder; a relay rewritten to call handlers before the command stores its change, or a second relay with a method
 * named deliverPending called inside the command from outside the context folder, is not separated from the seed's
 * relay; a change by direct field assignment from outside the aggregate's prototype methods is seen only through a
 * store write; the app method names (`signUp`, `withdraw`, `cancelShift`) must be kept, since a renamed command is
 * skipped as absent. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f7-ddd-volunteer-shifts/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';

interface App {
  openShift(name: string, places: number): string;
  signUp(volunteer: string, shiftId: string, places: number): string;
  withdraw?(signUpId: string): void;
  cancelShift?(shiftId: string): void;
}

async function main(): Promise<number> {
  const treeArg = process.argv[2];
  if (treeArg === undefined) {
    process.stderr.write('usage: oracle.ts <tree>\n');
    return 2;
  }
  const t = new Tracer(path.resolve(treeArg));
  await t.hook([
    { context: 'shifts', file: 'src/shifts/domain/shift/Shift.ts', className: 'Shift' },
    { context: 'signups', file: 'src/signups/domain/signup/SignUp.ts', className: 'SignUp' },
  ]);
  const entry = await t.load('src/main.ts');
  const app = (entry.createApp as () => App)();
  const s1 = t.run('openShift', () => app.openShift('Park clean-up', 5)) ?? 'S-0001';
  const s2 = t.run('openShift', () => app.openShift('Food bank, Saturday morning', 3)) ?? 'S-0002';
  const u1 = t.run('signUp', () => app.signUp('Ana', s1, 3)) ?? 'U-0001';
  t.run('signUp', () => app.signUp('Ben', s1, 3));
  t.run('signUp', () => app.signUp('Cy', s2, 2));
  if (typeof app.withdraw === 'function') {
    t.run('withdraw', () => app.withdraw!(u1));
    t.run('withdraw', () => app.withdraw!(u1));
  }
  if (typeof app.cancelShift === 'function') t.run('cancelShift', () => app.cancelShift!(s2));
  t.run('signUp', () => app.signUp('Di', s2, 1));

  const relay = 'src/messaging/EventRelay.ts';
  const sg1 = [...t.missing, ...crossContextWrites(t.changes, new Set(['signUp']), 'signups', relay)];
  const sg2 = [
    ...t.missing,
    ...crossContextWrites(t.changes, new Set(['withdraw']), 'signups', relay),
    ...crossContextWrites(t.changes, new Set(['cancelShift']), 'shifts', relay),
  ];
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4 cross-context', pass: sg2.length === 0, evidence: sg2 },
  ];
  return report('f7-ddd-volunteer-shifts', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
