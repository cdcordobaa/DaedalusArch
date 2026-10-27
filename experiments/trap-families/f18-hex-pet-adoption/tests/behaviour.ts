/**
 * F18 behaviour tests: black-box through `createApp` (the seed's entry, which returns the HTTP handlers `shelter` and
 * `frontDesk`). They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface HttpResponse { status: number; body: unknown }
type Handler = (...args: unknown[]) => HttpResponse;
interface App {
  shelter: { admitPet: Handler; registerAdopter: Handler; pet: Handler; apply: Handler; approve: Handler; application: Handler; withdrawApplication: Handler };
  frontDesk: { availablePets: Handler; waitingList: Handler; adoptionsBySpecies: Handler };
}
/** An app whose clock the test moves. */
const setup = (createApp: (o?: Record<string, unknown>) => unknown, start = '2026-09-01'): { app: App; on: (day: string) => void } => {
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
/** Four pets (two arrivals days), three adopters. */
const shelter = (createApp: (o?: Record<string, unknown>) => unknown) => {
  const { app, on } = setup(createApp);
  const rex = id(app.shelter.admitPet('Rex', 'dog'));
  const tom = id(app.shelter.admitPet('Tom', 'cat'));
  on('2026-09-10');
  const bun = id(app.shelter.admitPet('Bun', 'Rabbit'));
  const fido = id(app.shelter.admitPet('Fido', 'dog'));
  const ann = id(app.shelter.registerAdopter('Ann'));
  const bo = id(app.shelter.registerAdopter('Bo'));
  const cy = id(app.shelter.registerAdopter('Cy'));
  return { app, on, rex, tom, bun, fido, ann, bo, cy };
};
/** Three pending applications and one approved one, seen on 2026-10-06. */
const waiting = (createApp: (o?: Record<string, unknown>) => unknown) => {
  const s = shelter(createApp);
  const { app, on } = s;
  on('2026-10-01');
  const a1 = id(app.shelter.apply(s.rex, s.ann));
  on('2026-10-03');
  const a2 = id(app.shelter.apply(s.rex, s.bo));
  const a3 = id(app.shelter.apply(s.tom, s.cy));
  on('2026-10-05');
  const a4 = id(app.shelter.apply(s.bun, s.ann));
  ok(app.shelter.approve(a4));
  on('2026-10-06');
  return { ...s, a1, a2, a3, a4 };
};

export const cases: TestCase[] = [
  {
    name: 'a pet is admitted, applied for and adopted; the other applications for it are rejected',
    kind: 'regression',
    run: (createApp) => {
      const s = shelter(createApp);
      const { app, on } = s;
      on('2026-10-01');
      const a = id(app.shelter.apply(s.rex, s.ann));
      const b = id(app.shelter.apply(s.rex, s.bo));
      assert.deepEqual(ok(app.shelter.pet(s.bun)), { id: s.bun, name: 'Bun', species: 'rabbit', status: 'available', arrivedOn: '2026-09-10', adoptedOn: null });
      on('2026-10-02');
      assert.equal(ok(app.shelter.approve(a)).status, 'approved');
      assert.deepEqual([ok(app.shelter.pet(s.rex)).status, ok(app.shelter.pet(s.rex)).adoptedOn], ['adopted', '2026-10-02']);
      assert.deepEqual(ok(app.shelter.application(b)), { id: b, petId: s.rex, adopterId: s.bo, submittedOn: '2026-10-01', status: 'rejected' });
    },
  },
  {
    name: 'unknown species, unknown pets and adopters, adopted pets, double applications and second decisions are refused',
    kind: 'regression',
    run: (createApp) => {
      const s = shelter(createApp);
      const { app } = s;
      assert.match(error(app.shelter.admitPet('Polly', 'parrot')), /unknown species 'parrot'/);
      assert.match(error(app.shelter.admitPet('  ', 'cat')), /a pet needs a name/);
      assert.match(error(app.shelter.apply('P-0099', s.ann)), /no pet P-0099/);
      assert.match(error(app.shelter.apply(s.rex, 'A-0099')), /no adopter A-0099/);
      const a = id(app.shelter.apply(s.rex, s.ann));
      assert.match(error(app.shelter.apply(s.rex, s.ann)), new RegExp(`adopter ${s.ann} already applied for ${s.rex}`));
      ok(app.shelter.approve(a));
      assert.match(error(app.shelter.approve(a)), new RegExp(`application ${a} is not pending`));
      assert.match(error(app.shelter.apply(s.rex, s.bo)), new RegExp(`pet ${s.rex} is adopted`));
      assert.match(error(app.shelter.application('AP-0999')), /no application AP-0999/);
    },
  },
  {
    name: 'the front desk lists the pets still waiting for a home, longest in the shelter first',
    kind: 'regression',
    run: (createApp) => {
      const s = shelter(createApp);
      const { app, on } = s;
      on('2026-09-15');
      ok(app.shelter.approve(id(app.shelter.apply(s.tom, s.ann))));
      assert.deepEqual(ok(app.frontDesk.availablePets()), [
        { id: s.rex, name: 'Rex', species: 'dog', daysInShelter: 14 },
        { id: s.bun, name: 'Bun', species: 'rabbit', daysInShelter: 5 },
        { id: s.fido, name: 'Fido', species: 'dog', daysInShelter: 5 },
      ]);
    },
  },
  {
    name: 'the waiting list shows every pending application, longest waiting first, with pet and adopter names',
    kind: 'feature',
    step: 'waiting-list',
    run: (createApp) => {
      const { app, a1, a2, a3 } = waiting(createApp);
      assert.deepEqual(ok(app.frontDesk.waitingList()), [
        { application: a1, pet: 'Rex', adopter: 'Ann', waitingDays: 5 },
        { application: a2, pet: 'Rex', adopter: 'Bo', waitingDays: 3 },
        { application: a3, pet: 'Tom', adopter: 'Cy', waitingDays: 3 },
      ]);
    },
  },
  {
    name: 'a pending application can be withdrawn; it leaves the waiting list and the adopter may apply again',
    kind: 'feature',
    step: 'withdraw',
    run: (createApp) => {
      const { app, on, rex, bo, a1, a2, a3 } = waiting(createApp);
      assert.equal(ok(app.shelter.withdrawApplication(a2)).status, 'withdrawn');
      assert.equal(ok(app.shelter.application(a2)).status, 'withdrawn');
      assert.deepEqual((ok(app.frontDesk.waitingList()) as unknown as { application: string }[]).map((e) => e.application), [a1, a3]);
      on('2026-10-07');
      const again = id(app.shelter.apply(rex, bo));
      assert.deepEqual((ok(app.frontDesk.waitingList()) as unknown as { application: string; waitingDays: number }[]).map((e) => [e.application, e.waitingDays]), [[a1, 6], [a3, 4], [again, 0]]);
    },
  },
  {
    name: 'only an existing pending application can be withdrawn',
    kind: 'feature',
    step: 'withdraw',
    run: (createApp) => {
      const { app, a1, a3, a4 } = waiting(createApp);
      assert.match(error(app.shelter.withdrawApplication('AP-0999')), /no application AP-0999/);
      assert.match(error(app.shelter.withdrawApplication(a4)), new RegExp(`application ${a4} is not pending`));
      ok(app.shelter.withdrawApplication(a3));
      assert.match(error(app.shelter.withdrawApplication(a3)), new RegExp(`application ${a3} is not pending`));
      assert.match(error(app.shelter.approve(a3)), new RegExp(`application ${a3} is not pending`));
      assert.equal(ok(app.shelter.application(a1)).status, 'pending');
    },
  },
  {
    name: 'adoptions of a month by species, most first, with the average stay to one decimal',
    kind: 'feature',
    step: 'monthly-adoptions',
    run: (createApp) => {
      const s = shelter(createApp);
      const { app, on } = s;
      on('2026-10-01');
      const kit = id(app.shelter.admitPet('Kit', 'cat'));
      const adopt = (pet: string, adopter: string): void => { ok(app.shelter.approve(id(app.shelter.apply(pet, adopter)))); };
      on('2026-10-11');
      adopt(s.rex, s.ann);
      adopt(s.bun, s.bo);
      on('2026-10-21');
      adopt(s.tom, s.cy);
      adopt(s.fido, s.ann);
      on('2026-11-02');
      adopt(kit, s.bo);
      assert.deepEqual(ok(app.frontDesk.adoptionsBySpecies('2026-10')), [
        { species: 'dog', adopted: 2, averageStayDays: 40.5 },
        { species: 'cat', adopted: 1, averageStayDays: 50 },
        { species: 'rabbit', adopted: 1, averageStayDays: 31 },
      ]);
      assert.deepEqual(ok(app.frontDesk.adoptionsBySpecies('2026-11')), [{ species: 'cat', adopted: 1, averageStayDays: 32 }]);
      assert.deepEqual(ok(app.frontDesk.adoptionsBySpecies('2026-09')), []);
    },
  },
  {
    name: 'a month not written YYYY-MM is refused',
    kind: 'feature',
    step: 'monthly-adoptions',
    run: (createApp) => {
      const { app } = setup(createApp);
      assert.match(error(app.frontDesk.adoptionsBySpecies('2026-13')), /not a month: 2026-13/);
      assert.match(error(app.frontDesk.adoptionsBySpecies('October')), /not a month: October/);
    },
  },
];
