import { LockerError } from './LockerError';

/** An apartment number such as 4B or 12A: digits then one letter. */
export function parseApartment(value: string): string {
  const clean = value.trim().toUpperCase();
  if (!/^\d{1,3}[A-Z]$/.test(clean)) throw new LockerError(`not an apartment: ${value}`);
  return clean;
}
