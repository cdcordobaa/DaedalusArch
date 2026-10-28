export class RunId {
  private constructor(readonly raw: string) {}

  static from(raw: string): RunId {
    if (raw.trim() === '') throw new Error('a course run id must not be blank');
    return new RunId(raw);
  }
}
