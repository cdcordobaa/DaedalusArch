import { RoomSlot } from './RoomSlot';

export class RehearsalRoom {
  private _slots: RoomSlot[] = [];

  constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  get slots(): readonly RoomSlot[] {
    return this._slots;
  }

  book(productionId: string, start: number, end: number): void {
    if (this._slots.some((slot) => slot.overlaps(start, end))) {
      throw new Error('slot overlaps an existing booking');
    }
    this._slots.push(new RoomSlot(productionId, start, end));
  }

  release(productionId: string): void {
    this._slots = this._slots.filter((slot) => slot.productionId !== productionId);
  }
}
