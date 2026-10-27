/**
 * F9 oracle (hand-written with the puzzle, independent of the DaedalusArch instrument). Zero calls. Trap-family
 * variant of the P5 oracle (`experiments/puzzle-03/puzzles/p5-ferry-seats/oracle.ts`): same runtime method, its own
 * scenario, aggregate roots, dispatcher and one sub-goal per step.
 *
 * The rule (ARCHITECTURE.md 1): a command changes and saves one aggregate; an aggregate of the other context follows
 * through an event that context reacts to. The oracle runs a fixed auction through the tree's `createApp` and records
 * every change of a `Lot` (context saleroom) and a `BidderAccount` (context accounts) with the call stack, using the
 * PUZZLE-03 tracer (`../../puzzle-03/tools/runtime-trace.ts`: a prototype method of the root that leaves the instance
 * different, or a write-named method of a store class under the context folder). A change of the other context's
 * aggregate, during a call started by one context, passes only when the dispatcher (`src/plumbing/MessageDispatcher.ts`,
 * `drain`) delivered it and no frame of the starting context is a caller of that drain. Frames of the starting
 * context inside the drain are a reaction the dispatcher called, which is allowed wherever its file lives.
 * SG1 (cover-bids): during `placeBid`, the saleroom command never changes a bidder account.
 * SG2 (hammer): during `closeLot`, the saleroom command never changes a bidder account.
 * SG3 (suspend): during `suspendAccount`, the accounts command never changes a lot.
 * A write placed in the composition root (`src/main.ts`) during a command but outside `drain` fails ("no delivery on
 * the stack"), as does a renamed write, a "batch" store call and a reaction run directly inside the command.
 * Calls the tree does not have yet (the seed has no closeLot or suspendAccount) are skipped. An aggregate root class
 * that cannot be found fails every sub-goal with that reason (not checkable; hand read).
 *
 * Limits (stated, not hidden): only the scenario's paths are exercised (a write on a path the scenario does not take
 * is not seen); the roots must stay at the declared files with the declared class names; a store is seen only when its
 * class name ends in Repository / Repo / Store / UnitOfWork / Database / Db and it lives under the context's folder; a
 * dispatcher rewritten to run reactions before the command writes its change, or a second function named drain in
 * `src/plumbing/MessageDispatcher.ts` called from outside the context folders, is not separated from the seed's; a
 * change by direct field assignment from outside the root's prototype methods is seen only through a store write; the
 * oracle judges where a write happens, not whether the credit check itself sits in the right place. Every failure on
 * an agent tree is hand-read before it counts.
 *
 * Usage (repository root): npx tsx experiments/trap-families/f9-ddd-auctions/oracle.ts <tree>
 */
import * as path from 'node:path';
import { report, type SubGoalVerdict } from '../../puzzle-01/tools/oracle-lib';
import { Tracer, type Change, type Frame } from '../../puzzle-03/tools/runtime-trace';

interface App {
  registerBidder(name: string, creditLimit: number): string;
  openLot(title: string, openingBid: number, reserve: number): string;
  placeBid(lotId: string, bidderId: string, amount: number): string;
  closeLot?(lotId: string): void;
  suspendAccount?(accountId: string): void;
}

const DISPATCHER = 'src/plumbing/MessageDispatcher.ts';

/** Cross-context changes during `call` (started by `initiator`) that the dispatcher's drain did not deliver. */
function undelivered(changes: readonly Change[], call: string, initiator: string): string[] {
  const out: string[] = [];
  const where = (f: Frame): string => `${f.file}:${String(f.line)} ${f.fn}`;
  for (const c of changes) {
    if (c.call !== call || c.context === initiator) continue;
    const d = c.frames.findIndex((f) => f.file === DISPATCHER && /drain/.test(f.fn));
    const callers = (d < 0 ? c.frames : c.frames.slice(d + 1)).filter((f) => f.file.startsWith(`src/${initiator}/`));
    const inner = callers.length > 0 ? where(callers[callers.length - 1]!) : null;
    if (d < 0) out.push(`${call}: ${c.what} (${c.context}) changed with no delivery on the stack${inner === null ? '' : `, inside ${inner}`}`);
    else if (inner !== null) out.push(`${call}: ${c.what} (${c.context}) changed in a drain started inside ${inner}`);
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
    { context: 'saleroom', file: 'src/saleroom/domain/Lot.ts', className: 'Lot' },
    { context: 'accounts', file: 'src/accounts/domain/BidderAccount.ts', className: 'BidderAccount' },
  ]);
  const entry = await t.load('src/main.ts');
  const app = (entry.createApp as () => App)();
  const ana = t.run('registerBidder', () => app.registerBidder('Ana', 1000)) ?? 'P-101';
  const ben = t.run('registerBidder', () => app.registerBidder('Ben', 1000)) ?? 'P-102';
  const cy = t.run('registerBidder', () => app.registerBidder('Cy', 300)) ?? 'P-103';
  const bureau = t.run('openLot', () => app.openLot('Oak bureau', 100, 100)) ?? 'LOT-1';
  const clock = t.run('openLot', () => app.openLot('Long-case clock', 100, 5000)) ?? 'LOT-2';
  const salver = t.run('openLot', () => app.openLot('Silver salver', 100, 0)) ?? 'LOT-3';
  const lantern = t.run('openLot', () => app.openLot('Brass lantern', 100, 0)) ?? 'LOT-4';
  t.run('placeBid', () => app.placeBid(bureau, ana, 100));
  t.run('placeBid', () => app.placeBid(bureau, ben, 150));
  t.run('placeBid', () => app.placeBid(bureau, cy, 400));
  t.run('placeBid', () => app.placeBid(clock, ana, 100));
  t.run('placeBid', () => app.placeBid(salver, ana, 100));
  t.run('placeBid', () => app.placeBid(lantern, ben, 100));
  if (typeof app.closeLot === 'function') {
    t.run('closeLot', () => app.closeLot!(bureau));
    t.run('closeLot', () => app.closeLot!(clock));
    t.run('closeLot', () => app.closeLot!(bureau));
  }
  if (typeof app.suspendAccount === 'function') {
    t.run('suspendAccount', () => app.suspendAccount!(ana));
    t.run('suspendAccount', () => app.suspendAccount!(ana));
  }
  t.run('placeBid', () => app.placeBid(salver, ben, 100));

  const sg = (call: string, initiator: string): string[] => [...t.missing, ...undelivered(t.changes, call, initiator)];
  const verdicts: SubGoalVerdict[] = [
    { id: 'SG1', family: 'D4 cross-context', pass: false, evidence: sg('placeBid', 'saleroom') },
    { id: 'SG2', family: 'D4 cross-context', pass: false, evidence: sg('closeLot', 'saleroom') },
    { id: 'SG3', family: 'D4 cross-context', pass: false, evidence: sg('suspendAccount', 'accounts') },
  ].map((v) => ({ ...v, pass: v.evidence.length === 0 }));
  return report('f9-ddd-auctions', treeArg, verdicts);
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
