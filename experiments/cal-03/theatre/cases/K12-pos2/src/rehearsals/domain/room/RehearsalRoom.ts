import { RoomSlot } from './RoomSlot';

export class RehearsalRoom {
  private _slots: RoomSlot[] = [];
  private _bookedHours = 0;

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  get bookedHours(): number {
    return this._bookedHours;
  }

  setBookedHours(hours: number): void {
    this._bookedHours = hours;
  }

  get slots(): readonly RoomSlot[] {
    return this._slots;
  }

  book(productionId: string, start: number, end: number): void {
    if (end <= start) {
      throw new Error('slot must end after it starts');
    }
    if (this._slots.some((slot) => slot.overlaps(start, end))) {
      throw new Error('slot overlaps an existing booking');
    }
    this._slots.push(new RoomSlot(productionId, start, end));
  }

  release(productionId: string): void {
    this._slots = this._slots.filter((slot) => slot.productionId !== productionId);
  }
}
