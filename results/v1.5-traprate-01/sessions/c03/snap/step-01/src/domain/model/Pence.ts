import { CanteenError } from '../errors/CanteenError';

/** Money is held as whole pence. */
export type Pence = number;

/** Below this balance the parents get a letter. */
export const LOW_BALANCE: Pence = 300;

/** 240 -> 'GBP 2.40'. */
export const formatPence = (p: Pence): string => `GBP ${plainPence(p)}`;

/** 240 -> '2.40'. */
export const plainPence = (p: Pence): string => `${String(Math.floor(p / 100))}.${String(p % 100).padStart(2, '0')}`;

export function requirePositivePence(value: unknown, what: string): Pence {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) throw new CanteenError(`${what} must be a positive amount`);
  return value;
}
