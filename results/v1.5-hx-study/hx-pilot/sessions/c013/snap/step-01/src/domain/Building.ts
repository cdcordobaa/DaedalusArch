import { LockerError } from './LockerError';

/** An apartment building with a bank of laundry lockers in its lobby. */
export class Building {
  private constructor(
    readonly id: string,
    readonly name: string,
  ) {}

  static register(id: string, name: string): Building {
    const clean = name.trim();
    if (clean === '') throw new LockerError('a building needs a name');
    return new Building(id, clean);
  }
}
