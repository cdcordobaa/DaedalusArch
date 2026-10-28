import type { LearnerStore } from '../domain/learner/LearnerStore';
import { StudentId } from '../domain/learner/value-objects/StudentId';
import type { ProgressSheet } from '../published/ProgressSheet';

export function readProgressSheet(learners: LearnerStore, studentId: string): ProgressSheet | undefined {
  const learner = learners.find(StudentId.from(studentId));
  if (learner === undefined) return undefined;
  return { studentId: learner.id.raw, name: learner.name, standing: learner.standing(), level: learner.level() };
}
