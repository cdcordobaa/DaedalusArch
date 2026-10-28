export class JobId {
  private constructor(readonly value: string) {}

  static of(value: string): JobId {
    if (value.trim() === '') throw new Error('job id must not be empty');
    return new JobId(value);
  }

  equals(other: JobId): boolean {
    return other.value === this.value;
  }
}
