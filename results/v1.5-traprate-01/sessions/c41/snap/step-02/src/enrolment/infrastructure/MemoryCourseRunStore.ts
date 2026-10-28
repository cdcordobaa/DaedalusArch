import type { SchoolEvent } from '../../shared-kernel/SchoolEvent';
import type { EventBacklog } from '../application/ports/EventBacklog';
import { CourseRun, type CourseRunSnapshot } from '../domain/course-run/CourseRun';
import type { CourseRunStore } from '../domain/course-run/CourseRunStore';
import { RunId } from '../domain/course-run/value-objects/RunId';

/** Runs and the facts they raised, kept side by side so that one `put` stores both. */
export class MemoryCourseRunStore implements CourseRunStore, EventBacklog {
  private readonly byId = new Map<string, CourseRunSnapshot>();
  private unsent: SchoolEvent[] = [];
  private issued = 0;

  allocateId(): RunId {
    this.issued += 1;
    return RunId.from(`R${String(this.issued)}`);
  }

  find(id: RunId): CourseRun | undefined {
    const s = this.byId.get(id.raw);
    return s === undefined ? undefined : CourseRun.fromSnapshot(s);
  }

  put(run: CourseRun): void {
    const raised = run.takeRaised();
    this.byId.set(run.id.raw, run.snapshot());
    this.unsent = this.unsent.concat(raised);
  }

  drainUnsent(): SchoolEvent[] {
    const due = this.unsent;
    this.unsent = [];
    return due;
  }
}
