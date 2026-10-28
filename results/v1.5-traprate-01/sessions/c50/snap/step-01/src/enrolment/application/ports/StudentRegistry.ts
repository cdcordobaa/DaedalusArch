import type { Cefr } from '../../../shared-kernel/Cefr';

/** What the course desk needs to know about students. */
export interface StudentRegistry {
  isRegistered(studentId: string): boolean;
  /** The CEFR level on the student's progress sheet, or undefined if the student is unknown. */
  levelOf(studentId: string): Cefr | undefined;
}
