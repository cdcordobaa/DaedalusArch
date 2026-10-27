export interface DayOffView {
  readonly teacher: string;
  readonly cancelled: string[];
}

export interface TeacherAbsence {
  /** The teacher whose calendar this is is away on `date`. */
  dayOff(calendarId: string, date: string): DayOffView;
}
