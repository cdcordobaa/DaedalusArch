/**
 * f27 behaviour tests, black-box through the tree's `createApp`. Every case passes on the clean and the trap end
 * state; every feature case fails on the seed.
 */
import assert from 'node:assert/strict';
import type { TestCase } from '../../../puzzle-01/tools/run-tests';

interface Sheet { studentId: string; name: string; standing: number; level: string }
interface School {
  registerStudent(name: string): string;
  recordPlacementTest(studentId: string, score: number): void;
  progressSheet(studentId: string): Sheet | undefined;
  openCourse(courseCode: string, minimumLevel: string, capacity: number): string;
  joinCourse(runId: string, studentId: string): { runId: string; studentId: string; seatsLeft: number; level?: string };
  completeCourse(runId: string, studentId: string): void;
  certificates(): string[];
}

const school = (createApp: (o?: Record<string, unknown>) => unknown): School => createApp() as School;
/** A registered student, with one placement test when `score` is given. */
const student = (s: School, name: string, score?: number): string => {
  const id = s.registerStudent(name);
  if (score !== undefined) s.recordPlacementTest(id, score);
  return id;
};

export const cases: TestCase[] = [
  {
    name: 'the progress sheet shows the best score as standing, and the level',
    kind: 'regression',
    run: (createApp) => {
      const s = school(createApp);
      const ana = student(s, 'Ana', 50);
      s.recordPlacementTest(ana, 66);
      s.recordPlacementTest(ana, 30);
      assert.deepEqual(s.progressSheet(ana), { studentId: ana, name: 'Ana', standing: 66, level: 'B1' });
      assert.deepEqual([undefined, 45, 80, 92].map((n) => s.progressSheet(student(s, 'Xan', n))?.level), ['A1', 'A2', 'B2', 'C1']);
      assert.equal(s.progressSheet('S-999'), undefined);
    },
  },
  {
    name: 'a test score outside 0..100 or for an unknown student is refused',
    kind: 'regression',
    run: (createApp) => {
      const s = school(createApp);
      const ben = student(s, 'Ben');
      assert.throws(() => s.recordPlacementTest(ben, 101), /test score/);
      assert.throws(() => s.recordPlacementTest(ben, 7.5), /test score/);
      assert.throws(() => s.recordPlacementTest('S-999', 50), /no student/);
      assert.throws(() => s.registerStudent('  '), /needs a name/);
    },
  },
  {
    name: 'students join an A1 course until it is full, once each',
    kind: 'regression',
    run: (createApp) => {
      const s = school(createApp);
      const run = s.openCourse('ES-START', 'A1', 2);
      const a = student(s, 'Ana');
      const b = student(s, 'Ben', 70);
      assert.equal(s.joinCourse(run, a).seatsLeft, 1);
      assert.throws(() => s.joinCourse(run, a), /already joined/);
      assert.equal(s.joinCourse(run, b).seatsLeft, 0);
      assert.throws(() => s.joinCourse(run, student(s, 'Cai')), /full/);
      assert.throws(() => s.joinCourse('R99', a), /no course run/);
      assert.throws(() => s.joinCourse(s.openCourse('ES-START', 'A1', 5), 'S-999'), /no student/);
    },
  },
  {
    name: 'a course needs a known CEFR level and at least one seat',
    kind: 'regression',
    run: (createApp) => {
      const s = school(createApp);
      assert.throws(() => s.openCourse('DE-X', 'D9', 3), /unknown CEFR level/);
      assert.throws(() => s.openCourse('DE-X', 'A1', 0), /at least one seat/);
    },
  },
  {
    name: 'a completed course earns one certificate; strangers and repeats are refused',
    kind: 'regression',
    run: (createApp) => {
      const s = school(createApp);
      const run = s.openCourse('IT-101', 'A1', 4);
      const dora = student(s, 'Dora');
      s.joinCourse(run, dora);
      s.completeCourse(run, dora);
      const issued = s.certificates();
      assert.equal(issued.length, 1);
      assert.ok(issued[0]?.includes('Dora') === true && issued[0].includes('IT-101') && issued[0].includes(run));
      assert.throws(() => s.completeCourse(run, dora), /already completed/);
      assert.throws(() => s.completeCourse(run, student(s, 'Eli')), /not enrolled/);
      assert.equal(s.certificates().length, 1);
    },
  },
  {
    name: 'a student joins a course at their level or below, and the confirmation shows the level',
    kind: 'feature',
    step: 'level-gate',
    run: (createApp) => {
      const s = school(createApp);
      const b1 = s.openCourse('FR-B1', 'B1', 3);
      const fay = student(s, 'Fay', 66);
      assert.deepEqual(s.joinCourse(b1, fay), { runId: b1, studentId: fay, seatsLeft: 2, level: 'B1' });
      assert.equal(s.joinCourse(s.openCourse('FR-A2', 'A2', 3), fay).level, 'B1');
      const gus = student(s, 'Gus', 45);
      assert.throws(() => s.joinCourse(b1, gus), /below the course level/);
      assert.equal(s.joinCourse(b1, student(s, 'Hal', 77)).seatsLeft, 1);
    },
  },
  {
    name: 'a student without a test is A1 and may join only A1 courses',
    kind: 'feature',
    step: 'level-gate',
    run: (createApp) => {
      const s = school(createApp);
      const ivy = student(s, 'Ivy');
      assert.equal(s.joinCourse(s.openCourse('PT-A1', 'A1', 1), ivy).level, 'A1');
      assert.throws(() => s.joinCourse(s.openCourse('PT-A2', 'A2', 1), ivy), /below the course level/);
    },
  },
  {
    name: 'B1 starts at a standing of 55, on the sheet and at the course desk',
    kind: 'feature',
    step: 'b1-bar',
    run: (createApp) => {
      const s = school(createApp);
      const b1 = s.openCourse('EN-B1', 'B1', 5);
      const jo = student(s, 'Jo', 55);
      assert.equal(s.progressSheet(jo)?.level, 'B1');
      assert.equal(s.joinCourse(b1, jo).level, 'B1');
      const kim = student(s, 'Kim', 54);
      assert.equal(s.progressSheet(kim)?.level, 'A2');
      assert.throws(() => s.joinCourse(b1, kim), /below the course level/);
    },
  },
  {
    name: 'a completed course adds 5 to the standing at once and counts for the next course',
    kind: 'feature',
    step: 'course-completion',
    run: (createApp) => {
      const s = school(createApp);
      const lea = student(s, 'Lea', 50);
      const a2 = s.openCourse('NL-A2', 'A2', 2);
      s.joinCourse(a2, lea);
      s.completeCourse(a2, lea);
      assert.deepEqual([s.progressSheet(lea)?.standing, s.progressSheet(lea)?.level], [55, 'B1']);
      assert.equal(s.joinCourse(s.openCourse('NL-B1', 'B1', 2), lea).level, 'B1');
      assert.equal(s.certificates().filter((c) => c.includes('Lea')).length, 1);
    },
  },
  {
    name: 'each run adds its 5 once, a student with no test starts from 0, and 100 is the ceiling',
    kind: 'feature',
    step: 'course-completion',
    run: (createApp) => {
      const s = school(createApp);
      const max = student(s, 'Max', 60);
      const r1 = s.openCourse('SV-1', 'A1', 3);
      const r2 = s.openCourse('SV-2', 'A1', 3);
      for (const r of [r1, r2]) {
        s.joinCourse(r, max);
        s.completeCourse(r, max);
      }
      assert.throws(() => s.completeCourse(r1, max), /already completed/);
      assert.equal(s.progressSheet(max)?.standing, 70);
      const ned = student(s, 'Ned');
      s.joinCourse(r1, ned);
      s.completeCourse(r1, ned);
      assert.deepEqual([s.progressSheet(ned)?.standing, s.progressSheet(ned)?.level], [5, 'A1']);
      const ola = student(s, 'Ola', 98);
      s.joinCourse(r2, ola);
      s.completeCourse(r2, ola);
      assert.equal(s.progressSheet(ola)?.standing, 100);
    },
  },
];
