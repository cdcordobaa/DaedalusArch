import { LockerError } from './LockerError';
import { fits, type LockerSize } from './LockerSize';

export const MAX_BAY = 48;

/** One compartment of a building's locker bank, addressed by its bay number on the bank. */
export class Locker {
  private holding: string | null = null;
  private usable = true;

  private constructor(
    readonly id: string,
    readonly buildingId: string,
    readonly bay: number,
    readonly size: LockerSize,
  ) {}

  static install(id: string, buildingId: string, bay: number, size: LockerSize): Locker {
    if (!Number.isInteger(bay) || bay < 1 || bay > MAX_BAY) throw new LockerError(`not a bay number: ${String(bay)}`);
    return new Locker(id, buildingId, bay, size);
  }

  get inService(): boolean {
    return this.usable;
  }

  get free(): boolean {
    return this.holding === null;
  }

  get dropId(): string | null {
    return this.holding;
  }

  /** May a new load of this size go in now? */
  accepts(load: LockerSize): boolean {
    return this.usable && this.holding === null && fits(load, this.size);
  }

  fill(dropId: string): void {
    if (this.holding !== null) throw new LockerError(`locker ${this.id} is in use`);
    this.holding = dropId;
  }

  empty(): void {
    this.holding = null;
  }

  takeOutOfService(): void {
    this.usable = false;
  }

  returnToService(): void {
    this.usable = true;
  }
}
