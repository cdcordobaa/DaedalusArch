import type { CalendarEntry, LessonCalendar } from '../../../application/ports/out/LessonCalendar';
import type { TempoCalendarClient } from './TempoCalendarClient';

/** Lessons are APPOINTMENT events in the teacher's Tempo calendar; the reference is the Tempo event id. */
export class TempoLessonCalendar implements LessonCalendar {
  constructor(private readonly tempo: TempoCalendarClient) {}

  place(entry: CalendarEntry): string {
    return this.tempo.createEvent(entry.calendarId, { summary: entry.title, day: entry.date, startsAt: entry.start, endsAt: entry.end, category: 'APPOINTMENT' });
  }

  withdraw(calendarId: string, ref: string): void {
    this.tempo.deleteEvent(calendarId, ref);
  }
}
