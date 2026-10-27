import type { TempoCategory, TempoCloud } from './TempoCloud';

export interface TempoEvent {
  readonly eventId: string;
  readonly summary: string;
  readonly day: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly category: TempoCategory;
}

export interface TempoEventDraft {
  readonly summary: string;
  readonly day: string;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly category: TempoCategory;
}

export class TempoApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TempoApiError';
  }
}

/** Client for the Tempo calendar API, authorised with the school's token. */
export class TempoCalendarClient {
  constructor(
    private readonly cloud: TempoCloud,
    private readonly token: string,
  ) {}

  listEvents(calendarId: string, day: string): TempoEvent[] {
    this.authorise();
    return this.cloud.list(calendarId, day).map((e) => ({ eventId: e.eventId, summary: e.summary, day: e.day, startsAt: e.startsAt, endsAt: e.endsAt, category: e.category }));
  }

  /** Creates an event and answers its Tempo event id. */
  createEvent(calendarId: string, draft: TempoEventDraft): string {
    this.authorise();
    return this.cloud.insert({ calendarId, ...draft });
  }

  deleteEvent(calendarId: string, eventId: string): void {
    this.authorise();
    if (!this.cloud.remove(calendarId, eventId)) throw new TempoApiError(`404 no event ${eventId} in ${calendarId}`);
  }

  private authorise(): void {
    if (this.token === '') throw new TempoApiError('401 no token');
  }
}
