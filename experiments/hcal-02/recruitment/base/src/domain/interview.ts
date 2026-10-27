export class Interview {
  constructor(
    readonly id: string,
    readonly applicationId: string,
    readonly startsAt: Date,
    readonly interviewer: string,
  ) {}
}
