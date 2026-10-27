/** An entry of a lesson in a teacher's calendar, in the school's own terms. */
export interface CalendarEntry {
  readonly calendarId: string;
  readonly title: string;
  readonly date: string;
  readonly start: string;
  readonly end: string;
}

/** The teachers' calendars, as far as lessons are concerned. */
export interface LessonCalendar {
  /** Places the entry and answers its reference. */
  place(entry: CalendarEntry): string;
  withdraw(calendarId: string, ref: string): void;
}
