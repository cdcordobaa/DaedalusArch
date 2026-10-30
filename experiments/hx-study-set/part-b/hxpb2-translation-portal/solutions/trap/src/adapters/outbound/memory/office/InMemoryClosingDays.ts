import type { ClosingDay } from '../../../../domain/model/office/ClosingDay';
import type { ClosingDays } from '../../../../application/ports/out/office/ClosingDays';

export class InMemoryClosingDays implements ClosingDays {
  private readonly days: ClosingDay[] = [];

  async add(day: ClosingDay): Promise<void> {
    if (!this.days.some((d) => d.date === day.date)) this.days.push(day);
  }

  async between(from: string, to: string): Promise<ClosingDay[]> {
    return this.days.filter((d) => d.date >= from && d.date <= to);
  }
}
