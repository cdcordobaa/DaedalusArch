import { isCefr, reaches, type Cefr } from '../../../shared-kernel/Cefr';
import type { SchoolEvent } from '../../../shared-kernel/SchoolEvent';
import { CourseCompleted } from './events/CourseCompleted';
import { RunId } from './value-objects/RunId';

export interface Seat {
  readonly studentId: string;
  readonly completed: boolean;
}

export interface CourseRunSnapshot {
  readonly id: string;
  readonly courseCode: string;
  readonly minimumLevel: Cefr;
  readonly capacity: number;
  readonly seats: readonly Seat[];
}

/**
 * One scheduled run of a course: a fixed number of seats, a CEFR level the course is taught at, and the students
 * holding a seat. A student holds at most one seat and completes a run at most once.
 */
export class CourseRun {
  private raised: SchoolEvent[] = [];

  private constructor(
    readonly id: RunId,
    readonly courseCode: string,
    readonly minimumLevel: Cefr,
    readonly capacity: number,
    private seats: Seat[],
  ) {}

  static schedule(id: RunId, courseCode: string, minimumLevel: string, capacity: number): CourseRun {
    if (courseCode.trim() === '') throw new Error('a course needs a code');
    if (!isCefr(minimumLevel)) throw new Error(`unknown CEFR level ${minimumLevel}`);
    if (!Number.isInteger(capacity) || capacity < 1) throw new Error('a course needs at least one seat');
    return new CourseRun(id, courseCode, minimumLevel, capacity, []);
  }

  static fromSnapshot(s: CourseRunSnapshot): CourseRun {
    return new CourseRun(RunId.from(s.id), s.courseCode, s.minimumLevel, s.capacity, [...s.seats]);
  }

  seatsLeft(): number {
    return this.capacity - this.seats.length;
  }

  admit(studentId: string, level: Cefr): void {
    if (!reaches(level, this.minimumLevel)) {
      throw new Error(`${studentId} is below the course level ${this.minimumLevel} (student level ${level})`);
    }
    if (this.seats.some((s) => s.studentId === studentId)) throw new Error(`${studentId} has already joined ${this.id.raw}`);
    if (this.seatsLeft() === 0) throw new Error(`course run ${this.id.raw} is full`);
    this.seats = [...this.seats, { studentId, completed: false }];
  }

  markCompleted(studentId: string): void {
    const seat = this.seats.find((s) => s.studentId === studentId);
    if (seat === undefined) throw new Error(`${studentId} is not enrolled in ${this.id.raw}`);
    if (seat.completed) throw new Error(`${studentId} has already completed ${this.id.raw}`);
    this.seats = this.seats.map((s) => (s.studentId === studentId ? { studentId, completed: true } : s));
    this.raised.push(new CourseCompleted(this.id.raw, this.courseCode, studentId));
  }

  takeRaised(): SchoolEvent[] {
    const out = this.raised;
    this.raised = [];
    return out;
  }

  snapshot(): CourseRunSnapshot {
    return { id: this.id.raw, courseCode: this.courseCode, minimumLevel: this.minimumLevel, capacity: this.capacity, seats: [...this.seats] };
  }
}
