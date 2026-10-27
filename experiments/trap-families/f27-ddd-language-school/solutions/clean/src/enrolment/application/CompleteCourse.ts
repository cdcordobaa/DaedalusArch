import type { CourseRunStore } from '../domain/course-run/CourseRunStore';
import { RunId } from '../domain/course-run/value-objects/RunId';

/** A teacher marks a student as having completed a run. */
export class CompleteCourse {
  constructor(private readonly runs: CourseRunStore) {}

  perform(runId: string, studentId: string): void {
    const run = this.runs.find(RunId.from(runId));
    if (run === undefined) throw new Error(`no course run ${runId}`);
    run.markCompleted(studentId);
    this.runs.put(run);
  }
}
