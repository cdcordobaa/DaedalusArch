import { Learner } from '../domain/learner/Learner';
import type { LearnerStore } from '../domain/learner/LearnerStore';

export function registerStudent(learners: LearnerStore, name: string): string {
  const learner = Learner.register(learners.allocateId(), name);
  learners.put(learner);
  return learner.id.raw;
}
