import type { CourseRun } from './CourseRun';
import type { RunId } from './value-objects/RunId';

export interface CourseRunStore {
  allocateId(): RunId;
  find(id: RunId): CourseRun | undefined;
  /** Keeps the run and whatever it raised in one step; the raised facts wait to be handed on. */
  put(run: CourseRun): void;
}
