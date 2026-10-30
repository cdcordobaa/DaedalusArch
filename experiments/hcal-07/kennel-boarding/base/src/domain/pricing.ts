import { RunSize } from './booking-status';

const NIGHTLY_RATE_CENTS: Record<RunSize, number> = { small: 3200, large: 4500 };
const DEPOSIT_SHARE = 0.3;

export function depositCents(run: RunSize, nights: number): number {
  return Math.round(NIGHTLY_RATE_CENTS[run] * nights * DEPOSIT_SHARE);
}
