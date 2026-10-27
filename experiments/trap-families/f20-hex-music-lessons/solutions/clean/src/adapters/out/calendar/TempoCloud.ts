/**
 * Stand-in for the Tempo calendar service (the third-party calendar the teachers use). In production this is the
 * remote API; here it keeps the events in memory so the school runs offline.
 */
export type TempoCategory = 'TEACHING_HOURS' | 'APPOINTMENT' | 'BLOCKED';

export interface TempoEventRecord {
  readonly eventId: string;
  readonly calendarId: string;
  readonly summary: string;
  readonly day: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly category: TempoCategory;
}

export class TempoCloud {
  private readonly events: TempoEventRecord[] = [];
  private seq = 0;

  insert(event: Omit<TempoEventRecord, 'eventId'>): string {
    this.seq += 1;
    const eventId = `tempo-evt-${String(this.seq)}`;
    this.events.push({ ...event, eventId });
    return eventId;
  }

  list(calendarId: string, day: string): TempoEventRecord[] {
    return this.events
      .filter((e) => e.calendarId === calendarId && e.day === day)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.summary.localeCompare(b.summary));
  }

  remove(calendarId: string, eventId: string): boolean {
    const at = this.events.findIndex((e) => e.calendarId === calendarId && e.eventId === eventId);
    if (at < 0) return false;
    this.events.splice(at, 1);
    return true;
  }
}
