import { SchoolError } from '../../../domain/SchoolError';
import { parseDate } from '../../../domain/time/LessonDate';
import type { MemoryLessonLedger } from '../../out/memory/MemoryLessonLedger';
import type { MemoryTeacherBook } from '../../out/memory/MemoryTeacherBook';
import type { TempoCalendarClient } from '../../out/calendar/TempoCalendarClient';
import { answer, type Answer } from '../http/answer';

/** The payload Tempo sends when a teacher marks a day off. */
export interface DayOffPayload {
  readonly calendarId: string;
  readonly date: string;
}

export class TempoWebhook {
  constructor(
    private readonly teachers: MemoryTeacherBook,
    private readonly lessons: MemoryLessonLedger,
    private readonly tempo: TempoCalendarClient,
  ) {}

  dayOff(payload: DayOffPayload): Answer {
    return answer(() => {
      const teacher = this.teachers.all().find((t) => t.calendarId === payload.calendarId);
      if (teacher === undefined) throw new SchoolError(`no teacher with calendar ${payload.calendarId}`);
      const day = parseDate(payload.date);
      const cancelled: string[] = [];
      for (const lesson of this.lessons.forTeacherOn(teacher.id, day).filter((l) => l.isBooked())) {
        lesson.cancelForTeacherAbsence();
        if (lesson.calendarRef !== null) this.tempo.deleteEvent(teacher.calendarId, lesson.calendarRef);
        this.lessons.save(lesson);
        cancelled.push(lesson.id);
      }
      return { teacher: teacher.name, cancelled };
    });
  }
}
