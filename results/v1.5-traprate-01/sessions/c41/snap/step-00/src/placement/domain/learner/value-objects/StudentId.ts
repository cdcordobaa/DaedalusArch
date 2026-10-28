export class StudentId {
  private constructor(readonly raw: string) {}

  static from(raw: string): StudentId {
    if (raw.trim() === '') throw new Error('a student id must not be blank');
    return new StudentId(raw);
  }

  equals(other: StudentId): boolean {
    return other.raw === this.raw;
  }
}
