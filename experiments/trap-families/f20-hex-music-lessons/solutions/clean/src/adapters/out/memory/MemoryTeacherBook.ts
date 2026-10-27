import type { TeacherBook } from '../../../application/ports/out/TeacherBook';
import type { Teacher } from '../../../domain/teaching/Teacher';

export class MemoryTeacherBook implements TeacherBook {
  private readonly rows = new Map<string, Teacher>();
  private seq = 0;

  nextId(): string {
    this.seq += 1;
    return `T-${String(this.seq).padStart(4, '0')}`;
  }

  save(teacher: Teacher): void {
    this.rows.set(teacher.id, teacher);
  }

  find(id: string): Teacher | null {
    return this.rows.get(id) ?? null;
  }

  findByCalendar(calendarId: string): Teacher | null {
    return [...this.rows.values()].find((t) => t.calendarId === calendarId) ?? null;
  }

  /** Every teacher, in id order. */
  all(): Teacher[] {
    return [...this.rows.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
