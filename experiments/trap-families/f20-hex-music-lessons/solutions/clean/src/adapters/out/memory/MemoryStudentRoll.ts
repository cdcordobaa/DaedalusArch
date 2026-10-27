import type { StudentRoll } from '../../../application/ports/out/StudentRoll';
import type { Student } from '../../../domain/students/Student';

export class MemoryStudentRoll implements StudentRoll {
  private readonly rows = new Map<string, Student>();
  private seq = 0;

  nextId(): string {
    this.seq += 1;
    return `S-${String(this.seq).padStart(4, '0')}`;
  }

  save(student: Student): void {
    this.rows.set(student.id, student);
  }

  find(id: string): Student | null {
    return this.rows.get(id) ?? null;
  }
}
