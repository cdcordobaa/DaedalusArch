/**
 * F10 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; every feature case must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Profile { backerId: string; handle: string; backedTotal: number; missedPayments: number; standing: string }
interface App {
  registerBacker(handle: string): string;
  recordPastBackings(backerId: string, amount: number): void;
  recordMissedPayment(backerId: string): void;
  backerProfile(backerId: string): Profile | undefined;
  launchCampaign(title: string, goal: number): string;
  pledge(campaignId: string, backerId: string, amount: number): { pledgeId: string; campaignTotal: number; remaining?: number };
  closeCampaign(campaignId: string): { outcome: string; collected: number };
  creatorMessages(): string[];
}
const app = (createApp: (o?: Record<string, unknown>) => unknown): App => createApp() as App;
const backerWith = (a: App, past: number, handle = 'ana'): string => {
  const id = a.registerBacker(handle);
  if (past > 0) a.recordPastBackings(id, past);
  return id;
};

export const cases: TestCase[] = [
  {
    name: 'a backer profile shows the backed total and the standing',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const ana = backerWith(a, 600);
      assert.deepEqual(a.backerProfile(ana), { backerId: ana, handle: 'ana', backedTotal: 600, missedPayments: 0, standing: 'established' });
      assert.equal(a.backerProfile(backerWith(a, 0, 'bo'))?.standing, 'newcomer');
      assert.equal(a.backerProfile(backerWith(a, 3000, 'cy'))?.standing, 'trusted');
      const dee = backerWith(a, 3000, 'dee');
      a.recordMissedPayment(dee);
      assert.equal(a.backerProfile(dee)?.standing, 'trusted');
      a.recordMissedPayment(dee);
      assert.equal(a.backerProfile(dee)?.standing, 'blocked');
      assert.equal(a.backerProfile('B-999'), undefined);
    },
  },
  {
    name: 'pledges add up on the campaign and the creator is told',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const c = a.launchCampaign('Solar kettle', 1000);
      const r1 = a.pledge(c, backerWith(a, 0), 40);
      const r2 = a.pledge(c, backerWith(a, 0, 'bo'), 12.5);
      assert.equal(r2.campaignTotal, 52.5);
      assert.ok(a.creatorMessages().some((m) => m.includes(r1.pledgeId) && m.includes('40.00') && m.includes('@ana')));
    },
  },
  {
    name: 'bad pledges and bad campaigns are refused',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const c = a.launchCampaign('Solar kettle', 1000);
      const ana = backerWith(a, 0);
      assert.throws(() => a.pledge(c, ana, 0), /positive/);
      assert.throws(() => a.pledge(c, 'B-999', 10), /no backer/);
      assert.throws(() => a.pledge('C-999', ana, 10), /no campaign/);
      assert.throws(() => a.launchCampaign('Empty', 0), /goal/);
      a.closeCampaign(c);
      assert.throws(() => a.pledge(c, ana, 10), /closed/);
      assert.throws(() => a.closeCampaign(c), /closed/);
    },
  },
  {
    name: 'a campaign that reaches its goal is funded, one that does not fails',
    kind: 'regression',
    run: (createApp) => {
      const a = app(createApp);
      const ana = backerWith(a, 0);
      const funded = a.launchCampaign('Board game', 50);
      a.pledge(funded, ana, 30);
      a.pledge(funded, ana, 20);
      assert.deepEqual(a.closeCampaign(funded), { outcome: 'funded', collected: 2 });
      const failed = a.launchCampaign('Moon base', 100000);
      a.pledge(failed, ana, 10);
      assert.deepEqual(a.closeCampaign(failed), { outcome: 'failed', collected: 0 });
      assert.ok(a.creatorMessages().some((m) => m.includes(failed) && m.includes('released')));
    },
  },
  {
    name: 'each standing caps what a backer may pledge on one campaign',
    kind: 'feature',
    step: 'standing-limits',
    run: (createApp) => {
      const a = app(createApp);
      const c = a.launchCampaign('Solar kettle', 100000);
      const newcomer = backerWith(a, 0);
      assert.equal(a.pledge(c, newcomer, 200).remaining, 50);
      assert.throws(() => a.pledge(c, newcomer, 60), /over the limit/);
      assert.equal(a.pledge(c, newcomer, 50).remaining, 0);
      assert.equal(a.pledge(a.launchCampaign('Other', 1000), newcomer, 250).remaining, 0);
      const established = backerWith(a, 600, 'bo');
      assert.equal(a.pledge(c, established, 900).remaining, 100);
      assert.throws(() => a.pledge(c, established, 100.01), /over the limit/);
      const trusted = backerWith(a, 3000, 'cy');
      assert.equal(a.pledge(c, trusted, 4999).remaining, 1);
    },
  },
  {
    name: 'a blocked backer cannot pledge at all',
    kind: 'feature',
    step: 'standing-limits',
    run: (createApp) => {
      const a = app(createApp);
      const c = a.launchCampaign('Solar kettle', 1000);
      const dee = backerWith(a, 5000, 'dee');
      a.recordMissedPayment(dee);
      assert.equal(a.pledge(c, dee, 10).remaining, 4990);
      a.recordMissedPayment(dee);
      assert.throws(() => a.pledge(c, dee, 1), /blocked/);
      assert.equal(a.pledge(c, backerWith(a, 0), 10).campaignTotal, 20);
    },
  },
  {
    name: 'trusted starts at 2,000 backed, on the profile and when pledging',
    kind: 'feature',
    step: 'trusted-threshold',
    run: (createApp) => {
      const a = app(createApp);
      const c = a.launchCampaign('Solar kettle', 100000);
      const t = backerWith(a, 2000);
      assert.equal(a.backerProfile(t)?.standing, 'trusted');
      assert.equal(a.pledge(c, t, 4000).remaining, 1000);
      const e = backerWith(a, 1999.99, 'bo');
      assert.equal(a.backerProfile(e)?.standing, 'established');
      assert.throws(() => a.pledge(c, e, 1001), /over the limit/);
    },
  },
  {
    name: 'collected pledges go on the backer record; released ones do not',
    kind: 'feature',
    step: 'fulfilled-pledges',
    run: (createApp) => {
      const a = app(createApp);
      const ana = backerWith(a, 0);
      const funded = a.launchCampaign('Board game', 150);
      a.pledge(funded, ana, 200);
      a.pledge(funded, ana, 50);
      a.closeCampaign(funded);
      assert.equal(a.backerProfile(ana)?.backedTotal, 250);
      const failed = a.launchCampaign('Moon base', 100000);
      a.pledge(failed, ana, 100);
      a.closeCampaign(failed);
      assert.equal(a.backerProfile(ana)?.backedTotal, 250);
      const bo = backerWith(a, 1990, 'bo');
      const big = a.launchCampaign('Printer', 10);
      a.pledge(big, bo, 10.5);
      a.closeCampaign(big);
      assert.deepEqual([a.backerProfile(bo)?.backedTotal, a.backerProfile(bo)?.standing], [2000.5, 'trusted']);
    },
  },
  {
    name: 'a funded record counts for the next pledge',
    kind: 'feature',
    step: 'fulfilled-pledges',
    run: (createApp) => {
      const a = app(createApp);
      const ana = backerWith(a, 0);
      for (const title of ['Board game', 'Card game']) {
        const c = a.launchCampaign(title, 200);
        a.pledge(c, ana, 250);
        a.closeCampaign(c);
      }
      assert.equal(a.backerProfile(ana)?.standing, 'established');
      assert.equal(a.pledge(a.launchCampaign('Printer', 5000), ana, 600).remaining, 400);
    },
  },
];
