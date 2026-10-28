import type { LearnerStore } from '../domain/learner/LearnerStore';
import { StudentId } from '../domain/learner/value-objects/StudentId';

export function creditCompletion(learners: LearnerStore, studentId: string, runId: string): void {
  const learner = learners.find(StudentId.from(studentId));
  if (learner === undefined) throw new Error(`no student ${studentId}`);
  learner.creditCompletion(runId);
  learners.put(learner);
}
