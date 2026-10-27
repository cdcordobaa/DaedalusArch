import type { Student } from '../../../domain/students/Student';

export interface StudentRoll {
  nextId(): string;
  save(student: Student): void;
  find(id: string): Student | null;
}
