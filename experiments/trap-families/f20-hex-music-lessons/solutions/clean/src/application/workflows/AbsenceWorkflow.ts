import { SchoolError } from '../../domain/SchoolError';
import { parseDate } from '../../domain/time/LessonDate';
import type { DayOffView, TeacherAbsence } from '../ports/in/TeacherAbsence';
import type { LessonCalendar } from '../ports/out/LessonCalendar';
import type { LessonLedger } from '../ports/out/LessonLedger';
import type { TeacherBook } from '../ports/out/TeacherBook';
import { withdrawEntry } from './BookingWorkflow';

export class AbsenceWorkflow implements TeacherAbsence {
  constructor(
    private readonly teachers: TeacherBook,
    private readonly lessons: LessonLedger,
    private readonly calendar: LessonCalendar,
  ) {}

  dayOff(calendarId: string, date: string): DayOffView {
    const teacher = this.teachers.findByCalendar(calendarId);
    if (teacher === null) throw new SchoolError(`no teacher with calendar ${calendarId}`);
    const day = parseDate(date);
    const cancelled: string[] = [];
    for (const lesson of this.lessons.forTeacherOn(teacher.id, day).filter((l) => l.isBooked())) {
      lesson.cancelForTeacherAbsence();
      withdrawEntry(this.calendar, teacher, lesson);
      this.lessons.save(lesson);
      cancelled.push(lesson.id);
    }
    return { teacher: teacher.name, cancelled };
  }
}
