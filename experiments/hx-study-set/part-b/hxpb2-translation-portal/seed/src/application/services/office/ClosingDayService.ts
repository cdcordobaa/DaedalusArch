import type { ClosingDays } from '../../ports/out/office/ClosingDays';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Moves a delivery date past weekends and the days the office is shut. */
export class ClosingDayService {
  constructor(private readonly days: ClosingDays) {}

  async close(date: string, reason: string): Promise<void> {
    await this.days.add({ date, reason });
  }

  async nextWorkingDay(date: string): Promise<string> {
    const shut = new Set((await this.days.between(date, '9999-12-31')).map((d) => d.date));
    let t = Date.parse(date + 'T00:00:00Z');
    for (;;) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const weekday = new Date(t).getUTCDay();
      if (weekday !== 0 && weekday !== 6 && !shut.has(iso)) return iso;
      t += DAY_MS;
    }
  }
}
