import type { LessonDesk } from '../../../application/ports/in/LessonDesk';
import { answer, type Answer } from './answer';

export class LessonRoutes {
  constructor(private readonly desk: LessonDesk) {}

  book(studentId: string, teacherId: string, instrument: string, date: string, start: string, minutes: number): Answer {
    return answer(() => this.desk.book({ studentId, teacherId, instrument, date, start, minutes }));
  }

  lesson(id: string): Answer {
    return answer(() => this.desk.lesson(id));
  }

  cancel(id: string): Answer {
    return answer(() => this.desk.cancel(id));
  }
}
