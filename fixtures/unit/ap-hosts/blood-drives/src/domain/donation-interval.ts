const DAY_MS = 24 * 60 * 60 * 1000;

/** Minimum days between two whole-blood donations, by sex as recorded at registration. */
export const MIN_INTERVAL_DAYS: Readonly<Record<string, number>> = { female: 112, male: 84, other: 112 };

export class DonationInterval {
  readonly lastDonation: Date | null;
  readonly minimumDays: number;

  constructor(lastDonation: Date | null, minimumDays: number) {
    this.lastDonation = lastDonation;
    this.minimumDays = minimumDays;
  }

  nextEligibleOn(): Date | null {
    return this.lastDonation === null ? null : new Date(this.lastDonation.getTime() + this.minimumDays * DAY_MS);
  }

  allowsDonationOn(day: Date): boolean {
    const next = this.nextEligibleOn();
    return next === null || day.getTime() >= next.getTime();
  }
}
