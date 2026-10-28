import type { SchoolEvent } from '../../../../shared-kernel/SchoolEvent';

export class CourseCompleted implements SchoolEvent {
  readonly type = 'CourseCompleted';

  constructor(
    readonly runId: string,
    readonly courseCode: string,
    readonly studentId: string,
  ) {}
}
