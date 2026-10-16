const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(value));
}

export type HalfDay = 'morning' | 'afternoon';

/** One desk on one day, or half of it. Two bookings clash when they share a desk, a date and a half. */
export class DeskDay {
  readonly deskId: string;
  readonly date: string;
  readonly half: HalfDay | null;

  constructor(deskId: string, date: string, half: HalfDay | null) {
    this.deskId = deskId;
    this.date = date;
    this.half = half;
  }

  clashesWith(other: DeskDay): boolean {
    return this.deskId === other.deskId && this.date === other.date && (this.half === null || other.half === null || this.half === other.half);
  }

  isWeekend(): boolean {
    const day = new Date(`${this.date}T12:00:00Z`).getUTCDay();
    return day === 0 || day === 6;
  }
}
