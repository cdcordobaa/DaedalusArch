export class Enrolment {
  courseId: string;
  studentEmail: string;
  enrolledAt: Date;

  constructor(courseId: string, studentEmail: string, enrolledAt: Date) {
    this.courseId = courseId;
    this.studentEmail = studentEmail;
    this.enrolledAt = enrolledAt;
  }

  withinCoolingOff(now: Date): boolean {
    return now.getTime() - this.enrolledAt.getTime() <= 14 * 86_400_000;
  }
}
