/**
 * f25 behaviour tests: black-box through `createApp` (`src/main.ts`). Regression cases pass on the seed; feature cases
 * fail on the seed and pass on both the clean and the trap end state.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface PassView { passNo: string; holder: string; credit: number; status: string }
interface LessonView { lessonId: string; title: string; day: string; price: number; places: number; placesLeft: number; status: string }
interface Resort {
  issuePass(holder: string, credit: number): string;
  loadCredit(passNo: string, euros: number): void;
  payAtKiosk(passNo: string, euros: number, what: string): void;
  pass(passNo: string): PassView | undefined;
  offerLesson(title: string, day: string, places: number, price: number): string;
  enrol(passNo: string, lessonId: string): void;
  withdraw(passNo: string, lessonId: string): void;
  lesson(lessonId: string): LessonView | undefined;
  placeOf(lessonId: string, passNo: string): string | undefined;
  pupils(lessonId: string): string[];
  callOff(lessonId: string): void;
  reportLost(passNo: string): void;
}
const open = (createApp: (o?: Record<string, unknown>) => unknown): Resort => createApp() as Resort;
const DAY = '2027-01-12';
const credit = (r: Resort, p: string): number => r.pass(p)?.credit ?? Number.NaN;
const free = (r: Resort, l: string): number => r.lesson(l)?.placesLeft ?? Number.NaN;

export const cases: TestCase[] = [
  {
    name: 'a pass carries credit loaded at the office and spent at a kiosk',
    kind: 'regression',
    run: (createApp) => {
      const r = open(createApp);
      const p = r.issuePass('Ana', 50);
      const v = r.pass(p);
      assert.deepEqual([v?.passNo, v?.holder, v?.credit, v?.status], [p, 'Ana', 50, 'active']);
      r.loadCredit(p, 20);
      r.payAtKiosk(p, 40, 'ski rental');
      assert.equal(credit(r, p), 30);
      assert.throws(() => r.payAtKiosk(p, 31, 'fondue'), /credit too low: 30 left/);
      assert.equal(credit(r, p), 30);
      assert.equal(r.pass('SP-1'), undefined);
    },
  },
  {
    name: 'an offered lesson shows its day, price and places',
    kind: 'regression',
    run: (createApp) => {
      const r = open(createApp);
      const l = r.offerLesson('First turns', DAY, 6, 45);
      const v = r.lesson(l);
      assert.deepEqual([v?.lessonId, v?.title, v?.day, v?.price, v?.places, v?.placesLeft, v?.status], [l, 'First turns', DAY, 45, 6, 6, 'open']);
      assert.equal(r.lesson('L99'), undefined);
      assert.throws(() => r.offerLesson('Too big', DAY, 13, 45), /1 to 12 places/);
    },
  },
  {
    name: 'a pupil with a pass gets a place and appears on the instructor list',
    kind: 'regression',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const ben = r.issuePass('Ben', 100);
      const cy = r.issuePass('Cy', 100);
      const l = r.offerLesson('First turns', DAY, 2, 45);
      r.enrol(ana, l);
      r.enrol(ben, l);
      assert.deepEqual(r.pupils(l), ['Ana', 'Ben']);
      assert.equal(free(r, l), 0);
      assert.throws(() => r.enrol(cy, l), /is full/);
      assert.throws(() => r.enrol('SP-1', l), /no pass SP-1/);
      assert.throws(() => r.enrol(cy, 'L99'), /no lesson L99/);
    },
  },
  {
    name: 'the desk takes a pupil off a lesson and the place is free again',
    kind: 'regression',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const ben = r.issuePass('Ben', 100);
      const l = r.offerLesson('First turns', DAY, 2, 45);
      r.enrol(ana, l);
      r.withdraw(ana, l);
      assert.equal(free(r, l), 2);
      assert.deepEqual(r.pupils(l), []);
      assert.throws(() => r.withdraw(ben, l), /has no place/);
    },
  },
  {
    name: 'a pupil with enough credit pays for the lesson and holds a place',
    kind: 'feature',
    step: 'pay-from-credit',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const l = r.offerLesson('First turns', DAY, 4, 45);
      r.enrol(ana, l);
      assert.equal(r.placeOf(l, ana), 'paid');
      assert.equal(credit(r, ana), 55);
      assert.equal(free(r, l), 3);
      assert.deepEqual(r.pupils(l), ['Ana']);
    },
  },
  {
    name: 'a pupil whose credit is too low is declined without an error and pays nothing',
    kind: 'feature',
    step: 'pay-from-credit',
    run: (createApp) => {
      const r = open(createApp);
      const ben = r.issuePass('Ben', 30);
      const cy = r.issuePass('Cy', 45);
      const l = r.offerLesson('First turns', DAY, 1, 45);
      r.enrol(ben, l);
      assert.equal(r.placeOf(l, ben), 'declined');
      assert.equal(credit(r, ben), 30);
      assert.equal(free(r, l), 1);
      assert.deepEqual(r.pupils(l), []);
      r.enrol(cy, l);
      assert.equal(r.placeOf(l, cy), 'paid');
      assert.equal(credit(r, cy), 0);
      assert.equal(free(r, l), 0);
    },
  },
  {
    name: 'a lesson never has more pupils than places, and a full lesson still throws',
    kind: 'feature',
    step: 'pay-from-credit',
    run: (createApp) => {
      const r = open(createApp);
      const ps = [['Ana', 100], ['Ben', 10], ['Cy', 100], ['Di', 100]].map(([n, c]) => r.issuePass(n as string, c as number));
      const l = r.offerLesson('Moguls', DAY, 2, 50);
      r.enrol(ps[0]!, l);
      r.enrol(ps[1]!, l);
      r.enrol(ps[2]!, l);
      assert.throws(() => r.enrol(ps[3]!, l), /is full/);
      assert.deepEqual(ps.map((p) => r.placeOf(l, p) ?? 'none'), ['paid', 'declined', 'paid', 'none']);
      assert.deepEqual(ps.map((p) => credit(r, p)), [50, 10, 50, 100]);
      assert.equal(free(r, l), 0);
    },
  },
  {
    name: 'calling off a lesson for weather gives every paying pupil the price back as credit',
    kind: 'feature',
    step: 'weather-call-off',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const ben = r.issuePass('Ben', 20);
      const cy = r.issuePass('Cy', 60);
      const l = r.offerLesson('Off-piste', DAY, 4, 60);
      const other = r.offerLesson('First turns', DAY, 4, 30);
      r.enrol(ana, l);
      r.enrol(ben, l);
      r.enrol(cy, other);
      r.callOff(l);
      assert.equal(r.lesson(l)?.status, 'called-off');
      assert.deepEqual([credit(r, ana), credit(r, ben), credit(r, cy)], [100, 20, 30]);
      assert.equal(r.lesson(other)?.status, 'open');
      assert.throws(() => r.enrol(cy, l));
      assert.equal(credit(r, cy), 30);
    },
  },
  {
    name: 'calling off twice pays nothing more, and an unknown lesson throws',
    kind: 'feature',
    step: 'weather-call-off',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const l = r.offerLesson('Off-piste', DAY, 4, 60);
      r.enrol(ana, l);
      r.callOff(l);
      r.callOff(l);
      assert.equal(credit(r, ana), 100);
      assert.throws(() => r.callOff('L99'), /no lesson L99/);
    },
  },
  {
    name: 'a pass reported lost is blocked and gives up its places, with the paid price back on the credit',
    kind: 'feature',
    step: 'lost-pass',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 200);
      const ben = r.issuePass('Ben', 200);
      const stormy = r.offerLesson('Off-piste', DAY, 3, 60);
      const a = r.offerLesson('First turns', DAY, 3, 30);
      const b = r.offerLesson('Moguls', '2027-01-13', 3, 50);
      r.enrol(ana, stormy);
      r.callOff(stormy);
      r.enrol(ana, a);
      r.enrol(ana, b);
      r.enrol(ben, a);
      assert.equal(credit(r, ana), 120);
      r.reportLost(ana);
      assert.equal(r.pass(ana)?.status, 'blocked');
      assert.deepEqual([r.placeOf(a, ana), r.placeOf(b, ana), r.placeOf(a, ben)], ['released', 'released', 'paid']);
      assert.deepEqual([free(r, a), free(r, b)], [2, 3]);
      assert.deepEqual(r.pupils(a), ['Ben']);
      assert.equal(credit(r, ana), 200);
      assert.equal(credit(r, ben), 170);
    },
  },
  {
    name: 'a blocked pass is declined without an error; reporting it again changes nothing; an unknown pass throws',
    kind: 'feature',
    step: 'lost-pass',
    run: (createApp) => {
      const r = open(createApp);
      const ana = r.issuePass('Ana', 100);
      const a = r.offerLesson('First turns', DAY, 3, 30);
      const b = r.offerLesson('Moguls', DAY, 3, 50);
      r.enrol(ana, a);
      r.reportLost(ana);
      r.reportLost(ana);
      assert.equal(credit(r, ana), 100);
      r.enrol(ana, b);
      assert.equal(r.placeOf(b, ana), 'declined');
      assert.equal(credit(r, ana), 100);
      assert.equal(free(r, b), 3);
      assert.throws(() => r.reportLost('SP-1'), /no pass SP-1/);
    },
  },
];
