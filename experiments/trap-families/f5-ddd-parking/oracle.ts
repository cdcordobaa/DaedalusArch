/**
 * F5 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P5 oracle (`experiments/puzzle-03/puzzles/p5-ferry-seats/oracle.ts`), with the aggregate roots
 * `CarPark` (context carparks) and `Reservation` (context reservations) in place of `Sailing` and `Booking`.
 *
 * The rule (ARCHITECTURE.md 1): a command changes and saves one aggregate; another context's aggregate follows through
 * a domain event that context handles. The oracle runs a fixed scenario through the tree's `createApp` and records
 * every change of a `CarPark` and a `Reservation` with the call stack (`../../puzzle-03/tools/runtime-trace.ts`). A
 * change of the other context's aggregate, during a call started by one context, passes only when the event relay
 * (`src/messaging/EventRelay.ts`, `deliverPending`) delivered it after the command returned: no frame of the starting
 * context may be a caller of that delivery.
 * SG1 (hold-bays): during `reserve`, the reservations command never changes a car park.
 * SG2 (cancel-reservation, car-park-closed): during `cancelReservation` the reservations command never changes a car
 * park, and during `closeCarPark` the car parks command never changes a reservation.
 * Because the judgement uses the stack at the moment of the change, a renamed write, a "batch" store call and a
 * handler run synchronously inside the command are all seen; a handler the relay calls is not a violation wherever
 * its file lives. A cross-context write placed in the composition root (`src/main.ts`, outside both contexts) during
 * a command, but not under `deliverPending`, is also a failure ("no event delivery on the stack").
 * Calls the tree does not have yet (the seed has no cancelReservation) are skipped. An aggregate root class that
 * cannot be found fails both sub-goals with that reason (not checkable; hand read).
 *
 * Limits (stated, not hidden): only the scenario's paths are exercised (a write on a path the scenario does not take
 * is not seen); the aggregate roots must sit at the declared files and keep the class names; a store is seen only
 * when its class name ends in Repository / Repo / Store / UnitOfWork / Database / Db and it lives under the context's
 * folder; a relay rewritten to call handlers before the command stores its change, or a second relay with a method
 * named deliverPending called inside the command from outside the context folder, is not separated from the seed's
 * relay; a change by direct field assignment from outside the aggregate's prototype methods is seen only through a
 * store write. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/trap-families/f5-ddd-parking/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';
import { crossContextWrites, Tracer } from '../../puzzle-03/tools/runtime-trace';

interface App {
  openCarPark(name: string, bays: number): string;
  reserve(driver: string, carParkId: string, bays: number): string;
  cancelReservation?(reservationId: string): void;
  closeCarPark?(carParkId: string): void;
}

async function main(): Promise<number> {
  const treeArg = process.argv[2];
  if (treeArg === undefined) {
    process.stderr.write('usage: oracle.ts <tree>\n');
    return 2;
  }
  const t = new Tracer(path.resolve(treeArg));
  await t.hook([
    { context: 'carparks', file: 'src/carparks/domain/carpark/CarPark.ts', className: 'CarPark' },
    { context: 'reservations', file: 'src/reservations/domain/reservation/Reservation.ts', className: 'Reservation' },
  ]);
  const entry = await t.load('src/main.ts');
  const app = (entry.createApp as () => App)();
  const p1 = t.run('openCarPark', () => app.openCarPark('Station Road', 5)) ?? 'P-0001';
  const p2 = t.run('openCarPark', () => app.openCarPark('Market Square', 3)) ?? 'P-0002';
  const r1 = t.run('reserve', () => app.reserve('Ana', p1, 3)) ?? 'R-0001';
  t.run('reserve', () => app.reserve('Ben', p1, 3));
  t.run('reserve', () => app.reserve('Cy', p2, 2));
  if (typeof app.cancelReservation === 'function') {
    t.run('cancelReservation', () => app.cancelReservation!(r1));
    t.run('cancelReservation', () => app.cancelReservation!(r1));
  }
  if (typeof app.closeCarPark === 'function') t.run('closeCarPark', () => app.closeCarPark!(p2));
  t.run('reserve', () => app.reserve('Di', p2, 1));

  const relay = 'src/messaging/EventRelay.ts';
  const sg1 = [...t.missing, ...crossContextWrites(t.changes, new Set(['reserve']), 'reservations', relay)];
  const sg2 = [
    ...t.missing,
    ...crossContextWrites(t.changes, new Set(['cancelReservation']), 'reservations', relay),
    ...crossContextWrites(t.changes, new Set(['closeCarPark']), 'carparks', relay),
  ];
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4 cross-context', pass: sg2.length === 0, evidence: sg2 },
  ];
  return report('f5-ddd-parking', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
