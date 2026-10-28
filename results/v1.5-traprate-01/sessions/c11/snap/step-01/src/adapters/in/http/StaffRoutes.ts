import type { TeacherDesk } from '../../../application/ports/in/TeacherDesk';
import { answer, type Answer } from './answer';

export class StaffRoutes {
  constructor(private readonly desk: TeacherDesk) {}

  addTeacher(name: string, instruments: string[], calendarId: string): Answer {
    return answer(() => this.desk.addTeacher(name, instruments, calendarId));
  }

  teacher(id: string): Answer {
    return answer(() => this.desk.teacher(id));
  }

  teachingHours(teacherId: string, date: string): Answer {
    return answer(() => this.desk.teachingHours(teacherId, date));
  }
}
