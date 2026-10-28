/**
 * Composition root: creates the stores, the Tempo client and the clock, and hands them to the workflows.
 * createApp({ today }) answers the HTTP routes plus `calendar`, a view of the Tempo calendars (used by the front
 * desk to enter teaching hours, and to look at a teacher's day).
 */
import { StaffRoutes } from './adapters/in/http/StaffRoutes';
import { StudentRoutes } from './adapters/in/http/StudentRoutes';
import { LessonRoutes } from './adapters/in/http/LessonRoutes';
import { MemoryTeacherBook } from './adapters/out/memory/MemoryTeacherBook';
import { MemoryStudentRoll } from './adapters/out/memory/MemoryStudentRoll';
import { MemoryLessonLedger } from './adapters/out/memory/MemoryLessonLedger';
import { TempoCloud } from './adapters/out/calendar/TempoCloud';
import { TempoCalendarClient } from './adapters/out/calendar/TempoCalendarClient';
import { TempoTeachingHours } from './adapters/out/calendar/TempoTeachingHours';
import { SchoolClock } from './adapters/out/clock/SchoolClock';
import { TeacherWorkflow } from './application/workflows/TeacherWorkflow';
import { StudentWorkflow } from './application/workflows/StudentWorkflow';
import { BookingWorkflow } from './application/workflows/BookingWorkflow';

export interface AppOptions {
  today?: () => string;
  tempoToken?: string;
}

export function createApp(options: AppOptions = {}) {
  const cloud = new TempoCloud();
  const tempo = new TempoCalendarClient(cloud, options.tempoToken ?? 'harmony-hall-school');
  const teachers = new MemoryTeacherBook();
  const students = new MemoryStudentRoll();
  const lessons = new MemoryLessonLedger();
  const hours = new TempoTeachingHours(tempo);
  const clock = new SchoolClock(options.today);

  return {
    staff: new StaffRoutes(new TeacherWorkflow(teachers, hours)),
    students: new StudentRoutes(new StudentWorkflow(students)),
    lessons: new LessonRoutes(new BookingWorkflow(lessons, teachers, students, hours, clock)),
    calendar: {
      addHours: (calendarId: string, date: string, from: string, to: string): void => {
        cloud.insert({ calendarId, summary: 'Teaching hours', day: date, startsAt: from, endsAt: to, category: 'TEACHING_HOURS' });
      },
      events: (calendarId: string, date: string): { title: string; start: string; end: string }[] =>
        cloud.list(calendarId, date).map((e) => ({ title: e.summary, start: e.startsAt, end: e.endsAt })),
    },
  };
}
