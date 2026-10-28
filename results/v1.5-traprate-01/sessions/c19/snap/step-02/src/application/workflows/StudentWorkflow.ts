import { Student } from '../../domain/students/Student';
import type { StudentDesk, StudentView } from '../ports/in/StudentDesk';
import type { StudentRoll } from '../ports/out/StudentRoll';

export class StudentWorkflow implements StudentDesk {
  constructor(private readonly students: StudentRoll) {}

  enrol(name: string): StudentView {
    Student.enrol('pending', name);
    const student = Student.enrol(this.students.nextId(), name);
    this.students.save(student);
    return { id: student.id, name: student.name };
  }
}
