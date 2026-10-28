import { SchoolError } from '../SchoolError';

export class Student {
  private constructor(readonly id: string, readonly name: string) {}

  static enrol(id: string, name: string): Student {
    if (name.trim() === '') throw new SchoolError('a student needs a name');
    return new Student(id, name.trim());
  }
}
