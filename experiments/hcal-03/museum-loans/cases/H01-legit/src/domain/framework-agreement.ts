import { DateRange, Money } from './value-objects';

export class FrameworkAgreement {
  constructor(
    readonly lender: string,
    readonly partner: string,
    readonly validity: DateRange,
    readonly insuranceCeiling: Money,
  ) {}

  covers(period: DateRange): boolean {
    return (
      period.start.getTime() >= this.validity.start.getTime() &&
      period.end.getTime() <= this.validity.end.getTime()
    );
  }
}
