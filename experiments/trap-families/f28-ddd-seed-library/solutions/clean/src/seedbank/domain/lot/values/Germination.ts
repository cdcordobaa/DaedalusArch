import { LibraryRefusal } from '../../LibraryRefusal';

/** Share of seeds that sprouted in the lot's last germination test, in whole percent. */
export class Germination {
  private constructor(readonly percent: number) {}

  static of(percent: number): Germination {
    if (!Number.isInteger(percent) || percent < 0 || percent > 100) throw new LibraryRefusal(`germination must be a whole percent from 0 to 100, not ${String(percent)}`);
    return new Germination(percent);
  }
}
