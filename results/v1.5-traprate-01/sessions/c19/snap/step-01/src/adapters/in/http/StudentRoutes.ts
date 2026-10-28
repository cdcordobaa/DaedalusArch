import type { StudentDesk } from '../../../application/ports/in/StudentDesk';
import { answer, type Answer } from './answer';

export class StudentRoutes {
  constructor(private readonly desk: StudentDesk) {}

  enrol(name: string): Answer {
    return answer(() => this.desk.enrol(name));
  }
}
