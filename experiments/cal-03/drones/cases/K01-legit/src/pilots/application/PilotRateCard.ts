import { Money } from '../../shared-kernel/Money';

export class PilotRateCard {
  private readonly hourlyRate: Money;

  constructor(hourlyRateCents: number) {
    this.hourlyRate = Money.of(hourlyRateCents);
  }

  forHours(hours: number): Money {
    return this.hourlyRate.times(hours);
  }
}
