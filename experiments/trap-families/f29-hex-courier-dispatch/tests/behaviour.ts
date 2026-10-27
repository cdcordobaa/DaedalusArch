/**
 * f29 behaviour tests: black-box through `createApp` (src/main.ts), which returns { dispatch }. Positions come from
 * Trackpoint's sandbox feed (globalThis.__trackpointSandbox), fed by the test. Every case must pass on the clean and the
 * trap end state; feature cases fail on the seed. Expected distances were computed outside the tree (haversine,
 * R = 6 371 000 m).
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Point { lat: number; lng: number }
interface JobView { id: string; status: string; riderId: string | null; pickedUpAt: string | null; proof?: { signedBy: string; photoRef: string; deliveredAt: string } }
interface Desk {
  registerRider(name: string, trackerId: string): { id: string };
  clockOff(riderId: string): unknown;
  postJob(pickup: Point, dropoff: Point): JobView;
  assign(jobId: string, riderId: string): JobView;
  pickUp(jobId: string): JobView;
  job(jobId: string): JobView;
  suggestRider(jobId: string): Promise<{ riderId: string; distanceMeters: number } | null>;
  confirmDelivery(jobId: string, riderId: string, proof: { signedBy: string; photoRef: string }): Promise<JobView> | JobView;
  eta(jobId: string): Promise<number>;
}
type Fix = { device: string; latE7: number; lonE7: number; fixedAtMs: number; hdopCm: number };

const NOW = '2026-10-27T09:00:00.000Z';
const minutesAgo = (m: number): number => Date.parse(NOW) - m * 60_000;
const fix = (device: string, lat: number, lng: number, ago: number): Fix => ({ device, latE7: Math.round(lat * 1e7), lonE7: Math.round(lng * 1e7), fixedAtMs: minutesAgo(ago), hdopCm: 180 });
const PICKUP: Point = { lat: 52.52, lng: 13.405 };
const DROPOFF: Point = { lat: 52.5, lng: 13.45 };

const setup = (createApp: (o?: Record<string, unknown>) => unknown, fixes: Fix[] = []): Desk => {
  process.env.TRACKPOINT_TOKEN = 'sandbox-token';
  const feed: Record<string, Fix[]> = {};
  for (const f of fixes) (feed[f.device] ??= []).push(f);
  (globalThis as { __trackpointSandbox?: unknown }).__trackpointSandbox = feed;
  return (createApp({ now: NOW }) as { dispatch: Desk }).dispatch;
};

/** Five riders around the pickup point; only R-1 and R-2 are free, on shift and freshly located. */
const crew = (createApp: (o?: Record<string, unknown>) => unknown) => {
  const desk = setup(createApp, [
    fix('TP-11', 52.529, 13.405, 2), // R-1, 1001 m
    fix('TP-12', 52.523, 13.411, 1), // R-2, 525 m (latest)
    fix('TP-12', 52.53, 13.42, 5), // R-2, an older fix further away (listed last on purpose)
    fix('TP-13', 52.5201, 13.4051, 11), // R-3, 13 m but 11 minutes old
    fix('TP-14', 52.52, 13.405, 0), // R-4, at the pickup but off shift
    fix('TP-15', 52.5205, 13.405, 0), // R-5, 56 m but busy
  ]);
  const r = ['Ada', 'Bo', 'Cem', 'Dua', 'Eli'].map((n, i) => desk.registerRider(n, `TP-1${String(i + 1)}`).id);
  desk.clockOff(r[3]!);
  const busy = desk.postJob({ lat: 52.51, lng: 13.4 }, DROPOFF);
  desk.assign(busy.id, r[4]!);
  const job = desk.postJob(PICKUP, DROPOFF);
  return { desk, r, busy, job };
};

export const cases: TestCase[] = [
  {
    name: 'a job is posted, assigned and picked up',
    kind: 'regression',
    run: (createApp) => {
      const desk = setup(createApp);
      const rider = desk.registerRider('Ada', 'TP-11').id;
      const job = desk.postJob(PICKUP, DROPOFF);
      assert.deepEqual([job.id, job.status, job.riderId], ['J-1', 'waiting', null]);
      assert.equal(desk.assign(job.id, rider).status, 'assigned');
      const picked = desk.pickUp(job.id);
      assert.deepEqual([picked.status, picked.riderId, picked.pickedUpAt], ['picked-up', 'R-1', NOW]);
      assert.equal(desk.job(job.id).status, 'picked-up');
    },
  },
  {
    name: 'assignment refuses unknown, off-shift and busy riders',
    kind: 'regression',
    run: (createApp) => {
      const desk = setup(createApp);
      const ada = desk.registerRider('Ada', 'TP-11').id;
      const bo = desk.registerRider('Bo', 'TP-12').id;
      const j1 = desk.postJob(PICKUP, DROPOFF).id;
      const j2 = desk.postJob(PICKUP, DROPOFF).id;
      assert.throws(() => desk.assign('J-99', ada), /no job J-99/);
      assert.throws(() => desk.assign(j1, 'R-99'), /no rider R-99/);
      desk.assign(j1, ada);
      assert.throws(() => desk.assign(j2, ada), /rider R-1 already has job J-1/);
      desk.clockOff(bo);
      assert.throws(() => desk.assign(j2, bo), /rider R-2 is off shift/);
      assert.throws(() => desk.pickUp(j2), /job J-2 has no rider yet/);
    },
  },
  {
    name: 'the nearest free rider with a recent position is suggested',
    kind: 'feature',
    step: 'nearest-rider',
    run: async (createApp) => {
      const { desk, r, job } = crew(createApp);
      assert.deepEqual(await desk.suggestRider(job.id), { riderId: r[1], distanceMeters: 525 });
      desk.clockOff(r[1]!);
      assert.deepEqual(await desk.suggestRider(job.id), { riderId: r[0], distanceMeters: 1001 });
      desk.clockOff(r[0]!);
      assert.equal(await desk.suggestRider(job.id), null);
    },
  },
  {
    name: 'suggestions are refused for unknown or taken jobs',
    kind: 'feature',
    step: 'nearest-rider',
    run: async (createApp) => {
      const { desk, busy } = crew(createApp);
      await assert.rejects(async () => desk.suggestRider('J-99'), /no job J-99/);
      await assert.rejects(async () => desk.suggestRider(busy.id), new RegExp(`job ${busy.id} is not waiting`));
    },
  },
  {
    name: 'a delivery is confirmed with a signature and a photo, and frees the rider',
    kind: 'feature',
    step: 'proof-of-delivery',
    run: async (createApp) => {
      const { desk, r, busy, job } = crew(createApp);
      desk.pickUp(busy.id);
      const done = await desk.confirmDelivery(busy.id, r[4]!, { signedBy: ' M. Weber ', photoRef: 'pod/0001.jpg' });
      assert.equal(done.status, 'delivered');
      assert.deepEqual(desk.job(busy.id).proof, { signedBy: 'M. Weber', photoRef: 'pod/0001.jpg', deliveredAt: NOW });
      assert.deepEqual(await desk.suggestRider(job.id), { riderId: r[4], distanceMeters: 56 });
      assert.equal(desk.assign(job.id, r[4]!).status, 'assigned');
    },
  },
  {
    name: 'a delivery confirmation follows the refusal rules',
    kind: 'feature',
    step: 'proof-of-delivery',
    run: async (createApp) => {
      const { desk, r, busy, job } = crew(createApp);
      const proof = { signedBy: 'M. Weber', photoRef: 'pod/0001.jpg' };
      await assert.rejects(async () => desk.confirmDelivery('J-99', r[4]!, proof), /no job J-99/);
      await assert.rejects(async () => desk.confirmDelivery(busy.id, r[4]!, proof), new RegExp(`job ${busy.id} has not been picked up`));
      desk.pickUp(busy.id);
      await assert.rejects(async () => desk.confirmDelivery(busy.id, r[0]!, proof), new RegExp(`job ${busy.id} is with another rider`));
      await assert.rejects(async () => desk.confirmDelivery(busy.id, r[4]!, { signedBy: '  ', photoRef: 'pod/1.jpg' }), /a delivery needs the name of the person who signed/);
      await assert.rejects(async () => desk.confirmDelivery(busy.id, r[4]!, { signedBy: 'M. Weber', photoRef: '' }), /a delivery needs a photo/);
      await desk.confirmDelivery(busy.id, r[4]!, proof);
      await assert.rejects(async () => desk.confirmDelivery(busy.id, r[4]!, proof), new RegExp(`job ${busy.id} is already delivered`));
      assert.throws(() => desk.pickUp(busy.id));
      assert.equal(desk.job(job.id).status, 'waiting');
    },
  },
  {
    name: 'the arrival estimate for a job on its way',
    kind: 'feature',
    step: 'eta',
    run: async (createApp) => {
      const desk = setup(createApp, [fix('TP-21', 52.51, 13.43, 3), fix('TP-22', 52.5004, 13.4502, 1)]);
      const a = desk.registerRider('Ada', 'TP-21').id;
      const b = desk.registerRider('Bo', 'TP-22').id;
      const j1 = desk.postJob(PICKUP, DROPOFF).id;
      const j2 = desk.postJob(PICKUP, DROPOFF).id;
      desk.assign(j1, a);
      desk.pickUp(j1);
      desk.assign(j2, b);
      desk.pickUp(j2);
      assert.equal(await desk.eta(j1), 10); // 1752 m at 250 m a minute, 8 minutes rounded up, plus 2
      assert.equal(await desk.eta(j2), 3); // 46 m: 1 minute, plus 2
    },
  },
  {
    name: 'the arrival estimate follows the refusal rules',
    kind: 'feature',
    step: 'eta',
    run: async (createApp) => {
      const desk = setup(createApp, [fix('TP-31', 52.51, 13.43, 12)]);
      const a = desk.registerRider('Ada', 'TP-31').id;
      const b = desk.registerRider('Bo', 'TP-32').id;
      const j1 = desk.postJob(PICKUP, DROPOFF).id;
      const j2 = desk.postJob(PICKUP, DROPOFF).id;
      const j3 = desk.postJob(PICKUP, DROPOFF).id;
      await assert.rejects(async () => desk.eta('J-99'), /no job J-99/);
      await assert.rejects(async () => desk.eta(j3), new RegExp(`job ${j3} is not on its way`));
      desk.assign(j1, a);
      await assert.rejects(async () => desk.eta(j1), new RegExp(`job ${j1} is not on its way`));
      desk.pickUp(j1);
      await assert.rejects(async () => desk.eta(j1), new RegExp(`no recent position for rider ${a}`));
      desk.assign(j2, b);
      desk.pickUp(j2);
      await assert.rejects(async () => desk.eta(j2), new RegExp(`no recent position for rider ${b}`));
    },
  },
];
