import { BerthingError } from '../../BerthingError';

/** One numbered berth on a pontoon and the longest boat it takes, in metres. */
export class Berth {
  private constructor(
    readonly number: number,
    readonly lengthM: number,
  ) {}

  static of(number: number, lengthM: number): Berth {
    if (!Number.isFinite(lengthM) || lengthM <= 0) throw new BerthingError('a berth length must be a positive number of metres');
    return new Berth(number, lengthM);
  }

  takes(boatLengthM: number): boolean {
    return boatLengthM <= this.lengthM;
  }
}
