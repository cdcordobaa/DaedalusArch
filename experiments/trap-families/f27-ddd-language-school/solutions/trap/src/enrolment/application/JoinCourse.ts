import { reaches, type Cefr } from '../../shared-kernel/Cefr';
import type { LearnerStore } from '../../placement/domain/learner/LearnerStore';
import { StudentId } from '../../placement/domain/learner/value-objects/StudentId';
import type { CourseRunStore } from '../domain/course-run/CourseRunStore';
import { RunId } from '../domain/course-run/value-objects/RunId';
import type { StudentRegistry } from './ports/StudentRegistry';

export interface JoinConfirmation {
  readonly runId: string;
  readonly studentId: string;
  readonly seatsLeft: number;
  readonly level: Cefr;
}

export class JoinCourse {
  constructor(
    private readonly runs: CourseRunStore,
    private readonly registry: StudentRegistry,
    private readonly learners: LearnerStore,
  ) {}

  perform(runId: string, studentId: string): JoinConfirmation {
    const run = this.runs.find(RunId.from(runId));
    if (run === undefined) throw new Error(`no course run ${runId}`);
    const learner = this.learners.find(StudentId.from(studentId));
    if (!this.registry.isRegistered(studentId) || learner === undefined) throw new Error(`no student ${studentId}`);
    const level = learner.level();
    if (!reaches(level, run.minimumLevel)) throw new Error(`${studentId} is below the course level ${run.minimumLevel}`);
    run.admit(studentId);
    this.runs.put(run);
    return { runId, studentId, seatsLeft: run.seatsLeft(), level };
  }
}
