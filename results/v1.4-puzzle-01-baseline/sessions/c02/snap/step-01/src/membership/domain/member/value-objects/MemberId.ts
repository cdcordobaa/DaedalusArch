export class MemberId {
  private constructor(readonly value: string) {}

  static of(value: string): MemberId {
    if (value.trim() === '') throw new Error('member id must not be empty');
    return new MemberId(value);
  }
}
