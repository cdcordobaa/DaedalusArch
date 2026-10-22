/**
 * P6 behaviour tests: black-box through `createApp` (the seed's entry, which returns the HTTP controllers). They must
 * pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../../puzzle-01/tools/run-tests';

interface HttpResponse { status: number; body: unknown }
type Handler = (...args: unknown[]) => HttpResponse;
interface App {
  workshop: { hire: Handler; openJob: Handler; closeJob: Handler; job: Handler; reassignJob: Handler };
  reports: { dailyTakings: Handler; workload: Handler; takingsByMechanic: Handler };
}
/** An app whose clock the test moves. */
const setup = (createApp: (o?: Record<string, unknown>) => unknown, start = '2026-10-05'): { app: App; on: (day: string) => void } => {
  let day = start;
  const app = createApp({ today: () => day }) as App;
  return { app, on: (d) => { day = d; } };
};
const ok = (r: HttpResponse): Record<string, unknown> => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown>;
};
const id = (r: HttpResponse): string => String(ok(r).id);
const error = (r: HttpResponse): string => {
  assert.equal(r.status, 400, JSON.stringify(r.body));
  return String((r.body as { error?: unknown }).error);
};
/** Three mechanics and a few jobs on different days. */
const shop = (createApp: (o?: Record<string, unknown>) => unknown) => {
  const { app, on } = setup(createApp);
  const ana = id(app.workshop.hire('Ana'));
  const ben = id(app.workshop.hire('Ben'));
  const cy = id(app.workshop.hire('Cy'));
  on('2026-10-01');
  const j1 = id(app.workshop.openJob('AB12 CDE', ben));
  on('2026-10-02');
  const j2 = id(app.workshop.openJob('XY99 ZZZ', ana));
  on('2026-10-03');
  const j3 = id(app.workshop.openJob('KL55 MNO', ben));
  const j4 = id(app.workshop.openJob('PQ77 RST', ana));
  on('2026-10-04');
  const j5 = id(app.workshop.openJob('GH10 IJK', cy));
  return { app, on, ana, ben, cy, j1, j2, j3, j4, j5 };
};

export const cases: TestCase[] = [
  {
    name: 'a job is opened, closed and priced (labour per started quarter hour plus parts)',
    kind: 'regression',
    run: (createApp) => {
      const { app } = setup(createApp);
      const m = id(app.workshop.hire('Ana'));
      const j = id(app.workshop.openJob('ab12 cde', m));
      assert.deepEqual([ok(app.workshop.job(j)).plate, ok(app.workshop.job(j)).status], ['AB12CDE', 'open']);
      assert.equal(ok(app.workshop.closeJob(j, 75, 4250)).total, 'EUR 117.50');
      assert.equal(ok(app.workshop.job(j)).status, 'closed');
    },
  },
  {
    name: 'bad plates, unknown mechanics and closing twice are refused',
    kind: 'regression',
    run: (createApp) => {
      const { app } = setup(createApp);
      const m = id(app.workshop.hire('Ana'));
      assert.match(error(app.workshop.openJob('!!', m)), /not a number plate/);
      assert.match(error(app.workshop.openJob('AB12CDE', 'M-0099')), /no mechanic M-0099/);
      const j = id(app.workshop.openJob('AB12CDE', m));
      ok(app.workshop.closeJob(j, 30, 0));
      assert.match(error(app.workshop.closeJob(j, 30, 0)), /is closed/);
    },
  },
  {
    name: 'the takings report sums the jobs closed on a day',
    kind: 'regression',
    run: (createApp) => {
      const { app, on } = setup(createApp);
      const m = id(app.workshop.hire('Ana'));
      const a = id(app.workshop.openJob('AB12CDE', m));
      const b = id(app.workshop.openJob('XY99ZZZ', m));
      const c = id(app.workshop.openJob('KL55MNO', m));
      ok(app.workshop.closeJob(a, 60, 1000));
      ok(app.workshop.closeJob(b, 15, 0));
      on('2026-10-06');
      ok(app.workshop.closeJob(c, 60, 0));
      assert.deepEqual(ok(app.reports.dailyTakings('2026-10-05')), { day: '2026-10-05', jobs: 2, takings: 'EUR 85.00' });
    },
  },
  {
    name: 'the workload board lists every mechanic, busiest first, with the plate of the oldest open job',
    kind: 'feature',
    step: 'workload',
    run: (createApp) => {
      const { app, j3 } = shop(createApp);
      const dan = id(app.workshop.hire('Dan'));
      ok(app.workshop.closeJob(j3, 30, 0));
      assert.ok(dan !== '');
      assert.deepEqual(ok(app.reports.workload()), [
        { mechanic: 'Ana', openJobs: 2, oldestOpenPlate: 'XY99ZZZ' },
        { mechanic: 'Ben', openJobs: 1, oldestOpenPlate: 'AB12CDE' },
        { mechanic: 'Cy', openJobs: 1, oldestOpenPlate: 'GH10IJK' },
        { mechanic: 'Dan', openJobs: 0, oldestOpenPlate: null },
      ]);
    },
  },
  {
    name: 'an open job can be handed to another mechanic',
    kind: 'feature',
    step: 'reassign',
    run: (createApp) => {
      const { app, cy, j2 } = shop(createApp);
      ok(app.workshop.reassignJob(j2, cy));
      assert.equal(ok(app.workshop.job(j2)).mechanicId, cy);
      assert.deepEqual(ok(app.reports.workload()), [
        { mechanic: 'Ben', openJobs: 2, oldestOpenPlate: 'AB12CDE' },
        { mechanic: 'Cy', openJobs: 2, oldestOpenPlate: 'XY99ZZZ' },
        { mechanic: 'Ana', openJobs: 1, oldestOpenPlate: 'PQ77RST' },
      ]);
    },
  },
  {
    name: 'closed jobs and unknown mechanics cannot be reassigned',
    kind: 'feature',
    step: 'reassign',
    run: (createApp) => {
      const { app, ana, cy, j1 } = shop(createApp);
      assert.match(error(app.workshop.reassignJob(j1, 'M-0099')), /no mechanic M-0099/);
      ok(app.workshop.closeJob(j1, 30, 0));
      assert.match(error(app.workshop.reassignJob(j1, cy)), new RegExp(`job ${j1} is closed`));
      assert.match(error(app.workshop.reassignJob('J-0999', ana)), /no job J-0999/);
    },
  },
  {
    name: 'monthly takings per mechanic, highest first, only jobs closed in that month',
    kind: 'feature',
    step: 'monthly-takings',
    run: (createApp) => {
      const { app, on, j1, j2, j3, j4, j5 } = shop(createApp);
      on('2026-10-20');
      ok(app.workshop.closeJob(j1, 60, 2000));
      ok(app.workshop.closeJob(j2, 30, 500));
      ok(app.workshop.closeJob(j4, 60, 0));
      on('2026-11-02');
      ok(app.workshop.closeJob(j3, 600, 99900));
      assert.ok(j5 !== '');
      assert.deepEqual(ok(app.reports.takingsByMechanic('2026-10')), [
        { mechanic: 'Ana', takings: 'EUR 95.00' },
        { mechanic: 'Ben', takings: 'EUR 80.00' },
      ]);
    },
  },
];
