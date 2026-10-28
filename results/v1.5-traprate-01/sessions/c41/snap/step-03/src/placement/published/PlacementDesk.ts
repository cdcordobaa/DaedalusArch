import { creditCompletion } from '../application/creditCompletion';
import { readProgressSheet } from '../application/readProgressSheet';
import { recordTestScore } from '../application/recordTestScore';
import { registerStudent } from '../application/registerStudent';
import type { LearnerStore } from '../domain/learner/LearnerStore';
import { MemoryLearnerStore } from '../infrastructure/MemoryLearnerStore';
import type { ProgressSheet } from './ProgressSheet';

export type { ProgressSheet } from './ProgressSheet';

/** The placement office's counter: the only calls other parts of the school may make. */
export interface PlacementDesk {
  register(name: string): string;
  recordTest(studentId: string, score: number): void;
  /** Adds a completed course run to the student's standing; crediting the same run again changes nothing. */
  creditCompletion(studentId: string, runId: string): void;
  sheet(studentId: string): ProgressSheet | undefined;
}

export function openPlacementDesk(learners: LearnerStore = new MemoryLearnerStore()): PlacementDesk {
  return {
    register: (name) => registerStudent(learners, name),
    recordTest: (studentId, score) => recordTestScore(learners, studentId, score),
    creditCompletion: (studentId, runId) => creditCompletion(learners, studentId, runId),
    sheet: (studentId) => readProgressSheet(learners, studentId),
  };
}
