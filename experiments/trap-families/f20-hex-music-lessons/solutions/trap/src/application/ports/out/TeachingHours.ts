import type { TimeWindow } from '../../../domain/time/TimeWindow';

/** The hours a teacher has marked for teaching on a day, read from the teacher's calendar. */
export interface TeachingHours {
  on(calendarId: string, date: string): TimeWindow[];
}
