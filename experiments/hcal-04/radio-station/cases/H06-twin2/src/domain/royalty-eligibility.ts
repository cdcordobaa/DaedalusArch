import type { PlayReport } from './play-report';

export class RoyaltyEligibility {
  static readonly MINIMUM_SECONDS = 30;

  isRoyaltyBearing(report: PlayReport): boolean {
    return report.durationSeconds >= RoyaltyEligibility.MINIMUM_SECONDS;
  }
}
