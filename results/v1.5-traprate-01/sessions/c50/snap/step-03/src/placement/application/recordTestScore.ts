import type { LearnerStore } from '../domain/learner/LearnerStore';
import { StudentId } from '../domain/learner/value-objects/StudentId';

export function recordTestScore(learners: LearnerStore, studentId: string, score: number): void {
  const learner = learners.find(StudentId.from(studentId));
  if (learner === undefined) throw new Error(`no student ${studentId}`);
  learner.sitTest(score);
  learners.put(learner);
}
