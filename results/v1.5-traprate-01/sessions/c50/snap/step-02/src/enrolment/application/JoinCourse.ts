import type { Cefr } from '../../shared-kernel/Cefr';
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
  ) {}

  perform(runId: string, studentId: string): JoinConfirmation {
    const run = this.runs.find(RunId.from(runId));
    if (run === undefined) throw new Error(`no course run ${runId}`);
    const level = this.registry.levelOf(studentId);
    if (level === undefined) throw new Error(`no student ${studentId}`);
    run.admit(studentId, level);
    this.runs.put(run);
    return { runId, studentId, seatsLeft: run.seatsLeft(), level };
  }
}
