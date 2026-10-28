export class RoomSlot {
  constructor(
    readonly productionId: string,
    readonly start: number,
    readonly end: number,
  ) {}

  overlaps(start: number, end: number): boolean {
    return start < this.end && end > this.start;
  }
}
