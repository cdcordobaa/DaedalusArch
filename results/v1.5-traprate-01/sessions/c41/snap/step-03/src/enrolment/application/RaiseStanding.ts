import type { SchoolEvent } from '../../shared-kernel/SchoolEvent';
import type { CourseCompleted } from '../domain/course-run/events/CourseCompleted';
import type { StudentRegistry } from './ports/StudentRegistry';

/** Listener: a completed run adds to the student's standing. */
export class RaiseStanding {
  constructor(private readonly registry: StudentRegistry) {}

  on(fact: SchoolEvent): void {
    const done = fact as CourseCompleted;
    this.registry.creditCompletion(done.studentId, done.runId);
  }
}
