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

export interface DayOffResult {
  readonly teacher: string;
  readonly cancelled: string[];
}

export interface LessonDesk {
  dayOff(calendarId: string, date: string): DayOffResult;
  book(request: BookingRequest): LessonView;
  lesson(id: string): LessonView;
  cancel(id: string): LessonView;
}
