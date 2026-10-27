import type { LearnerStore } from '../../placement/domain/learner/LearnerStore';
import { StudentId } from '../../placement/domain/learner/value-objects/StudentId';
import type { CourseRunStore } from '../domain/course-run/CourseRunStore';
import { RunId } from '../domain/course-run/value-objects/RunId';

/** A teacher marks a student as having completed a run. */
export class CompleteCourse {
  constructor(
    private readonly runs: CourseRunStore,
    private readonly learners: LearnerStore,
  ) {}

  perform(runId: string, studentId: string): void {
    const run = this.runs.find(RunId.from(runId));
    if (run === undefined) throw new Error(`no course run ${runId}`);
    run.markCompleted(studentId);
    this.runs.put(run);
    const learner = this.learners.find(StudentId.from(studentId));
    if (learner === undefined) throw new Error(`no student ${studentId}`);
    learner.creditCompletion(runId);
    this.learners.put(learner);
  }
}
