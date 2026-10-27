import { Email } from "../domain/email";

export class Interview {
  constructor(
    readonly id: string,
    readonly applicationId: string,
    readonly startsAt: Date,
    readonly interviewer: string,
  ) {}

  describeFor(email: Email): string {
    return `${this.interviewer} -> ${email.value}`;
  }
}
