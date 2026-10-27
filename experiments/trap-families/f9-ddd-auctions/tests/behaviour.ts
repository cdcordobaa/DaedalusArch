/**
 * F9 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; feature cases fail on the seed. Every refusal is checked in the one form its request states (a returned
 * 'refused', a normal return that changes nothing, or a thrown error with the stated message).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface AccountView { id: string; name: string; creditLimit: number; creditAvailable: number; bidsPlaced: number; status: string; amountOwed?: number }
interface LotView { id: string; title: string; openingBid: number; status: string; leadingBid: number | null; leader: string | null; nextMinimum: number; buyer?: string | null }
interface App {
  registerBidder(name: string, creditLimit: number): string;
  account(id: string): AccountView | undefined;
  holdCredit(accountId: string, ref: string, amount: number): void;
  releaseCredit(accountId: string, ref: string): void;
  openLot(title: string, openingBid: number, reserve: number): string;
  lot(id: string): LotView | undefined;
  placeBid(lotId: string, bidderId: string, amount: number): string;
  closeLot(lotId: string): void;
  suspendAccount(accountId: string): void;
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const credit = (a: App, id: string): number => a.account(id)?.creditAvailable ?? Number.NaN;
const owed = (a: App, id: string): number => a.account(id)?.amountOwed ?? Number.NaN;
const lead = (a: App, l: string): [string | null | undefined, number | null | undefined] => [a.lot(l)?.leader, a.lot(l)?.leadingBid];

export const cases: TestCase[] = [
  {
    name: 'a registered bidder shows their name and credit',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.registerBidder('Ana', 1000);
      const v = a.account(p);
      assert.deepEqual([v?.id, v?.name, v?.creditLimit, v?.creditAvailable, v?.bidsPlaced, v?.status], [p, 'Ana', 1000, 1000, 0, 'active']);
      assert.equal(a.account('P-999'), undefined);
      assert.throws(() => a.registerBidder('Ben', 0), /positive whole amount/);
    },
  },
  {
    name: 'the finance desk holds and releases credit',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.registerBidder('Ana', 1000);
      a.holdCredit(p, 'phone-L7', 300);
      assert.equal(credit(a, p), 700);
      assert.throws(() => a.holdCredit(p, 'absentee-L9', 701), /not enough credit: 700 available/);
      a.releaseCredit(p, 'phone-L7');
      assert.equal(credit(a, p), 1000);
      assert.throws(() => a.releaseCredit(p, 'phone-L7'), /no credit is held for phone-L7/);
    },
  },
  {
    name: 'an opened lot shows its title and opening bid, with no leader',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const l = a.openLot('Pair of Meissen vases', 100, 300);
      const v = a.lot(l);
      assert.deepEqual([v?.id, v?.title, v?.openingBid, v?.status, v?.leadingBid, v?.leader, v?.nextMinimum], [l, 'Pair of Meissen vases', 100, 'open', null, null, 100]);
      assert.equal(a.lot('LOT-99'), undefined);
    },
  },
  {
    name: 'bids climb the ladder and the leader is shown',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 5000);
      const p2 = a.registerBidder('Ben', 5000);
      const l = a.openLot('Oak bureau', 100, 0);
      assert.equal(a.placeBid(l, p1, 100), 'accepted');
      assert.equal(a.lot(l)?.nextMinimum, 150);
      assert.equal(a.placeBid(l, p2, 150), 'accepted');
      assert.deepEqual(lead(a, l), [p2, 150]);
      assert.throws(() => a.placeBid(l, p1, 190), /bid must be at least 200/);
      assert.throws(() => a.placeBid(l, p2, 400), /already leads/);
      a.placeBid(l, p1, 950);
      assert.equal(a.lot(l)?.nextMinimum, 1000);
      a.placeBid(l, p2, 1000);
      assert.equal(a.lot(l)?.nextMinimum, 1100);
    },
  },
  {
    name: 'a bid on an unknown lot or by an unknown bidder is refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.registerBidder('Ana', 1000);
      const l = a.openLot('Oak bureau', 100, 0);
      assert.throws(() => a.placeBid('LOT-99', p, 100), /no lot LOT-99/);
      assert.throws(() => a.placeBid(l, 'P-999', 100), /no account P-999/);
      assert.deepEqual(lead(a, l), [null, null]);
    },
  },
  {
    name: 'every bid taken is counted on the bidder\'s account',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 5000);
      const p2 = a.registerBidder('Ben', 5000);
      const l = a.openLot('Oak bureau', 100, 0);
      a.placeBid(l, p1, 100);
      a.placeBid(l, p2, 150);
      a.placeBid(l, p1, 200);
      assert.deepEqual([a.account(p1)?.bidsPlaced, a.account(p2)?.bidsPlaced], [2, 1]);
    },
  },
  {
    name: 'a covered bid takes its amount from the bidder\'s credit, and the outbid bidder gets theirs back',
    kind: 'feature',
    step: 'cover-bids',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 1000);
      const p2 = a.registerBidder('Ben', 1000);
      const l1 = a.openLot('Oak bureau', 100, 0);
      const l2 = a.openLot('Brass lantern', 100, 0);
      assert.equal(a.placeBid(l1, p1, 300), 'accepted');
      assert.equal(credit(a, p1), 700);
      assert.equal(a.placeBid(l1, p2, 350), 'accepted');
      assert.deepEqual([credit(a, p1), credit(a, p2)], [1000, 650]);
      a.placeBid(l2, p1, 200);
      a.placeBid(l1, p1, 400);
      assert.deepEqual([credit(a, p1), credit(a, p2)], [400, 1000]);
    },
  },
  {
    name: 'a bid over the credit available returns refused and changes nothing',
    kind: 'feature',
    step: 'cover-bids',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 1000);
      const p3 = a.registerBidder('Cy', 300);
      const l = a.openLot('Oak bureau', 100, 0);
      a.placeBid(l, p1, 100);
      let outcome = 'threw';
      try {
        outcome = a.placeBid(l, p3, 400);
      } catch {
        outcome = 'threw';
      }
      assert.equal(outcome, 'refused');
      assert.deepEqual(lead(a, l), [p1, 100]);
      assert.deepEqual([credit(a, p1), credit(a, p3), a.account(p3)?.bidsPlaced], [900, 300, 0]);
      assert.equal(a.placeBid(l, p3, 300), 'accepted');
      assert.deepEqual([credit(a, p1), credit(a, p3)], [1000, 0]);
      assert.throws(() => a.placeBid(l, p1, 310), /bid must be at least 350/);
    },
  },
  {
    name: 'credit the finance desk holds counts as used',
    kind: 'feature',
    step: 'cover-bids',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.registerBidder('Di', 1000);
      const l = a.openLot('Oak bureau', 100, 0);
      a.holdCredit(p, 'phone-L7', 700);
      assert.equal(a.placeBid(l, p, 400), 'refused');
      assert.equal(a.placeBid(l, p, 300), 'accepted');
      assert.equal(credit(a, p), 0);
      assert.throws(() => a.holdCredit(p, 'absentee-L9', 1), /not enough credit: 0 available/);
      a.releaseCredit(p, 'phone-L7');
      assert.equal(credit(a, p), 700);
    },
  },
  {
    name: 'a lot that reaches its reserve is sold, and the buyer owes the hammer price plus 20%',
    kind: 'feature',
    step: 'hammer',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 2000);
      const p2 = a.registerBidder('Ben', 2000);
      const l1 = a.openLot('Oak bureau', 100, 300);
      const l2 = a.openLot('Long-case clock', 1000, 1000);
      a.placeBid(l1, p1, 200);
      a.placeBid(l1, p2, 400);
      a.placeBid(l2, p2, 1150);
      a.closeLot(l1);
      assert.deepEqual([a.lot(l1)?.status, a.lot(l1)?.buyer], ['sold', p2]);
      assert.deepEqual([owed(a, p2), credit(a, p2), owed(a, p1), credit(a, p1)], [480, 450, 0, 2000]);
      a.closeLot(l2);
      assert.deepEqual([owed(a, p2), credit(a, p2)], [1860, 450]);
    },
  },
  {
    name: 'a lot under its reserve or without bids is unsold, and the leader gets their credit back at once',
    kind: 'feature',
    step: 'hammer',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.registerBidder('Ana', 1000);
      const l1 = a.openLot('Oak bureau', 100, 500);
      const l2 = a.openLot('Brass lantern', 100, 0);
      a.placeBid(l1, p, 300);
      a.closeLot(l1);
      a.closeLot(l2);
      assert.deepEqual([a.lot(l1)?.status, a.lot(l1)?.buyer, a.lot(l2)?.status, a.lot(l2)?.buyer], ['unsold', null, 'unsold', null]);
      assert.deepEqual([credit(a, p), owed(a, p)], [1000, 0]);
    },
  },
  {
    name: 'closing twice changes nothing, an unknown lot throws, and a closed lot takes no bids',
    kind: 'feature',
    step: 'hammer',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 2000);
      const p2 = a.registerBidder('Ben', 2000);
      const l = a.openLot('Oak bureau', 100, 0);
      a.placeBid(l, p1, 500);
      a.closeLot(l);
      a.closeLot(l);
      assert.deepEqual([a.lot(l)?.status, a.lot(l)?.buyer, owed(a, p1), credit(a, p1)], ['sold', p1, 600, 1500]);
      assert.throws(() => a.closeLot('LOT-99'), /no lot LOT-99/);
      assert.throws(() => a.placeBid(l, p2, 600), new RegExp(`lot ${l} is closed`));
      assert.equal(credit(a, p2), 2000);
    },
  },
  {
    name: 'suspending a bidder strikes their leading bids and gives that credit back',
    kind: 'feature',
    step: 'suspend',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 2000);
      const p2 = a.registerBidder('Ben', 2000);
      const l1 = a.openLot('Oak bureau', 100, 0);
      const l2 = a.openLot('Brass lantern', 100, 0);
      const l3 = a.openLot('Silver salver', 100, 0);
      const l4 = a.openLot('Long-case clock', 200, 0);
      a.placeBid(l4, p1, 200);
      a.closeLot(l4);
      a.placeBid(l1, p1, 100);
      a.placeBid(l1, p2, 150);
      a.placeBid(l1, p1, 200);
      a.placeBid(l2, p1, 100);
      a.placeBid(l3, p1, 100);
      a.placeBid(l3, p2, 150);
      a.holdCredit(p1, 'phone-L9', 300);
      a.suspendAccount(p1);
      assert.equal(a.account(p1)?.status, 'suspended');
      assert.deepEqual([lead(a, l1), lead(a, l2), lead(a, l3)], [[null, null], [null, null], [p2, 150]]);
      assert.deepEqual([a.lot(l1)?.status, a.lot(l1)?.nextMinimum, a.lot(l2)?.nextMinimum], ['open', 100, 100]);
      assert.deepEqual([a.lot(l4)?.status, a.lot(l4)?.buyer], ['sold', p1]);
      assert.deepEqual([credit(a, p1), owed(a, p1), credit(a, p2)], [1500, 240, 1850]);
      assert.equal(a.placeBid(l1, p2, 100), 'accepted');
      assert.deepEqual([lead(a, l1), credit(a, p2)], [[p2, 100], 1750]);
    },
  },
  {
    name: 'a suspended bidder\'s bids throw, suspending twice changes nothing, and an unknown account throws',
    kind: 'feature',
    step: 'suspend',
    run: (createApp) => {
      const a = app(createApp);
      const p1 = a.registerBidder('Ana', 2000);
      const p2 = a.registerBidder('Ben', 2000);
      const l = a.openLot('Oak bureau', 100, 0);
      a.placeBid(l, p2, 100);
      a.suspendAccount(p1);
      assert.throws(() => a.placeBid(l, p1, 150), new RegExp(`account ${p1} is suspended`));
      assert.deepEqual([lead(a, l), credit(a, p1), a.account(p1)?.bidsPlaced], [[p2, 100], 2000, 0]);
      a.suspendAccount(p1);
      assert.deepEqual([a.account(p1)?.status, credit(a, p1), lead(a, l)], ['suspended', 2000, [p2, 100]]);
      assert.throws(() => a.suspendAccount('P-999'), /no account P-999/);
    },
  },
];
