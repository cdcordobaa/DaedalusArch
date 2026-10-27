import type { TeachingHours } from '../../../application/ports/out/TeachingHours';
import { parseTime } from '../../../domain/time/TimeOfDay';
import { TimeWindow } from '../../../domain/time/TimeWindow';
import type { TempoCalendarClient } from './TempoCalendarClient';

/** Teaching hours are the events of category TEACHING_HOURS in the teacher's Tempo calendar. */
export class TempoTeachingHours implements TeachingHours {
  constructor(private readonly tempo: TempoCalendarClient) {}

  on(calendarId: string, date: string): TimeWindow[] {
    return this.tempo
      .listEvents(calendarId, date)
      .filter((e) => e.category === 'TEACHING_HOURS')
      .map((e) => new TimeWindow(parseTime(e.startsAt), parseTime(e.endsAt)));
  }
}
