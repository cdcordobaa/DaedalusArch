import { CourseRun } from '../domain/course-run/CourseRun';
import type { CourseRunStore } from '../domain/course-run/CourseRunStore';

export class OpenCourse {
  constructor(private readonly runs: CourseRunStore) {}

  perform(courseCode: string, minimumLevel: string, capacity: number): string {
    const run = CourseRun.schedule(this.runs.allocateId(), courseCode, minimumLevel, capacity);
    this.runs.put(run);
    return run.id.raw;
  }
}
