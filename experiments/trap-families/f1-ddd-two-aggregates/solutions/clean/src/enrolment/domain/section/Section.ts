import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { EnrolmentError } from '../EnrolmentError';
import { SectionOpened } from './events/SectionOpened';
import { StudentSwitched } from './events/StudentSwitched';
import type { RosterChange } from './RosterChange';
import type { SectionId } from './value-objects/SectionId';

/** Students a section may take in by switch per calendar day. */
export const DAILY_SWITCH_LIMIT = 3;

export interface SectionState {
  readonly id: SectionId;
  readonly courseCode: string;
  readonly capacity: number;
  readonly students: readonly string[];
  readonly switchDay: string | null;
  readonly switchesThatDay: number;
  readonly released: readonly string[];
  readonly changes: readonly RosterChange[];
}

/**
 * One teaching section of a course. It never holds more students than it has seats, each student only once, and it
 * never takes in more than the daily switch limit by switch in one calendar day.
 */
export class Section {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: SectionId,
    readonly courseCode: string,
    readonly capacity: number,
    private students: string[],
    private switchDay: string | null,
    private switchesThatDay: number,
    private released: string[],
    private changes: RosterChange[],
  ) {}

  static open(id: SectionId, courseCode: string, capacity: number): Section {
    if (!Number.isInteger(capacity) || capacity < 1) throw new EnrolmentError('a section needs a whole number of seats, at least one');
    const section = new Section(id, courseCode, capacity, [], null, 0, [], []);
    section.pending.push(new SectionOpened(id.value, courseCode, capacity));
    return section;
  }

  static restore(state: SectionState): Section {
    return new Section(
      state.id, state.courseCode, state.capacity, [...state.students],
      state.switchDay, state.switchesThatDay, [...state.released], [...state.changes],
    );
  }

  roster(): string[] {
    return [...this.students];
  }

  has(studentId: string): boolean {
    return this.students.includes(studentId);
  }

  enrol(studentId: string): void {
    this.admit(studentId);
    this.changes.push({ kind: 'enrolled', studentId, otherSection: null });
  }

  drop(studentId: string): void {
    this.assertEnrolled(studentId);
    this.students = this.students.filter((s) => s !== studentId);
    this.changes.push({ kind: 'dropped', studentId, otherSection: null });
  }

  assertEnrolled(studentId: string): void {
    if (!this.has(studentId)) throw new EnrolmentError(`${studentId} is not enrolled in ${this.id.value}`);
  }

  /** Takes in a student switching from another section of the same course; that section releases the seat on delivery. */
  acceptSwitch(switchId: string, studentId: string, from: SectionId, fromCourse: string, day: string): void {
    if (from.equals(this.id)) throw new EnrolmentError('a switch needs two different sections');
    if (fromCourse !== this.courseCode) throw new EnrolmentError(`course mismatch: ${fromCourse} to ${this.courseCode}`);
    const takenToday = this.switchDay === day ? this.switchesThatDay : 0;
    if (takenToday >= DAILY_SWITCH_LIMIT) {
      throw new EnrolmentError(`daily switch limit reached: ${this.id.value} already took ${String(takenToday)} students by switch today`);
    }
    this.admit(studentId);
    this.switchDay = day;
    this.switchesThatDay = takenToday + 1;
    this.changes.push({ kind: 'switched-in', studentId, otherSection: from.value });
    this.pending.push(new StudentSwitched(switchId, studentId, from.value, this.id.value));
  }

  /** Releases the seat of a student who switched away, once per switch whatever the number of deliveries. */
  releaseSwitched(switchId: string, studentId: string, to: SectionId): void {
    if (this.released.includes(switchId)) return;
    this.released.push(switchId);
    this.students = this.students.filter((s) => s !== studentId);
    this.changes.push({ kind: 'switched-out', studentId, otherSection: to.value });
  }

  history(): RosterChange[] {
    return [...this.changes].reverse();
  }

  state(): SectionState {
    return {
      id: this.id, courseCode: this.courseCode, capacity: this.capacity, students: [...this.students],
      switchDay: this.switchDay, switchesThatDay: this.switchesThatDay, released: [...this.released], changes: [...this.changes],
    };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private admit(studentId: string): void {
    if (studentId.trim() === '') throw new EnrolmentError('a student id must not be empty');
    if (this.has(studentId)) throw new EnrolmentError(`${studentId} is already enrolled in ${this.id.value}`);
    if (this.isFull()) throw new EnrolmentError(`section full: ${this.id.value} has ${String(this.students.length)} of ${String(this.capacity)} seats taken`);
    this.students.push(studentId);
  }

  private isFull(): boolean {
    return this.students.length >= this.capacity;
  }
}
