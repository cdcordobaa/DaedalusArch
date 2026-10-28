import { Learner, type LearnerSnapshot } from '../domain/learner/Learner';
import type { LearnerStore } from '../domain/learner/LearnerStore';
import { StudentId } from '../domain/learner/value-objects/StudentId';

export class MemoryLearnerStore implements LearnerStore {
  private readonly byId = new Map<string, LearnerSnapshot>();
  private issued = 0;

  allocateId(): StudentId {
    this.issued += 1;
    return StudentId.from(`S-${String(this.issued).padStart(3, '0')}`);
  }

  find(id: StudentId): Learner | undefined {
    const s = this.byId.get(id.raw);
    return s === undefined ? undefined : Learner.fromSnapshot(s);
  }

  put(learner: Learner): void {
    this.byId.set(learner.id.raw, learner.snapshot());
  }
}
