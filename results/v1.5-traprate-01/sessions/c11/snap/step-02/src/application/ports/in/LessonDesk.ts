export interface BookingRequest {
  readonly studentId: string;
  readonly teacherId: string;
  readonly instrument: string;
  readonly date: string;
  readonly start: string;
  readonly minutes: number;
}

export interface LessonView {
  readonly id: string;
  readonly studentId: string;
  readonly teacherId: string;
  readonly instrument: string;
  readonly date: string;
  readonly start: string;
  readonly end: string;
  readonly status: string;
}

export interface LessonDesk {
  book(request: BookingRequest): LessonView;
  lesson(id: string): LessonView;
  cancel(id: string): LessonView;
}
