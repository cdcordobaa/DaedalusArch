import type { LearnerStore } from '../../placement/domain/learner/LearnerStore';
import { StudentId } from '../../placement/domain/learner/value-objects/StudentId';

/** The holder line printed on a certificate. */
export class CertificateWording {
  constructor(private readonly learners: LearnerStore) {}

  holder(studentId: string): string {
    const learner = this.learners.find(StudentId.from(studentId));
    return learner === undefined ? studentId : `${learner.name} (${studentId})`;
  }
}
