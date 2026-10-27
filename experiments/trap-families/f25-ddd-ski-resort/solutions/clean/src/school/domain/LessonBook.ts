import type { SchoolHappening } from './happenings';
import type { Lesson } from './Lesson';

/** Where lessons are kept. `put` writes the lesson and what it said in one step. */
export interface LessonBook {
  newId(): string;
  find(lessonId: string): Lesson | undefined;
  /** Ids of the lessons in which the pass has any place. */
  idsWithPass(passNo: string): string[];
  put(lesson: Lesson, said: readonly SchoolHappening[]): void;
}
