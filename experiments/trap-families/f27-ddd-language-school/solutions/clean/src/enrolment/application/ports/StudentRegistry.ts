import type { Cefr } from '../../../shared-kernel/Cefr';

/** What the course desk needs to know about students. */
export interface StudentRegistry {
  isRegistered(studentId: string): boolean;
  /** The level the placement office gives the student, or undefined for an unknown student. */
  levelOf(studentId: string): Cefr | undefined;
}
