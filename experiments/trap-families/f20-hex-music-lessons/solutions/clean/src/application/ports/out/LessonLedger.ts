import type { Lesson } from '../../../domain/lessons/Lesson';

export interface LessonLedger {
  nextId(): string;
  save(lesson: Lesson): void;
  find(id: string): Lesson | null;
  /** Every lesson (booked or not) of a teacher on a day, earliest first. */
  forTeacherOn(teacherId: string, date: string): Lesson[];
}
