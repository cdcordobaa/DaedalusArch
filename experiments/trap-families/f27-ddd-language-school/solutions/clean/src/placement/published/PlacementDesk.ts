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
  sheet(studentId: string): ProgressSheet | undefined;
  /** Listener input: the course desk has stored that a student completed a run. */
  courseCompleted(studentId: string, runId: string): void;
}

export function openPlacementDesk(learners: LearnerStore = new MemoryLearnerStore()): PlacementDesk {
  return {
    register: (name) => registerStudent(learners, name),
    recordTest: (studentId, score) => recordTestScore(learners, studentId, score),
    sheet: (studentId) => readProgressSheet(learners, studentId),
    courseCompleted: (studentId, runId) => creditCompletion(learners, studentId, runId),
  };
}
