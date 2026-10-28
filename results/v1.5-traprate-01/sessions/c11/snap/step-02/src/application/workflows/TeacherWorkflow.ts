import { SchoolError } from '../../domain/SchoolError';
import { Teacher } from '../../domain/teaching/Teacher';
import { parseDate } from '../../domain/time/LessonDate';
import type { TeacherDesk, TeacherView, TeachingHoursView } from '../ports/in/TeacherDesk';
import type { TeacherBook } from '../ports/out/TeacherBook';
import type { TeachingHours } from '../ports/out/TeachingHours';

export const teacherView = (t: Teacher): TeacherView => ({ id: t.id, name: t.name, instruments: [...t.instruments], calendarId: t.calendarId });

export class TeacherWorkflow implements TeacherDesk {
  constructor(
    private readonly teachers: TeacherBook,
    private readonly hours: TeachingHours,
  ) {}

  addTeacher(name: string, instruments: string[], calendarId: string): TeacherView {
    const teacher = Teacher.hire('pending', name, instruments, calendarId);
    const stored = Teacher.hire(this.teachers.nextId(), teacher.name, teacher.instruments, teacher.calendarId);
    this.teachers.save(stored);
    return teacherView(stored);
  }

  teacher(id: string): TeacherView {
    return teacherView(this.mustFind(id));
  }

  teachingHours(teacherId: string, date: string): TeachingHoursView {
    const teacher = this.mustFind(teacherId);
    const day = parseDate(date);
    const windows = this.hours.on(teacher.calendarId, day).sort((a, b) => a.from - b.from).map((w) => w.label());
    return { teacher: teacher.name, date: day, windows };
  }

  private mustFind(id: string): Teacher {
    const teacher = this.teachers.find(id);
    if (teacher === null) throw new SchoolError(`no teacher ${id}`);
    return teacher;
  }
}
