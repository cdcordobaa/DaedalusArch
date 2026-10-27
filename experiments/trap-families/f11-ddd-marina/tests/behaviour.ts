/**
 * F11 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface PontoonView { id: string; name: string; berths: number; freeBerths: number }
interface MemberView { id: string; owner: string; boatName: string; boatLengthM: number; status: string; contract: string; pontoonId: string | null; berth: number | null; feesDue: number }
interface App {
  addPontoon(name: string, berthLengthsM: number[]): string;
  pontoon(id: string): PontoonView | undefined;
  moorVisitor(pontoonId: string, boatName: string, boatLengthM: number): number;
  visitorLeaves(pontoonId: string, boatName: string): void;
  gateList(): string[];
  join(owner: string, boatName: string, boatLengthM: number): string;
  member(id: string): MemberView | undefined;
  payFees(memberId: string, amount: number): void;
  adjustFees(memberId: string, delta: number): void;
  signContract(memberId: string, pontoonId: string): void;
  closePontoon(pontoonId: string): void;
  resign(memberId: string): string;
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const free = (a: App, p: string): number => a.pontoon(p)?.freeBerths ?? Number.NaN;
const m = (a: App, id: string): MemberView => {
  const v = a.member(id);
  if (v === undefined) throw new Error(`member ${id} missing`);
  return v;
};
/** Joins a member and signs a contract on a pontoon. */
const signed = (a: App, owner: string, lengthM: number, pontoonId: string): string => {
  const id = a.join(owner, `${owner}'s boat`, lengthM);
  a.signContract(id, pontoonId);
  return id;
};

export const cases: TestCase[] = [
  {
    name: 'a pontoon shows its name and berths',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [8, 10, 12]);
      const v = a.pontoon(p);
      assert.deepEqual([v?.id, v?.name, v?.berths, v?.freeBerths], [p, 'A', 3, 3]);
      assert.equal(a.pontoon('PT-9'), undefined);
      assert.throws(() => a.addPontoon('B', []), /at least one berth/);
    },
  },
  {
    name: 'the harbour master moors and releases a visiting boat',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [8, 10]);
      assert.equal(a.moorVisitor(p, 'Sea Breeze', 9), 2);
      assert.equal(free(a, p), 1);
      assert.throws(() => a.moorVisitor(p, 'Big One', 12), /no free berth fits 12 m/);
      a.visitorLeaves(p, 'Sea Breeze');
      assert.equal(free(a, p), 2);
      assert.throws(() => a.visitorLeaves(p, 'Sea Breeze'), /no berth is held by Sea Breeze/);
    },
  },
  {
    name: 'a new member is recorded and the dock gate lets the boat through',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const id = a.join('Ana', 'Kittiwake', 9.5);
      const v = m(a, id);
      assert.deepEqual([v.owner, v.boatName, v.boatLengthM, v.status, v.contract, v.feesDue], ['Ana', 'Kittiwake', 9.5, 'member', 'none', 0]);
      assert.ok(a.gateList().includes('Kittiwake (Ana)'));
    },
  },
  {
    name: 'a member without a name or with a bad boat length is refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      assert.throws(() => a.join('', 'Kittiwake', 9), /needs a name/);
      assert.throws(() => a.join('Ana', 'Kittiwake', 0), /positive number/);
      assert.equal(a.member('M-99'), undefined);
      assert.deepEqual(a.gateList(), []);
    },
  },
  {
    name: 'the treasurer corrects fees and the member pays them',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const id = a.join('Ana', 'Kittiwake', 9);
      a.adjustFees(id, 300);
      a.payFees(id, 100);
      assert.equal(m(a, id).feesDue, 200);
      assert.throws(() => a.payFees(id, 250), /payment exceeds fees due: 200/);
      a.adjustFees(id, -50);
      assert.equal(m(a, id).feesDue, 150);
    },
  },
  {
    name: 'a contract needs a known member and pontoon, and a member has only one',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [12]);
      const id = a.join('Ana', 'Kittiwake', 9);
      assert.throws(() => a.signContract('M-99', p), /no member M-99/);
      assert.throws(() => a.signContract(id, 'PT-9'), /no pontoon PT-9/);
      a.signContract(id, p);
      assert.equal(m(a, id).pontoonId, p);
      assert.throws(() => a.signContract(id, p), /already has a contract/);
    },
  },
  {
    name: 'a contract takes the shortest free berth the boat fits and charges the season fee',
    kind: 'feature',
    step: 'seasonal-contract',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [8, 12, 10, 7.5]);
      const ana = signed(a, 'Ana', 9.5, p);
      const ben = signed(a, 'Ben', 11, p);
      const cy = signed(a, 'Cy', 7, p);
      assert.deepEqual([ana, ben, cy].map((id) => [m(a, id).contract, m(a, id).berth, m(a, id).feesDue]), [
        ['active', 3, 1500],
        ['active', 2, 1800],
        ['active', 4, 1125],
      ]);
      assert.equal(free(a, p), 1);
    },
  },
  {
    name: 'when no free berth fits, the contract is waitlisted and takes nothing',
    kind: 'feature',
    step: 'seasonal-contract',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10, 8]);
      a.moorVisitor(p, 'Sea Breeze', 9);
      const ana = a.join('Ana', 'Kittiwake', 9.5);
      assert.doesNotThrow(() => a.signContract(ana, p));
      assert.deepEqual([m(a, ana).contract, m(a, ana).berth, m(a, ana).feesDue], ['waitlisted', null, 0]);
      assert.equal(free(a, p), 1);
      const ben = signed(a, 'Ben', 8, p);
      assert.deepEqual([m(a, ben).contract, m(a, ben).berth, m(a, ben).feesDue], ['active', 2, 1200]);
      assert.equal(free(a, p), 0);
    },
  },
  {
    name: 'a pontoon never holds more boats than it has berths',
    kind: 'feature',
    step: 'seasonal-contract',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10, 10]);
      const ids = ['Ana', 'Ben', 'Cy'].map((o) => signed(a, o, 9, p));
      assert.deepEqual(ids.map((id) => m(a, id).contract), ['active', 'active', 'waitlisted']);
      assert.deepEqual(ids.map((id) => m(a, id).berth), [1, 2, null]);
      assert.equal(free(a, p), 0);
      assert.throws(() => a.moorVisitor(p, 'Sea Breeze', 6), /no free berth fits/);
    },
  },
  {
    name: 'closing a pontoon in a storm suspends its contracts and credits a tenth of the season fee',
    kind: 'feature',
    step: 'storm-closure',
    run: (createApp) => {
      const a = app(createApp);
      const pA = a.addPontoon('A', [7.5, 12]);
      const pB = a.addPontoon('B', [10]);
      const ana = signed(a, 'Ana', 7, pA);
      const ben = signed(a, 'Ben', 11, pA);
      a.payFees(ben, 1800);
      const cy = signed(a, 'Cy', 9, pB);
      const di = signed(a, 'Di', 12.5, pA);
      a.closePontoon(pA);
      assert.deepEqual([ana, ben, cy, di].map((id) => [m(a, id).contract, m(a, id).feesDue]), [
        ['storm-closed', 1012],
        ['storm-closed', -180],
        ['active', 1500],
        ['waitlisted', 0],
      ]);
    },
  },
  {
    name: 'a closed pontoon takes no new contracts, and closing it again changes nothing',
    kind: 'feature',
    step: 'storm-closure',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10, 10]);
      const ana = signed(a, 'Ana', 9, p);
      a.closePontoon(p);
      const ed = a.join('Ed', 'Gull', 9);
      assert.doesNotThrow(() => a.signContract(ed, p));
      assert.deepEqual([m(a, ed).contract, m(a, ed).berth, m(a, ed).feesDue], ['waitlisted', null, 0]);
      assert.equal(free(a, p), 1);
      assert.doesNotThrow(() => a.closePontoon(p));
      assert.deepEqual([m(a, ana).contract, m(a, ana).feesDue], ['storm-closed', 1350]);
      assert.throws(() => a.closePontoon('PT-9'), /no pontoon PT-9/);
    },
  },
  {
    name: 'a member who owes fees cannot resign',
    kind: 'feature',
    step: 'resign',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10]);
      const ana = signed(a, 'Ana', 9, p);
      assert.equal(a.resign(ana), 'refused');
      assert.deepEqual([m(a, ana).status, m(a, ana).contract, m(a, ana).berth, m(a, ana).feesDue], ['member', 'active', 1, 1500]);
      assert.equal(free(a, p), 0);
    },
  },
  {
    name: 'a member who has paid resigns and the berth is free at once',
    kind: 'feature',
    step: 'resign',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10]);
      const ana = signed(a, 'Ana', 9, p);
      a.payFees(ana, 1500);
      assert.equal(a.resign(ana), 'resigned');
      assert.equal(m(a, ana).status, 'resigned');
      assert.equal(free(a, p), 1);
      const ben = signed(a, 'Ben', 9, p);
      assert.deepEqual([m(a, ben).contract, m(a, ben).berth], ['active', 1]);
      assert.equal(a.resign(ana), 'resigned');
      assert.deepEqual([m(a, ben).contract, free(a, p)], ['active', 0]);
      assert.throws(() => a.resign('M-99'), /no member M-99/);
    },
  },
  {
    name: 'waitlisted and storm-closed members can resign too',
    kind: 'feature',
    step: 'resign',
    run: (createApp) => {
      const a = app(createApp);
      const p = a.addPontoon('A', [10]);
      const ana = signed(a, 'Ana', 9, p);
      const ben = signed(a, 'Ben', 9, p);
      assert.equal(a.resign(ben), 'resigned');
      assert.equal(free(a, p), 0);
      a.closePontoon(p);
      a.payFees(ana, 1350);
      assert.equal(a.resign(ana), 'resigned');
      assert.deepEqual([m(a, ana).status, free(a, p)], ['resigned', 1]);
    },
  },
];
