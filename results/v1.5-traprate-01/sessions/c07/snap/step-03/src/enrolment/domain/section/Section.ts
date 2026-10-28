import type { DomainEvent } from '../../../shared-kernel/DomainEvent';
import { EnrolmentError } from '../EnrolmentError';
import { SectionOpened } from './events/SectionOpened';
import type { SectionId } from './value-objects/SectionId';

export type HistoryKind = 'enrolled' | 'dropped' | 'switched-in' | 'switched-out';

export interface HistoryItem {
  readonly kind: HistoryKind;
  readonly studentId: string;
  readonly otherSection: string | null;
}

export interface SectionState {
  readonly id: SectionId;
  readonly courseCode: string;
  readonly capacity: number;
  readonly students: readonly string[];
  /** Day (YYYY-MM-DD) of the latest switch into the section, and how many switches came in that day. */
  readonly switchInDay?: string;
  readonly switchInCount?: number;
  /** Roster changes, oldest first. */
  readonly history?: readonly HistoryItem[];
}

export const DAILY_SWITCH_LIMIT = 3;

/** One teaching section of a course. It never holds more students than it has seats, and each student only once. */
export class Section {
  private pending: DomainEvent[] = [];

  private constructor(
    readonly id: SectionId,
    readonly courseCode: string,
    readonly capacity: number,
    private students: string[],
    private switchInDay = '',
    private switchInCount = 0,
    private log: HistoryItem[] = [],
  ) {}

  static open(id: SectionId, courseCode: string, capacity: number): Section {
    if (!Number.isInteger(capacity) || capacity < 1) throw new EnrolmentError('a section needs a whole number of seats, at least one');
    const section = new Section(id, courseCode, capacity, []);
    section.pending.push(new SectionOpened(id.value, courseCode, capacity));
    return section;
  }

  static restore(state: SectionState): Section {
    return new Section(state.id, state.courseCode, state.capacity, [...state.students], state.switchInDay ?? '', state.switchInCount ?? 0, [...(state.history ?? [])]);
  }

  roster(): string[] {
    return [...this.students];
  }

  has(studentId: string): boolean {
    return this.students.includes(studentId);
  }

  /** Roster changes, newest first. */
  history(): HistoryItem[] {
    return [...this.log].reverse();
  }

  enrol(studentId: string): void {
    this.admit(studentId);
    this.log.push({ kind: 'enrolled', studentId, otherSection: null });
  }

  private admit(studentId: string): void {
    if (studentId.trim() === '') throw new EnrolmentError('a student id must not be empty');
    if (this.has(studentId)) throw new EnrolmentError(`${studentId} is already enrolled in ${this.id.value}`);
    if (this.isFull()) throw new EnrolmentError(`section full: ${this.id.value} has ${String(this.students.length)} of ${String(this.capacity)} seats taken`);
    this.students.push(studentId);
  }

  /** Enrols a student who switches in from another section; at most DAILY_SWITCH_LIMIT per calendar day. */
  enrolBySwitch(studentId: string, today: string, fromSection: string): void {
    const taken = this.switchInDay === today ? this.switchInCount : 0;
    if (taken >= DAILY_SWITCH_LIMIT) {
      throw new EnrolmentError(`daily switch limit reached: ${this.id.value} already took ${String(taken)} students by switch today`);
    }
    this.admit(studentId);
    this.log.push({ kind: 'switched-in', studentId, otherSection: fromSection });
    this.switchInDay = today;
    this.switchInCount = taken + 1;
  }

  drop(studentId: string): void {
    this.remove(studentId);
    this.log.push({ kind: 'dropped', studentId, otherSection: null });
  }

  /** Removes a student who switches out to another section. */
  dropBySwitch(studentId: string, toSection: string): void {
    this.remove(studentId);
    this.log.push({ kind: 'switched-out', studentId, otherSection: toSection });
  }

  private remove(studentId: string): void {
    if (!this.has(studentId)) throw new EnrolmentError(`${studentId} is not enrolled in ${this.id.value}`);
    this.students = this.students.filter((s) => s !== studentId);
  }

  state(): SectionState {
    return { id: this.id, courseCode: this.courseCode, capacity: this.capacity, students: [...this.students], switchInDay: this.switchInDay, switchInCount: this.switchInCount, history: [...this.log] };
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
