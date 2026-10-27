import type { LessonLedger } from '../../../application/ports/out/LessonLedger';
import type { Lesson } from '../../../domain/lessons/Lesson';

export class MemoryLessonLedger implements LessonLedger {
  private readonly rows = new Map<string, Lesson>();
  private seq = 0;

  nextId(): string {
    this.seq += 1;
    return `L-${String(this.seq).padStart(4, '0')}`;
  }

  save(lesson: Lesson): void {
    this.rows.set(lesson.id, lesson);
  }

  find(id: string): Lesson | null {
    return this.rows.get(id) ?? null;
  }

  forTeacherOn(teacherId: string, date: string): Lesson[] {
    return [...this.rows.values()].filter((l) => l.teacherId === teacherId && l.date === date).sort((a, b) => a.slot.from - b.slot.from);
  }
}
