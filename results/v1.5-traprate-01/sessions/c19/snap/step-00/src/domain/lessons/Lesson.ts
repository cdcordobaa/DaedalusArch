import { SchoolError } from '../SchoolError';
import type { Instrument } from '../teaching/Instrument';
import { TimeWindow } from '../time/TimeWindow';

export const LESSON_LENGTHS: readonly number[] = [30, 45, 60];
export type LessonStatus = 'booked' | 'cancelled';

/** One lesson of one student with one teacher, on one day. */
export class Lesson {
  private constructor(
    readonly id: string,
    readonly studentId: string,
    readonly teacherId: string,
    readonly instrument: Instrument,
    readonly date: string,
    readonly slot: TimeWindow,
    private state: LessonStatus,
  ) {}

  static book(id: string, studentId: string, teacherId: string, instrument: Instrument, date: string, startMinute: number, minutes: number): Lesson {
    if (startMinute % 15 !== 0) throw new SchoolError('lessons start on a quarter hour');
    if (!LESSON_LENGTHS.includes(minutes)) throw new SchoolError('a lesson is 30, 45 or 60 minutes');
    return new Lesson(id, studentId, teacherId, instrument, date, new TimeWindow(startMinute, startMinute + minutes), 'booked');
  }

  get status(): LessonStatus {
    return this.state;
  }

  isBooked(): boolean {
    return this.state === 'booked';
  }

  /** True when this lesson is still booked and takes some of `slot` on `date`. */
  clashesWith(date: string, slot: TimeWindow): boolean {
    return this.isBooked() && this.date === date && this.slot.overlaps(slot);
  }
}
