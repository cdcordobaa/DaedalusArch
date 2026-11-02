import { LockerError } from './LockerError';

/** The six-digit code a resident types on the locker bank's keypad. */
export function parsePickupCode(value: string): string {
  if (!/^\d{6}$/.test(value)) throw new LockerError(`not a pickup code: ${value}`);
  return value;
}
