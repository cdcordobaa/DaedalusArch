import { RunSize } from './booking-status';
import { CareLevel } from './care-level';

const NIGHTLY_RATE_CENTS: Record<RunSize, number> = { small: 3200, large: 4500 };
const DEPOSIT_SHARE = 0.3;

function careSurchargeCents(level: CareLevel): number {
  switch (level) {
    case 'STANDARD': return 0;
    case 'SENIOR': return 400;
    case 'MEDICATED': return 650;
    case 'POST_OP': return 900;
    case 'PUPPY': return 300;
  }
}

export function depositCents(run: RunSize, nights: number, care: CareLevel): number {
  return Math.round((NIGHTLY_RATE_CENTS[run] + careSurchargeCents(care)) * nights * DEPOSIT_SHARE);
}
