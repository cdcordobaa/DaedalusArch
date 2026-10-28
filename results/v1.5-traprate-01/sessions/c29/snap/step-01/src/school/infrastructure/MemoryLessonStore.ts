import type { Journal } from '../../wiring/mailroom';
import type { SchoolHappening } from '../domain/happenings';
import type { LessonBook } from '../domain/LessonBook';
import { Lesson, type LessonRecord } from '../domain/Lesson';

/** Lessons in memory, with the journal of what they said: `put` writes both together. */
export class MemoryLessonStore implements LessonBook, Journal {
  private readonly records = new Map<string, LessonRecord>();
  private readonly journal: SchoolHappening[] = [];

  newId(): string {
    return `L${String(this.records.size + 1)}`;
  }

  find(lessonId: string): Lesson | undefined {
    const r = this.records.get(lessonId);
    return r === undefined ? undefined : Lesson.fromRecord(r);
  }

  put(lesson: Lesson, said: readonly SchoolHappening[]): void {
    this.records.set(lesson.lessonId, lesson.toRecord());
    this.journal.push(...said);
  }

  readFrom(position: number): readonly SchoolHappening[] {
    return this.journal.slice(position);
  }
}
