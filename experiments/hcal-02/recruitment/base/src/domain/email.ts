import { InvalidEmailError } from "./errors";

export class Email {
  private constructor(readonly value: string) {}

  static parse(raw: string): Email {
    const v = raw.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      throw new InvalidEmailError(raw);
    }
    return new Email(v);
  }
}
