/**
 * F1 behaviour tests: black-box through `createApp` (the seed's entry). They must pass on the clean and the trap end
 * state; the feature cases must fail on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface App {
  openSection(courseCode: string, capacity: number): string;
  enrol(sectionId: string, studentId: string): void;
  drop(sectionId: string, studentId: string): void;
  rosterOf(sectionId: string): string[];
  notices(): string[];
  switchSection(studentId: string, fromSectionId: string, toSectionId: string): unknown;
  history(sectionId: string): { kind: string; studentId: string; otherSection: string | null }[];
}

type Factory = (options?: Record<string, unknown>) => unknown;
const make = (createApp: Factory, day = '2026-10-21'): { app: App; setDay: (d: string) => void } => {
  let today = day;
  const app = createApp({ today: () => today }) as App;
  return { app, setDay: (d) => { today = d; } };
};
/** Two sections of the same course; the first holds the given students. */
const twoSections = (app: App, students: string[], capacity = 10): [string, string] => {
  const a = app.openSection('CS101', capacity);
  const b = app.openSection('CS101', capacity);
  for (const s of students) app.enrol(a, s);
  return [a, b];
};
const sorted = (xs: string[]): string[] => [...xs].sort();

export const cases: TestCase[] = [
  {
    name: 'enrol and drop change the roster',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openSection('CS101', 3);
      app.enrol(a, 'st-1');
      app.enrol(a, 'st-2');
      app.drop(a, 'st-1');
      assert.deepEqual(app.rosterOf(a), ['st-2']);
      assert.throws(() => app.drop(a, 'st-1'), /not enrolled/);
      assert.throws(() => app.enrol(a, 'st-2'), /already enrolled/);
    },
  },
  {
    name: 'enrolling in a full section is refused and says how full it is',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openSection('CS101', 2);
      app.enrol(a, 'st-1');
      app.enrol(a, 'st-2');
      assert.throws(() => app.enrol(a, 'st-3'), /section full: S-0001 has 2 of 2 seats taken/);
      assert.deepEqual(app.rosterOf(a), ['st-1', 'st-2']);
    },
  },
  {
    name: 'opening a section sends an opening notice',
    kind: 'regression',
    run: (createApp) => {
      const { app } = make(createApp);
      const a = app.openSection('CS101', 30);
      assert.ok(app.notices().some((n) => n.includes(a) && n.includes('CS101') && n.includes('open')));
    },
  },
  {
    name: 'a switch moves the student from one section to the other',
    kind: 'feature',
    step: 'switches',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoSections(app, ['st-1', 'st-2']);
      app.switchSection('st-1', a, b);
      assert.deepEqual(app.rosterOf(a), ['st-2']);
      assert.deepEqual(app.rosterOf(b), ['st-1']);
    },
  },
  {
    name: 'a switch into a full section is refused and nothing changes',
    kind: 'feature',
    step: 'switches',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoSections(app, ['st-1'], 1);
      app.enrol(b, 'st-9');
      assert.throws(() => app.switchSection('st-1', a, b), /section full/);
      assert.deepEqual(app.rosterOf(a), ['st-1']);
      assert.deepEqual(app.rosterOf(b), ['st-9']);
    },
  },
  {
    name: 'a switch across courses, to an unknown section or for a student not in the section is refused',
    kind: 'feature',
    step: 'switches',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoSections(app, ['st-1']);
      const other = app.openSection('MA201', 10);
      assert.equal(typeof app.switchSection, 'function');
      assert.throws(() => app.switchSection('st-1', a, other));
      assert.throws(() => app.switchSection('st-1', a, 'S-9999'));
      assert.throws(() => app.switchSection('st-7', a, b));
      assert.throws(() => app.switchSection('st-1', a, a));
      assert.deepEqual(app.rosterOf(a), ['st-1']);
      assert.deepEqual(app.rosterOf(b), []);
      assert.deepEqual(app.rosterOf(other), []);
    },
  },
  {
    name: 'switches over the daily limit are refused and say how many came in today',
    kind: 'feature',
    step: 'daily-limit',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoSections(app, ['st-1', 'st-2', 'st-3', 'st-4']);
      app.switchSection('st-1', a, b);
      app.switchSection('st-2', a, b);
      app.switchSection('st-3', a, b);
      assert.throws(() => app.switchSection('st-4', a, b), /daily switch limit reached: S-0002 already took 3 students by switch today/);
      assert.deepEqual(app.rosterOf(a), ['st-4']);
      assert.deepEqual(sorted(app.rosterOf(b)), ['st-1', 'st-2', 'st-3']);
      app.enrol(b, 'st-8');
      assert.equal(app.rosterOf(b).length, 4);
    },
  },
  {
    name: 'the daily limit starts again the next day and counts only students taken in',
    kind: 'feature',
    step: 'daily-limit',
    run: (createApp) => {
      const { app, setDay } = make(createApp);
      const [a, b] = twoSections(app, ['st-1', 'st-2', 'st-3', 'st-4']);
      const c = app.openSection('CS101', 10);
      app.switchSection('st-1', a, b);
      app.switchSection('st-2', a, b);
      app.switchSection('st-3', a, b);
      app.switchSection('st-1', b, c);
      app.switchSection('st-2', b, c);
      setDay('2026-10-22');
      app.switchSection('st-4', a, b);
      app.switchSection('st-1', c, b);
      assert.deepEqual(app.rosterOf(a), []);
      assert.deepEqual(sorted(app.rosterOf(b)), ['st-1', 'st-3', 'st-4']);
      assert.deepEqual(app.rosterOf(c), ['st-2']);
    },
  },
  {
    name: 'the history lists roster changes newest first with the other section',
    kind: 'feature',
    step: 'history',
    run: (createApp) => {
      const { app } = make(createApp);
      const [a, b] = twoSections(app, ['st-1', 'st-2']);
      app.drop(a, 'st-2');
      app.switchSection('st-1', a, b);
      assert.deepEqual(app.history(a), [
        { kind: 'switched-out', studentId: 'st-1', otherSection: b },
        { kind: 'dropped', studentId: 'st-2', otherSection: null },
        { kind: 'enrolled', studentId: 'st-2', otherSection: null },
        { kind: 'enrolled', studentId: 'st-1', otherSection: null },
      ]);
      assert.deepEqual(app.history(b), [{ kind: 'switched-in', studentId: 'st-1', otherSection: a }]);
    },
  },
];
