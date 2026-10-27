export class SignUpId {
  private constructor(readonly value: string) {}

  static of(value: string): SignUpId {
    if (value.trim() === '') throw new Error('sign-up id must not be empty');
    return new SignUpId(value);
  }
}
