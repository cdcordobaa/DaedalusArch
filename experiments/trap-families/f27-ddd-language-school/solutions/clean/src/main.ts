import { PlacementGateway } from './enrolment/acl/PlacementGateway';
import { CertificateWording } from './enrolment/application/CertificateWording';
import type { CourseCompleted } from './enrolment/domain/course-run/events/CourseCompleted';
import { CompleteCourse } from './enrolment/application/CompleteCourse';
import { EventPump } from './enrolment/application/EventPump';
import { IssueCertificate } from './enrolment/application/IssueCertificate';
import { JoinCourse, type JoinConfirmation } from './enrolment/application/JoinCourse';
import { OpenCourse } from './enrolment/application/OpenCourse';
import { MemoryCertificateBook } from './enrolment/infrastructure/MemoryCertificateBook';
import { MemoryCourseRunStore } from './enrolment/infrastructure/MemoryCourseRunStore';
import { MemoryLearnerStore } from './placement/infrastructure/MemoryLearnerStore';
import { openPlacementDesk, type ProgressSheet } from './placement/published/PlacementDesk';

/** Wires the school. Each course desk command hands on the facts it stored before it returns. */
export function createApp() {
  const learners = new MemoryLearnerStore();
  const desk = openPlacementDesk(learners);
  const runs = new MemoryCourseRunStore();
  const book = new MemoryCertificateBook();
  const pump = new EventPump(runs);
  const certificates = new IssueCertificate(book, new CertificateWording(learners));
  pump.subscribe('CourseCompleted', (fact) => certificates.on(fact));
  pump.subscribe('CourseCompleted', (fact) => {
    const done = fact as CourseCompleted;
    desk.courseCompleted(done.studentId, done.runId);
  });
  const registry = new PlacementGateway(desk);
  const thenHandOn = <R>(work: () => R): R => {
    const out = work();
    pump.drain();
    return out;
  };
  return {
    registerStudent: (name: string): string => desk.register(name),
    recordPlacementTest: (studentId: string, score: number): void => desk.recordTest(studentId, score),
    progressSheet: (studentId: string): ProgressSheet | undefined => desk.sheet(studentId),
    openCourse: (courseCode: string, minimumLevel: string, capacity: number): string =>
      thenHandOn(() => new OpenCourse(runs).perform(courseCode, minimumLevel, capacity)),
    joinCourse: (runId: string, studentId: string): JoinConfirmation => thenHandOn(() => new JoinCourse(runs, registry).perform(runId, studentId)),
    completeCourse: (runId: string, studentId: string): void => thenHandOn(() => new CompleteCourse(runs).perform(runId, studentId)),
    certificates: (): string[] => book.lines(),
  };
}
