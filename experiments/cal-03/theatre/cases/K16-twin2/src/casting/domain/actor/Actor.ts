export class Actor {
  private _name: string;
  private _engagements = 0;
  private _bookingIds: string[] = [];

  constructor(
    readonly id: string,
    name: string,
    readonly agentEmail: string,
  ) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get engagements(): number {
    return this._engagements;
  }

  setName(name: string): void {
    if (name.trim() === '') {
      throw new Error('name required');
    }
    this._name = name;
  }

  get bookingIds(): readonly string[] {
    return this._bookingIds;
  }

  addBookingId(bookingId: string): void {
    this._bookingIds.push(bookingId);
  }

  startEngagement(): void {
    this._engagements += 1;
  }
}
