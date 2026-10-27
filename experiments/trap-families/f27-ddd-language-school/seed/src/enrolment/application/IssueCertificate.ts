import type { SchoolEvent } from '../../shared-kernel/SchoolEvent';
import type { CourseCompleted } from '../domain/course-run/events/CourseCompleted';
import type { CertificateWording } from './CertificateWording';
import type { CertificateBook } from './ports/CertificateBook';

/** Listener: a completed run earns the student a certificate. */
export class IssueCertificate {
  constructor(
    private readonly book: CertificateBook,
    private readonly wording: CertificateWording,
  ) {}

  on(fact: SchoolEvent): void {
    const done = fact as CourseCompleted;
    this.book.record(`Certificate ${done.runId}: ${this.wording.holder(done.studentId)} completed ${done.courseCode}`);
  }
}
