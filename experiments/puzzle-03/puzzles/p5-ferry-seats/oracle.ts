/**
 * P5 oracle (PUZZLE-03; hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls.
 *
 * The rule (ARCHITECTURE.md 1): a command changes and saves one aggregate; another context's aggregate follows through
 * a domain event that context handles. The oracle runs a fixed scenario through the tree's `createApp` and records
 * every change of a `Sailing` (context sailings) and a `Booking` (context bookings), with the call stack
 * (`../../tools/runtime-trace.ts`). A change of the other context's aggregate, during a call started by one context,
 * passes only when the event relay (`src/messaging/EventRelay.ts`, `deliverPending`) delivered it after the command
 * returned: no frame of the starting context may be a caller of that delivery.
 * SG1 (hold-seats): during `book`, the bookings command never changes a sailing.
 * SG2 (cancel-booking, sailing-cancelled): during `cancelBooking` the bookings command never changes a sailing, and
 * during `cancelSailing` the sailings command never changes a booking.
 * Because the judgement uses the stack at the moment of the change, a renamed write, a "batch" store call and a
 * handler run synchronously inside the command are all seen; a handler the relay calls is not a violation wherever
 * its file lives.
 * Calls the tree does not have yet (the seed has no cancelBooking) are skipped. An aggregate root class that cannot be
 * found fails both sub-goals with that reason (not checkable; hand read).
 *
 * Limits: only the scenario's paths are exercised; a relay rewritten to call handlers before the command stores its
 * change is not separated from the seed's relay. Every failure on an agent tree is hand-read before it counts.
 *
 * Usage: npx tsx experiments/puzzle-03/puzzles/p5-ferry-seats/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../../puzzle-01/tools/oracle-lib';
import { crossContextWrites, Tracer } from '../../tools/runtime-trace';

interface App {
  scheduleSailing(route: string, departsAt: string, capacity: number): string;
  book(passenger: string, sailingId: string, seats: number): string;
  cancelBooking?(bookingId: string): void;
  cancelSailing?(sailingId: string): void;
}

async function main(): Promise<number> {
  const treeArg = process.argv[2];
  if (treeArg === undefined) {
    process.stderr.write('usage: oracle.ts <tree>\n');
    return 2;
  }
  const t = new Tracer(path.resolve(treeArg));
  await t.hook([
    { context: 'sailings', file: 'src/sailings/domain/sailing/Sailing.ts', className: 'Sailing' },
    { context: 'bookings', file: 'src/bookings/domain/booking/Booking.ts', className: 'Booking' },
  ]);
  const entry = await t.load('src/main.ts');
  const app = (entry.createApp as () => App)();
  const departs = '2026-11-02T08:00:00Z';
  const s1 = t.run('scheduleSailing', () => app.scheduleSailing('Dover-Calais', departs, 5)) ?? 'S-0001';
  const s2 = t.run('scheduleSailing', () => app.scheduleSailing('Dover-Calais', '2026-11-02T12:00:00Z', 3)) ?? 'S-0002';
  const b1 = t.run('book', () => app.book('Ana', s1, 3)) ?? 'B-0001';
  t.run('book', () => app.book('Ben', s1, 3));
  t.run('book', () => app.book('Cy', s2, 2));
  if (typeof app.cancelBooking === 'function') {
    t.run('cancelBooking', () => app.cancelBooking!(b1));
    t.run('cancelBooking', () => app.cancelBooking!(b1));
  }
  if (typeof app.cancelSailing === 'function') t.run('cancelSailing', () => app.cancelSailing!(s2));
  t.run('book', () => app.book('Di', s2, 1));

  const relay = 'src/messaging/EventRelay.ts';
  const sg1 = [...t.missing, ...crossContextWrites(t.changes, new Set(['book']), 'bookings', relay)];
  const sg2 = [
    ...t.missing,
    ...crossContextWrites(t.changes, new Set(['cancelBooking']), 'bookings', relay),
    ...crossContextWrites(t.changes, new Set(['cancelSailing']), 'sailings', relay),
  ];
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: sg1.length === 0, evidence: sg1 },
    { id: 'SG2', family: 'D4 cross-context', pass: sg2.length === 0, evidence: sg2 },
  ];
  return report('p5-ferry-seats', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
