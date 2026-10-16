import { DomainError } from '../../../shared-kernel/DomainError';
import { Coverage } from './Coverage';

export class Policy {
  number: string;
  holder: string;
  startsOn: Date;
  endsOn: Date;
  private readonly coverages: Coverage[] = [];

  constructor(number: string, holder: string, startsOn: Date, endsOn: Date) {
    if (endsOn <= startsOn) throw new DomainError('invalid', 'A policy must end after it starts');
    this.number = number;
    this.holder = holder;
    this.startsOn = startsOn;
    this.endsOn = endsOn;
  }

  cover(peril: string, limitCents: number, deductibleCents: number): void {
    if (this.coverages.some((c) => c.peril === peril)) throw new DomainError('rejected', `${peril} is already covered`);
    this.coverages.push(new Coverage(peril, limitCents, deductibleCents));
  }

  coverageFor(peril: string, on: Date): Coverage | undefined {
    if (on < this.startsOn || on > this.endsOn) return undefined;
    return this.coverages.find((c) => c.peril === peril);
  }

  perils(): string[] {
    return this.coverages.map((c) => c.peril);
  }
}
