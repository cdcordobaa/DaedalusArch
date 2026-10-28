import { LockerError } from './LockerError';

/** Compartment sizes, smallest first. A load fits any compartment of its size or larger. */
export type LockerSize = 'S' | 'M' | 'L';
const ORDER: readonly string[] = ['S', 'M', 'L'];

export function parseSize(value: string): LockerSize {
  if (!ORDER.includes(value)) throw new LockerError(`unknown size '${value}'`);
  return value as LockerSize;
}

export const sizeRank = (size: LockerSize): number => ORDER.indexOf(size);
export const fits = (load: LockerSize, compartment: LockerSize): boolean => sizeRank(compartment) >= sizeRank(load);
