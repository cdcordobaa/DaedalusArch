import type { Teacher } from '../../../domain/teaching/Teacher';

export interface TeacherBook {
  nextId(): string;
  save(teacher: Teacher): void;
  find(id: string): Teacher | null;
}
