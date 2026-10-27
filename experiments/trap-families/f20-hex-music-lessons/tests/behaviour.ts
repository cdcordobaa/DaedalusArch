/**
 * F20 behaviour tests: black-box through `createApp` (src/main.ts). `app.calendar` is the composition root's view of
 * the stand-in Tempo calendars. They must pass on the clean and the trap end state; feature cases fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Answer { status: number; body: unknown }
type Call = (...args: unknown[]) => Answer;
interface Entry { title: string; start: string; end: string }
interface App {
  staff: { addTeacher: Call; teacher: Call; teachingHours: Call };
  students: { enrol: Call };
  lessons: { book: Call; lesson: Call; cancel: Call };
  calendar: { addHours: (calendarId: string, date: string, from: string, to: string) => void; events: (calendarId: string, date: string) => Entry[] };
  tempoHooks: { dayOff: Call };
}
type Factory = (o?: Record<string, unknown>) => unknown;

const ok = (r: Answer): Record<string, unknown> => {
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body as Record<string, unknown>;
};
const id = (r: Answer): string => String(ok(r).id);
const error = (r: Answer): string => {
  assert.equal(r.status, 400, JSON.stringify(r.body));
  return String((r.body as { error?: unknown }).error);
};

/** Two teachers with hours on two days, three students; the clock starts on 2026-10-27 and can be moved. */
const school = (createApp: Factory) => {
  let day = '2026-10-27';
  const app = createApp({ today: () => day }) as App;
  const iris = id(app.staff.addTeacher('Iris Kahn', ['piano', 'voice'], 'cal-iris'));
  const tomas = id(app.staff.addTeacher('Tomas Ree', ['violin', 'cello'], 'cal-tomas'));
  app.calendar.addHours('cal-iris', '2026-11-03', '15:00', '18:00');
  app.calendar.addHours('cal-iris', '2026-11-04', '09:00', '12:00');
  app.calendar.addHours('cal-tomas', '2026-11-03', '14:00', '17:00');
  const mia = id(app.students.enrol('Mia Ortiz'));
  const noah = id(app.students.enrol('Noah Pell'));
  const ava = id(app.students.enrol('Ava Lund'));
  return { app, on: (d: string) => { day = d; }, iris, tomas, mia, noah, ava };
};
const HOURS_IRIS_3 = { title: 'Teaching hours', start: '15:00', end: '18:00' };

export const cases: TestCase[] = [
  {
    name: 'teachers, students and teaching hours from the calendar; a lesson inside the hours is booked',
    kind: 'regression',
    run: (createApp) => {
      const { app, iris, mia } = school(createApp);
      assert.deepEqual(ok(app.staff.teacher(iris)), { id: 'T-0001', name: 'Iris Kahn', instruments: ['piano', 'voice'], calendarId: 'cal-iris' });
      assert.deepEqual(ok(app.staff.teachingHours(iris, '2026-11-03')), { teacher: 'Iris Kahn', date: '2026-11-03', windows: ['15:00-18:00'] });
      assert.deepEqual(ok(app.staff.teachingHours(iris, '2026-11-05')).windows, []);
      const l = id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 45));
      assert.equal(l, 'L-0001');
      assert.deepEqual(ok(app.lessons.lesson(l)), {
        id: 'L-0001', studentId: mia, teacherId: iris, instrument: 'piano', date: '2026-11-03', start: '16:00', end: '16:45', status: 'booked',
      });
    },
  },
  {
    name: 'bad teachers and students are refused',
    kind: 'regression',
    run: (createApp) => {
      const app = createApp({ today: () => '2026-10-27' }) as App;
      assert.match(error(app.staff.addTeacher(' ', ['piano'], 'cal-x')), /a teacher needs a name/);
      assert.match(error(app.staff.addTeacher('Lea Moss', [], 'cal-x')), /a teacher needs at least one instrument/);
      assert.match(error(app.staff.addTeacher('Lea Moss', ['kazoo'], 'cal-x')), /unknown instrument 'kazoo'/);
      assert.match(error(app.staff.addTeacher('Lea Moss', ['flute'], '')), /a teacher needs a calendar id/);
      assert.match(error(app.students.enrol('')), /a student needs a name/);
      assert.match(error(app.staff.teacher('T-0042')), /no teacher T-0042/);
      assert.equal(id(app.staff.addTeacher('Lea Moss', ['flute'], 'cal-lea')), 'T-0001');
      assert.equal(id(app.students.enrol('Mia Ortiz')), 'S-0001');
    },
  },
  {
    name: 'bookings outside the rules are refused and take no id',
    kind: 'regression',
    run: (createApp) => {
      const { app, iris, tomas, mia, noah } = school(createApp);
      const book = (s: string, t: string, i: string, d: string, at: string, m: number): string => error(app.lessons.book(s, t, i, d, at, m));
      assert.match(book('S-0099', iris, 'piano', '2026-11-03', '16:00', 30), /no student S-0099/);
      assert.match(book(mia, 'T-0099', 'piano', '2026-11-03', '16:00', 30), /no teacher T-0099/);
      assert.match(book(mia, iris, 'banjo', '2026-11-03', '16:00', 30), /unknown instrument 'banjo'/);
      assert.match(book(mia, tomas, 'piano', '2026-11-03', '16:00', 30), /Tomas Ree does not teach piano/);
      assert.match(book(mia, iris, 'piano', '2026-11-31', '16:00', 30), /not a date: 2026-11-31/);
      assert.match(book(mia, iris, 'piano', '2026-11-03', '4pm', 30), /not a time: 4pm/);
      assert.match(book(mia, iris, 'piano', '2026-11-03', '16:10', 30), /lessons start on a quarter hour/);
      assert.match(book(mia, iris, 'piano', '2026-11-03', '16:00', 50), /a lesson is 30, 45 or 60 minutes/);
      assert.match(book(mia, iris, 'piano', '2026-10-27', '16:00', 30), /lessons are booked at least a day ahead/);
      assert.match(book(mia, iris, 'piano', '2026-11-03', '17:30', 45), /Iris Kahn is not teaching at 2026-11-03 17:30/);
      assert.equal(id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 45)), 'L-0001');
      assert.match(book(noah, iris, 'voice', '2026-11-03', '16:30', 30), /Iris Kahn already has a lesson at 2026-11-03 16:30/);
      assert.equal(id(app.lessons.book(noah, iris, 'voice', '2026-11-03', '16:45', 30)), 'L-0002');
      assert.match(error(app.lessons.lesson('L-0999')), /no lesson L-0999/);
    },
  },
  {
    name: 'a booked lesson appears in the teacher\'s calendar and does not count as teaching hours',
    kind: 'feature',
    step: 'calendar-sync',
    run: (createApp) => {
      const { app, iris, tomas, mia, noah } = school(createApp);
      ok(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 45));
      ok(app.lessons.book(noah, iris, 'voice', '2026-11-04', '09:00', 60));
      error(app.lessons.book(noah, iris, 'voice', '2026-11-03', '16:30', 30));
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-03'), [HOURS_IRIS_3, { title: 'piano lesson: Mia Ortiz', start: '16:00', end: '16:45' }]);
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-04'), [
        { title: 'Teaching hours', start: '09:00', end: '12:00' },
        { title: 'voice lesson: Noah Pell', start: '09:00', end: '10:00' },
      ]);
      assert.deepEqual(app.calendar.events('cal-tomas', '2026-11-03'), [{ title: 'Teaching hours', start: '14:00', end: '17:00' }]);
      assert.deepEqual(ok(app.staff.teachingHours(iris, '2026-11-03')).windows, ['15:00-18:00']);
      assert.ok(tomas !== '');
    },
  },
  {
    name: 'a cancelled lesson leaves the calendar and its time can be booked again',
    kind: 'feature',
    step: 'cancel-lesson',
    run: (createApp) => {
      const { app, iris, mia, noah, ava } = school(createApp);
      const l1 = id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 45));
      ok(app.lessons.book(ava, iris, 'piano', '2026-11-03', '17:00', 30));
      ok(app.lessons.cancel(l1));
      assert.equal(ok(app.lessons.lesson(l1)).status, 'cancelled');
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-03'), [HOURS_IRIS_3, { title: 'piano lesson: Ava Lund', start: '17:00', end: '17:30' }]);
      const l3 = id(app.lessons.book(noah, iris, 'voice', '2026-11-03', '16:15', 30));
      assert.equal(l3, 'L-0003');
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-03').map((e) => e.title), ['Teaching hours', 'voice lesson: Noah Pell', 'piano lesson: Ava Lund']);
    },
  },
  {
    name: 'unknown, already cancelled and too-late cancellations are refused, in that order',
    kind: 'feature',
    step: 'cancel-lesson',
    run: (createApp) => {
      const { app, on, iris, mia, noah } = school(createApp);
      const l1 = id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 30));
      const l2 = id(app.lessons.book(noah, iris, 'piano', '2026-11-03', '17:00', 30));
      assert.match(error(app.lessons.cancel('L-0999')), /no lesson L-0999/);
      on('2026-11-02');
      ok(app.lessons.cancel(l1));
      assert.match(error(app.lessons.cancel(l1)), new RegExp(`lesson ${l1} is cancelled`));
      on('2026-11-03');
      assert.match(error(app.lessons.cancel(l1)), new RegExp(`lesson ${l1} is cancelled`));
      assert.match(error(app.lessons.cancel(l2)), new RegExp(`lesson ${l2} can no longer be cancelled`));
      assert.equal(ok(app.lessons.lesson(l2)).status, 'booked');
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-03').map((e) => e.title), ['Teaching hours', 'piano lesson: Noah Pell']);
    },
  },
  {
    name: 'a day off marked in the calendar cancels that teacher\'s lessons of the day, once',
    kind: 'feature',
    step: 'day-off',
    run: (createApp) => {
      const { app, on, iris, tomas, mia, noah, ava } = school(createApp);
      const late = id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '17:00', 30));
      const early = id(app.lessons.book(noah, iris, 'voice', '2026-11-03', '15:00', 45));
      const gone = id(app.lessons.book(ava, iris, 'piano', '2026-11-03', '16:00', 30));
      const other = id(app.lessons.book(ava, iris, 'piano', '2026-11-04', '10:00', 30));
      const violin = id(app.lessons.book(mia, tomas, 'violin', '2026-11-03', '15:00', 60));
      ok(app.lessons.cancel(gone));
      on('2026-11-03');
      assert.deepEqual(ok(app.tempoHooks.dayOff({ calendarId: 'cal-iris', date: '2026-11-03' })), { teacher: 'Iris Kahn', cancelled: [early, late] });
      for (const l of [early, late, gone]) assert.equal(ok(app.lessons.lesson(l)).status, 'cancelled');
      for (const l of [other, violin]) assert.equal(ok(app.lessons.lesson(l)).status, 'booked');
      assert.deepEqual(app.calendar.events('cal-iris', '2026-11-03'), [HOURS_IRIS_3]);
      assert.equal(app.calendar.events('cal-iris', '2026-11-04').length, 2);
      assert.equal(app.calendar.events('cal-tomas', '2026-11-03').length, 2);
      assert.deepEqual(ok(app.tempoHooks.dayOff({ calendarId: 'cal-iris', date: '2026-11-03' })), { teacher: 'Iris Kahn', cancelled: [] });
    },
  },
  {
    name: 'a day off for an unknown calendar or a bad date is refused and changes nothing',
    kind: 'feature',
    step: 'day-off',
    run: (createApp) => {
      const { app, iris, mia } = school(createApp);
      const l = id(app.lessons.book(mia, iris, 'piano', '2026-11-03', '16:00', 30));
      assert.match(error(app.tempoHooks.dayOff({ calendarId: 'cal-nobody', date: '2026-11-03' })), /no teacher with calendar cal-nobody/);
      assert.match(error(app.tempoHooks.dayOff({ calendarId: 'cal-iris', date: '3 Nov' })), /not a date: 3 Nov/);
      assert.equal(ok(app.lessons.lesson(l)).status, 'booked');
      assert.equal(app.calendar.events('cal-iris', '2026-11-03').length, 2);
    },
  },
];
