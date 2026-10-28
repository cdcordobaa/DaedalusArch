import { SchoolError } from '../../domain/SchoolError';
import { Lesson } from '../../domain/lessons/Lesson';
import type { Student } from '../../domain/students/Student';
import { parseInstrument } from '../../domain/teaching/Instrument';
import type { Teacher } from '../../domain/teaching/Teacher';
import { parseDate } from '../../domain/time/LessonDate';
import { parseTime } from '../../domain/time/TimeOfDay';
import type { BookingRequest, DayOffResult, LessonDesk, LessonView } from '../ports/in/LessonDesk';
import type { Clock } from '../ports/out/Clock';
import type { LessonCalendar } from '../ports/out/LessonCalendar';
import type { LessonLedger } from '../ports/out/LessonLedger';
import type { StudentRoll } from '../ports/out/StudentRoll';
import type { TeacherBook } from '../ports/out/TeacherBook';
import type { TeachingHours } from '../ports/out/TeachingHours';

export const lessonView = (l: Lesson): LessonView => ({
  id: l.id, studentId: l.studentId, teacherId: l.teacherId, instrument: l.instrument,
  date: l.date, start: l.slot.start, end: l.slot.end, status: l.status,
});

export class BookingWorkflow implements LessonDesk {
  constructor(
    private readonly lessons: LessonLedger,
    private readonly teachers: TeacherBook,
    private readonly students: StudentRoll,
    private readonly hours: TeachingHours,
    private readonly clock: Clock,
    private readonly calendar: LessonCalendar,
  ) {}

  book(request: BookingRequest): LessonView {
    const student = this.student(request.studentId);
    const teacher = this.teacher(request.teacherId);
    const instrument = parseInstrument(request.instrument);
    if (!teacher.teaches(instrument)) throw new SchoolError(`${teacher.name} does not teach ${instrument}`);
    const date = parseDate(request.date);
    const start = parseTime(request.start);
    const draft = Lesson.book('pending', student.id, teacher.id, instrument, date, start, request.minutes);
    if (date <= this.clock.today()) throw new SchoolError('lessons are booked at least a day ahead');
    const open = this.hours.on(teacher.calendarId, date);
    if (!open.some((w) => w.contains(draft.slot))) throw new SchoolError(`${teacher.name} is not teaching at ${date} ${request.start}`);
    if (this.lessons.forTeacherOn(teacher.id, date).some((l) => l.clashesWith(date, draft.slot))) {
      throw new SchoolError(`${teacher.name} already has a lesson at ${date} ${request.start}`);
    }
    const lesson = Lesson.book(this.lessons.nextId(), student.id, teacher.id, instrument, date, start, request.minutes);
    const eventId = this.calendar.add(teacher.calendarId, lesson, student.name);
    lesson.attachCalendarEvent(eventId);
    try {
      this.lessons.save(lesson);
    } catch (e) {
      this.calendar.remove(teacher.calendarId, eventId);
      throw e;
    }
    return lessonView(lesson);
  }

  lesson(id: string): LessonView {
    const lesson = this.lessons.find(id);
    if (lesson === null) throw new SchoolError(`no lesson ${id}`);
    return lessonView(lesson);
  }

  /** Cancelling closes at the end of the day before the lesson. */
  cancel(id: string): LessonView {
    const lesson = this.lessons.find(id);
    if (lesson === null) throw new SchoolError(`no lesson ${id}`);
    if (!lesson.isBooked()) throw new SchoolError(`lesson ${id} is cancelled`);
    if (lesson.date <= this.clock.today()) throw new SchoolError(`lesson ${id} can no longer be cancelled`);
    const reference = lesson.calendarEvent;
    if (reference !== null) this.calendar.remove(this.teacher(lesson.teacherId).calendarId, reference);
    lesson.cancel();
    this.lessons.save(lesson);
    return lessonView(lesson);
  }

  /** A teacher's day off cancels every lesson still booked that day, whatever the notice. */
  dayOff(calendarId: string, day: string): DayOffResult {
    const teacher = this.teachers.findByCalendar(calendarId);
    if (teacher === null) throw new SchoolError(`no teacher with calendar ${calendarId}`);
    const date = parseDate(day);
    const cancelled: string[] = [];
    for (const lesson of this.lessons.forTeacherOn(teacher.id, date)) {
      if (!lesson.isBooked()) continue;
      const reference = lesson.calendarEvent;
      if (reference !== null) this.calendar.remove(teacher.calendarId, reference);
      lesson.cancel();
      this.lessons.save(lesson);
      cancelled.push(lesson.id);
    }
    return { teacher: teacher.name, cancelled };
  }

  private student(id: string): Student {
    const student = this.students.find(id);
    if (student === null) throw new SchoolError(`no student ${id}`);
    return student;
  }

  private teacher(id: string): Teacher {
    const teacher = this.teachers.find(id);
    if (teacher === null) throw new SchoolError(`no teacher ${id}`);
    return teacher;
  }
}
