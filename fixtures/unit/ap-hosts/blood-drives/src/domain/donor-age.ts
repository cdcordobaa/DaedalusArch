const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;

export const MIN_DONOR_AGE = 18;
export const MAX_DONOR_AGE = 70;

/** Age in whole years on a given day; donors give blood from their 18th to their 71st birthday. */
export class DonorAge {
  readonly years: number;

  constructor(birthDate: Date, on: Date) {
    this.years = Math.floor((on.getTime() - birthDate.getTime()) / YEAR_MS);
  }

  isEligible(): boolean {
    return this.years >= MIN_DONOR_AGE && this.years <= MAX_DONOR_AGE;
  }
}
