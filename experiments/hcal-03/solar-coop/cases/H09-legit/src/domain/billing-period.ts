export class BillingPeriod {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static parse(label: string): BillingPeriod {
    const [year, month] = label.split('-').map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(`invalid period ${label}`);
    }
    return new BillingPeriod(year, month);
  }

  daysInMonth(): number {
    return new Date(Date.UTC(this.year, this.month, 0)).getUTCDate();
  }

  format(locale: string): string {
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(this.year, this.month - 1, 1)),
    );
  }
}
