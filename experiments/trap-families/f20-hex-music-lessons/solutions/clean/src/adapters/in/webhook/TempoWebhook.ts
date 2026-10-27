import type { TeacherAbsence } from '../../../application/ports/in/TeacherAbsence';
import { answer, type Answer } from '../http/answer';

/** The payload Tempo sends when a teacher marks a day off. */
export interface DayOffPayload {
  readonly calendarId: string;
  readonly date: string;
}

export class TempoWebhook {
  constructor(private readonly absence: TeacherAbsence) {}

  dayOff(payload: DayOffPayload): Answer {
    return answer(() => this.absence.dayOff(payload.calendarId, payload.date));
  }
}
