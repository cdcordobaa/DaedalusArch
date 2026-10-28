export class TimeSlot {
  constructor(
    readonly dayOfWeek: number,
    readonly startMinute: number,
    readonly lengthMinutes: number,
  ) {}

  get endMinute(): number {
    return this.startMinute + this.lengthMinutes;
  }

  overlaps(other: TimeSlot): boolean {
    return this.dayOfWeek === other.dayOfWeek && this.startMinute < other.endMinute && other.startMinute < this.endMinute;
  }
}

export class Show {
  constructor(
    readonly id: string,
    readonly title: string,
    readonly hostId: string,
    readonly slot: TimeSlot,
  ) {}
}
