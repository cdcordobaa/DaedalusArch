import type { Learner } from './Learner';
import type { StudentId } from './value-objects/StudentId';

export interface LearnerStore {
  allocateId(): StudentId;
  find(id: StudentId): Learner | undefined;
  put(learner: Learner): void;
}
