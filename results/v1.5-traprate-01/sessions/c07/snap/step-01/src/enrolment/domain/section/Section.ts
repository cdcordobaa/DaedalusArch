import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { EnrolmentError } from '../EnrolmentError';
import { SectionOpened } from './events/SectionOpened';
import type { SectionId } from './value-objects/SectionId';

export interface SectionState {
  readonly id: SectionId;
  readonly courseCode: string;
  readonly capacity: number;
  readonly students: readonly string[];
}

/** One teaching section of a course. It never holds more students than it has seats, and each student only once. */
export class Section {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: SectionId,
    readonly courseCode: string,
    readonly capacity: number,
    private students: string[],
  ) {}

  static open(id: SectionId, courseCode: string, capacity: number): Section {
    if (!Number.isInteger(capacity) || capacity < 1) throw new EnrolmentError('a section needs a whole number of seats, at least one');
    const section = new Section(id, courseCode, capacity, []);
    section.pending.push(new SectionOpened(id.value, courseCode, capacity));
    return section;
  }

  static restore(state: SectionState): Section {
    return new Section(state.id, state.courseCode, state.capacity, [...state.students]);
  }

  roster(): string[] {
    return [...this.students];
  }

  has(studentId: string): boolean {
    return this.students.includes(studentId);
  }

  enrol(studentId: string): void {
    if (studentId.trim() === '') throw new EnrolmentError('a student id must not be empty');
    if (this.has(studentId)) throw new EnrolmentError(`${studentId} is already enrolled in ${this.id.value}`);
    if (this.isFull()) throw new EnrolmentError(`section full: ${this.id.value} has ${String(this.students.length)} of ${String(this.capacity)} seats taken`);
    this.students.push(studentId);
  }

  drop(studentId: string): void {
    if (!this.has(studentId)) throw new EnrolmentError(`${studentId} is not enrolled in ${this.id.value}`);
    this.students = this.students.filter((s) => s !== studentId);
  }

  state(): SectionState {
    return { id: this.id, courseCode: this.courseCode, capacity: this.capacity, students: [...this.students] };
  }

  pullEvents(): DomainEvent[] {
    const out = this.pending;
    this.pending = [];
    return out;
  }

  private isFull(): boolean {
    return this.students.length >= this.capacity;
  }
}
